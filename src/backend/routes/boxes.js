const express = require('express');
const router = express.Router();
const boxesData = require('../data/boxes.json');
const contractService = require('../services/contractService');

// GET /api/boxes
// Returns all available mystery box types from smart contract
router.get('/', async (req, res) => {
  try {
    // Fetch boxes from smart contract
    const contractBoxes = await contractService.getAllBoxes();
    
    // Merge with static data from JSON for UI enhancements
    const enrichedBoxes = contractBoxes.map(box => {
      const staticData = boxesData.find(b => b.id === box.id) || {};
      return {
        ...box,
        description: staticData.description || `${box.name} mystery box`,
        color: staticData.color || 'from-purple-600 to-blue-600',
        glowColor: staticData.glowColor || 'shadow-purple-500/50',
        price: parseFloat(box.priceEth), // For backward compatibility
        currency: 'ETH',
      };
    });
    
    res.json({
      success: true,
      data: enrichedBoxes,
      timestamp: new Date().toISOString(),
      source: 'smart-contract'
    });
  } catch (error) {
    console.error('❌ Error fetching boxes:', error);
    
    // Fallback to static data if contract fails
    res.json({
      success: true,
      data: boxesData,
      timestamp: new Date().toISOString(),
      source: 'fallback',
      error: error.message
    });
  }
});

// GET /api/boxes/:id
// Returns specific box details from smart contract
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Fetch from smart contract
    const contractBox = await contractService.getBoxConfig(id);
    
    if (!contractBox) {
      return res.status(404).json({
        success: false,
        error: 'Box not found on blockchain'
      });
    }
    
    // Merge with static data
    const staticData = boxesData.find(b => b.id === id) || {};
    const enrichedBox = {
      ...contractBox,
      description: staticData.description || `${contractBox.name} mystery box`,
      color: staticData.color || 'from-purple-600 to-blue-600',
      glowColor: staticData.glowColor || 'shadow-purple-500/50',
      price: parseFloat(contractBox.priceEth),
      currency: 'ETH',
    };
    
    res.json({
      success: true,
      data: enrichedBox,
      timestamp: new Date().toISOString(),
      source: 'smart-contract'
    });
  } catch (error) {
    console.error('❌ Error fetching box:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch box',
      message: error.message
    });
  }
});

module.exports = router;
