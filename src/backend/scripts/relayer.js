const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { ethers } = require("ethers");
const fs = require("fs");

// Import services
const { generateNFTForMinting } = require('../services/nftService');
const nftDB = require('../services/nftDatabase');
const RPCManager = require('./rpcManager');

// ============================================================================
// RELAYER V4: Multi-RPC with Load Balancing
// Reference: https://docs.zama.org/protocol/relayer-sdk-guides/development-guide
// ============================================================================

console.log("\n" + "=".repeat(70));
console.log("🚀 Mystery Box Relayer Service v4");
console.log("📖 Multi-RPC Load Balancing with Automatic Failover");
console.log("=".repeat(70) + "\n");

// Initialize RPC Manager
const rpcManager = new RPCManager();

// Validate required environment variables
const relayerKey = process.env.RELAYER_PRIVATE_KEY;
if (!relayerKey) {
    console.error("❌ Missing RELAYER_PRIVATE_KEY in .env");
    console.error("   RELAYER_PRIVATE_KEY must have RELAYER_ROLE granted via grantRoles.js");
    process.exit(1);
}

// Create initial provider
let providerInfo = rpcManager.createProvider();
let provider = providerInfo.provider;
let currentEndpoint = providerInfo.endpoint;

const wallet = new ethers.Wallet(relayerKey, provider);
const relayerAddress = wallet.address;

console.log("🔧 Relayer Configuration:");
console.log("   Provider Type:", providerInfo.type);
console.log("   Current Endpoint:", currentEndpoint.name);
console.log("   Relayer Address:", relayerAddress);

// Function to recreate provider on failover
async function recreateProvider() {
    console.log('🔄 Recreating provider...');
    
    // Cleanup old provider
    if (provider && provider.destroy) {
        try {
            await provider.destroy();
        } catch (e) {
            // Ignore cleanup errors
        }
    }
    
    // Create new provider
    providerInfo = rpcManager.createProvider();
    provider = providerInfo.provider;
    currentEndpoint = providerInfo.endpoint;
    
    // Update wallet connection
    wallet.provider = provider;
    
    // Recreate contract instances
    box = new ethers.Contract(BOX_ADDRESS, abi, wallet);
    
    console.log(`✅ Switched to ${currentEndpoint.name}`);
    return provider;
}

// Load contract address
const deploymentsPath = path.resolve(__dirname, '..', 'deployments.json');
let BOX_ADDRESS = process.env.BOX_ADDRESS;

if (!BOX_ADDRESS && fs.existsSync(deploymentsPath)) {
    try {
        const deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));
        BOX_ADDRESS = deployments.box?.address;
    } catch (e) {
        console.warn('⚠️  Could not parse deployments.json:', e.message);
    }
}

if (!BOX_ADDRESS) {
    console.error('❌ BOX_ADDRESS not set. Set BOX_ADDRESS in .env or ensure deployments.json contains box.address');
    process.exit(1);
}

console.log("   Box Contract:", BOX_ADDRESS);

// Load contract ABI and create contract instance
const abi = require("../artifacts/contracts/MysteryBox.sol/MysteryBox.json").abi;
let box = new ethers.Contract(BOX_ADDRESS, abi, wallet);

// Global relayer SDK instance
let fheInstance;

// Track processed purchases to prevent duplicate handling
const processedPurchases = new Set();
const processingPurchases = new Set();

// Nonce management to prevent "already known" errors
let currentNonce = null;
const nonceLock = { locked: false, queue: [] };

// Wrap provider calls with automatic failover
async function safeProviderCall(callFn, context = '') {
    try {
        return await rpcManager.callWithFailover(callFn);
    } catch (error) {
        // Check if we should switch provider
        if (rpcManager.isRateLimitError(error) || rpcManager.isFilterError(error)) {
            console.log(`⚠️  ${context}: Provider error, attempting failover...`);
            rpcManager.markFailed(currentEndpoint.url, error);
            await recreateProvider();
            
            // Retry once with new provider
            try {
                return await callFn();
            } catch (retryError) {
                console.error(`❌ ${context}: Retry failed:`, retryError.message);
                throw retryError;
            }
        }
        throw error;
    }
}

async function getNextNonce() {
    // Wait if locked
    while (nonceLock.locked) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    nonceLock.locked = true;
    
    try {
        if (currentNonce === null) {
            currentNonce = await wallet.getNonce('pending');
        }
        
        const nonce = currentNonce;
        currentNonce++; // Reserve next nonce
        
        return nonce;
    } finally {
        nonceLock.locked = false;
    }
}

// ============================================================================
// Initialize Zama FHE Relayer SDK (Node.js)
// Reference: https://docs.zama.org/protocol/relayer-sdk-guides/development-guide/node
// ============================================================================
async function initializeRelayerSDK() {
    console.log("\n🔐 Initializing Zama FHE Relayer SDK...");
    console.log("📖 Guide: https://docs.zama.org/protocol/relayer-sdk-guides/development-guide/node");
    
    try {
        // Step 1: Import SDK from /node endpoint (for Node.js environment)
        const { pathToFileURL } = require('url');
        const sdkPath = path.join(
            __dirname, '..', 'node_modules', 
            '@zama-fhe', 'relayer-sdk', 'lib', 'node.js'
        );
        
        console.log("   SDK Path:", sdkPath);
        const relayerSdk = await import(pathToFileURL(sdkPath).href);
        const { createInstance, SepoliaConfig } = relayerSdk;

        // Step 2: Configure for Sepolia testnet - use current endpoint
        const relayerUrl = process.env.RELAYER_URL || 'http://relayer.testnet.zama.org/';
        SepoliaConfig.relayerUrl = relayerUrl;
        SepoliaConfig.network = currentEndpoint.url; // Use current RPC endpoint

        console.log("   Relayer URL:", relayerUrl);
        console.log("   Network RPC:", currentEndpoint.name);

        // Step 3: Create FHE instance
        console.log("   Creating FHE instance...");
        fheInstance = await createInstance(SepoliaConfig);
        
        console.log("✅ Relayer SDK initialized successfully");
        console.log("   Instance methods:", Object.keys(fheInstance || {}).slice(0, 5).join(', ') + '...');
        
        return true;
    } catch (e) {
        console.error("❌ Failed to initialize Relayer SDK:", e.message);
        console.error("   Stack:", e.stack);
        console.error("\n💡 Troubleshooting:");
        console.error("   1. Check @zama-fhe/relayer-sdk is installed: npm list @zama-fhe/relayer-sdk");
        console.error("   2. Verify SEPOLIA_RPC_URL is correct");
        console.error("   3. Check network connectivity");
        console.error("   4. Read guide: https://docs.zama.org/protocol/relayer-sdk-guides/development-guide/node");
        return false;
    }
}

// ============================================================================
// Handler: BoxPurchased Event
// When user buys a box, relayer creates encrypted random and calls openBox()
// Reference: https://docs.zama.org/protocol/relayer-sdk-guides/development-guide/node#encrypt-values
// ============================================================================
async function handleBoxPurchased(purchaseId) {
    const purchaseKey = `purchase_${purchaseId}`;
    
    // Check if already processed or currently processing
    if (processedPurchases.has(purchaseKey)) {
        console.log(`\n⏭️  Skipping BoxPurchased #${purchaseId} - already completed`);
        return;
    }
    
    if (processingPurchases.has(purchaseKey)) {
        console.log(`\n⏭️  Skipping BoxPurchased #${purchaseId} - currently processing`);
        return;
    }
    
    console.log(`\n🛒 BoxPurchased Event: Purchase #${purchaseId}`);
    processingPurchases.add(purchaseKey);
    
    try {
        // Step 1: Generate random seed for this purchase
        const randomValue = Math.floor(Math.random() * 2**32);
        console.log(`   Generated random seed: ${randomValue}`);

        // Step 2: Create encrypted input
        // Reference: https://docs.zama.org/protocol/relayer-sdk-guides/development-guide/node#create-encrypted-input
        console.log(`   Creating encrypted input for contract: ${BOX_ADDRESS}`);
        console.log(`   Using relayer address as user: ${relayerAddress}`);
        
        const inputBuffer = fheInstance.createEncryptedInput(BOX_ADDRESS, relayerAddress);
        inputBuffer.add32(randomValue);
        
        console.log("   Encrypting input...");
        const encryptedInput = await inputBuffer.encrypt();
        console.log("   ✅ Encrypted input created");
        console.log("   Encrypted input keys:", Object.keys(encryptedInput));
        
        // Step 3: Extract handle and proof
        // According to Zama SDK: encryptedInput contains { handles, inputProof }
        // handles[0] is the bytes32 handle that represents the encrypted value
        // For externalEuint32 in Solidity, we pass the handle (bytes32) + inputProof (bytes)
        const handleBytes = encryptedInput.handles[0];
        const inputProofBytes = encryptedInput.inputProof;
        
        // Convert to hex for contract call
        const handle = ethers.hexlify(handleBytes);
        const inputProof = ethers.hexlify(inputProofBytes);
        
        console.log("   Handle (bytes32):", handle);
        console.log("   Handle length:", handle.length, "chars");
        console.log("   InputProof length:", inputProof.length, "chars");
        
        // Step 4: Call openBox on contract
        // Reference: MysteryBox.sol - openBox(uint256 purchaseId, externalEuint32 encryptedRandom, bytes calldata inputProof)
        // externalEuint32 is actually a bytes32 handle in the SDK
        console.log(`   Calling openBox(${purchaseId}, handle, inputProof)...`);
        
        try {
            // Test with static call first
            console.log("   Testing with callStatic...");
            await box.openBox.staticCall(purchaseId, handle, inputProof);
            console.log("   ✅ Static call succeeded");
        } catch (staticErr) {
            console.error("   ❌ Static call failed:", staticErr.message);
            
            // Try to decode error
            if (staticErr.data) {
                try {
                    const decoded = box.interface.parseError(staticErr.data);
                    console.error("   Decoded error:", decoded.name, decoded.args);
                } catch (e) {
                    console.error("   Raw error data:", staticErr.data);
                }
            }
            
            throw staticErr;
        }
        
        // Send actual transaction with proper nonce and gas management
        console.log("   Preparing transaction with current nonce...");
        const txNonce = await getNextNonce();
        
        const feeData = await safeProviderCall(
            () => provider.getFeeData(),
            'Getting fee data'
        );
        
        const txOptions = {
            nonce: txNonce,
            maxFeePerGas: feeData.maxFeePerGas ? feeData.maxFeePerGas * 120n / 100n : undefined, // +20%
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? feeData.maxPriorityFeePerGas * 120n / 100n : undefined, // +20%
            gasLimit: 2000000n  // Increased gas limit for FHE operations
        };
        
        console.log(`   Nonce: ${txNonce}, Gas limit: ${txOptions.gasLimit}, Fee: ${txOptions.maxFeePerGas ? (Number(txOptions.maxFeePerGas) / 1e9).toFixed(2) + ' Gwei' : 'auto'}`);
        
        const tx = await box.openBox(purchaseId, handle, inputProof, txOptions);
        console.log(`   Transaction sent: ${tx.hash}`);
        
        const receipt = await tx.wait();
        console.log(`   ✅ BoxOpened: Gas used: ${receipt.gasUsed.toString()}`);
        console.log(`   Block: ${receipt.blockNumber}`);
        
        // Mark as completed
        processedPurchases.add(purchaseKey);
        processingPurchases.delete(purchaseKey);
        
    } catch (error) {
        console.error(`\n❌ Error handling BoxPurchased:`, error.message);
        console.error("   Purchase ID:", purchaseId);
        
        // Check for rate limit and switch provider if needed
        if (rpcManager.isRateLimitError(error)) {
            console.log('⚠️  Rate limit detected, marking endpoint as failed...');
            rpcManager.markFailed(currentEndpoint.url, error);
        }
        
        if (error.stack) console.error("   Stack:", error.stack);
        
        // Remove from processing so it can be retried
        processingPurchases.delete(purchaseKey);
    }
}

// ============================================================================
// Handler: BoxOpened Event  
// When box is opened, relayer decrypts the handle and fulfills with proof
// Reference: https://docs.zama.org/protocol/relayer-sdk-guides/development-guide/node#public-decryption
// ============================================================================
async function handleBoxOpened(purchaseId, encryptedIndexHandle) {
    const decryptKey = `decrypt_${purchaseId}`;
    
    // Check if already processed or currently processing
    if (processedPurchases.has(decryptKey)) {
        console.log(`\n⏭️  Skipping BoxOpened #${purchaseId} - already fulfilled`);
        return;
    }
    
    if (processingPurchases.has(decryptKey)) {
        console.log(`\n⏭️  Skipping BoxOpened #${purchaseId} - currently fulfilling`);
        return;
    }
    
    console.log(`\n🔓 BoxOpened Event: Purchase #${purchaseId}`);
    console.log(`   Encrypted Handle: ${encryptedIndexHandle}`);
    processingPurchases.add(decryptKey);
    
    try {
        // Step 1: Request public decryption from KMS
        // Reference: https://docs.zama.org/protocol/relayer-sdk-guides/development-guide/node#decrypt-values
        console.log("   Requesting public decryption from KMS...");
        console.log("   📖 Guide: https://docs.zama.org/protocol/relayer-sdk-guides/development-guide/node#decrypt-values");
        
        // Poll for decryption result (KMS may take time)
        // According to Zama docs, publicDecrypt returns: 
        // { clearValues: { [handle]: decryptedValue }, abiEncodedClearValues, decryptionProof }
        let decryptionResult = null;
        let attempts = 0;
        const maxAttempts = 12; // 60 seconds max (5s intervals)
        
        while (!decryptionResult && attempts < maxAttempts) {
            attempts++;
            
            try {
                console.log(`   Poll attempt ${attempts}/${maxAttempts}...`);
                
                // Call publicDecrypt with handle from event
                const result = await fheInstance.publicDecrypt([encryptedIndexHandle]);
                
                if (result && result.clearValues) {
                    decryptionResult = result;
                    console.log("   ✅ Decryption result received");
                    break;
                }
                
                console.log("   ⏳ Waiting for KMS to process...");
                await new Promise(resolve => setTimeout(resolve, 5000));
                
            } catch (e) {
                console.error(`   ⚠️  Poll ${attempts} failed:`, e.message);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
        
        if (!decryptionResult) {
            throw new Error('Decryption timeout - KMS did not respond in time');
        }
        
        // Step 2: Extract decrypted value and proof
        console.log("   Decryption result keys:", Object.keys(decryptionResult));
        
        const decryptedValue = decryptionResult.clearValues[encryptedIndexHandle];
        const abiEncodedClearValues = decryptionResult.abiEncodedClearValues;
        const decryptionProof = decryptionResult.decryptionProof;
        
        console.log("   Decrypted rarity index:", decryptedValue);
        console.log("   ABI encoded clear values:", abiEncodedClearValues ? 'present' : 'missing');
        console.log("   Decryption proof:", decryptionProof ? 'present' : 'missing');
        
        if (typeof decryptedValue === 'undefined') {
            throw new Error('Decrypted value is undefined');
        }
        
        // Step 3: Generate NFT with IPFS upload
        console.log("\n🎨 Generating NFT metadata and uploading to IPFS...");
        let nftData = null;
        try {
            const rarityIndex = Number(decryptedValue);
            nftData = await generateNFTForMinting(purchaseId, rarityIndex);
            console.log(`   ✅ NFT generated: ${nftData.name} (${nftData.rarity})`);
            console.log(`   📦 IPFS Metadata: ${nftData.metadataURI}`);
            console.log(`   🖼️  IPFS Image: ${nftData.imageURI}`);
        } catch (nftError) {
            console.error(`   ⚠️  NFT generation failed:`, nftError.message);
            console.log(`   ℹ️  Will continue with contract fulfillment...`);
        }
        
        // Step 4: Call fulfillDecryptionWithProof on contract
        // Reference: MysteryBox.sol v0.9
        // fulfillDecryptionWithProof(uint256 purchaseId, bytes32[] calldata handlesList, bytes calldata abiEncodedCleartexts, bytes calldata decryptionProof)
        console.log(`   Calling fulfillDecryptionWithProof(${purchaseId})...`);
        
        // Prepare parameters according to v0.9 signature
        const handlesList = [encryptedIndexHandle]; // bytes32[] - array of handles we decrypted
        const abiEncodedCleartexts = abiEncodedClearValues; // bytes - ABI encoded cleartext values
        const proofBytes = decryptionProof || '0x'; // bytes - KMS signature proof
        
        console.log("   Handles list:", handlesList);
        console.log("   ABI encoded cleartexts length:", abiEncodedCleartexts?.length || 0, "chars");
        console.log("   Proof length:", proofBytes.length, "chars");
        
        // Send transaction with proper nonce and gas management
        console.log("   Preparing transaction with current nonce...");
        const fulfillNonce = await getNextNonce();
        
        const feeData = await safeProviderCall(
            () => provider.getFeeData(),
            'Getting fee data for fulfillment'
        );
        
        const txOptions = {
            nonce: fulfillNonce,
            maxFeePerGas: feeData.maxFeePerGas ? feeData.maxFeePerGas * 120n / 100n : undefined, // +20%
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? feeData.maxPriorityFeePerGas * 120n / 100n : undefined, // +20%
            gasLimit: 1000000n
        };
        
        console.log(`   Nonce: ${fulfillNonce}, Gas: ${txOptions.maxFeePerGas ? (Number(txOptions.maxFeePerGas) / 1e9).toFixed(2) + ' Gwei' : 'auto'}`);
        
        let tx, receipt;
        try {
            tx = await box.fulfillDecryptionWithProof(
                purchaseId,
                handlesList,
                abiEncodedCleartexts,
                proofBytes,
                txOptions
            );
            
            console.log(`   Transaction sent: ${tx.hash}`);
            receipt = await tx.wait();
        } catch (txError) {
            // Handle "already known" - transaction already pending/mined
            if (txError.message?.includes('already known') || txError.code === 'NONCE_EXPIRED') {
                console.log(`   ℹ️  Transaction already submitted (nonce ${fulfillNonce})`);
                console.log(`   Checking blockchain for existing transaction...`);
                
                // Wait a bit and check if transaction was mined
                await new Promise(resolve => setTimeout(resolve, 5000));
                
                // Try to find transaction in recent blocks
                const currentBlock = await provider.getBlockNumber();
                console.log(`   Scanning blocks around ${currentBlock}...`);
                
                // If we can't find it, just mark as completed to avoid retry loops
                console.log(`   ⚠️  Marking as completed to prevent retry`);
                processedPurchases.add(decryptKey);
                processingPurchases.delete(decryptKey);
                return;
            }
            throw txError;
        }
        
        if (!receipt) {
            throw new Error('No receipt received');
        }
        console.log(`   ✅ Decryption fulfilled: Gas used: ${receipt.gasUsed.toString()}`);
        console.log(`   Block: ${receipt.blockNumber}`);
        
        // Parse events to confirm NFT minted
        const iface = new ethers.Interface(abi);
        const logs = receipt.logs
            .map(log => {
                try {
                    return iface.parseLog(log);
                } catch (e) {
                    return null;
                }
            })
            .filter(log => log !== null);
        
        const nftRevealedEvent = logs.find(log => log?.name === 'NFTRevealed');
        
        console.log(`   📋 Found ${logs.length} parsed events in receipt`);
        console.log(`   Event names:`, logs.map(log => log?.name).filter(Boolean).join(', '));
        console.log(`   NFTRevealed event found: ${!!nftRevealedEvent}`);
        
        if (nftRevealedEvent) {
            const nftTokenId = nftRevealedEvent.args.tokenId;
            const rarityTier = nftRevealedEvent.args.rarity;
            const purchaseIdFromEvent = nftRevealedEvent.args.purchaseId;
            
            console.log(`   🎉 NFT Minted! Token ID: ${nftTokenId}`);
            console.log(`   Rarity Tier: ${rarityTier}`);
            
            // Get buyer address from purchase
            console.log(`   Fetching buyer address from contract...`);
            const purchase = await box.purchases(purchaseId);
            const buyer = purchase.buyer;
            console.log(`   Owner: ${buyer}`);
            
            // Step 5: Set IPFS URI on NFT contract (if NFT generation succeeded)
            if (nftData && nftData.metadataURI) {
                try {
                    console.log("\n📌 Setting IPFS URI on NFT contract...");
                    
                    // Load NFT contract
                    const NFT_ADDRESS = process.env.MYSTERY_NFT_ADDRESS;
                    if (!NFT_ADDRESS) {
                        throw new Error('MYSTERY_NFT_ADDRESS not set in .env');
                    }
                    
                    // Load NFT ABI
                    const nftAbiPath = path.join(__dirname, '../contracts/MysteryNFT.json');
                    if (!fs.existsSync(nftAbiPath)) {
                        throw new Error('MysteryNFT.json not found - run hardhat compile first');
                    }
                    const nftArtifact = JSON.parse(fs.readFileSync(nftAbiPath, 'utf8'));
                    const nftAbi = nftArtifact.abi;
                    
                    const nftContract = new ethers.Contract(NFT_ADDRESS, nftAbi, wallet);
                    
                    // Call setTokenURI
                    const setUriNonce = await getNextNonce();
                    const setUriTx = await nftContract.setTokenURI(
                        nftTokenId,
                        nftData.metadataURI,
                        {
                            nonce: setUriNonce,
                            gasLimit: 200000n
                        }
                    );
                    
                    console.log(`   Transaction sent: ${setUriTx.hash}`);
                    await setUriTx.wait();
                    console.log(`   ✅ TokenURI set successfully!`);
                    
                } catch (uriError) {
                    console.error(`   ⚠️  Failed to set tokenURI:`, uriError.message);
                }
            }
            
            // Step 6: Save to database
            console.log(`\n💾 Saving NFT to database... (nftData present: ${!!nftData})`);
            
            if (!nftData) {
                console.log(`   ⚠️  NFT data not available - skipping metadata save`);
                console.log(`   ℹ️  NFT #${nftTokenId} was minted but IPFS data missing`);
            } else {
                try {
                    console.log(`   Preparing to save NFT #${nftTokenId}...`);
                    console.log(`   - Owner: ${buyer}`);
                    console.log(`   - Rarity: ${nftData.rarity}`);
                    console.log(`   - Name: ${nftData.name}`);
                    
                    const savedNFT = await nftDB.saveNFT({
                        tokenId: Number(nftTokenId),
                        ownerAddress: buyer,
                        rarity: nftData.rarity,
                        name: nftData.name,
                        type: nftData.type,
                        attributes: nftData.attributes,
                        ipfsMetadataURI: nftData.metadataURI,
                        ipfsImageURI: nftData.imageURI,
                        purchaseId: Number(purchaseId),
                        transactionHash: receipt.hash,
                        blockNumber: receipt.blockNumber
                    });
                    
                    console.log(`   ✅ NFT saved to database!`);
                    console.log(`   Database record:`, savedNFT ? 'created' : 'unknown');
                    console.log(`\n🎊 COMPLETE! NFT #${nftTokenId} ready for display in DApp`);
                    
                } catch (dbError) {
                    console.error(`   ⚠️  Failed to save to database:`, dbError.message);
                    console.error(`   Stack:`, dbError.stack);
                }
            }
        } else {
            console.log(`\n⚠️  DecryptionFulfilled event not found in receipt`);
            console.log(`   Cannot save NFT - missing tokenId and buyer info`);
        }
        
        // Mark as completed
        processedPurchases.add(decryptKey);
        processingPurchases.delete(decryptKey);
        
    } catch (error) {
        console.error(`\n❌ Error handling BoxOpened:`, error.message);
        console.error("   Purchase ID:", purchaseId);
        console.error("   Handle:", encryptedIndexHandle);
        
        // Check for rate limit and switch provider if needed
        if (rpcManager.isRateLimitError(error)) {
            console.log('⚠️  Rate limit detected in BoxOpened handler...');
            rpcManager.markFailed(currentEndpoint.url, error);
        }
        
        if (error.stack) console.error("   Stack:", error.stack);
        
        // Remove from processing so it can be retried
        processingPurchases.delete(decryptKey);
    }
}

// ============================================================================
// Main: Start Relayer Service
// ============================================================================
async function start() {
    console.log("\n" + "=".repeat(70));
    console.log("🚀 Starting Relayer Service");
    console.log("=".repeat(70));
    
    // Initialize database
    try {
        console.log("\n💾 Initializing NFT database...");
        await nftDB.initDatabase();
    } catch (dbError) {
        console.error("❌ Failed to initialize database:", dbError);
        console.error("⚠️  Continuing without database - NFTs won't be saved");
    }
    
    // Initialize Zama SDK
    const initialized = await initializeRelayerSDK();
    if (!initialized) {
        console.error("\n❌ Cannot start relayer without FHE SDK");
        console.error("💡 Check the troubleshooting steps above");
        process.exit(1);
    }
    
    // Set up event listeners
    console.log("\n👂 Setting up event listeners...");
    
    // Listen for BoxPurchased events
    box.on("BoxPurchased", async (purchaseId, buyer, boxId, event) => {
        console.log("\n" + "=".repeat(70));
        await handleBoxPurchased(purchaseId);
    });
    
    // Listen for BoxOpened events (NEW: with handle parameter)
    box.on("BoxOpened", async (purchaseId, encryptedIndexHandle, event) => {
        console.log("\n" + "=".repeat(70));
        await handleBoxOpened(purchaseId, encryptedIndexHandle);
    });
    
    console.log("✅ Event listeners registered");
    
    // Display RPC health status
    console.log("\n📊 RPC Endpoints Status:");
    const healthStatus = rpcManager.getHealthStatus();
    healthStatus.forEach((ep, i) => {
        const status = ep.healthy ? '✅' : '❌';
        const cooldown = ep.cooldownRemaining > 0 ? ` (cooldown: ${Math.round(ep.cooldownRemaining/1000)}s)` : '';
        console.log(`   ${i + 1}. ${status} ${ep.name} (${ep.type})${cooldown}`);
    });
    
    console.log("\n" + "=".repeat(70));
    console.log("✅ Relayer is now running and listening for events...");
    console.log("   📖 Documentation: https://docs.zama.org/protocol/relayer-sdk-guides");
    console.log("   🔄 Automatic failover: Enabled");
    console.log("   ⚡ Current endpoint:", currentEndpoint.name);
    console.log("   Press Ctrl+C to stop");
    console.log("=".repeat(70) + "\n");
    
    // Periodic health status display (every 5 minutes)
    setInterval(() => {
        console.log("\n📊 RPC Health Update:");
        const status = rpcManager.getHealthStatus();
        status.forEach((ep, i) => {
            if (!ep.healthy) {
                console.log(`   ⚠️  ${ep.name}: ${ep.failures} failures`);
            }
        });
        console.log(`   ✅ Current: ${currentEndpoint.name}\n`);
    }, 300000); // 5 minutes
    
    // Keep process alive
    await new Promise(() => {});
}

// Start the relayer service
start().catch((error) => {
    console.error("\n💥 Fatal error:", error);
    console.error("\n💡 Troubleshooting:");
    console.error("   1. Check all environment variables in .env");
    console.error("   2. Verify contract is deployed and address is correct");
    console.error("   3. Ensure RELAYER_PRIVATE_KEY has RELAYER_ROLE granted");
    console.error("   4. Check network connectivity");
    console.error("   5. Read guide: https://docs.zama.org/protocol/relayer-sdk-guides");
    process.exit(1);
});