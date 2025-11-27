
  # 🎲 ZAMA Mystery Box DApp

A decentralized Mystery Box application built with **Fully Homomorphic Encryption (FHE)** on the Ethereum Sepolia testnet. This DApp enables users to purchase mystery boxes and receive random NFTs with provably fair randomness powered by [Zama's fhEVM](https://docs.zama.org/).

![React](https://img.shields.io/badge/React-18.3.1-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-6.3.5-646CFF?logo=vite)
![Ethereum](https://img.shields.io/badge/Ethereum-Sepolia-3C3C3D?logo=ethereum)
![Zama FHE](https://img.shields.io/badge/Zama-FHE-purple)

## ✨ Features

- **🔐 FHE-Powered Randomness**: Provably fair random NFT drops using Fully Homomorphic Encryption
- **🦊 MetaMask Integration**: Seamless wallet connection and transaction signing
- **🎁 Mystery Box System**: Multiple box tiers (Bronze, Silver, Gold) with different rarity pools
- **🖼️ NFT Gallery**: Browse featured NFTs with rarity-based grouping
- **📊 Drop Rate Transparency**: View detailed drop rate statistics for each box type
- **🎬 Opening Animation**: Smooth reveal animation when opening mystery boxes
- **📱 Responsive Design**: Beautiful UI optimized for all screen sizes

## 🛠️ Tech Stack

### Frontend
- **React 18** - UI Framework
- **TypeScript** - Type Safety
- **Vite** - Build Tool & Dev Server
- **Tailwind CSS 4** - Styling
- **Radix UI** - Accessible Component Primitives
- **Embla Carousel** - Carousel/Slider
- **Recharts** - Data Visualization
- **Lucide React** - Icons
- **Ethers.js 6** - Ethereum Interactions

### Backend
- **Express.js** - REST API Server
- **SQLite** - Database for NFTs and Gallery
- **CORS** - Cross-Origin Resource Sharing

### Blockchain
- **Ethereum Sepolia Testnet** - Smart Contract Deployment
- **Zama fhEVM** - Fully Homomorphic Encryption
- **Zama Relayer SDK** - Client-side FHE Operations

## 🏗️ Architecture Overview

```
┌─────────────┐        ┌──────────────┐        ┌─────────────────┐
│   Frontend  │───────>│   Relayer    │───────>│  Smart Contract │
│  (React/TS) │<───────│   Service    │<───────│   (FHE/FHEVM)   │
└─────────────┘        └──────────────┘        └─────────────────┘
      │                       │                         │
      │                       │                         │
      ▼                       ▼                         ▼
┌─────────────┐        ┌──────────────┐        ┌─────────────────┐
│   Wallet    │        │  Decryption  │        │   NFT Engine    │
│  (MetaMask) │        │    Oracle    │        │   (ERC721)      │
└─────────────┘        └──────────────┘        └─────────────────┘
```

### Component Descriptions

| Component | Description |
|-----------|-------------|
| **Frontend** | React/TypeScript web application with Vite build system |
| **Relayer Service** | Off-chain service that handles FHE decryption requests |
| **Smart Contract** | Solidity contracts deployed on Sepolia with fhEVM support |
| **Wallet (MetaMask)** | User wallet for transaction signing and authentication |
| **Decryption Oracle** | Zama KMS service for secure decryption of FHE ciphertexts |
| **NFT Engine** | ERC721 contract for minting and managing mystery box NFTs |

### Data Flow

1. **User Action** → Frontend sends transaction request to MetaMask
2. **Transaction** → MetaMask signs and broadcasts to Smart Contract
3. **FHE Computation** → Contract generates encrypted random value
4. **Decryption Request** → Relayer requests decryption from Oracle
5. **Proof Verification** → Oracle returns decrypted value with KMS signature
6. **NFT Minting** → Contract mints NFT based on random result
7. **UI Update** → Frontend displays the revealed NFT to user

## 📋 Contract Architecture

### Core Contracts

#### 1. **MysteryBox.sol** - Main Mystery Box Logic

**Purpose**: Handles box purchases, encrypted box opening with FHE computation, and NFT minting coordination.

**Key Structs**:
```solidity
enum PurchaseState { Paid, Opened, Revealed }

struct Box {
    string id;
    string name;
    uint256 priceWei;
    string[] rarities;    // ["Common", "Uncommon", "Rare", "Epic", "Legendary"]
    uint16[] weights;     // [4000, 3000, 1500, 1000, 500] - total = 10000
}

struct Purchase {
    uint256 id;
    address buyer;
    string boxId;
    PurchaseState state;
    uint256 rarityIndex;
    string plaintextRarity;
    uint256 tokenId;
    bytes32 encryptedIndexHandle;
}
```

**Key Functions**:

| Function | Access | Description |
|----------|--------|-------------|
| `buyBox(boxId)` | Public | User purchases box with ETH, creates Purchase in `Paid` state |
| `openBox(purchaseId, encryptedRandom, inputProof)` | RELAYER_ROLE | Relayer opens box with FHE encrypted random value |
| `openBoxWithUserSeed(purchaseId, encryptedUserSeed, inputProof)` | Public (buyer only) | User opens box with their own encrypted seed for provable fairness |
| `requestDecryption(purchaseId)` | Public | Emit event to request async decryption from KMS |
| `fulfillDecryption(purchaseId, rarity)` | RELAYER_ROLE | Simple fulfillment with plaintext rarity |
| `fulfillDecryptionWithProof(purchaseId, handles, cleartexts, proof)` | RELAYER_ROLE | v0.9 flow with on-chain KMS signature verification |

**State Machine**:
```
┌──────────┐     buyBox()      ┌──────────┐
│          │ ────────────────> │          │
│  (None)  │                   │   Paid   │
│          │                   │          │
└──────────┘                   └────┬─────┘
                                    │
                    openBox() or    │
                openBoxWithUserSeed()
                                    │
                                    ▼
                              ┌──────────┐
                              │          │
                              │  Opened  │ ← FHE computation done,
                              │          │   encryptedIndexHandle stored
                              └────┬─────┘
                                   │
               fulfillDecryption() │ or fulfillDecryptionWithProof()
                                   │
                                   ▼
                             ┌──────────┐
                             │          │
                             │ Revealed │ ← NFT minted to buyer,
                             │          │   plaintext rarity stored
                             └──────────┘
```

**FHE Computation Flow**:
```solidity
// 1. Normalize encrypted random to 0-10000 range
euint32 normalized = FHE.mul(encryptedRandom, FHE.asEuint32(10000));

// 2. Compute cumulative weight thresholds (5 rarities)
euint32 cum0 = FHE.asEuint32(weights[0]);           // e.g., 4000 (Common)
euint32 cum1 = FHE.add(cum0, weights[1]);           // e.g., 7000 (Uncommon)
euint32 cum2 = FHE.add(cum1, weights[2]);           // e.g., 8500 (Rare)
euint32 cum3 = FHE.add(cum2, weights[3]);           // e.g., 9500 (Epic)
                                                    // remaining = Legendary

// 3. Encrypted comparison to select rarity index (0-4)
euint32 index = FHE.select(
    FHE.le(normalized, cum0), FHE.asEuint32(0),     // Common
    FHE.select(
        FHE.le(normalized, cum1), FHE.asEuint32(1), // Uncommon
        FHE.select(
            FHE.le(normalized, cum2), FHE.asEuint32(2), // Rare
            FHE.select(
                FHE.le(normalized, cum3), FHE.asEuint32(3), // Epic
                FHE.asEuint32(4)                             // Legendary
            )
        )
    )
);

// 4. Mark for public decryption
FHE.makePubliclyDecryptable(index);
```

**Events**:
```solidity
event BoxPurchased(uint256 indexed purchaseId, address buyer, string boxId);
event BoxOpened(uint256 indexed purchaseId, bytes32 encryptedIndexHandle);
event DecryptionRequested(uint256 indexed purchaseId);
event NFTRevealed(uint256 indexed purchaseId, uint256 tokenId, string rarity);
```

---

#### 2. **MysteryNFT.sol** - ERC721 NFT Contract

**Purpose**: ERC721 NFT minted when mystery box is opened. Stores revealed rarity and supports IPFS metadata.

**Key Features**:
- Inherits: `ERC721`, `ERC721URIStorage`, `AccessControl`
- Auto-incrementing token IDs
- On-chain rarity storage
- Dual metadata support: IPFS URI or fallback on-chain data URI

**Key Functions**:

| Function | Access | Description |
|----------|--------|-------------|
| `safeMint(to, rarity)` | MINTER_ROLE | Mint NFT to address with rarity string |
| `setTokenURI(tokenId, uri)` | MINTER_ROLE | Set IPFS metadata URI post-mint |
| `tokenURI(tokenId)` | Public | Returns IPFS URI if set, else on-chain data URI |

**Metadata Fallback**:
```json
{
  "name": "Mystery Box #1",
  "description": "FHE-powered Mystery Box NFT",
  "image": "ipfs://...",
  "attributes": [
    { "trait_type": "Rarity", "value": "Legendary" }
  ]
}
```

---

### Role-Based Access Control

| Role | Contract | Permissions |
|------|----------|-------------|
| `DEFAULT_ADMIN_ROLE` | MysteryBox, MysteryNFT | Grant/revoke roles, setBox(), withdraw() |
| `RELAYER_ROLE` | MysteryBox | openBox(), fulfillDecryption(), fulfillDecryptionWithProof() |
| `MINTER_ROLE` | MysteryNFT | safeMint(), setTokenURI() |

---

### Complete Purchase Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MYSTERY BOX PURCHASE FLOW                         │
└─────────────────────────────────────────────────────────────────────────────┘

  User (Browser)              Contract (fhEVM)              Relayer/KMS
       │                            │                            │
       │  1. buyBox("gold")         │                            │
       │  ────────────────────────> │                            │
       │     (sends ETH)            │                            │
       │                            │                            │
       │  2. BoxPurchased event     │                            │
       │  <──────────────────────── │                            │
       │                            │                            │
       │  3. createEncryptedInput() │                            │
       │     (generate random seed) │                            │
       │                            │                            │
       │  4. openBoxWithUserSeed()  │                            │
       │  ────────────────────────> │                            │
       │     (encrypted seed+proof) │                            │
       │                            │                            │
       │                            │  5. FHE.mul(), FHE.select()│
       │                            │     (encrypted computation)│
       │                            │                            │
       │                            │  6. makePubliclyDecryptable│
       │                            │                            │
       │  7. BoxOpened event        │                            │
       │  <──────────────────────── │                            │
       │     (encryptedIndexHandle) │                            │
       │                            │                            │
       │                            │  8. publicDecrypt(handle)  │
       │                            │  ──────────────────────────>│
       │                            │                            │
       │                            │  9. cleartext + KMS proof  │
       │                            │  <──────────────────────────│
       │                            │                            │
       │                            │ 10. fulfillDecryptionWithProof()
       │                            │  <──────────────────────────│
       │                            │     (verify + mint NFT)    │
       │                            │                            │
       │ 11. NFTRevealed event      │                            │
       │  <──────────────────────── │                            │
       │     (tokenId, rarity)      │                            │
       │                            │                            │
       ▼                            ▼                            ▼
   Show NFT!                   NFT Minted              Decryption Complete
```

## 📁 Project Structure

```
/
├── src/
│   ├── App.tsx                 # Main application component
│   ├── main.tsx                # Entry point
│   ├── index.css               # Global styles (Tailwind v4)
│   ├── components/
│   │   ├── HomePage.tsx        # Main page with boxes & gallery
│   │   ├── CollectionPage.tsx  # User's NFT collection
│   │   ├── MysteryBoxCard.tsx  # Box purchase card
│   │   ├── NFTCard.tsx         # NFT display card
│   │   ├── NFTDetailModal.tsx  # NFT detail popup
│   │   ├── BoxOpeningAnimation.tsx  # Reveal animation
│   │   ├── DropRateChart.tsx   # Drop rate visualization
│   │   ├── Web3AuthHeader.tsx  # Wallet connection UI
│   │   └── ui/                 # Shadcn UI components
│   ├── contexts/
│   │   └── Web3AuthContext.tsx # Web3 authentication context
│   ├── hooks/
│   │   └── useWeb3Auth.ts      # Web3 authentication hook
│   └── backend/
│       ├── server.js           # Express API server
│       ├── routes/             # API route handlers
│       └── data/               # Mock JSON data
├── package.json
├── vite.config.ts
├── tsconfig.json
└── index.html
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18.x or higher
- **npm** or **yarn**
- **MetaMask** browser extension
- **Sepolia testnet ETH** (for gas fees)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd "Crypto DApp UI Design"
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Install backend dependencies**
   ```bash
   cd src/backend
   npm install
   cd ../..
   ```

4. **Configure environment variables** (optional)
   
   Create a `.env` file in the root directory:
   ```env
   VITE_BOX_ADDRESS=0x3f3DaA5031cd3B9e69051a163b658585c99123f2
   ```

### Running the Application

1. **Start the backend server** (Terminal 1)
   ```bash
   cd src/backend
   npm start
   ```
   The API server will run on `http://localhost:3001`

2. **Start the frontend development server** (Terminal 2)
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:5173`

### Building for Production

```bash
npm run build
```

The production build will be output to the `dist/` directory.

## 🔗 Smart Contract Integration

### Contract Address (Sepolia)
```
0x3f3DaA5031cd3B9e69051a163b658585c99123f2
```

### FHE Flow

1. **User connects wallet** via MetaMask
2. **User purchases a mystery box** with ETH
3. **FHE generates encrypted random value** on-chain
4. **Relayer decrypts the value** and submits proof
5. **NFT is minted** to the user based on the random result
6. **Animation reveals** the obtained NFT

## 📋 API Endpoints

The backend provides the following REST endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/boxes` | GET | Get all mystery box types |
| `/api/boxes/:id` | GET | Get specific box details |
| `/api/boxes/:id/purchase` | POST | Purchase a box (mock) |
| `/api/gallery` | GET | Get gallery NFTs |
| `/api/gallery/featured` | GET | Get featured NFTs |
| `/api/user` | GET | Get user profile |
| `/api/user/nfts` | GET | Get user's NFT collection |
| `/api/drop-rates` | GET | Get drop rate percentages |
| `/api/drop-rates/chart` | GET | Get chart-formatted data |

## 🎨 Mystery Box Tiers

| Tier | Price | Rarity Pool |
|------|-------|-------------|
| 🥉 Bronze | 0.02 ETH | Common, Uncommon |
| 🥈 Silver | 0.05 ETH | Common, Uncommon, Rare, Epic |
| 🥇 Gold | 0.1 ETH | Uncommon, Rare, Epic, Legendary |

## 🔒 Security Features

- **Provably Fair**: FHE ensures randomness cannot be manipulated
- **On-Chain Verification**: All random values are computed and verified on-chain
- **KMS Signature Verification**: Decryption proofs are cryptographically verified
- **Non-Custodial**: Users maintain full control of their wallets

## ⚠️ Testnet Disclaimer

> **This application is deployed on the Ethereum Sepolia testnet.**
> 
> - All ETH used is testnet ETH with no real value
> - NFTs are for demonstration purposes only
> - Do not send real cryptocurrency to testnet addresses

## 🧪 Development

### Code Style
- TypeScript strict mode enabled
- ESLint for linting
- Prettier for formatting

### Key Dependencies
```json
{
  "@zama-fhe/relayer-sdk": "0.3.0-5",
  "ethers": "^6.15.0",
  "react": "^18.3.1",
  "embla-carousel-react": "^8.6.0"
}
```

## 📚 Documentation

- [Zama fhEVM Documentation](https://docs.zama.org/)
- [Zama Relayer SDK Guide](https://docs.zama.org/protocol/relayer-sdk-guides/development-guide/webapp)
- [Ethers.js Documentation](https://docs.ethers.org/v6/)

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is for educational and demonstration purposes.

## 🙏 Acknowledgments

- [Zama](https://www.zama.ai/) for FHE technology
- [Figma Design](https://www.figma.com/design/DlZ5XOQWsRRFZWQYw2MNLp/Crypto-DApp-UI-Design) - Original UI Design
- [Shadcn/ui](https://ui.shadcn.com/) for UI components
- [Radix UI](https://www.radix-ui.com/) for accessible primitives

---

<p align="center">
  Built with ❤️ using Zama FHE Technology
</p>
  