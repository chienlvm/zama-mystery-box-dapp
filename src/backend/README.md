# Mystery Box Backend

Backend for the Mystery Box crypto DApp, including:
1. **Smart Contracts** - Solidity contracts with FHE (Fully Homomorphic Encryption) on Zama FHEVM
2. **Relayer Service** - Off-chain service for FHE decryption and oracle fulfillment
3. **Mock API Server** - RESTful endpoints with static JSON data for frontend development

## 🔐 Role-Based Access Control

This project uses role-based access control. See [ROLE_MAPPING.md](./ROLE_MAPPING.md) for detailed role definitions.

**Quick Reference:**
- `DEPLOYER_PRIVATE_KEY`: Admin account (DEFAULT_ADMIN_ROLE)
- `RELAYER_PRIVATE_KEY`: Relayer service account (RELAYER_ROLE)
- `METAMASK_USER1_PRIVATE_KEY`: Test user account (no special role)

## 🚀 Quick Start

### Prerequisites
```bash
npm install
cp .env.template .env
# Fill in your private keys and RPC URLs in .env
```

### 1. Deploy Smart Contracts
```bash
# Compile contracts
npx hardhat compile

# Deploy to Sepolia (uses DEPLOYER_PRIVATE_KEY)
npx hardhat run deploy/01_deploy.js --network sepolia
```

### 2. Grant Roles
```bash
# Grant RELAYER_ROLE and MINTER_ROLE
node scripts/grantRoles.js
```

### 3. Test Contract Flow
```bash
# Simulate user buying and opening a box
node scripts/simulatePurchase.js
```

### 4. Start Relayer Service
```bash
# Background service for FHE decryption
node scripts/relayer.js
```

### 5. Start Mock API Server (Optional)
```bash
# For frontend development
npm start
# or with auto-reload
npm run dev
```

## 📋 Smart Contract Architecture

### Contracts

- **MysteryBox.sol**: Main contract handling box purchases, FHE computation, and NFT minting
- **MysteryNFT.sol**: ERC721 NFT contract with metadata support

### Roles

| Role | Contract | Permissions |
|------|----------|-------------|
| `DEFAULT_ADMIN_ROLE` | MysteryBox, MysteryNFT | Grant/revoke roles, admin functions |
| `RELAYER_ROLE` | MysteryBox | openBox(), fulfillDecryption() |
| `MINTER_ROLE` | MysteryNFT | safeMint() |

See [GRANT_ROLES.md](./GRANT_ROLES.md) for role setup instructions.

## 🔄 FHE Decryption Flow

```
User → buyBox() → BoxPurchased event
  ↓
Relayer Service:
  1. createEncryptedInput().encrypt()
  2. openBox(purchaseId, handle, inputProof)
  3. Poll publicDecrypt([handle])
  4. fulfillDecryptionWithProof(id, handles, cleartexts, proof)
  ↓
Contract:
  - Verify KMS signature with FHE.checkSignatures()
  - Mint NFT via MysteryNFT.safeMint()
```

## 📁 Project Structure

```
/backend
  /contracts         # Solidity contracts
    MysteryBox.sol
    MysteryNFT.sol
  /scripts           # Deployment & relayer scripts
    relayer.js       # FHE decryption service
    grantRoles.js    # Role provisioning
    simulatePurchase.js  # Test script
  /deploy           # Deployment scripts
    01_deploy.js
  /data             # Mock API data
  /routes           # Express API routes
  server.js         # Mock API server
  hardhat.config.js
  .env.template
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
Mock purchase endpoint.

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
Returns mock user profile data.

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
Mock endpoint to update user balance.

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

- **Port**: Default 3001 (configurable via `PORT` environment variable)
- **CORS**: Enabled for all origins
- **Body Parser**: JSON and URL-encoded

## 📝 Notes

- All data is mocked and stored in JSON files
- No real blockchain integration
- No database required
- All transaction hashes are randomly generated
- User authentication is not implemented

## 🚨 Important

This is a **mock backend only**. Do not use in production with real cryptocurrency or blockchain transactions.

## 📦 Dependencies

- **express**: Web framework
- **cors**: Cross-origin resource sharing
- **body-parser**: Parse request bodies
- **nodemon**: Development auto-reload (dev dependency)

## 🔗 Frontend Integration

Update your frontend API calls to point to:
```
http://localhost:3001/api/...
```

Example:
```javascript
// Fetch boxes
const response = await fetch('http://localhost:3001/api/boxes');
const data = await response.json();

// Fetch user NFTs
const response = await fetch('http://localhost:3001/api/user/nfts?rarity=Legendary');
const data = await response.json();
```
