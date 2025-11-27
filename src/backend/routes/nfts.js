/**
 * NFT API Routes
 * Endpoints để frontend fetch NFT metadata
 */

const express = require('express');
const router = express.Router();
const nftDB = require('../services/nftDatabase');

/**
 * GET /api/nfts/stats
 * Get NFT statistics (must be BEFORE /:tokenId route)
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await nftDB.getStats();
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/nfts/rarity/:rarity
 * Get all NFTs by rarity
 */
router.get('/rarity/:rarity', async (req, res) => {
  try {
    const { rarity } = req.params;
    const nfts = await nftDB.getNFTsByRarity(rarity);
    
    res.json({
      success: true,
      rarity: rarity,
      count: nfts.length,
      data: nfts
    });
    
  } catch (error) {
    console.error('Error fetching NFTs by rarity:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/nfts/user/:address
 * Get all NFTs owned by a user
 */
router.get('/user/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!address) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address is required'
      });
    }
    
    const nfts = await nftDB.getUserNFTs(address);
    
    // Convert IPFS URIs to use backend proxy (avoids CORS issues)
    const nftsData = nfts.map(nft => {
      let imageURL = null;
      if (nft.ipfsImageURI) {
        const cid = nft.ipfsImageURI.replace('ipfs://', '');
        imageURL = `http://localhost:3001/api/nfts/image/${cid}`;
      }
      
      return {
        ...nft,
        imageURL,
        metadataURL: nft.ipfsMetadataURI
          ? nft.ipfsMetadataURI.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/')
          : null
      };
    });
    
    res.json({
      success: true,
      owner: address,
      count: nftsData.length,
      data: nftsData
    });
    
  } catch (error) {
    console.error('Error fetching user NFTs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/nfts/image/:cid
 * Proxy IPFS images to avoid CORS issues
 */
router.get('/image/:cid', async (req, res) => {
  try {
    const { cid } = req.params;
    const fetch = (await import('node-fetch')).default;
    
    // Fetch from Pinata gateway
    const response = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`);
    
    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: 'Failed to fetch image from IPFS'
      });
    }
    
    // Set proper CORS and COEP headers
    const contentType = response.headers.get('content-type');
    res.setHeader('Content-Type', contentType || 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    
    const buffer = await response.buffer();
    res.send(buffer);
    
  } catch (error) {
    console.error('Error proxying IPFS image:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/nfts/:tokenId
 * Get single NFT by tokenId (must be LAST - catches all other paths)
 */
router.get('/:tokenId', async (req, res) => {
  try {
    const { tokenId } = req.params;
    const nft = await nftDB.getNFT(Number(tokenId));
    
    if (!nft) {
      return res.status(404).json({
        success: false,
        error: 'NFT not found'
      });
    }
    
    // Convert IPFS URIs to use backend proxy (avoids CORS issues)
    let imageURL = null;
    if (nft.ipfsImageURI) {
      const cid = nft.ipfsImageURI.replace('ipfs://', '');
      imageURL = `http://localhost:3001/api/nfts/image/${cid}`;
    }
    
    const nftData = {
      ...nft,
      imageURL,
      metadataURL: nft.ipfsMetadataURI
        ? nft.ipfsMetadataURI.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/')
        : null
    };
    
    res.json({
      success: true,
      data: nftData
    });
    
  } catch (error) {
    console.error('Error fetching NFT:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
