# 🚀 Setup NFT.Storage API Key

## Step 1: Sign up for NFT.Storage (FREE)

1. Go to: **https://nft.storage**
2. Click **"Sign Up"** (no credit card required)
3. Verify email

## Step 2: Generate API Key

1. Login to NFT.Storage dashboard
2. Click **"API Keys"** in sidebar
3. Click **"+ New Key"** button
4. Enter name: `Mystery Box DApp`
5. Click **"Create"**
6. **Copy the API key** (starts with `eyJhbG...`)

## Step 3: Add to .env file

1. Copy `.env.example` → `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and paste your API key:
   ```env
   NFT_STORAGE_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your_actual_key_here
   ```

3. Save file

## Step 4: Test IPFS Upload

Run test script to verify:
```bash
node services/testNftService.js
```

Expected output:
```
✅ IPFS Upload Successful!
📦 NFT Data:
   Token ID: 99999
   Name: Golden Dragon #99999
   Rarity: Legendary
🔗 IPFS URIs:
   Metadata: ipfs://bafyrei...
   Image: ipfs://bafybe...
```

## Troubleshooting

**Error: "NFT.Storage client not initialized"**
- Check `.env` file exists in `src/backend/`
- Verify `NFT_STORAGE_API_KEY=` has your actual key
- Restart node script

**Error: "IPFS upload failed: 401 Unauthorized"**
- API key is invalid
- Generate new API key from dashboard

**Error: "IPFS upload failed: Network error"**
- Check internet connection
- Try again (NFT.Storage may be temporarily down)

## Free Tier Limits

- ✅ **UNLIMITED storage** (yes, really!)
- ✅ **UNLIMITED bandwidth**
- ✅ Files stored permanently on IPFS + Filecoin
- ✅ No credit card ever needed

Perfect for NFT projects! 🎉
