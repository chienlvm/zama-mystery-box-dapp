// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ebool} from "encrypted-types/EncryptedTypes.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./MysteryNFT.sol";

contract MysteryBox is AccessControl, ReentrancyGuard {
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    MysteryNFT public immutable nft;

    enum PurchaseState { Paid, Opened, Revealed }

    struct Box {
        string id;
        string name;
        uint256 priceWei;
        string[] rarities;
        uint16[] weights; // total = 10000
    }

    struct Purchase {
        uint256 id;
        address buyer;
        string boxId;
        PurchaseState state;
        uint256 rarityIndex; // 0-4 index for the rarity after FHE computation (Common, Uncommon, Rare, Epic, Legendary)
        string plaintextRarity;
        uint256 tokenId;
        bytes32 encryptedIndexHandle; // Store handle for relayer to decrypt
    }

    mapping(string => Box) public boxes;
    Purchase[] public purchases;
    mapping(address => uint256[]) public userPurchases;
    uint256 public purchaseCounter;

    event BoxPurchased(uint256 indexed purchaseId, address buyer, string boxId);
    event BoxOpened(uint256 indexed purchaseId, bytes32 encryptedIndexHandle);
    event DecryptionRequested(uint256 indexed purchaseId);
    event NFTRevealed(uint256 indexed purchaseId, uint256 tokenId, string rarity);

    constructor(address _nft) {
        nft = MysteryNFT(_nft);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(RELAYER_ROLE, msg.sender);
        
        // Initialize Zama FHE coprocessor configuration
        // Auto-detects network (Ethereum/Sepolia/Local) and sets correct addresses
        FHE.setCoprocessor(ZamaConfig.getEthereumCoprocessorConfig());
    }

    // === ADMIN ===
    function setBox(
        string calldata id,
        string calldata name,
        uint256 priceWei,
        string[] calldata rarities,
        uint16[] calldata weights
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(rarities.length == weights.length && weights.length == 5, "Must have 5 rarities");
        uint256 sum = 0;
        for (uint i = 0; i < 5; i++) sum += weights[i];
        require(sum == 10000, "Weights must sum to 10000");

        boxes[id] = Box(id, name, priceWei, rarities, weights);
    }

    function withdraw() external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        payable(msg.sender).transfer(address(this).balance);
    }

    // === USER ===
    function buyBox(string calldata boxId) external payable nonReentrant {
        Box memory b = boxes[boxId];
        require(b.priceWei > 0, "Box not exist");
        require(msg.value >= b.priceWei, "Insufficient");

        if (msg.value > b.priceWei)
            payable(msg.sender).transfer(msg.value - b.priceWei);

        uint256 pid = purchaseCounter++;
        purchases.push(Purchase(pid, msg.sender, boxId, PurchaseState.Paid, 0, "", 0, bytes32(0)));
        userPurchases[msg.sender].push(pid);

        emit BoxPurchased(pid, msg.sender, boxId);
    }

    // === RELAYER – 100% giống Ratings ===
    function openBox(
        uint256 purchaseId,
        externalEuint32 encryptedRandom,
        bytes calldata inputProof
    ) external onlyRole(RELAYER_ROLE) {
        Purchase storage p = purchases[purchaseId];
        require(p.state == PurchaseState.Paid, "Not paid");

        Box storage b = boxes[p.boxId];
        
        // Compute encrypted rarity index based on FHE random value
        euint32 normalized = FHE.mul(
            FHE.fromExternal(encryptedRandom, inputProof), 
            FHE.asEuint32(10000)
        );

        // Compute cumulative thresholds for 5 rarities
        euint32 cum0 = FHE.asEuint32(b.weights[0]);  // Common threshold
        euint32 cum1 = FHE.add(cum0, FHE.asEuint32(b.weights[1]));  // Uncommon threshold
        euint32 cum2 = FHE.add(cum1, FHE.asEuint32(b.weights[2]));  // Rare threshold
        euint32 cum3 = FHE.add(cum2, FHE.asEuint32(b.weights[3]));  // Epic threshold
        // Remaining = Legendary

        // Select index based on threshold comparisons (0-4 for 5 rarities)
        euint32 index = FHE.select(
            FHE.le(normalized, cum0), 
            FHE.asEuint32(0),  // Common
            FHE.select(
                FHE.and(FHE.gt(normalized, cum0), FHE.le(normalized, cum1)), 
                FHE.asEuint32(1),  // Uncommon
                FHE.select(
                    FHE.and(FHE.gt(normalized, cum1), FHE.le(normalized, cum2)), 
                    FHE.asEuint32(2),  // Rare
                    FHE.select(
                        FHE.and(FHE.gt(normalized, cum2), FHE.le(normalized, cum3)),
                        FHE.asEuint32(3),  // Epic
                        FHE.asEuint32(4)   // Legendary
                    )
                )
            )
        );

        // Allow contract and relayer to access the encrypted index
        FHE.allowThis(index);
        
        // ✅ CRITICAL: Mark ciphertext as publicly decryptable for KMS
        // This enables off-chain relayer to call publicDecrypt() via Zama KMS
        FHE.makePubliclyDecryptable(index);
        
        // Store handle and update state
        p.encryptedIndexHandle = euint32.unwrap(index);
        p.rarityIndex = 0;
        p.state = PurchaseState.Opened;

        emit BoxOpened(purchaseId, euint32.unwrap(index));
    }

    /// @notice User-initiated box opening with encrypted seed from browser
    /// @dev User creates seed in browser, encrypts with FHE, sends encrypted input
    /// This ensures provable fairness - user controls randomness, not relayer
    /// @param purchaseId The purchase to open
    /// @param encryptedUserSeed User's encrypted random seed from browser (fhevmjs)
    /// @param inputProof Proof that user encrypted the seed correctly
    function openBoxWithUserSeed(
        uint256 purchaseId,
        externalEuint32 encryptedUserSeed,
        bytes calldata inputProof
    ) external {
        Purchase storage p = purchases[purchaseId];
        require(p.state == PurchaseState.Paid, "Not paid");
        require(p.buyer == msg.sender, "Not your purchase");

        Box storage b = boxes[p.boxId];
        
        // Import user's encrypted seed
        euint32 userSeed = FHE.fromExternal(encryptedUserSeed, inputProof);
        
        // Mix with on-chain randomness for additional unpredictability
        // This prevents user from pre-calculating exact outcomes
        euint32 blockRandom = FHE.asEuint32(uint32(block.timestamp));
        euint32 combinedRandom = FHE.add(userSeed, blockRandom);
        
        // Normalize to 0-10000 range for weight comparison
        euint32 normalized = FHE.mul(combinedRandom, FHE.asEuint32(10000));

        // Compute cumulative thresholds for 5 rarities
        euint32 cum0 = FHE.asEuint32(b.weights[0]);  // Common threshold
        euint32 cum1 = FHE.add(cum0, FHE.asEuint32(b.weights[1]));  // Uncommon threshold
        euint32 cum2 = FHE.add(cum1, FHE.asEuint32(b.weights[2]));  // Rare threshold
        euint32 cum3 = FHE.add(cum2, FHE.asEuint32(b.weights[3]));  // Epic threshold
        // Remaining = Legendary

        // Select rarity index based on threshold comparisons (0-4 for 5 rarities)
        euint32 index = FHE.select(
            FHE.le(normalized, cum0), 
            FHE.asEuint32(0),  // Common
            FHE.select(
                FHE.and(FHE.gt(normalized, cum0), FHE.le(normalized, cum1)), 
                FHE.asEuint32(1),  // Uncommon
                FHE.select(
                    FHE.and(FHE.gt(normalized, cum1), FHE.le(normalized, cum2)), 
                    FHE.asEuint32(2),  // Rare
                    FHE.select(
                        FHE.and(FHE.gt(normalized, cum2), FHE.le(normalized, cum3)),
                        FHE.asEuint32(3),  // Epic
                        FHE.asEuint32(4)   // Legendary
                    )
                )
            )
        );

        // Grant permissions for decryption
        FHE.allowThis(index);
        FHE.makePubliclyDecryptable(index);
        
        // Store handle and update state
        p.encryptedIndexHandle = euint32.unwrap(index);
        p.rarityIndex = 0;
        p.state = PurchaseState.Opened;

        emit BoxOpened(purchaseId, euint32.unwrap(index));
    }

    function requestDecryption(uint256 purchaseId) external {
        require(purchases[purchaseId].state == PurchaseState.Opened, "Not opened");
        emit DecryptionRequested(purchaseId);
    }


    function fulfillDecryption(uint256 purchaseId, string calldata rarity) external onlyRole(RELAYER_ROLE) {
        Purchase storage p = purchases[purchaseId];
        require(p.state == PurchaseState.Opened, "Invalid state");

        uint256 tokenId = nft.safeMint(p.buyer, rarity);
        p.plaintextRarity = rarity;
        p.tokenId = tokenId;
        p.state = PurchaseState.Revealed;

        emit NFTRevealed(purchaseId, tokenId, rarity);
    }

    /// @notice New v0.9 flow: accept public-decryption proof (signatures) from relayer,
    /// verify signatures on-chain via FHE.checkSignatures, then decode the cleartext
    /// and reveal the NFT.
    /// @param purchaseId the purchase to fulfill
    /// @param handlesList list of handles that were publicly decrypted (usually single-item)
    /// @param abiEncodedCleartexts ABI-encoded cleartext(s) returned by publicDecrypt
    /// @param decryptionProof signatures/proof bytes returned by publicDecrypt
    function fulfillDecryptionWithProof(
        uint256 purchaseId,
        bytes32[] calldata handlesList,
        bytes calldata abiEncodedCleartexts,
        bytes calldata decryptionProof
    ) external onlyRole(RELAYER_ROLE) {
        Purchase storage p = purchases[purchaseId];
        require(p.state == PurchaseState.Opened, "Invalid state");

        // Verify KMS signatures and proof on-chain. Reverts if invalid.
        FHE.checkSignatures(handlesList, abiEncodedCleartexts, decryptionProof);

        // Decode the cleartext. We expect a single uint256 index (0..4) encoded by the relayer.
        // Index mapping: 0=Common, 1=Uncommon, 2=Rare, 3=Epic, 4=Legendary
        uint256 idx = abi.decode(abiEncodedCleartexts, (uint256));
        Box memory b = boxes[p.boxId];
        require(idx < b.rarities.length, "Invalid index");

        string memory rarity = b.rarities[idx];

        uint256 tokenId = nft.safeMint(p.buyer, rarity);
        p.plaintextRarity = rarity;
        p.tokenId = tokenId;
        p.rarityIndex = idx;
        p.state = PurchaseState.Revealed;

        emit NFTRevealed(purchaseId, tokenId, rarity);
    }

    // View
    function getPurchase(uint256 id) external view returns (Purchase memory) {
        return purchases[id];
    }
    function getUserPurchases(address user) external view returns (uint256[] memory) {
        return userPurchases[user];
    }
    function getPurchaseHandle(uint256 purchaseId) external view returns (bytes32) {
        require(purchaseId < purchases.length, "Invalid purchase");
        return purchases[purchaseId].encryptedIndexHandle;
    }
}