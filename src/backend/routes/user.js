const express = require('express');
const router = express.Router();
const userData = require('../data/user.json');
const nftsData = require('../data/nfts.json');
const contractService = require('../services/contractService');

// GET /api/user
// Returns user profile with on-chain data
router.get('/', async (req, res) => {
  try {
    const { wallet } = req.query;
    
    if (!wallet) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address is required'
      });
    }
    
    console.log(`👤 Fetching user data for ${wallet}`);
    
    // Fetch on-chain data
    const balance = await contractService.getUserBalance(wallet);
    const nftCount = await contractService.getUserNFTCount(wallet);
    
    res.json({
      success: true,
      data: {
        wallet,
        balance,
        currency: 'ETH',
        totalNFTs: nftCount,
        unopenedBoxes: 0, // Could be calculated from purchases
      },
      timestamp: new Date().toISOString(),
      source: 'blockchain'
    });
  } catch (error) {
    console.error('❌ Error fetching user data:', error);
    
    // Fallback to mock data
    res.json({
      success: true,
      data: userData,
      timestamp: new Date().toISOString(),
      source: 'fallback',
      error: error.message
    });
  }
});

// GET /api/user/nfts
// Returns user's NFT collection from blockchain
router.get('/nfts', async (req, res) => {
  try {
    const { wallet, rarity, type, sortBy, limit = 50 } = req.query;
    
    if (!wallet) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address is required'
      });
    }
    
    console.log(`🎨 Fetching NFTs for ${wallet}`);
    
    // Fetch NFTs from blockchain
    let userNFTs = await contractService.getUserNFTs(wallet);
    
    // Enrich with mock metadata for demo
    let enrichedNFTs = userNFTs.map((nft, index) => {
      const mockData = nftsData[index % nftsData.length] || {};
      return {
        id: nft.tokenId.toString(),
        tokenId: nft.tokenId,
        name: `NFT #${nft.tokenId}`,
        image: mockData.image || nft.metadata.image || '/placeholder-nft.png',
        rarity: mockData.rarity || 'Common',
        type: mockData.type || 'Item',
        owner: nft.owner,
        tokenURI: nft.tokenURI,
        ...mockData,
      };
    });
    
    // Apply filters
    if (rarity && rarity !== 'All') {
      enrichedNFTs = enrichedNFTs.filter(
        nft => nft.rarity.toLowerCase() === rarity.toLowerCase()
      );
    }
    
    if (type && type !== 'All') {
      enrichedNFTs = enrichedNFTs.filter(
        nft => nft.type.toLowerCase() === type.toLowerCase()
      );
    }
    
    // Sort NFTs
    if (sortBy === 'rarity') {
      const rarityOrder = { 
        'Legendary': 5, 
        'Epic': 4, 
        'Rare': 3, 
        'Uncommon': 2, 
        'Common': 1 
      };
      enrichedNFTs.sort((a, b) => rarityOrder[b.rarity] - rarityOrder[a.rarity]);
    } else if (sortBy === 'date') {
      enrichedNFTs.sort((a, b) => b.tokenId - a.tokenId); // Newer tokens first
    }
    
    // Apply limit
    enrichedNFTs = enrichedNFTs.slice(0, parseInt(limit));
    
    res.json({
      success: true,
      data: enrichedNFTs,
      total: enrichedNFTs.length,
      timestamp: new Date().toISOString(),
      source: 'blockchain'
    });
  } catch (error) {
    console.error('❌ Error fetching NFTs:', error);
    
    // Fallback to mock data
    res.json({
      success: true,
      data: nftsData,
      total: nftsData.length,
      timestamp: new Date().toISOString(),
      source: 'fallback',
      error: error.message
    });
  }
});

// GET /api/user/nfts/:id
// Returns specific NFT details from blockchain
router.get('/nfts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tokenId = parseInt(id);
    
    if (isNaN(tokenId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid token ID'
      });
    }
    
    console.log(`🎨 Fetching NFT #${tokenId}`);
    
    // Fetch from blockchain
    const nft = await contractService.getNFT(tokenId);
    
    if (!nft) {
      return res.status(404).json({
        success: false,
        error: 'NFT not found on blockchain'
      });
    }
    
    // Enrich with mock data for demo
    const mockData = nftsData.find(n => n.id === id) || {};
    
    res.json({
      success: true,
      data: {
        ...nft,
        id: tokenId.toString(),
        name: `NFT #${tokenId}`,
        ...mockData,
      },
      timestamp: new Date().toISOString(),
      source: 'blockchain'
    });
  } catch (error) {
    console.error('❌ Error fetching NFT:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch NFT',
      message: error.message
    });
  }
});

// PUT /api/user/balance
// Mock endpoint to update user balance (for testing)
router.put('/balance', (req, res) => {
  try {
    const { amount } = req.body;
    
    if (typeof amount !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount'
      });
    }
    
    // In real app, this would update database
    const newBalance = userData.balance + amount;
    
    res.json({
      success: true,
      data: {
        wallet: userData.wallet,
        previousBalance: userData.balance,
        newBalance: newBalance,
        change: amount
      },
      message: 'Balance updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update balance',
      message: error.message
    });
  }
});

module.exports = router;
