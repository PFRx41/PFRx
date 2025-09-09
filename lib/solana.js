const { Connection, Keypair, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, VersionedTransaction } = require("@solana/web3.js");
const axios = require("axios");

async function initializeKeypair() {
  try {
    try {
      const secretKeyArray = JSON.parse(process.env.PRIVATE_KEY);
      const secretKeyBytes = Uint8Array.from(secretKeyArray);
      if (secretKeyBytes.length !== 64) {
        throw new Error(`Secret key must be 64 bytes, got ${secretKeyBytes.length}`);
      }
      return Keypair.fromSecretKey(secretKeyBytes);
    } catch (jsonError) {
      throw new Error(`Invalid private key format: JSON error (${jsonError.message})`);
    }
  } catch (error) {
    throw new Error(`Invalid secret key: ${error.message}`);
  }
}

async function claimFeesForToken(tokenMint, connection, keypair, logToFile) {
  try {
    await logToFile(`Claiming fees for token ${tokenMint} with wallet ${keypair.publicKey.toBase58()} on mainnet`);
    const initialBalance = await connection.getBalance(keypair.publicKey, "confirmed");
    const response = await axios.post("https://pumpportal.fun/api/trade-local", {
      publicKey: keypair.publicKey.toBase58(),
      action: "collectCreatorFee",
      mint: tokenMint, // Added for mainnet compatibility
      priorityFee: 0.000001,
    });
    if (response.status !== 200) {
      throw new Error(`Pump Portal API error: Status ${response.status}, Response: ${JSON.stringify(response.data)}`);
    }
    const messageBytes = Buffer.from(response.data, "base64");
    const message = VersionedTransaction.deserialize(messageBytes).message;
    const tx = new VersionedTransaction(message);
    tx.sign([keypair]);
    const signature = await connection.sendTransaction(tx, { preflightCommitment: "confirmed" });
    await connection.confirmTransaction(signature, "confirmed");
    const finalBalance = await connection.getBalance(keypair.publicKey, "confirmed");
    const txDetails = await connection.getTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
    const txFee = txDetails?.meta?.fee || 5000;
    const claimedLamports = (finalBalance - initialBalance) + txFee;
    const claimedSol = claimedLamports / LAMPORTS_PER_SOL;
    await logToFile(`Transaction confirmed: https://solscan.io/tx/${signature}`);
    await logToFile(`Claimed ${claimedSol.toFixed(6)} SOL on mainnet`);
    return claimedSol;
  } catch (error) {
    await logToFile(`Error in claimFeesForToken on mainnet: ${error.message}, Response: ${error.response ? JSON.stringify(error.response.data) : 'No response'}`);
    return 0;
  }
}

async function getTokenDecimals(mintAddress, logToFile) {
  const url = process.env.HELIUS_RPC_URL;
  const payload = {
    jsonrpc: "2.0",
    id: "get-account-info",
    method: "getAccountInfo",
    params: [mintAddress, { encoding: "jsonParsed" }],
  };
  try {
    const response = await axios.post(url, payload);
    if (!response.data.result?.value) {
      throw new Error(`No account info found for mint ${mintAddress} on mainnet: ${JSON.stringify(response.data)}`);
    }
    const decimals = response.data.result.value.data.parsed.info.decimals;
    await logToFile(`Fetched decimals: ${decimals} for mint ${mintAddress} on mainnet`);
    return decimals;
  } catch (error) {
    await logToFile(`Failed to fetch decimals for mint ${mintAddress} on mainnet: ${error.message}`);
    throw error;
  }
}

async function fetchTokenHolders(tokenMintAddress, logToFile) {
  const url = process.env.HELIUS_RPC_URL;
  try {
    const decimals = await getTokenDecimals(tokenMintAddress, logToFile);
    await logToFile(`Token decimals: ${decimals}`);
    let page = 1;
    const allHolders = [];
    while (true) {
      const payload = {
        jsonrpc: "2.0",
        id: `helius-test-${page}`,
        method: "getTokenAccounts",
        params: {
          page: page,
          limit: 1000,
          mint: tokenMintAddress,
          displayOptions: {},
        },
      };
      const response = await axios.post(url, payload);
      if (response.status !== 200) {
        throw new Error(`Helius API error: Status ${response.status}, Response: ${response.statusText}`);
      }
      const data = response.data;
      if (data.error) {
        throw new Error(`Helius API error: ${JSON.stringify(data.error)}`);
      }
      if (!data.result?.token_accounts?.length) {
        await logToFile(`No more results from mainnet. Total pages processed: ${page - 1}`);
        break;
      }
      await logToFile(`Processing page ${page} with ${data.result.token_accounts.length} accounts from mainnet`);
      for (const account of data.result.token_accounts) {
        if (account.amount > 0) {
          const balance = account.amount / Math.pow(10, decimals);
          allHolders.push({
            holder_address: account.owner,
            balance: balance,
            token_account: account.address,
          });
        }
      }
      page++;
    }
    await logToFile(`Fetched ${allHolders.length} token holders for mint ${tokenMintAddress} on mainnet`);
    return allHolders;
  } catch (error) {
    await logToFile(`Error fetching token holders for mint ${tokenMintAddress} on mainnet: ${error.message}`);
    return []; // Return empty array to allow airdrop to continue
  }
}

async function validateMainnetAddress(connection, address, logToFile) {
  try {
    const pubkey = new PublicKey(address);
    const accountInfo = await connection.getAccountInfo(pubkey, "confirmed");
    const exists = !!accountInfo;
    await logToFile(`Validated address ${address} on mainnet: ${exists ? "Exists" : "Does not exist"}`);
    return exists;
  } catch (error) {
    await logToFile(`Error validating address ${address} on mainnet: ${error.message}`);
    return false;
  }
}

async function sendAirdrop(connection, keypair, recipients, logToFile) {
  const senderPubkey = keypair.publicKey;
  const TRANSACTION_FEE = 5000;
  const totalAmount = recipients.reduce((sum, { amount }) => sum + amount, 0);
  const balance = await connection.getBalance(senderPubkey, "confirmed");
  if (balance < totalAmount + TRANSACTION_FEE * recipients.length) {
    const errorMsg = `Insufficient funds on mainnet. Have: ${balance / LAMPORTS_PER_SOL} SOL, Need: ${(totalAmount + TRANSACTION_FEE * recipients.length) / LAMPORTS_PER_SOL} SOL`;
    await logToFile(errorMsg);
    return 0;
  }
  let totalSentLamports = 0;
  for (const { address, amount } of recipients) {
    if (amount <= 0) {
      await logToFile(`Skipping zero or negative amount for ${address}`);
      continue;
    }
    try {
      await logToFile(`Preparing to send ${amount / LAMPORTS_PER_SOL} SOL from ${senderPubkey} to ${address} on mainnet`);
      let success = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
          const transaction = new Transaction({ recentBlockhash: blockhash, feePayer: senderPubkey }).add(
            SystemProgram.transfer({
              fromPubkey: senderPubkey,
              toPubkey: new PublicKey(address),
              lamports: Math.floor(amount),
            })
          );
          const signature = await connection.sendTransaction(transaction, [keypair], { skipPreflight: false });
          await logToFile(`Transaction sent with signature: ${signature} to ${address} on mainnet`);
          const confirmation = await connection.confirmTransaction(
            { signature, blockhash, lastValidBlockHeight },
            "confirmed"
          );
          if (confirmation.value.err) {
            throw new Error(`Transaction failed: ${confirmation.value.err}`);
          }
          await logToFile(`Airdrop successful! Sent ${amount / LAMPORTS_PER_SOL} SOL to ${address} on mainnet`);
          success = true;
          break;
        } catch (error) {
          await logToFile(`Error on attempt ${attempt} for ${address} on mainnet: ${error.message}`);
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }
      if (success) {
        totalSentLamports += amount;
      }
    } catch (error) {
      await logToFile(`Critical error sending to ${address} on mainnet: ${error.message}`);
    }
  }
  return totalSentLamports;
}

module.exports = {
  initializeKeypair,
  claimFeesForToken,
  fetchTokenHolders,
  validateMainnetAddress,
  sendAirdrop,
};