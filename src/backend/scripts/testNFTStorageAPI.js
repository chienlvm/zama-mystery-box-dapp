/**
 * Test NFT.Storage API Key
 * Verifies API key is valid by making a test request
 */

require('dotenv').config();
const { NFTStorage, File } = require('nft.storage');

async function testAPIKey() {
  console.log('🧪 Testing NFT.Storage API Key...\n');
  
  const apiKey = process.env.NFT_STORAGE_API_KEY;
  
  if (!apiKey) {
    console.error('❌ NFT_STORAGE_API_KEY not found in .env file');
    process.exit(1);
  }
  
  console.log('✅ API Key found');
  console.log('   Format:', apiKey.substring(0, 20) + '...' + apiKey.substring(apiKey.length - 10));
  console.log('   Length:', apiKey.length);
  console.log('   Valid JWT format:', apiKey.startsWith('eyJ'));
  
  // Test API connection
  try {
    const client = new NFTStorage({ token: apiKey });
    
    console.log('\n📤 Testing upload with small file...');
    
    // Create a tiny test file
    const testData = JSON.stringify({
      test: 'NFT.Storage API Test',
      timestamp: new Date().toISOString()
    });
    
    const testFile = new File([testData], 'test.json', { type: 'application/json' });
    
    // Upload test file
    const cid = await client.storeBlob(testFile);
    
    console.log('✅ Upload successful!');
    console.log('   CID:', cid);
    console.log('   Gateway URL: https://nftstorage.link/ipfs/' + cid);
    console.log('\n🎉 NFT.Storage API is working correctly!');
    console.log('   Your API key is valid and ready to use.');
    
  } catch (error) {
    console.error('\n❌ API Test Failed:');
    console.error('   Error:', error.message);
    
    if (error.message.includes('Unauthorized') || error.message.includes('401')) {
      console.error('\n💡 Solution: Your API key is invalid or expired.');
      console.error('   1. Go to https://nft.storage');
      console.error('   2. Sign in with your wallet');
      console.error('   3. Generate a new API key');
      console.error('   4. Update NFT_STORAGE_API_KEY in .env file');
    } else if (error.message.includes('rate limit')) {
      console.error('\n💡 Solution: Rate limit reached. Wait a few minutes and try again.');
    } else {
      console.error('\n💡 Full error:', error);
    }
    
    process.exit(1);
  }
}

testAPIKey();
