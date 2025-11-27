const express = require('express');
const router = express.Router();
const dropRatesData = require('../data/dropRates.json');

// GET /api/drop-rates
// Returns drop rate percentages for each box type and rarity
router.get('/', (req, res) => {
  try {
    const { box, rarity } = req.query;
    
    let responseData = dropRatesData;
    
    // Filter by specific box type if requested
    if (box) {
      responseData = Object.keys(dropRatesData).reduce((acc, rarityKey) => {
        acc[rarityKey] = {
          [box]: dropRatesData[rarityKey][box]
        };
        return acc;
      }, {});
    }
    
    // Filter by specific rarity if requested
    if (rarity) {
      responseData = {
        [rarity]: dropRatesData[rarity]
      };
    }
    
    res.json({
      success: true,
      data: responseData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch drop rates',
      message: error.message
    });
  }
});

// GET /api/drop-rates/calculate
// Calculate expected value for a box purchase
router.get('/calculate', (req, res) => {
  try {
    const { boxType } = req.query;
    
    if (!boxType) {
      return res.status(400).json({
        success: false,
        error: 'Box type required'
      });
    }
    
    const boxKey = boxType.toLowerCase();
    
    // Calculate probabilities
    const probabilities = Object.keys(dropRatesData).reduce((acc, rarity) => {
      acc[rarity] = dropRatesData[rarity][boxKey] || 0;
      return acc;
    }, {});
    
    // Verify probabilities sum to 100%
    const total = Object.values(probabilities).reduce((sum, val) => sum + val, 0);
    
    res.json({
      success: true,
      data: {
        boxType: boxType,
        probabilities: probabilities,
        totalProbability: total,
        isValid: total === 100
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to calculate drop rates',
      message: error.message
    });
  }
});

// GET /api/drop-rates/chart
// Returns data formatted for chart display
router.get('/chart', (req, res) => {
  try {
    // Transform data for recharts bar chart format
    const chartData = Object.keys(dropRatesData).map(rarity => ({
      rarity: rarity,
      bronze: dropRatesData[rarity].bronze,
      silver: dropRatesData[rarity].silver,
      gold: dropRatesData[rarity].gold
    }));
    
    res.json({
      success: true,
      data: chartData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to format chart data',
      message: error.message
    });
  }
});

module.exports = router;
