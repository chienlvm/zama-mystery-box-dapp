const express = require('express');
const router = express.Router();
const galleryData = require('../data/gallery.json');
const galleryDB = require('../services/galleryDatabase');

/**
 * GET /api/gallery/featured
 * Get all featured gallery NFTs with base64 encoded images from database
 */
router.get('/featured', async (req, res) => {
  try {
    const { limit, rarity } = req.query;
    
    let nfts;
    
    // Filter by rarity if specified
    if (rarity) {
      nfts = await galleryDB.getGalleryNFTsByRarity(rarity);
    } else {
      nfts = await galleryDB.getAllGalleryNFTs();
    }
    
    // Limit results if specified
    if (limit) {
      const limitNum = parseInt(limit);
      nfts = nfts.slice(0, limitNum);
    }
    
    res.json({
      success: true,
      count: nfts.length,
      data: nfts
    });
    
  } catch (error) {
    console.error('Error fetching featured gallery NFTs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/gallery/stats
 * Get gallery statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const total = await galleryDB.getGalleryNFTCount();
    
    res.json({
      success: true,
      data: {
        total,
        lastUpdate: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error fetching gallery stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/gallery/rarity/:rarity
 * Get gallery NFTs by rarity
 */
router.get('/rarity/:rarity', async (req, res) => {
  try {
    const { rarity } = req.params;
    const nfts = await galleryDB.getGalleryNFTsByRarity(rarity);
    
    res.json({
      success: true,
      rarity,
      count: nfts.length,
      data: nfts
    });
    
  } catch (error) {
    console.error('Error fetching gallery NFTs by rarity:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/gallery (legacy - keep for backwards compatibility)
// Returns featured NFTs for the gallery section from JSON
router.get('/', (req, res) => {
  try {
    const { limit, rarity } = req.query;
    
    let filteredGallery = [...galleryData];
    
    // Filter by rarity if specified
    if (rarity) {
      filteredGallery = filteredGallery.filter(
        item => item.rarity.toLowerCase() === rarity.toLowerCase()
      );
    }
    
    // Limit results if specified
    if (limit) {
      const limitNum = parseInt(limit);
      filteredGallery = filteredGallery.slice(0, limitNum);
    }
    
    res.json({
      success: true,
      data: filteredGallery,
      total: filteredGallery.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch gallery',
      message: error.message
    });
  }
});

// GET /api/gallery/:id (legacy - keep for backwards compatibility)
// Returns specific gallery item details
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const item = galleryData.find(i => i.id === parseInt(id));
    
    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Gallery item not found'
      });
    }
    
    res.json({
      success: true,
      data: item,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch gallery item',
      message: error.message
    });
  }
});

module.exports = router;
