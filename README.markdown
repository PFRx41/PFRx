# Solana Airdrop System for Pump.fun

This project is a Next.js-based web application for managing and visualizing a Solana token airdrop cycle. It scrapes token holders from the Solana mainnet, validates them on devnet, and distributes SOL to qualified holders (with a configurable minimum token balance) and a fee wallet using logarithmic weighting. The dashboard displays airdrop history, total fees claimed, and total SOL distributed, with real-time updates via Pusher, dark mode support, and data persistence to AWS S3.

## Features

- **Token Holder Scraping**: Fetches token holders for a specified token mint from Solana mainnet using Helius RPC.
- **Airdrop Distribution**: Distributes SOL on devnet to qualified holders (≥ configurable token balance) and a fee wallet (90/10% split by default).
- **Logarithmic Weighting**: Allocates SOL to holders based on the logarithm of their token balance.
- **Real-Time Updates**: Uses Pusher to update the dashboard in real-time when airdrops occur.
- **S3 Persistence**: Saves airdrop history to `dashboard_data.xlsx` in an AWS S3 bucket.
- **Dark Mode**: Toggleable light/dark theme with persistence via `localStorage`.
- **Configurable Parameters**: Set via environment variables:
  - `MINIMUM_TOKEN_BALANCE`: Minimum tokens required to qualify (default: 100,000).
  - `MINIMUM_WALLET_BALANCE_SOL`: Minimum SOL in the airdrop wallet to proceed (default: 0.2).
  - `HOLDERS_PERCENTAGE` and `FEE_WALLET_PERCENTAGE`: Distribution split (default: 90/10).
- **Logging**: Outputs cycle details to `airdrop_log.txt` and holder data to `token_holders.txt` (cleared each cycle).
- **Bypassed Fee Claiming**: Fee claiming is disabled on devnet for testing (re-enable for mainnet).

## Prerequisites

- **Node.js**: Version 16 or higher.
- **Git**: For cloning the repository.
- **Solana CLI**: For funding devnet wallets (optional for testing).
- **AWS Account**: For S3 storage of `dashboard_data.xlsx`.
- **Pusher Account**: For real-time dashboard updates.
- **Vercel Account**: For deployment (optional).

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
SOLANA_RPC_URL=https://api.devnet.solana.com
HELIUS_RPC_URL=your_helius_mainnet_rpc_url
PRIVATE_KEY=your_devnet_private_key
TOKEN_MINT_ADDRESS=your_mainnet_token_mint_address
FEE_WALLET_ADDRESS=your_devnet_fee_wallet_address

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
  - Get `HELIUS_RPC_URL` from [https://www.helius.dev](https://www.helius.dev).
  - Generate `PRIVATE_KEY` for the airdrop wallet using `solana-keygen new`.
  - Use a valid mainnet `TOKEN_MINT_ADDRESS` (e.g., `6bunJ76HV9SCDHkukezST3VKzQKJ8JtjTQQ92UD7pump`).
  - Fund `FEE_WALLET_ADDRESS` and the airdrop wallet on devnet:
    ```bash
    solana airdrop 2 <airdrop_wallet_address> --url https://api.devnet.solana.com
    solana airdrop 2 <fee_wallet_address> --url https://api.devnet.solana.com
    ```
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
  - Transactions: View on `https://explorer.solana.com/tx/<signature>?cluster=devnet`.

### Airdrop Cycle
- **Endpoint**: `POST /api/airdrop`
- **Process**:
  1. Clears `airdrop_log.txt` and `token_holders.txt`.
  2. Fetches token holders for `TOKEN_MINT_ADDRESS` from mainnet.
  3. Validates holders on devnet (must exist and have ≥ `MINIMUM_TOKEN_BALANCE` tokens).
  4. Checks airdrop wallet balance (must be > `MINIMUM_WALLET_BALANCE_SOL`).
  5. Distributes SOL: `FEE_WALLET_PERCENTAGE` to `FEE_WALLET_ADDRESS`, `HOLDERS_PERCENTAGE` to qualified holders (logarithmic weighting).
  6. Saves data to S3 and emits Pusher updates.
- **Trigger Locally**:
  ```bash
  curl -X POST http://localhost:3000/api/airdrop
  ```
- **Trigger on Vercel**:
  ```bash
  curl -X POST https://your-project.vercel.app/api/airdrop
  ```

### Vercel Deployment
1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Update project"
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

- **Push Fails**:
  - **Large Files**: Ensure no files >100 MB are committed:
    ```bash
    git ls-files | xargs ls -lh | awk '$5 ~ /[0-9]+M/ {print $9, $5}'
    ```
    Remove with `git filter-repo --path <file> --invert-paths --force`.
  - **Secrets**: Never commit `.env.local`. If committed, remove from history:
    ```bash
    git filter-repo --path .env.local --invert-paths --force
    git push origin main --force
    ```
- **Dark Mode Fails**:
  - Check console (F12 > Console) for logs like `Toggling dark mode to: true`.
  - Ensure `tailwind.config.js` has `darkMode: "class"`.
  - Inspect `<html>` (F12 > Elements) for the `dark` class.
- **Real-Time Updates Fail**:
  - Verify Pusher credentials in `.env.local` and Vercel.
  - Check Pusher dashboard for connection logs.
- **S3 Issues**:
  - Ensure IAM permissions include `s3:PutObject`, `s3:GetObject`, `s3:ListBucket`.
  - Check `airdrop_log.txt` for S3 errors.
- **Few Qualified Holders**:
  - Only 10/293 holders qualified in tests due to devnet non-existence. For testing, bypass validation in `lib/solana.js`:
    ```javascript
    async function validateMainnetAddress(connection, address, logToFile) {
      await logToFile(`Skipping devnet validation for address ${address}`);
      return true;
    }
    ```

## Mainnet Deployment
- Re-enable `claimFeesForToken` in `pages/api/airdrop.js`:
  ```javascript
  const claimedSol = await claimFeesForToken(process.env.TOKEN_MINT_ADDRESS, connection, keypair, logToFile);
  ```
- Update `.env.local`:
  - Set `SOLANA_RPC_URL` to a mainnet RPC (e.g., `https://api.mainnet-beta.solana.com`).
  - Ensure `PRIVATE_KEY`, `TOKEN_MINT_ADDRESS`, and `FEE_WALLET_ADDRESS` are mainnet-compatible.
- Fund the airdrop wallet with sufficient SOL.

## License
MIT License. See [LICENSE](LICENSE) for details.
