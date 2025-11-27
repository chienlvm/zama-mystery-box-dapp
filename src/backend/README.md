# 🎲 Mystery Box Backend

Complete backend infrastructure for the ZAMA Mystery Box DApp, featuring FHE-powered provably fair randomness on Ethereum Sepolia testnet.

## 🏗️ Architecture Components

This backend consists of three main components:

1. **📜 Smart Contracts** - Solidity contracts with FHE (Fully Homomorphic Encryption) on Zama fhEVM
2. **🔄 Relayer Service** - Off-chain service for FHE decryption and oracle fulfillment  
3. **🌐 API Server** - RESTful endpoints with SQLite database for frontend development

```
┌─────────────────┐       ┌──────────────────┐       ┌─────────────────┐
│   Frontend      │──────>│  Express API     │       │  Smart Contract │
│   (React/TS)    │       │                  │       │  (Sepolia)      │
└─────────────────┘       └──────────────────┘       └────────┬────────┘
                                                               │
                                   ┌───────────────────────────┘
                                   │
                                   ▼
                          ┌──────────────────┐
                          │  Relayer Service │
                          │  (FHE Decrypt)   │
                          └──────────────────┘
```

## 🔐 Role-Based Access Control

This project uses role-based access control. See [ROLE_MAPPING.md](./ROLE_MAPPING.md) for detailed role definitions.

**Quick Reference:**
- `DEPLOYER_PRIVATE_KEY`: Admin account (DEFAULT_ADMIN_ROLE)
- `RELAYER_PRIVATE_KEY`: Relayer service account (RELAYER_ROLE)
- `METAMASK_USER1_PRIVATE_KEY`: Test user account (no special role)

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18.x or higher
- **npm** or **yarn**
- **Sepolia testnet ETH** (for deployment and testing)
- **Private keys** for deployer and relayer accounts

### Installation

```bash
# Install dependencies
npm install

# Setup environment variables
cp .env.template .env
# Edit .env and fill in:
# - SEPOLIA_RPC_URL (get from Infura/Alchemy)
# - DEPLOYER_PRIVATE_KEY (admin account)
# - RELAYER_PRIVATE_KEY (relayer service account)
```

### Step-by-Step Deployment

#### 1️⃣ Clean & Compile Smart Contracts

```bash
# Clean previous artifacts
npm run clean

# Compile contracts with FHE support
npm run compile
```

Expected output:
```
Compiled 2 Solidity files successfully
```

#### 2️⃣ Deploy to Sepolia Testnet

```bash
# Deploy MysteryNFT and MysteryBox contracts
npm run deploy:sepolia
```

Expected output:
```
MysteryNFT deployed to: 0x...
MysteryBox deployed to: 0x...
Granted MINTER_ROLE to MysteryBox
Sample boxes (bronze/silver/gold) created!
✅ Deployment addresses saved to deployments.json
```

#### 3️⃣ Grant Roles

```bash
# Grant RELAYER_ROLE to relayer account
node scripts/grantRoles.js
```

Expected output:
```
Granting RELAYER_ROLE to 0x... from admin 0x...
grantRole tx hash: 0x...
RELAYER_ROLE granted
MysteryBox already has MINTER_ROLE on MysteryNFT
Done. Verify roles with check script or etherscan.
```

#### 4️⃣ Test Contract Flow (Optional)

```bash
# Simulate user buying and opening a box
node scripts/simulatePurchase.js
```

#### 5️⃣ Start Services

**Terminal 1 - Relayer Service:**
```bash
# Background service for FHE decryption
node scripts/relayer.js
```

**Terminal 2 - API Server:**
```bash
# For frontend development
npm start
# or with auto-reload
npm run dev
```

## 📋 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run clean` | Remove Hardhat artifacts and cache |
| `npm run compile` | Compile Solidity contracts |
| `npm test` | Run smart contract tests |
| `npm run node` | Start local Hardhat node |
| `npm run deploy:local` | Deploy to localhost (Hardhat node) |
| `npm run deploy:sepolia` | Deploy to Sepolia testnet |
| `npm start` | Start Express API server |
| `npm run dev` | Start API server with nodemon (auto-reload) |
| `npm run import-gallery` | Import NFT images to SQLite database |

## 📋 Smart Contract Architecture

### Core Contracts

#### **MysteryBox.sol**
Main contract handling mystery box purchases and FHE-based random NFT minting.

**Features:**
- ✅ Encrypted random value generation using Zama FHE
- ✅ Three box tiers (Bronze, Silver, Gold) with different rarity weights
- ✅ User-controlled randomness with `openBoxWithUserSeed()`
- ✅ On-chain KMS signature verification
- ✅ Role-based access control

**Key Functions:**
- `buyBox(boxId)` - Purchase box with ETH
- `openBox(purchaseId, encryptedRandom, proof)` - Relayer opens with FHE
- `openBoxWithUserSeed(purchaseId, userSeed, proof)` - User-controlled opening
- `fulfillDecryptionWithProof(purchaseId, handles, cleartexts, proof)` - Complete minting with KMS proof
- `withdraw()` - Admin withdraws contract balance

**State Machine:**
```
Paid → Opened → Revealed
```

#### **MysteryNFT.sol**
ERC721 NFT contract with on-chain rarity storage and dual metadata support.

**Features:**
- ✅ Standard ERC721 implementation
- ✅ On-chain rarity tracking
- ✅ IPFS metadata support with fallback to data URI
- ✅ Minter role access control

**Key Functions:**
- `safeMint(to, rarity)` - Mint NFT with rarity
- `setTokenURI(tokenId, uri)` - Set IPFS metadata
- `tokenURI(tokenId)` - Get metadata URI (IPFS or data URI)

### Role-Based Access Control

| Role | Contract | Account | Permissions |
|------|----------|---------|-------------|
| `DEFAULT_ADMIN_ROLE` | MysteryBox<br>MysteryNFT | Deployer | Grant/revoke roles<br>`setBox()`, `withdraw()` |
| `RELAYER_ROLE` | MysteryBox | Relayer Service | `openBox()`<br>`fulfillDecryption()`<br>`fulfillDecryptionWithProof()` |
| `MINTER_ROLE` | MysteryNFT | MysteryBox Contract | `safeMint()`<br>`setTokenURI()` |

### Box Configuration

| Box Tier | Price | Rarities | Weights |
|----------|-------|----------|---------|
| 🥉 **Bronze** | 0.001 ETH | Common, Uncommon, Rare, Epic, Legendary | 50%, 30%, 15%, 4%, 1% |
| 🥈 **Silver** | 0.005 ETH | Common, Uncommon, Rare, Epic, Legendary | 25%, 35%, 25%, 10%, 5% |
| 🥇 **Gold** | 0.02 ETH | Common, Uncommon, Rare, Epic, Legendary | 5%, 15%, 30%, 30%, 20% |

## 🔄 Complete Purchase Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                      MYSTERY BOX PURCHASE FLOW                            │
└──────────────────────────────────────────────────────────────────────────┘

User (Frontend)           Contract (Sepolia)         Relayer Service
      │                          │                          │
      │  1. buyBox("gold")       │                          │
      │  ───────────────────────>│                          │
      │     (send 0.02 ETH)      │                          │
      │                          │                          │
      │  2. BoxPurchased event   │                          │
      │  <───────────────────────│                          │
      │                          │                          │
      │  3. createEncryptedInput()                          │
      │     (generate random)    │                          │
      │                          │                          │
      │  4. openBoxWithUserSeed()│                          │
      │  ───────────────────────>│                          │
      │     (encrypted seed)     │                          │
      │                          │                          │
      │                          │  5. FHE computation      │
      │                          │     (encrypted rarity)   │
      │                          │                          │
      │  6. BoxOpened event      │                          │
      │  <───────────────────────│                          │
      │     (encryptedHandle)    │                          │
      │                          │                          │
      │                          │  7. publicDecrypt()      │
      │                          │  ───────────────────────>│
      │                          │                          │
      │                          │  8. cleartext + proof    │
      │                          │  <───────────────────────│
      │                          │                          │
      │                          │  9. fulfillDecryptionWithProof()
      │                          │  <───────────────────────│
      │                          │     (verify KMS sig)     │
      │                          │     (mint NFT)           │
      │                          │                          │
      │ 10. NFTRevealed event    │                          │
      │  <───────────────────────│                          │
      │     (tokenId, rarity)    │                          │
      │                          │                          │
      ▼                          ▼                          ▼
   Show NFT!               NFT Minted              Decryption Done
```

### Flow Steps Explained

1. **User purchases box** → ETH sent to MysteryBox contract
2. **BoxPurchased event** → Frontend receives purchase confirmation
3. **Frontend generates random seed** → Using Zama FHE SDK (fhevmjs)
4. **User calls openBoxWithUserSeed()** → Encrypted seed + proof submitted
5. **Contract performs FHE computation** → Encrypted rarity index calculated
6. **BoxOpened event emitted** → Encrypted handle stored on-chain
7. **Relayer requests decryption** → Calls Zama KMS publicDecrypt()
8. **KMS returns cleartext + proof** → Cryptographically signed decryption
9. **Relayer submits proof** → Contract verifies KMS signature on-chain
10. **NFT minted** → User receives NFT with revealed rarity

## 📁 Project Structure

```
backend/
├── contracts/                    # 📜 Solidity Smart Contracts
│   ├── MysteryBox.sol           # Main mystery box logic with FHE
│   └── MysteryNFT.sol           # ERC721 NFT contract
│
├── deploy/                       # 🚀 Hardhat Deployment Scripts
│   └── 01_deploy.js             # Deploy MysteryNFT + MysteryBox
│
├── scripts/                      # 🔧 Utility Scripts
│   ├── grantRoles.js            # Grant RELAYER_ROLE and MINTER_ROLE
│   ├── relayer.js               # FHE decryption relayer service
│   ├── simulatePurchase.js      # Test purchase flow
│   ├── importGalleryNFTs.js     # Import NFT images to SQLite
│   └── testPinataAPI.js         # Test IPFS uploads
│
├── routes/                       # 🌐 Express API Routes
│   ├── boxes.js                 # Box endpoints
│   ├── gallery.js               # Gallery/featured NFTs
│   ├── user.js                  # User data endpoints
│   ├── drops.js                 # Drop rate endpoints
│   └── relayer.js               # Relayer status endpoints
│
├── data/                         # 💾 JSON Data
│   ├── boxes.json               # Box configurations
│   ├── gallery.json             # Featured NFTs
│   ├── nfts.json                # NFT metadata
│   ├── user.json                # User profile data
│   └── dropRates.json           # Drop rate percentages
│
├── services/                     # 🗄️ Database Services
│   ├── galleryDatabase.js       # SQLite gallery operations
│   └── nftDatabase.js           # SQLite NFT operations
│
├── nfts/                         # 🖼️ NFT Image Assets
│   ├── Common/                  # Common rarity images
│   ├── Uncommon/                # Uncommon rarity images
│   ├── Rare/                    # Rare rarity images
│   ├── Epic/                    # Epic rarity images
│   └── Legendary/               # Legendary rarity images
│
├── server.js                     # 🌐 Express API Server Entry
├── hardhat.config.js            # ⚙️ Hardhat Configuration
├── package.json                 # 📦 Dependencies & Scripts
├── .env.template                # 📝 Environment Variable Template
├── .env.example                 # 📄 Example .env File
├── deployments.json             # 📍 Deployed Contract Addresses
└── README.md                    # 📖 This File
```

## 🧪 Testing

```bash
# Run unit tests
npm test

# Test on Sepolia testnet
node scripts/simulatePurchase.js
```

## 📋 API Endpoints

### Boxes

#### `GET /api/boxes`
Returns all available mystery box types.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "bronze",
      "name": "Bronze Box",
      "price": 10,
      "currency": "ZAMA",
      "rarityPool": ["Common", "Uncommon"],
      "description": "Common & Uncommon items"
    }
  ]
}
```

#### `GET /api/boxes/:id`
Returns specific box details.

#### `POST /api/boxes/:id/purchase`
purchase endpoint.

**Body:**
```json
{
  "walletAddress": "0x..."
}
```

### Gallery

#### `GET /api/gallery`
Returns featured NFTs for gallery section.

**Query Parameters:**
- `limit` - Number of items to return
- `rarity` - Filter by rarity

### User

#### `GET /api/user`
Returns user profile data.

**Response:**
```json
{
  "success": true,
  "data": {
    "wallet": "0x12ab...cd89",
    "balance": 420,
    "unopenedBoxes": 3
  }
}
```

#### `GET /api/user/nfts`
Returns user's NFT collection.

**Query Parameters:**
- `rarity` - Filter by rarity (Common, Uncommon, Rare, Epic, Legendary)
- `type` - Filter by type
- `sortBy` - Sort by 'date' or 'rarity'

#### `GET /api/user/nfts/:id`
Returns specific NFT details.

#### `PUT /api/user/balance`
Endpoint to update user balance.

### Drop Rates

#### `GET /api/drop-rates`
Returns drop rate percentages for all box types.

**Response:**
```json
{
  "success": true,
  "data": {
    "Common": { "bronze": 60, "silver": 30, "gold": 10 },
    "Uncommon": { "bronze": 30, "silver": 35, "gold": 15 }
  }
}
```

#### `GET /api/drop-rates/calculate?boxType=bronze`
Calculate probabilities for a specific box.

#### `GET /api/drop-rates/chart`
Returns data formatted for chart display.

## 📁 Project Structure

```
/backend
  /data
    boxes.json       # Mystery box types
    gallery.json     # Featured NFTs
    user.json        # User profile data
    nfts.json        # NFT collection
    dropRates.json   # Drop rate percentages
  /routes
    boxes.js         # Box endpoints
    gallery.js       # Gallery endpoints
    user.js          # User endpoints
    drops.js         # Drop rate endpoints
  server.js          # Main server file
  package.json       # Dependencies
  README.md          # This file
```

## 🔧 Configuration

### Environment Variables

Copy `.env.template` to `.env` and configure:

```bash
# Network Configuration
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
RELAYER_URL=http://relayer.testnet.zama.org/

# Deployed Contracts (auto-filled by deploy script)
BOX_ADDRESS=0x9b4D00818e9D1aC63ea4Fe963164726A3d46C21d
NFT_ADDRESS=0x05f844cB9C43ea04EA5d6e539964D0Bb01EacdD3

# Private Keys (NEVER commit these!)
DEPLOYER_PRIVATE_KEY=0x...  # Admin account
RELAYER_PRIVATE_KEY=0x...   # Relayer service account

# IPFS Configuration (optional)
PINATA_API_KEY=your_key
PINATA_API_SECRET=your_secret
```

### API Server Configuration

- **Port**: Default 3001 (configurable via `PORT` environment variable)
- **CORS**: Enabled for all origins (development mode)
- **Database**: SQLite (gallery.db, nfts.db)
- **Body Parser**: JSON and URL-encoded

### Hardhat Configuration

```javascript
// hardhat.config.js
{
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true  // Required for FHE contracts
    }
  },
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY]
    }
  }
}
```

## 🧪 Testing

### Smart Contract Tests

```bash
# Run all tests
npm test

# Run specific test file
npx hardhat test test/MysteryBox.test.js
```

### Manual Testing Flow

```bash
# 1. Start local Hardhat node (Terminal 1)
npm run node

# 2. Deploy to local network (Terminal 2)
npm run deploy:local

# 3. Grant roles
node scripts/grantRoles.js

# 4. Simulate purchase
node scripts/simulatePurchase.js
```

## 📦 Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@fhevm/solidity` | ^0.9.1 | Zama FHE library for Solidity |
| `@openzeppelin/contracts` | ^5.4.0 | ERC721, AccessControl |
| `@zama-fhe/relayer-sdk` | ^0.3.0-5 | FHE relayer SDK |
| `ethers` | ^6.15.0 | Ethereum interactions |
| `hardhat` | ^2.18.0 | Smart contract development |
| `express` | ^4.18.2 | Web server framework |
| `sqlite3` | ^5.1.7 | Database for NFT storage |

## 🔗 Integration with Frontend

### API Base URL

```javascript
// Frontend: src/App.tsx
export const API_BASE = 'http://localhost:3001/api';

// Production
export const API_BASE = 'https://your-backend.railway.app/api';
```

### Contract Addresses

```javascript
// Frontend: .env
VITE_BOX_ADDRESS=0x9b4D00818e9D1aC63ea4Fe963164726A3d46C21d
VITE_NFT_ADDRESS=0x05f844cB9C43ea04EA5d6e539964D0Bb01EacdD3
```

## 🚨 Security Notes

- ⚠️ **Never commit `.env` file** - Contains sensitive private keys
- ⚠️ **Use testnet only** - This is a demo project for Sepolia testnet
- ⚠️ **Data only** - API endpoints return data for development
- ⚠️ **Relayer key needs ETH** - Relayer account needs ~0.1-0.5 Sepolia ETH for gas

## 📚 Documentation

- [Zama fhEVM Docs](https://docs.zama.org/)
- [Hardhat Documentation](https://hardhat.org/docs)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts)
- [Ethers.js v6 Docs](https://docs.ethers.org/v6/)

## 🐛 Troubleshooting

### "Stack too deep" compilation error

**Solution**: `viaIR: true` is already enabled in `hardhat.config.js`

### "Insufficient funds" error

**Solution**: Fund deployer/relayer accounts with Sepolia ETH from faucets:
- https://sepoliafaucet.com/
- https://www.infura.io/faucet/sepolia

### "Must have 5 rarities" error

**Solution**: Box weights array must have exactly 5 elements (Common, Uncommon, Rare, Epic, Legendary)

### Relayer not processing purchases

**Solution**: 
1. Check relayer service is running: `node scripts/relayer.js`
2. Verify `RELAYER_ROLE` granted: `node scripts/grantRoles.js`
3. Check relayer account has ETH for gas

## 📄 License

MIT License - Educational and demonstration purposes only.

---

<p align="center">
  Built with ❤️ using Zama FHE Technology
</p>
