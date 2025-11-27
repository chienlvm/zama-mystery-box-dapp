/**
 * NFT Service - Random selection and IPFS upload
 * 
 * Flow:
 * 1. Map rarityIndex (0-4) → rarity name
 * 2. Random select NFT metadata from pool
 * 3. Random select image from nfts/{rarity}/ folder
 * 4. Upload to NFT.Storage (IPFS)
 * 5. Return IPFS metadata URI for contract
 */

const pinataSDK = require('@pinata/sdk');
const fs = require('fs');
const path = require('path');

// Load NFT metadata templates
const nftsData = require('../data/nfts.json');

// Initialize Pinata client
const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_API_SECRET = process.env.PINATA_API_SECRET;
if (!PINATA_API_KEY || !PINATA_API_SECRET) {
  console.warn('⚠️ Pinata credentials not set - IPFS upload will fail');
}
const pinata = (PINATA_API_KEY && PINATA_API_SECRET) 
  ? new pinataSDK(PINATA_API_KEY, PINATA_API_SECRET)
  : null;

/**
 * Map rarityIndex from FHE decryption to rarity name
 * Based on dropRates.json distribution
 */
function rarityIndexToName(rarityIndex) {
  const mapping = {
    0: 'Common',      // 60%
    1: 'Uncommon',    // 25%
    2: 'Rare',        // 10%
    3: 'Epic',        // 4%
    4: 'Legendary'    // 1%
  };
  return mapping[rarityIndex] || 'Common';
}

/**
 * Get random NFT metadata from pool by rarity
 */
function getRandomNFTMetadata(rarity) {
  // Filter NFTs by rarity
  const pool = nftsData.filter(nft => nft.rarity === rarity);
  
  if (pool.length === 0) {
    throw new Error(`No NFT metadata found for rarity: ${rarity}`);
  }
  
  // Random select
  const randomIndex = Math.floor(Math.random() * pool.length);
  return pool[randomIndex];
}

/**
 * Get random image file path from nfts/{rarity}/ folder
 */
function getRandomImagePath(rarity) {
  const nftsDir = path.join(__dirname, '../nfts', rarity);
  
  if (!fs.existsSync(nftsDir)) {
    throw new Error(`NFT images folder not found: ${nftsDir}`);
  }
  
  // Get all .jpg files
  const files = fs.readdirSync(nftsDir)
    .filter(file => file.endsWith('.jpg') || file.endsWith('.png'));
  
  if (files.length === 0) {
    throw new Error(`No images found in ${nftsDir}`);
  }
  
  // Random select
  const randomIndex = Math.floor(Math.random() * files.length);
  const filename = files[randomIndex];
  
  return path.join(nftsDir, filename);
}

/**
 * Upload NFT to IPFS via Pinata
 * Fallback: If upload fails, returns data URI for on-chain storage
 * Returns IPFS metadata URI: ipfs://QmXXX.../metadata.json
 */
async function uploadNFTToIPFS(tokenId, rarity, metadata, imagePath) {
  console.log(`📤 Uploading NFT #${tokenId} to IPFS via Pinata...`);
  console.log(`   Rarity: ${rarity}`);
  console.log(`   Name: ${metadata.name}`);
  console.log(`   Image: ${imagePath}`);
  
  
  // Check if Pinata client is available
  if (!pinata) {
    console.warn('⚠️  Pinata credentials not set - using fallback on-chain storage');
    return generateFallbackMetadata(tokenId, rarity, metadata, imagePath);
  }
  
  try {
    // Step 1: Upload image file to Pinata
    const imageBuffer = fs.readFileSync(imagePath);
    const imageExtension = path.extname(imagePath);
    
    console.log(`   📸 Uploading image (${(imageBuffer.length / 1024).toFixed(2)} KB)...`);
    
    const readableStreamForFile = require('stream').Readable.from(imageBuffer);
    const imageOptions = {
      pinataMetadata: {
        name: `NFT_${tokenId}_Image${imageExtension}`
      },
      pinataOptions: {
        cidVersion: 0
      }
    };
    
    const imageResult = await pinata.pinFileToIPFS(readableStreamForFile, imageOptions);
    const imageCID = imageResult.IpfsHash;
    const imageURI = `ipfs://${imageCID}`;
    console.log(`   ✅ Image uploaded: ${imageCID}`);
    
    // Step 2: Create and upload metadata JSON to Pinata
    const formattedAttributes = [
      { trait_type: 'Rarity', value: rarity },
      { trait_type: 'Type', value: metadata.type },
      ...Object.entries(metadata.attributes).map(([key, value]) => ({
        trait_type: key.charAt(0).toUpperCase() + key.slice(1),
        value: value
      }))
    ];
    
    const nftMetadata = {
      name: `${metadata.name} #${tokenId}`,
      description: `FHE-powered Mystery Box NFT - ${rarity} rarity item from encrypted loot box`,
      image: imageURI,
      attributes: formattedAttributes
    };
    
    console.log(`   📝 Uploading metadata...`);
    
    const metadataOptions = {
      pinataMetadata: {
        name: `NFT_${tokenId}_Metadata`
      },
      pinataOptions: {
        cidVersion: 0
      }
    };
    
    const metadataResult = await pinata.pinJSONToIPFS(nftMetadata, metadataOptions);
    const metadataCID = metadataResult.IpfsHash;
    const metadataURI = `ipfs://${metadataCID}`;
    console.log(`   ✅ Metadata uploaded: ${metadataCID}`);
    
    console.log(`\n✅ NFT uploaded to IPFS successfully via Pinata!`);
    console.log(`   📦 Metadata: https://gateway.pinata.cloud/ipfs/${metadataCID}`);
    console.log(`   🖼️  Image: https://gateway.pinata.cloud/ipfs/${imageCID}`);
    
    return {
      metadataURI,
      imageURI,
      ipfsMetadata: nftMetadata
    };
    
  } catch (error) {
    console.error('❌ Pinata upload failed:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.data);
    }
    console.warn('⚠️  Falling back to on-chain metadata storage');
    return generateFallbackMetadata(tokenId, rarity, metadata, imagePath);
  }
}

/**
 * Generate fallback metadata using data URI (on-chain storage)
 * Used when IPFS upload fails or API key is not available
 */
function generateFallbackMetadata(tokenId, rarity, metadata, imagePath) {
  console.log(`   📦 Generating on-chain metadata (data URI)...`);
  
  // Read image and convert to base64
  const imageBuffer = fs.readFileSync(imagePath);
  const imageExtension = path.extname(imagePath);
  const mimeType = imageExtension === '.png' ? 'image/png' : 'image/jpeg';
  const imageBase64 = imageBuffer.toString('base64');
  const imageDataURI = `data:${mimeType};base64,${imageBase64}`;
  
  // Format attributes for ERC721 standard
  const formattedAttributes = [
    { trait_type: 'Rarity', value: rarity },
    { trait_type: 'Type', value: metadata.type },
    ...Object.entries(metadata.attributes).map(([key, value]) => ({
      trait_type: key.charAt(0).toUpperCase() + key.slice(1),
      value: value
    }))
  ];
  
  const nftMetadata = {
    name: `${metadata.name} #${tokenId}`,
    description: `FHE-powered Mystery Box NFT - ${rarity} rarity item from encrypted loot box`,
    image: imageDataURI,
    attributes: formattedAttributes
  };
  
  // Convert metadata to base64 data URI
  const metadataJSON = JSON.stringify(nftMetadata);
  const metadataBase64 = Buffer.from(metadataJSON).toString('base64');
  const metadataURI = `data:application/json;base64,${metadataBase64}`;
  
  console.log(`   ✅ Fallback metadata generated (on-chain storage)`);
  console.log(`   📊 Image size: ${(imageBuffer.length / 1024).toFixed(2)} KB`);
  console.log(`   📊 Metadata size: ${(metadataJSON.length / 1024).toFixed(2)} KB`);
  
  return {
    metadataURI,
    imageURI: imageDataURI,
    ipfsMetadata: nftMetadata
  };
}

/**
 * Main function: Generate NFT for minting
 * Called by relayer after FHE decryption
 * 
 * @param {number} tokenId - NFT token ID
 * @param {number} rarityIndex - Decrypted rarity index (0-4)
 * @returns {Object} { rarity, name, type, attributes, metadataURI, imageURI }
 */
async function generateNFTForMinting(tokenId, rarityIndex) {
  console.log(`\n🎲 Generating NFT #${tokenId} with rarityIndex ${rarityIndex}...`);
  
  try {
    // Step 1: Map rarityIndex to rarity name
    const rarity = rarityIndexToName(rarityIndex);
    console.log(`📊 Rarity: ${rarity}`);
    
    // Step 2: Random select metadata from pool
    const metadata = getRandomNFTMetadata(rarity);
    console.log(`🎴 Selected: ${metadata.name} (${metadata.type})`);
    
    // Step 3: Random select image
    const imagePath = getRandomImagePath(rarity);
    console.log(`🖼️  Image: ${path.basename(imagePath)}`);
    
    // Step 4: Upload to IPFS
    const ipfsResult = await uploadNFTToIPFS(tokenId, rarity, metadata, imagePath);
    
    // Step 5: Return complete NFT data
    return {
      tokenId,
      rarity,
      name: metadata.name,
      type: metadata.type,
      attributes: metadata.attributes,
      metadataURI: ipfsResult.metadataURI,  // For contract.setTokenURI()
      imageURI: ipfsResult.imageURI,        // For frontend display
      ipfsMetadata: ipfsResult.ipfsMetadata // Full metadata
    };
    
  } catch (error) {
    console.error(`❌ Failed to generate NFT:`, error);
    throw error;
  }
}

/**
 * Get all available NFTs in pool (for testing/preview)
 */
function getAllNFTsInPool() {
  const pool = {};
  
  ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'].forEach(rarity => {
    pool[rarity] = nftsData.filter(nft => nft.rarity === rarity);
  });
  
  return pool;
}

module.exports = {
  rarityIndexToName,
  getRandomNFTMetadata,
  getRandomImagePath,
  generateNFTForMinting,
  uploadNFTToIPFS,
  getAllNFTsInPool
};
