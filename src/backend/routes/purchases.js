/**
 * Purchase Routes - Track box purchases and NFT reveals
 * 
 * Provides endpoints to:
 * - Get purchase status by ID
 * - Track transaction hashes
 * - Poll for NFT reveal results
 */

const express = require('express');
const router = express.Router();
const contractService = require('../services/contractService');

// In-memory cache for quick lookups (in production, use Redis)
const purchaseCache = new Map();

// GET /api/purchases/:id
// Get purchase status and NFT details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const purchaseId = parseInt(id);

    if (isNaN(purchaseId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid purchase ID. Must be a number.'
      });
    }

    console.log(`📊 Fetching purchase ${purchaseId}...`);

    // Fetch from smart contract
    const purchase = await contractService.getPurchase(purchaseId);

    if (!purchase) {
      return res.status(404).json({
        success: false,
        error: 'Purchase not found on blockchain'
      });
    }

    // If NFT is minted, fetch NFT details
    let nft = null;
    if (purchase.state === 'Fulfilled' && purchase.nftTokenId) {
      nft = await contractService.getNFT(purchase.nftTokenId);
      console.log(`🎨 NFT #${purchase.nftTokenId} found for purchase ${purchaseId}`);
    }

    // Convert BigInt to string for JSON serialization
    const sanitizedPurchase = JSON.parse(JSON.stringify(purchase, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ));

    const response = {
      success: true,
      data: {
        ...sanitizedPurchase,
        nft,
        status: getPurchaseStatus(purchase),
      },
      timestamp: new Date().toISOString()
    };

    // Update cache
    purchaseCache.set(purchaseId, response.data);

    res.json(response);
  } catch (error) {
    console.error('❌ Error fetching purchase:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch purchase',
      details: error.message
    });
  }
});

// POST /api/purchases/track
// Start tracking a purchase by txHash or purchaseId
router.post('/track', express.json(), async (req, res) => {
  try {
    const { txHash, purchaseId } = req.body;

    if (!txHash && !purchaseId) {
      return res.status(400).json({
        success: false,
        error: 'Either txHash or purchaseId is required'
      });
    }

    console.log('🔍 Tracking:', { txHash, purchaseId });

    // If txHash provided, parse events to get purchaseId
    if (txHash) {
      try {
        const receipt = await contractService.provider.getTransactionReceipt(txHash);
        
        if (!receipt) {
          return res.json({
            success: true,
            data: {
              status: 'pending',
              message: 'Transaction pending confirmation',
              txHash
            }
          });
        }

        // Parse BoxPurchased event
        const iface = contractService.boxContract.interface;
        const logs = receipt.logs
          .map(log => {
            try {
              return iface.parseLog(log);
            } catch (e) {
              return null;
            }
          })
          .filter(log => log !== null);

        const purchasedEvent = logs.find(log => log.name === 'BoxPurchased');
        
        if (purchasedEvent) {
          const pid = Number(purchasedEvent.args.purchaseId);
          console.log(`✅ Found purchase ID ${pid} in transaction ${txHash}`);
          
          return res.json({
            success: true,
            data: {
              purchaseId: pid,
              status: 'confirmed',
              message: 'Box purchased successfully. Opening...',
              txHash
            }
          });
        }
      } catch (error) {
        console.error('❌ Error parsing transaction:', error);
      }
    }

    // Return tracking status
    res.json({
      success: true,
      data: {
        purchaseId: purchaseId || null,
        txHash: txHash || null,
        status: 'tracking',
        message: 'Tracking purchase status'
      }
    });
  } catch (error) {
    console.error('❌ Error tracking purchase:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to track purchase',
      details: error.message
    });
  }
});

// GET /api/purchases/user/:address
// Get all purchases for a user address
router.get('/user/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const { limit = 10 } = req.query;

    // In production, use event logs or indexing
    // For now, check recent purchase IDs
    const purchases = [];
    const maxPurchaseId = 100;

    for (let id = 1; id <= Math.min(maxPurchaseId, parseInt(limit)); id++) {
      try {
        const purchase = await contractService.getPurchase(id);
        if (purchase && purchase.buyer.toLowerCase() === address.toLowerCase()) {
          purchases.push(purchase);
        }
      } catch (e) {
        continue;
      }
    }

    res.json({
      success: true,
      data: purchases,
      count: purchases.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error fetching user purchases:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch purchases',
      details: error.message
    });
  }
});

/**
 * Helper: Get purchase status with progress
 */
function getPurchaseStatus(purchase) {
  switch (purchase.state) {
    case 'Pending':
      return {
        stage: 'pending',
        message: '⏳ Waiting for box to be opened',
        progress: 25,
        color: 'yellow'
      };
    case 'Opened':
      return {
        stage: 'decrypting',
        message: '🔐 Decrypting result with FHE...',
        progress: 60,
        color: 'blue'
      };
    case 'Fulfilled':
      return {
        stage: 'complete',
        message: '🎉 NFT minted successfully!',
        progress: 100,
        color: 'green'
      };
    case 'Cancelled':
      return {
        stage: 'cancelled',
        message: '❌ Purchase cancelled',
        progress: 0,
        color: 'red'
      };
    default:
      return {
        stage: 'unknown',
        message: '❓ Unknown status',
        progress: 0,
        color: 'gray'
      };
  }
}

module.exports = router;
