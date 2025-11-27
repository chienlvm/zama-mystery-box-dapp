const fs = require('fs').promises;
const path = require('path');
const galleryDB = require('../services/galleryDatabase');

const NFTS_JSON_PATH = path.join(__dirname, '../data/nfts.json');
const NFTS_IMAGES_DIR = path.join(__dirname, '../nfts');

async function imageToBase64(imagePath) {
  try {
    const imageBuffer = await fs.readFile(imagePath);
    const base64 = imageBuffer.toString('base64');
    const ext = path.extname(imagePath).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error(`Error converting image to base64: ${imagePath}`, error);
    return null;
  }
}

async function importGalleryNFTs() {
  try {
    console.log('🔄 Starting gallery NFTs import...');
    
    // Initialize database
    await galleryDB.initialize();
    
    // Read NFTs metadata
    const nftsData = JSON.parse(await fs.readFile(NFTS_JSON_PATH, 'utf-8'));
    console.log(`📦 Found ${nftsData.length} NFTs in nfts.json`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const nft of nftsData) {
      try {
        // Build full image path
        const imagePath = path.join(NFTS_IMAGES_DIR, nft.image.replace('nfts/', ''));
        
        // Check if image exists
        try {
          await fs.access(imagePath);
        } catch {
          console.warn(`⚠️  Image not found: ${imagePath}`);
          errorCount++;
          continue;
        }
        
        // Convert image to base64
        const imageBase64 = await imageToBase64(imagePath);
        
        if (!imageBase64) {
          console.warn(`⚠️  Failed to convert image: ${nft.id}`);
          errorCount++;
          continue;
        }
        
        // Save to database
        await galleryDB.saveGalleryNFT({
          id: nft.id,
          name: nft.name,
          rarity: nft.rarity,
          type: nft.type,
          imageBase64: imageBase64,
          imagePath: nft.image,
          attributes: nft.attributes
        });
        
        successCount++;
        console.log(`✅ Imported: ${nft.name} (${nft.rarity})`);
        
      } catch (error) {
        console.error(`❌ Error importing ${nft.id}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n📊 Import Summary:');
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📦 Total: ${nftsData.length}`);
    
    const totalInDB = await galleryDB.getGalleryNFTCount();
    console.log(`   💾 Database Count: ${totalInDB}`);
    
    galleryDB.close();
    console.log('\n✨ Import completed!');
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  importGalleryNFTs();
}

module.exports = { importGalleryNFTs };
