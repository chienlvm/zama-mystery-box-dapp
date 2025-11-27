/**
 * Test script for nftService.js
 * 
 * Usage:
 *   node src/backend/services/testNftService.js
 * 
 * Tests:
 * 1. RarityIndex mapping
 * 2. Random NFT selection from pool
 * 3. Random image selection
 * 4. IPFS upload (requires PINATA_API_KEY and PINATA_API_SECRET)
 */

require('dotenv').config();
const nftService = require('./nftService');

async function testRarityMapping() {
  console.log('\n========================================');
  console.log('TEST 1: Rarity Index Mapping');
  console.log('========================================');
  
  for (let i = 0; i < 5; i++) {
    const rarity = nftService.rarityIndexToName(i);
    console.log(`rarityIndex ${i} → ${rarity}`);
  }
}

async function testRandomNFTSelection() {
  console.log('\n========================================');
  console.log('TEST 2: Random NFT Selection');
  console.log('========================================');
  
  const rarities = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];
  
  for (const rarity of rarities) {
    try {
      const nft = nftService.getRandomNFTMetadata(rarity);
      console.log(`\n${rarity}:`);
      console.log(`  Name: ${nft.name}`);
      console.log(`  Type: ${nft.type}`);
      console.log(`  Attributes:`, nft.attributes);
    } catch (error) {
      console.log(`\n${rarity}: ❌ ${error.message}`);
    }
  }
}

async function testRandomImageSelection() {
  console.log('\n========================================');
  console.log('TEST 3: Random Image Selection');
  console.log('========================================');
  
  const rarities = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];
  
  for (const rarity of rarities) {
    try {
      const imagePath = nftService.getRandomImagePath(rarity);
      console.log(`${rarity}: ${imagePath}`);
    } catch (error) {
      console.log(`${rarity}: ❌ ${error.message}`);
    }
  }
}

async function testFullNFTGeneration() {
  console.log('\n========================================');
  console.log('TEST 4: Full NFT Generation (Mock)');
  console.log('========================================');
  
  // Test with Legendary (rarityIndex = 4)
  const tokenId = 999;
  const rarityIndex = 4; // Legendary
  
  console.log(`\n🎲 Simulating NFT generation for token #${tokenId}...`);
  console.log(`   RarityIndex from FHE decrypt: ${rarityIndex}`);
  
  try {
    // Get rarity
    const rarity = nftService.rarityIndexToName(rarityIndex);
    console.log(`   Mapped to: ${rarity}`);
    
    // Get metadata
    const metadata = nftService.getRandomNFTMetadata(rarity);
    console.log(`\n✅ Selected NFT:`);
    console.log(`   Name: ${metadata.name}`);
    console.log(`   Type: ${metadata.type}`);
    console.log(`   Attributes:`, metadata.attributes);
    
    // Get image
    const imagePath = nftService.getRandomImagePath(rarity);
    console.log(`\n🖼️  Image selected: ${imagePath}`);
    
    console.log('\n📝 This NFT would be uploaded to IPFS in production');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

async function testIPFSUpload() {
  console.log('\n========================================');
  console.log('TEST 5: IPFS Upload (LIVE TEST)');
  console.log('========================================');
  
  if (!process.env.PINATA_API_KEY || !process.env.PINATA_API_SECRET) {
    console.log('⚠️ Skipping IPFS test - Pinata credentials not set');
    console.log('   Set them in .env file to test IPFS upload:');
    console.log('   PINATA_API_KEY=your_api_key');
    console.log('   PINATA_API_SECRET=your_api_secret');
    return;
  }
  
  console.log('🚀 Running LIVE IPFS upload test...');
  console.log('   (This will use your NFT.Storage quota)');
  
  try {
    const testTokenId = 99999;
    const testRarityIndex = 4; // Legendary
    
    const result = await nftService.generateNFTForMinting(testTokenId, testRarityIndex);
    
    console.log('\n✅ IPFS Upload Successful!');
    console.log('\n📦 NFT Data:');
    console.log(`   Token ID: ${result.tokenId}`);
    console.log(`   Name: ${result.name}`);
    console.log(`   Rarity: ${result.rarity}`);
    console.log(`   Type: ${result.type}`);
    console.log('\n🔗 IPFS URIs:');
    console.log(`   Metadata: ${result.metadataURI}`);
    console.log(`   Image: ${result.imageURI}`);
    console.log('\n👉 View in browser:');
    console.log(`   https://nftstorage.link/ipfs/${result.metadataURI.replace('ipfs://', '')}`);
    
  } catch (error) {
    console.error('❌ IPFS upload failed:', error.message);
  }
}

async function testNFTPool() {
  console.log('\n========================================');
  console.log('TEST 6: NFT Pool Statistics');
  console.log('========================================');
  
  const pool = nftService.getAllNFTsInPool();
  
  for (const [rarity, nfts] of Object.entries(pool)) {
    console.log(`\n${rarity}: ${nfts.length} items`);
    nfts.forEach(nft => {
      console.log(`  - ${nft.name} (${nft.type})`);
    });
  }
}

// Run all tests
async function runAllTests() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   NFT Service Test Suite               ║');
  console.log('╚════════════════════════════════════════╝');
  
  try {
    await testRarityMapping();
    await testRandomNFTSelection();
    await testRandomImageSelection();
    await testFullNFTGeneration();
    await testNFTPool();
    await testIPFSUpload();
    
    console.log('\n========================================');
    console.log('✅ All tests completed!');
    console.log('========================================\n');
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Run tests
runAllTests();
