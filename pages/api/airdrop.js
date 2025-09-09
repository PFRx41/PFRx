const { Connection, LAMPORTS_PER_SOL } = require("@solana/web3.js");
const fs = require("fs").promises;
const path = require("path");
const Pusher = require("pusher");
const { initializeKeypair, claimFeesForToken, fetchTokenHolders, validateMainnetAddress, sendAirdrop } = require("../../lib/solana");
const { appendToExcel } = require("../../lib/excel");

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  let keypair;
  try {
    keypair = await initializeKeypair();
  } catch (error) {
    await logToFile(`Invalid secret key: ${error.message}`);
    return res.status(500).json({ error: `Invalid secret key: ${error.message}` });
  }

  async function logToFile(message, logFile = path.join(process.cwd(), "airdrop_log.txt")) {
    const timestamp = new Date().toISOString().replace(/T/, " ").replace(/\..+/, "");
    try {
      await fs.appendFile(logFile, `[${timestamp}] ${message}\n`);
    } catch (err) {
      console.error(`Failed to write to log file ${logFile}: ${err.message}`);
      throw err;
    }
  }

  try {
    // Clear airdrop log at the start of each cycle
    const logFilePath = path.join(process.cwd(), "airdrop_log.txt");
    await fs.writeFile(logFilePath, "");
    await logToFile(`Starting airdrop cycle (holder scraping on mainnet, airdrop on devnet). Project directory: ${process.cwd()}`);

    // Validate percentage environment variables
    const holdersPercentage = parseFloat(process.env.HOLDERS_PERCENTAGE) || 90;
    const feeWalletPercentage = parseFloat(process.env.FEE_WALLET_PERCENTAGE) || 10;
    if (holdersPercentage + feeWalletPercentage !== 100) {
      await logToFile(`Invalid percentages: HOLDERS_PERCENTAGE (${holdersPercentage}) + FEE_WALLET_PERCENTAGE (${feeWalletPercentage}) must equal 100`);
      return res.status(400).json({ error: `Invalid percentages: HOLDERS_PERCENTAGE (${holdersPercentage}) + FEE_WALLET_PERCENTAGE (${feeWalletPercentage}) must equal 100` });
    }

    // Bypass claimFeesForToken for devnet testing
    await logToFile(`Bypassing fee claiming for token ${process.env.TOKEN_MINT_ADDRESS} on devnet`);
    const claimedSol = 0; // await claimFeesForToken(process.env.TOKEN_MINT_ADDRESS, connection, keypair, logToFile);

    await logToFile("Fetching token holders from mainnet...");
    const holders = await fetchTokenHolders(process.env.TOKEN_MINT_ADDRESS, logToFile);
    const qualifiedHolders = [];
    const MINIMUM_TOKEN_BALANCE = 100000; // 100,000 tokens
    for (const holder of holders) {
      if (holder.balance >= MINIMUM_TOKEN_BALANCE && await validateMainnetAddress(connection, holder.holder_address, logToFile)) {
        qualifiedHolders.push(holder);
      }
    }
    const outputContent = [
      `Token Holders for Mint: ${process.env.TOKEN_MINT_ADDRESS} (fetched from mainnet)`,
      `Total Holders: ${holders.length}`,
      `Qualified Holders (on devnet, min ${MINIMUM_TOKEN_BALANCE} tokens): ${qualifiedHolders.length}`,
      "-".repeat(50),
      ...holders.map(
        (holder) => `Holder: ${holder.holder_address}, Balance: ${holder.balance}, Token Account: ${holder.token_account}, Qualified: ${qualifiedHolders.some(q => q.holder_address === holder.holder_address) ? "Yes" : "No"}`
      ),
    ].join("\n");
    const holdersFilePath = path.join(process.cwd(), "token_holders.txt");
    await fs.writeFile(holdersFilePath, outputContent);
    await logToFile(`Saved ${holders.length} token holders (${qualifiedHolders.length} qualified) to ${holdersFilePath}`);
    const balance = await connection.getBalance(keypair.publicKey, "confirmed");
    await logToFile(`Devnet wallet balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    let airdroppedLamports = 0;
    const MINIMUM_BALANCE = 0.2 * LAMPORTS_PER_SOL;
    if (balance > MINIMUM_BALANCE) {
      const distributableLamports = Math.floor(balance - MINIMUM_BALANCE);
      await logToFile(`Distributable amount: ${distributableLamports / LAMPORTS_PER_SOL} SOL`);
      const feeWalletValid = await validateMainnetAddress(connection, process.env.FEE_WALLET_ADDRESS, logToFile);
      if (!feeWalletValid) {
        await logToFile(`Fee wallet ${process.env.FEE_WALLET_ADDRESS} does not exist on devnet`);
        return res.status(400).json({ error: `Fee wallet ${process.env.FEE_WALLET_ADDRESS} does not exist on devnet` });
      }
      const feeAmount = Math.floor(distributableLamports * (feeWalletPercentage / 100));
      let holdersAmount = distributableLamports - feeAmount;
      const holdersCount = qualifiedHolders.length;
      const recipients = [];
      let weights = [];
      if (feeAmount > 0) {
        recipients.push({ address: process.env.FEE_WALLET_ADDRESS, amount: feeAmount });
      }
      if (holdersCount > 0 && holdersAmount > 0) {
        weights = qualifiedHolders.map(holder => Math.log10(holder.balance + 1));
        const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
        if (totalWeight <= 0) {
          await logToFile("No valid weights for holders, sending all to fee wallet");
          recipients[0].amount += holdersAmount;
          holdersAmount = 0;
        } else {
          for (let i = 0; i < qualifiedHolders.length; i++) {
            const holder = qualifiedHolders[i];
            const weight = weights[i];
            const amount = Math.floor((weight / totalWeight) * holdersAmount);
            if (amount > 0) {
              recipients.push({ address: holder.holder_address, amount });
            }
          }
          const totalHoldersAmount = recipients.slice(1).reduce((sum, r) => sum + r.amount, 0);
          if (holdersAmount > totalHoldersAmount) {
            recipients[0].amount += holdersAmount - totalHoldersAmount;
          }
        }
      } else if (holdersAmount > 0) {
        recipients[0].amount += holdersAmount;
        holdersAmount = 0;
      }
      const distributionContent = [
        `\nAirdrop Distribution (on devnet, ${feeWalletPercentage}% fee wallet, ${holdersPercentage}% holders with logarithmic weighting)`,
        "-".repeat(50),
        `Fee Wallet (${process.env.FEE_WALLET_ADDRESS}): ${(recipients.find(r => r.address === process.env.FEE_WALLET_ADDRESS)?.amount || 0) / LAMPORTS_PER_SOL} SOL`,
        ...qualifiedHolders.map(
          (holder, i) => `Holder (${holder.holder_address}): ${(recipients.find(r => r.address === holder.holder_address)?.amount || 0) / LAMPORTS_PER_SOL} SOL (Weight: ${(weights[i] || 0).toFixed(4)})`
        ),
      ].join("\n");
      await fs.appendFile(holdersFilePath, distributionContent);
      await logToFile(distributionContent);
      if (recipients.length > 0) {
        airdroppedLamports = await sendAirdrop(connection, keypair, recipients, logToFile);
        if (airdroppedLamports > 0) {
          await logToFile("Airdrop completed successfully on devnet");
        } else {
          await logToFile("Airdrop failed on devnet, see logs for details");
        }
      } else {
        await logToFile("No valid recipients, skipping airdrop on devnet");
      }
    } else {
      await logToFile("Devnet wallet balance <= 0.2 SOL, skipping airdrop");
    }
    const airdroppedSol = airdroppedLamports / LAMPORTS_PER_SOL;
    await appendToExcel(new Date(), claimedSol, airdroppedSol);
    // Emit Pusher update
    const dashboardData = await require("../../lib/excel").readExcelData();
    await pusher.trigger("airdrop-channel", "dashboard-update", dashboardData);
    res.status(200).json({ message: "Airdrop cycle completed", claimedSol, airdroppedSol });
  } catch (error) {
    await logToFile(`Error in airdrop loop: ${error.message}`);
    res.status(500).json({ error: `Error in airdrop loop: ${error.message}` });
  }
}