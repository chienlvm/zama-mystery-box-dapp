/**
 * Test Pinata API Credentials
 * Verifies API credentials are valid by uploading a test file
 */

require('dotenv').config();
const pinataSDK = require('@pinata/sdk');

async function testPinataAPI() {
  console.log('🧪 Testing Pinata API Credentials...\n');
  
  const apiKey = process.env.PINATA_API_KEY;
  const apiSecret = process.env.PINATA_API_SECRET;
  
  if (!apiKey || !apiSecret) {
    console.error('❌ Pinata credentials not found in .env file');
    console.error('   Required: PINATA_API_KEY and PINATA_API_SECRET');
    process.exit(1);
  }
  
  console.log('✅ API credentials found');
  console.log('   API Key:', apiKey.substring(0, 10) + '...' + apiKey.substring(apiKey.length - 4));
  console.log('   API Secret:', apiSecret.substring(0, 10) + '...' + apiSecret.substring(apiSecret.length - 4));
  
  try {
    // Initialize Pinata client
    const pinata = new pinataSDK(apiKey, apiSecret);
    
    console.log('\n🔗 Testing connection...');
    
    // Test authentication
    const authTest = await pinata.testAuthentication();
    console.log('✅ Authentication successful!');
    console.log('   Message:', authTest.message);
    
    // Test JSON upload
    console.log('\n📤 Testing JSON upload...');
    const testData = {
      test: 'Pinata API Test',
      timestamp: new Date().toISOString(),
      message: 'NFT Mystery Box - IPFS Upload Test'
    };
    
    const options = {
      pinataMetadata: {
        name: 'Test_JSON_' + Date.now()
      },
      pinataOptions: {
        cidVersion: 0
      }
    };
    
    const result = await pinata.pinJSONToIPFS(testData, options);
    
    console.log('✅ Upload successful!');
    console.log('   IPFS Hash (CID):', result.IpfsHash);
    console.log('   Pin Size:', result.PinSize, 'bytes');
    console.log('   Timestamp:', result.Timestamp);
    console.log('\n🌐 Gateway URLs:');
    console.log('   Pinata:', 'https://gateway.pinata.cloud/ipfs/' + result.IpfsHash);
    console.log('   IPFS.io:', 'https://ipfs.io/ipfs/' + result.IpfsHash);
    
    console.log('\n🎉 Pinata API is working correctly!');
    console.log('   Your credentials are valid and ready to use.');
    console.log('   NFT images and metadata will be uploaded to IPFS via Pinata.');
    
  } catch (error) {
    console.error('\n❌ API Test Failed:');
    console.error('   Error:', error.message);
    
    if (error.message.includes('Invalid authentication credentials')) {
      console.error('\n💡 Solution: Your API credentials are invalid.');
      console.error('   1. Go to https://pinata.cloud');
      console.error('   2. Sign in to your account');
      console.error('   3. Navigate to: Developers → API Keys');
      console.error('   4. Generate a new API key');
      console.error('   5. Update PINATA_API_KEY and PINATA_API_SECRET in .env file');
    } else if (error.message.includes('rate limit')) {
      console.error('\n💡 Solution: Rate limit reached. Wait a few minutes and try again.');
    } else {
      console.error('\n💡 Full error:', error);
    }
    
    process.exit(1);
  }
}

testPinataAPI();
