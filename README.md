# Solana Fair Airdrop System For Pump.Fun

This is a web app built with Next.js to manage and display a Solana token airdrop on the mainnet. It collects token holders from the Solana mainnet, gathers creator fees using the Pump Portal API, and shares SOL with holders who have enough tokens and a fee wallet. The distribution uses a fair method called *adjusted logarithmic weighting* (explained below) to balance rewards, ensuring holders with more tokens (like Bob with 10,000) get more SOL than those with fewer (like Alice with 1,000), without letting the biggest holders take everything. The app features a dashboard that updates live with Pusher, supports dark mode, and saves airdrop history to an AWS S3 bucket in `dashboard_data.xlsx`.

## Features

- **Token Holder Scraping**: Gets the list of people holding your token from Solana mainnet using Helius.
- **Fee Claiming**: Collects creator fees for your token using the Pump Portal API (`https://pumpportal.fun/api/trade-local`).
- **Airdrop Distribution**: Sends SOL to holders with enough tokens (default: 100,000) and a fee wallet (default: 90% to holders, 10% to fee wallet).
- **Adjusted Logarithmic Weighting**: Shares SOL fairly so larger holders get more, but not way more than smaller ones (see below for examples).
- **Real-Time Updates**: Updates the dashboard instantly using Pusher when an airdrop happens.
- **S3 Storage**: Saves airdrop history to `dashboard_data.xlsx` in an AWS S3 bucket.
- **Dark Mode**: Switch between light and dark themes, saved in your browser.
- **Customizable Settings**: Control airdrop rules with environment variables:
  - `MINIMUM_TOKEN_BALANCE`: Minimum tokens to qualify (default: 100,000).
  - `MINIMUM_WALLET_BALANCE_SOL`: Minimum SOL in the airdrop wallet to start (default: 0.2 SOL).
  - `HOLDERS_PERCENTAGE` and `FEE_WALLET_PERCENTAGE`: How SOL is split (default: 90/10).
- **Logging**: Writes details to `airdrop_log.txt` and holder info to `token_holders.txt` (cleared each cycle).

### What is Adjusted Logarithmic Weighting?
Adjusted logarithmic weighting is a way to give out SOL in the airdrop so it’s fair. It makes sure people with more tokens (like Bob with 10,000) get more SOL than those with fewer (like Alice with 1,000), but it doesn’t let someone with millions of tokens take almost everything. It uses a math trick called a logarithm to “squash” big differences in token amounts, then adjusts it to reward larger holders a bit more.

**How It Works (Simple Version)**:
- Each holder’s token amount gets turned into a “weight.” For example, 1,000 tokens might give a weight of 6, and 10,000 tokens a weight of 8.
- The SOL is split based on these weights, so someone with a higher weight gets more SOL.
- It’s fairer than giving SOL exactly proportional to tokens, which would give almost all the SOL to the biggest holders.

**Example: 20 SOL Airdrop with 10 Holders**:
You have 20 SOL to share. The fee wallet gets 10% (2 SOL), leaving 18 SOL for holders. There are 10 holders with different token amounts:
- Holder 1: 1,000 tokens (like Alice)
- Holder 2: 5,000 tokens
- Holder 3: 10,000 tokens (like Bob)
- Holder 4: 50,000 tokens
- Holder 5: 100,000 tokens
- Holder 6: 200,000 tokens
- Holder 7: 500,000 tokens
- Holder 8: 1,000,000 tokens
- Holder 9: 2,000,000 tokens
- Holder 10: 5,000,000 tokens

**How SOL is Split**:
- The app gives each holder a weight based on their tokens:
  - Holder 1: Weight = 6
  - Holder 2: Weight ≈ 7.4
  - Holder 3: Weight = 8
  - Holder 4: Weight ≈ 9.4
  - Holder 5: Weight = 10
  - Holder 6: Weight ≈ 10.6
  - Holder 7: Weight ≈ 11.4
  - Holder 8: Weight = 12
  - Holder 9: Weight ≈ 12.6
  - Holder 10: Weight ≈ 13.4
- Total weight ≈ 100.8
- The 18 SOL is split:
  - Holder 1: (6 / 100.8) * 18 ≈ 1.07 SOL
  - Holder 2: (7.4 / 100.8) * 18 ≈ 1.32 SOL
  - Holder 3: (8 / 100.8) * 18 ≈ 1.43 SOL
  - Holder 4: (9.4 / 100.8) * 18 ≈ 1.68 SOL
  - Holder 5: (10 / 100.8) * 18 ≈ 1.79 SOL
  - Holder 6: (10.6 / 100.8) * 18 ≈ 1.89 SOL
  - Holder 7: (11.4 / 100.8) * 18 ≈ 2.04 SOL
  - Holder 8: (12 / 100.8) * 18 ≈ 2.14 SOL
  - Holder 9: (12.6 / 100.8) * 18 ≈ 2.25 SOL
  - Holder 10: (13.4 / 100.8) * 18 ≈ 2.39 SOL
  - Fee Wallet: 2 SOL

**Why This is Fair**:
- Holder 3 (like Bob) gets more (1.43 SOL) than Holder 1 (like Alice, 1.07 SOL) because they hold 10x more tokens.
- Holder 10 (with 5,000,000 tokens) gets the most (2.39 SOL), but not 5,000x more than Holder 1, keeping it fair for smaller holders.

## Prerequisites

- **Node.js**: Version 16 or higher (download from [nodejs.org](https://nodejs.org)).
- **Git**: To clone the project (install from [git-scm.com](https://git-scm.com)).
- **Solana CLI**: To create wallets and check SOL balances (install from [docs.solana.com](https://docs.solana.com)).
- **AWS Account**: For saving `dashboard_data.xlsx` to S3.
- **Pusher Account**: For live dashboard updates (sign up at [pusher.com](https://pusher.com)).
- **Vercel Account**: For hosting the app (sign up at [vercel.com](https://vercel.com)).
- **Mainnet Wallet**: A Solana wallet with enough SOL for airdrops and fees.

## Setup

### 1. Clone the Project
```bash
git clone https://github.com/PFRx41/PFRx.git
cd PFRx
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Set Up Environment Variables
Create a `.env.local` file in the project folder (`C:\Users\Administrator\Desktop\Rewards`). Add these settings, replacing placeholders with your real values:

```env
# Solana settings
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
HELIUS_RPC_URL=your_helius_mainnet_rpc_url
PRIVATE_KEY=your_mainnet_private_key
TOKEN_MINT_ADDRESS=your_mainnet_token_mint_address
FEE_WALLET_ADDRESS=your_mainnet_fee_wallet_address

# Airdrop settings
HOLDERS_PERCENTAGE=90
FEE_WALLET_PERCENTAGE=10
MINIMUM_TOKEN_BALANCE=100000
MINIMUM_WALLET_BALANCE_SOL=0.2

# AWS S3 settings
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_REGION=your_aws_region
AWS_S3_BUCKET=your_s3_bucket_name

# Pusher settings
PUSHER_APP_ID=your_pusher_app_id
PUSHER_KEY=your_pusher_key
PUSHER_SECRET=your_pusher_secret
PUSHER_CLUSTER=your_pusher_cluster
NEXT_PUBLIC_PUSHER_KEY=your_pusher_key
NEXT_PUBLIC_PUSHER_CLUSTER=your_pusher_cluster
```

**How to Fill This Out**:
- **Solana**:
  - **SOLANA_RPC_URL**: Use `https://api.mainnet-beta.solana.com` or a faster one from [QuickNode](https://www.quicknode.com).
  - **HELIUS_RPC_URL**: Sign up at [helius.dev](https://www.helius.dev) for mainnet token holder data.
  - **PRIVATE_KEY**: Create a mainnet wallet:
    ```bash
    solana-keygen new -o mainnet-keypair.json
    ```
    Copy the base58-encoded private key to `PRIVATE_KEY`.
  - **TOKEN_MINT_ADDRESS**: Your token’s mainnet address (e.g., `6bunJ76HV9SCDHkukezST3VKzQKJ8JtjTQQ92UD7pump`). Ensure your wallet can collect fees for it.
  - **FEE_WALLET_ADDRESS**: A mainnet wallet for fees (e.g., `AT1EFv9PqocDryKUcva39vjgH77GEC3JD8WW6gHdcw43`).
  - **Funding**: Send SOL to both wallets (airdrop and fee) from an exchange like Binance. Check balances:
    ```bash
    solana balance your_airdrop_wallet_address --url https://api.mainnet-beta.solana.com
    ```
    You need >0.2 SOL plus ~0.000005 SOL per transaction for fees.
- **AWS**:
  - Set up an S3 bucket and an IAM user with permissions to read/write objects (`s3:PutObject`, `s3:GetObject`, `s3:ListBucket`).
- **Pusher**:
  - Create an app at [pusher.com](https://pusher.com) and turn on **Client Events** in the app settings.
  - Use the same key for `PUSHER_KEY` and `NEXT_PUBLIC_PUSHER_KEY`, and cluster for `PUSHER_CLUSTER` and `NEXT_PUBLIC_PUSHER_CLUSTER`.

**Important**: Never share `.env.local` or commit it to Git. It’s ignored by `.gitignore`.

### 4. Run the App Locally
```bash
npm run dev
```
- Open `http://localhost:3000` in your browser to see the dashboard.
- Start an airdrop:
  ```bash
  curl -X POST http://localhost:3000/api/airdrop
  ```

## How to Use

### Dashboard
- **Where**: `http://localhost:3000` (local) or your Vercel URL (e.g., `https://your-project.vercel.app`).
- **What You See**:
  - Total SOL collected from fees and sent in airdrops.
  - A button to switch between light and dark mode (stays as you set it).
  - A table of past airdrops, updated live with Pusher.
- **Files Created**:
  - `airdrop_log.txt`: Shows what happened in each airdrop (cleared each time).
  - `token_holders.txt`: Lists token holders and who got SOL (cleared each time).
  - `dashboard_data.xlsx`: Saved to your S3 bucket with airdrop history.
  - Transactions: Check them on [Solscan](https://solscan.io) (e.g., `https://solscan.io/tx/your_transaction_signature`).

### Running an Airdrop
- **How**: Use the endpoint `POST /api/airdrop`.
- **What It Does**:
  1. Clears `airdrop_log.txt` and `token_holders.txt`.
  2. Collects fees for your token using Pump Portal.
  3. Gets token holders from mainnet.
  4. Checks if holders have at least 100,000 tokens and exist on mainnet.
  5. Checks if the airdrop wallet has >0.2 SOL.
  6. Splits SOL: 10% to the fee wallet, 90% to holders using adjusted logarithmic weighting.
  7. Saves data to S3 and updates the dashboard with Pusher.
- **Trigger Locally**:
  ```bash
  curl -X POST http://localhost:3000/api/airdrop
  ```
- **Trigger on Vercel**:
  ```bash
  curl -X POST https://your-project.vercel.app/api/airdrop
  ```

## Mainnet Deployment Notes
- **Fee Claiming**:
  - Uses Pump Portal API (`https://pumpportal.fun/api/trade-local`) to collect creator fees.
  - Ensure the airdrop wallet (`PRIVATE_KEY`) is the creator or fee recipient for `TOKEN_MINT_ADDRESS`.
  - Logs show transaction signatures: `https://solscan.io/tx/your_transaction_signature`.
- **Wallet Funding**:
  - Fund the airdrop wallet with >0.2 SOL (plus fees):
    ```bash
    solana balance your_airdrop_wallet_address --url https://api.mainnet-beta.solana.com
    ```
  - Fund the fee wallet if needed:
    ```bash
    solana balance your_fee_wallet_address --url https://api.mainnet-beta.solana.com
    ```
- **RPC**:
  - Use a reliable mainnet RPC (e.g., QuickNode or Helius) to avoid rate limits.
  - Test `HELIUS_RPC_URL` for token holder scraping:
    ```bash
    curl -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"getTokenAccounts","params":{"mint":"your_token_mint"}}' your_helius_rpc_url
    ```

## Vercel Deployment
1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Update for mainnet with adjusted logarithmic weighting"
   git push origin main
   ```
2. **Configure Vercel**:
   - Link the repository (`https://github.com/PFRx41/PFRx.git`) in Vercel.
   - Add all `.env.local` variables in Vercel’s dashboard (Settings > Environment Variables).
   - Ensure `vercel.json` is present:
     ```json
     {
       "crons": [
         {
           "path": "/api/airdrop",
           "schedule": "*/5 * * * *",
           "method": "POST"
         }
       ]
     }
     ```
3. **Deploy**: Vercel auto-deploys on push. Check build logs in the Vercel dashboard.
4. **Test**: Visit the Vercel URL and trigger the airdrop endpoint.

## Troubleshooting

- **Fee Claiming Fails**:
  - Check `airdrop_log.txt` for:
    ```
    Failed to generate fee claiming transaction: <error>
    ```
  - Verify `TOKEN_MINT_ADDRESS` and airdrop wallet authority with Pump Portal.
  - Test the API manually:
    ```bash
    curl -X POST -H "Content-Type: application/json" -d '{"publicKey":"your_wallet_public_key","action":"collectCreatorFee","mint":"your_token_mint","priorityFee":0.000001}' https://pumpportal.fun/api/trade-local
    ```
- **Few Qualified Holders**:
  - Check `token_holders.txt` for holder counts.
  - Lower `MINIMUM_TOKEN_BALANCE` (e.g., 50000) in `.env.local` for testing.
  - Verify `HELIUS_RPC_URL` functionality.
- **Insufficient SOL**:
  - Check wallet balance:
    ```bash
    solana balance your_airdrop_wallet_address --url https://api.mainnet-beta.solana.com
    ```
  - Fund via an exchange.
- **Push Fails**:
  - Ensure no large files (>100 MB):
    ```bash
    git ls-files | xargs ls -lh | awk '$5 ~ /[0-9]+M/ {print $9, $5}'
    ```
  - Ensure no secrets in `.env.local`:
    ```bash
    git ls-files | grep .env.local
    ```
    Remove with:
    ```bash
    git filter-repo --path .env.local --invert-paths --force
    ```
- **Vercel Build Fails**:
  - Check build logs for missing variables or dependencies.
  - Ensure `npm install` runs locally without errors.
- **Other Issues**:
  - **Dark Mode**: Check console (F12 > Console) for `Toggling dark mode to: true`.
  - **Pusher**: Verify credentials and connection logs in Pusher dashboard.
  - **S3**: Ensure IAM permissions (`s3:PutObject`, `s3:GetObject`, `s3:ListBucket`).

## License
MIT License. See [LICENSE](LICENSE) for details.
