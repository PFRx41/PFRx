# Solana Airdrop System for Pump.fun

This project is a Next.js-based web application for managing and visualizing a Solana token airdrop cycle on mainnet. It scrapes token holders from the Solana mainnet, claims creator fees via the Pump Portal API, and distributes SOL to qualified holders (with a configurable minimum token balance) and a fee wallet using logarithmic weighting. The dashboard displays airdrop history, total fees claimed, and total SOL distributed, with real-time updates via Pusher, dark mode support, and data persistence to AWS S3.

## Features

- **Token Holder Scraping**: Fetches token holders for a specified token mint from Solana mainnet using Helius RPC.
- **Fee Claiming**: Claims creator fees for the token via the Pump Portal API (`https://pumpportal.fun/api/trade-local`).
- **Airdrop Distribution**: Distributes SOL on mainnet to qualified holders (≥ configurable token balance) and a fee wallet (90/10% split by default).
- **Logarithmic Weighting**: Allocates SOL to holders based on the logarithm of their token balance.
- **Real-Time Updates**: Uses Pusher to update the dashboard in real-time when airdrops occur.
- **S3 Persistence**: Saves airdrop history to `dashboard_data.xlsx` in an AWS S3 bucket.
- **Dark Mode**: Toggleable light/dark theme with persistence via `localStorage`.
- **Configurable Parameters**: Set via environment variables:
  - `MINIMUM_TOKEN_BALANCE`: Minimum tokens required to qualify (default: 100,000).
  - `MINIMUM_WALLET_BALANCE_SOL`: Minimum SOL in the airdrop wallet to proceed (default: 0.2).
  - `HOLDERS_PERCENTAGE` and `FEE_WALLET_PERCENTAGE`: Distribution split (default: 90/10).
- **Logging**: Outputs cycle details to `airdrop_log.txt` and holder data to `token_holders.txt` (cleared each cycle).

## Prerequisites

- **Node.js**: Version 16 or higher.
- **Git**: For cloning the repository.
- **Solana CLI**: For generating keypairs and checking balances on mainnet.
- **AWS Account**: For S3 storage of `dashboard_data.xlsx`.
- **Pusher Account**: For real-time dashboard updates.
- **Vercel Account**: For deployment.
- **Mainnet Wallet**: Funded with sufficient SOL for airdrops and transaction fees.

## Setup

### 1. Clone the Repository
```bash
git clone https://github.com/PFRx41/PFRx.git
cd PFRx
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create a `.env.local` file in the project root (`C:\Users\Administrator\Desktop\Rewards` or equivalent) with the following variables. Replace placeholders with your actual values.

```env
# Solana configuration
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
HELIUS_RPC_URL=your_helius_mainnet_rpc_url
PRIVATE_KEY=your_mainnet_private_key
TOKEN_MINT_ADDRESS=your_mainnet_token_mint_address
FEE_WALLET_ADDRESS=your_mainnet_fee_wallet_address

# Airdrop parameters
HOLDERS_PERCENTAGE=90
FEE_WALLET_PERCENTAGE=10
MINIMUM_TOKEN_BALANCE=100000
MINIMUM_WALLET_BALANCE_SOL=0.2

# AWS S3 configuration
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_REGION=your_aws_region
AWS_S3_BUCKET=your_s3_bucket_name

# Pusher configuration
PUSHER_APP_ID=your_pusher_app_id
PUSHER_KEY=your_pusher_key
PUSHER_SECRET=your_pusher_secret
PUSHER_CLUSTER=your_pusher_cluster
NEXT_PUBLIC_PUSHER_KEY=your_pusher_key
NEXT_PUBLIC_PUSHER_CLUSTER=your_pusher_cluster
```

**Notes**:
- **Solana**:
  - **SOLANA_RPC_URL**: Use `https://api.mainnet-beta.solana.com` or a premium provider (e.g., QuickNode) for reliability.
  - **HELIUS_RPC_URL**: Obtain from [https://www.helius.dev](https://www.helius.dev) for mainnet token holder scraping.
  - **PRIVATE_KEY**: Generate a mainnet keypair:
    ```bash
    solana-keygen new -o mainnet-keypair.json
    ```
    Copy the base58-encoded private key to `PRIVATE_KEY`.
  - **TOKEN_MINT_ADDRESS**: Mainnet token mint (e.g., `6bunJ76HV9SCDHkukezST3VKzQKJ8JtjTQQ92UD7pump`). Ensure the airdrop wallet is the creator or fee recipient.
  - **FEE_WALLET_ADDRESS**: Mainnet wallet for fees (e.g., `AT1EFv9PqocDryKUcva39vjgH77GEC3JD8WW6gHdcw43`).
  - **Funding**: Fund both wallets with SOL:
    ```bash
    solana balance <airdrop_wallet_address> --url https://api.mainnet-beta.solana.com
    ```
    Transfer SOL from an exchange (e.g., Binance) to exceed `MINIMUM_WALLET_BALANCE_SOL` (0.2 SOL) plus fees (~0.000005 SOL per transaction).
- **AWS**:
  - Create an S3 bucket and IAM user with `s3:PutObject`, `s3:GetObject`, and `s3:ListBucket` permissions.
- **Pusher**:
  - Sign up at [https://pusher.com](https://pusher.com), create a Channels app, and enable **Client Events** in Settings.
  - Use the same `PUSHER_KEY` and `NEXT_PUBLIC_PUSHER_KEY`, and `PUSHER_CLUSTER` and `NEXT_PUBLIC_PUSHER_CLUSTER`.

**Security Warning**: Never commit `.env.local` to Git. It is excluded by `.gitignore`.

### 4. Run Locally
```bash
npm run dev
```
- Visit `http://localhost:3000` to view the dashboard.
- Trigger an airdrop cycle:
  ```bash
  curl -X POST http://localhost:3000/api/airdrop
  ```

## Usage

### Dashboard
- **URL**: `http://localhost:3000` (local) or your Vercel URL (e.g., `https://your-project.vercel.app`).
- **Features**:
  - View total fees claimed and SOL airdropped.
  - Toggle dark/light mode (persists in `localStorage`).
  - See airdrop history in a table, updated in real-time via Pusher.
- **Outputs**:
  - `airdrop_log.txt`: Logs cycle details (cleared each cycle).
  - `token_holders.txt`: Lists token holders and distribution (cleared each cycle).
  - `dashboard_data.xlsx`: Persisted in S3, containing airdrop history.
  - Transactions: View on `https://solscan.io/tx/<signature>` (mainnet).

### Airdrop Cycle
- **Endpoint**: `POST /api/airdrop`
- **Process**:
  1. Clears `airdrop_log.txt` and `token_holders.txt`.
  2. Claims creator fees for `TOKEN_MINT_ADDRESS` via Pump Portal API.
  3. Fetches token holders for `TOKEN_MINT_ADDRESS` from mainnet.
  4. Validates holders on mainnet (must exist and have ≥ `MINIMUM_TOKEN_BALANCE` tokens).
  5. Checks airdrop wallet balance (must be > `MINIMUM_WALLET_BALANCE_SOL`).
  6. Distributes SOL: `FEE_WALLET_PERCENTAGE` to `FEE_WALLET_ADDRESS`, `HOLDERS_PERCENTAGE` to qualified holders (logarithmic weighting).
  7. Saves data to S3 and emits Pusher updates.
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
  - Uses Pump Portal API (`https://pumpportal.fun/api/trade-local`) to claim creator fees.
  - Ensure the airdrop wallet (`PRIVATE_KEY`) is the creator or fee recipient for `TOKEN_MINT_ADDRESS`.
  - Logs show transaction signatures: `https://solscan.io/tx/<signature>`.
- **Wallet Funding**:
  - Fund the airdrop wallet with >0.2 SOL (plus fees):
    ```bash
    solana balance <airdrop_wallet_address> --url https://api.mainnet-beta.solana.com
    ```
  - Fund the fee wallet if needed:
    ```bash
    solana balance <fee_wallet_address> --url https://api.mainnet-beta.solana.com
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
   git commit -m "Update for mainnet"
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
    solana balance <airdrop_wallet_address> --url https://api.mainnet-beta.solana.com
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
