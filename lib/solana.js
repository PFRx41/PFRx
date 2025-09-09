const { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL, VersionedTransaction } = require("@solana/web3.js");
const bs58 = require("bs58");
const axios = require("axios");

async function initializeKeypair() {
  const secretKey = bs58.decode(process.env.PRIVATE_KEY);
  return Keypair.fromSecretKey(secretKey);
}

async function claimFeesForToken(tokenMint, connection, keypair, logToFile) {
  try {
    await logToFile(`Claiming creator fees for token ${tokenMint} via Pump Portal`);
    const response = await axios.post(`https://pumpportal.fun/api/trade-local`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        publicKey: keypair.publicKey.toBase58(),
        action: "collectCreatorFee",
        mint: tokenMint,
        priorityFee: 0.000001,
      })
    });

    if (response.status === 200) {
      const data = await response.arrayBuffer();
      const tx = VersionedTransaction.deserialize(new Uint8Array(data));
      tx.sign([keypair]);
      const signature = await connection.sendTransaction(tx, { commitment: "confirmed" });
      await connection.confirmTransaction(signature, "confirmed");
      await logToFile(`Claimed fees for ${tokenMint} (tx: https://solscan.io/tx/${signature})`);
      // Fetch balance change to estimate claimed SOL
      const balanceAfter = await connection.getBalance(keypair.publicKey, "confirmed");
      // Note: Actual claimed SOL may need to be fetched from transaction logs
      return balanceAfter / LAMPORTS_PER_SOL; // Placeholder, adjust as needed
    } else {
      await logToFile(`Failed to generate fee claiming transaction: ${response.statusText}`);
      return 0;
    }
  } catch (error) {
    await logToFile(`Error in claimFeesForToken: ${error.message}`);
    return 0; // Continue airdrop even if fee claiming fails
  }
}

async function fetchTokenHolders(tokenMint, logToFile) {
  try {
    const response = await axios.post(process.env.HELIUS_RPC_URL, {
      jsonrpc: "2.0",
      id: 1,
      method: "getTokenAccounts",
      params: {
        mint: tokenMint,
        programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
      },
    });
    const holders = response.data.result.map((account) => ({
      holder_address: account.owner,
      balance: parseInt(account.amount) / 1_000_000, // Adjust for decimals
      token_account: account.address,
    }));
    await logToFile(`Fetched ${holders.length} token holders for mint ${tokenMint}`);
    return holders;
  } catch (error) {
    await logToFile(`Error fetching token holders: ${error.message}`);
    throw error;
  }
}

async function validateMainnetAddress(connection, address, logToFile) {
  try {
    const publicKey = new PublicKey(address);
    const balance = await connection.getBalance(publicKey, "confirmed");
    await logToFile(`Validated address ${address} with balance ${balance / LAMPORTS_PER_SOL} SOL`);
    return balance >= 0; // Address exists if balance query succeeds
  } catch (error) {
    await logToFile(`Invalid address ${address}: ${error.message}`);
    return false;
  }
}

async function sendAirdrop(connection, keypair, recipients, logToFile) {
  let totalLamports = 0;
  for (const recipient of recipients) {
    try {
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: keypair.publicKey,
          toPubkey: new PublicKey(recipient.address),
          lamports: recipient.amount,
        })
      );
      const signature = await sendAndConfirmTransaction(connection, transaction, [keypair], { commitment: "confirmed" });
      await logToFile(`Airdropped ${recipient.amount / LAMPORTS_PER_SOL} SOL to ${recipient.address} (tx: https://solscan.io/tx/${signature})`);
      totalLamports += recipient.amount;
    } catch (error) {
      await logToFile(`Failed to airdrop to ${recipient.address}: ${error.message}`);
    }
  }
  return totalLamports;
}

module.exports = {
  initializeKeypair,
  claimFeesForToken,
  fetchTokenHolders,
  validateMainnetAddress,
  sendAirdrop,
};