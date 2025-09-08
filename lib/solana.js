const { Connection, Keypair, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, VersionedTransaction } = require("@solana/web3.js");
const axios = require("axios");
const bs58 = require("bs58");

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
      try {
        const secretKeyBytes = bs58.decode(process.env.PRIVATE_KEY);
        if (secretKeyBytes.length !== 64) {
          throw new Error(`Base58 secret key must decode to 64 bytes, got ${secretKeyBytes.length}`);
        }
        return Keypair.fromSecretKey(secretKeyBytes);
      } catch (bs58Error) {
        throw new Error(`Invalid private key format: JSON error (${jsonError.message}), Base58 error (${bs58Error.message})`);
      }
    }
  } catch (error) {
    throw new Error(`Invalid secret key: ${error.message}`);
  }
}

async function claimFeesForToken(tokenMint, connection, keypair, logToFile) {
  try {
    await logToFile(`Claiming fees for token ${tokenMint} with wallet ${keypair.publicKey.toBase58()} on devnet`);
    const initialBalance = await connection.getBalance(keypair.publicKey, "confirmed");
    const response = await axios.post("https://pumpportal.fun/api/trade-local", {
      publicKey: keypair.publicKey.toBase58(),
      action: "collectCreatorFee",
      priorityFee: 0.000001,
    });
    const messageBytes = Buffer.from(response.data, "base64");
    const message = VersionedTransaction.deserialize(messageBytes).message;
    const tx = new VersionedTransaction(message);
    tx.sign([keypair]);
    const signature = await connection.sendTransaction(tx, { preflightCommitment: "confirmed" });
    await connection.confirmTransaction(signature, "confirmed");
    const finalBalance = await connection.getBalance(keypair.publicKey, "confirmed");
    const txDetails = await connection.getTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
    const txFee = txDetails.meta.fee;
    const claimedLamports = (finalBalance - initialBalance) + txFee;
    const claimedSol = claimedLamports / LAMPORTS_PER_SOL;
    await logToFile(`Transaction confirmed: https://solscan.io/tx/${signature}?cluster=devnet`);
    await logToFile(`Claimed ${claimedSol.toFixed(6)} SOL on devnet`);
    return claimedSol;
  } catch (error) {
    await logToFile(`Unexpected error in claimFeesForToken on devnet: ${error.message}`);
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
      throw new Error(`No account info found for mint ${mintAddress} on mainnet`);
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
  const decimals = await getTokenDecimals(tokenMintAddress, logToFile);
  await logToFile(`Token decimals: ${decimals}`);
  let page = 1;
  const allHolders = [];
  while (true) {
    const payload = {
      jsonrpc: "2.0",
      id: "helius-test",
      method: "getTokenAccounts",
      params: {
        page: page,
        limit: 1000,
        mint: tokenMintAddress,
        displayOptions: {},
      },
    };
    try {
      const response = await axios.post(url, payload);
      if (response.status !== 200) {
        const errorMsg = `Error fetching holders from mainnet: ${response.status}, ${response.statusText}`;
        await logToFile(errorMsg);
        break;
      }
      const data = response.data;
      if (!data.result?.token_accounts?.length) {
        const msg = `No more results from mainnet. Total pages processed: ${page - 1}`;
        await logToFile(msg);
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
    } catch (error) {
      const errorMsg = `Error fetching page ${page} from mainnet: ${error.message}`;
      await logToFile(errorMsg);
      break;
    }
  }
  return allHolders;
}

async function validateMainnetAddress(connection, address, logToFile) {
  try {
    const pubkey = new PublicKey(address);
    const accountInfo = await connection.getAccountInfo(pubkey, "confirmed");
    const exists = !!accountInfo;
    await logToFile(`Validated address ${address} on devnet: ${exists ? "Exists" : "Does not exist"}`);
    return exists;
  } catch (error) {
    await logToFile(`Error validating address ${address} on devnet: ${error.message}`);
    return false;
  }
}

async function sendAirdrop(connection, keypair, recipients, logToFile) {
  const senderPubkey = keypair.publicKey;
  const TRANSACTION_FEE = 5000;
  const totalAmount = recipients.reduce((sum, { amount }) => sum + amount, 0);
  const balance = await connection.getBalance(senderPubkey, "confirmed");
  if (balance < totalAmount + TRANSACTION_FEE * recipients.length) {
    const errorMsg = `Insufficient funds on devnet. Have: ${balance / LAMPORTS_PER_SOL} SOL, Need: ${(totalAmount + TRANSACTION_FEE * recipients.length) / LAMPORTS_PER_SOL} SOL`;
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
      await logToFile(`Preparing to send ${amount / LAMPORTS_PER_SOL} SOL from ${senderPubkey} to ${address} on devnet`);
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
          await logToFile(`Transaction sent with signature: ${signature} to ${address} on devnet`);
          const confirmation = await connection.confirmTransaction(
            { signature, blockhash, lastValidBlockHeight },
            "confirmed"
          );
          if (confirmation.value.err) {
            throw new Error(`Transaction failed: ${confirmation.value.err}`);
          }
          await logToFile(`Airdrop successful! Sent ${amount / LAMPORTS_PER_SOL} SOL to ${address} on devnet`);
          success = true;
          break;
        } catch (error) {
          await logToFile(`Error on attempt ${attempt} for ${address} on devnet: ${error.message}`);
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }
      if (success) {
        totalSentLamports += amount;
      }
    } catch (error) {
      await logToFile(`Critical error sending to ${address} on devnet: ${error.message}`);
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