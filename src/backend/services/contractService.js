/**
 * Contract Service - Interface to MysteryBox and MysteryNFT contracts
 * 
 * This service provides methods to interact with deployed smart contracts
 * on Sepolia testnet, including reading box configurations, purchase status,
 * and NFT ownership.
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

class ContractService {
  constructor() {
    // Connect to Sepolia via RPC
    const rpcUrl = process.env.SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/c25f6035d0984e15a846bb787a238bac';
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Load deployed contract addresses
    const deploymentsPath = path.join(__dirname, '..', 'deployments.json');
    
    if (!fs.existsSync(deploymentsPath)) {
      console.warn('⚠️  deployments.json not found. Using fallback addresses.');
      this.BOX_ADDRESS = process.env.BOX_ADDRESS || '0x3f3DaA5031cd3B9e69051a163b658585c99123f2';
      this.NFT_ADDRESS = process.env.NFT_ADDRESS || '0x0000000000000000000000000000000000000000';
    } else {
      const deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));
      this.BOX_ADDRESS = deployments.box?.address || process.env.BOX_ADDRESS;
      this.NFT_ADDRESS = deployments.nft?.address || process.env.NFT_ADDRESS;
    }
    
    // Load ABIs
    try {
      const boxAbiPath = path.join(__dirname, '..', 'artifacts', 'contracts', 'MysteryBox.sol', 'MysteryBox.json');
      const nftAbiPath = path.join(__dirname, '..', 'artifacts', 'contracts', 'MysteryNFT.sol', 'MysteryNFT.json');
      
      const boxAbi = JSON.parse(fs.readFileSync(boxAbiPath, 'utf8')).abi;
      const nftAbi = JSON.parse(fs.readFileSync(nftAbiPath, 'utf8')).abi;
      
      this.boxContract = new ethers.Contract(this.BOX_ADDRESS, boxAbi, this.provider);
      this.nftContract = new ethers.Contract(this.NFT_ADDRESS, nftAbi, this.provider);
      
      console.log('✅ Contract Service initialized');
      console.log('   📦 Box:', this.BOX_ADDRESS);
      console.log('   🎨 NFT:', this.NFT_ADDRESS);
    } catch (error) {
      console.error('❌ Failed to load contract ABIs:', error.message);
      throw error;
    }
  }

  /**
   * Get box configuration from contract
   */
  async getBoxConfig(boxId) {
    try {
      const config = await this.boxContract.boxes(boxId);
      
      return {
        id: boxId,
        name: config.name,
        priceWei: config.priceWei.toString(),
        priceEth: ethers.formatEther(config.priceWei),
        rarityPool: config.rarityPool || [],
        metadata: config.metadata || '',
      };
    } catch (error) {
      console.error(`❌ Error fetching box ${boxId}:`, error.message);
      return null;
    }
  }

  /**
   * Get all available boxes
   */
  async getAllBoxes() {
    const boxIds = ['bronze', 'silver', 'gold'];
    const boxes = [];
    
    for (const id of boxIds) {
      const config = await this.getBoxConfig(id);
      if (config) {
        boxes.push(config);
      }
    }
    
    return boxes;
  }

  /**
   * Get purchase details by ID
   */
  async getPurchase(purchaseId) {
    try {
      const purchase = await this.boxContract.purchases(purchaseId);
      
      return {
        purchaseId: Number(purchaseId),
        buyer: purchase.buyer,
        boxId: purchase.boxId,
        priceWei: purchase.priceWei?.toString() || '0',
        state: this.getPurchaseStateName(purchase.state),
        stateCode: purchase.state,
        timestamp: purchase.timestamp ? Number(purchase.timestamp) : 0,
        nftTokenId: purchase.nftTokenId ? Number(purchase.nftTokenId) : null,
        refunded: purchase.refunded || false,
      };
    } catch (error) {
      console.error(`❌ Error fetching purchase ${purchaseId}:`, error.message);
      return null;
    }
  }

  /**
   * Get NFT details by token ID
   */
  async getNFT(tokenId) {
    try {
      const owner = await this.nftContract.ownerOf(tokenId);
      const tokenURI = await this.nftContract.tokenURI(tokenId);
      
      return {
        tokenId: Number(tokenId),
        owner,
        tokenURI,
        metadata: this.parseTokenURI(tokenURI),
      };
    } catch (error) {
      console.error(`❌ Error fetching NFT ${tokenId}:`, error.message);
      return null;
    }
  }

  /**
   * Get user's NFT balance
   */
  async getUserNFTCount(userAddress) {
    try {
      const balance = await this.nftContract.balanceOf(userAddress);
      return Number(balance);
    } catch (error) {
      console.error('❌ Error fetching NFT balance:', error.message);
      return 0;
    }
  }

  /**
   * Get user's NFTs (simplified - checks recent token IDs)
   * In production, use event logs or indexing service
   */
  async getUserNFTs(userAddress) {
    try {
      const nfts = [];
      const maxTokenId = 100; // Check last 100 tokens
      
      for (let tokenId = 1; tokenId <= maxTokenId; tokenId++) {
        try {
          const owner = await this.nftContract.ownerOf(tokenId);
          
          if (owner.toLowerCase() === userAddress.toLowerCase()) {
            const nft = await this.getNFT(tokenId);
            if (nft) nfts.push(nft);
          }
        } catch (e) {
          // Token doesn't exist or error - skip
          continue;
        }
      }
      
      return nfts;
    } catch (error) {
      console.error('❌ Error fetching user NFTs:', error.message);
      return [];
    }
  }

  /**
   * Get user's ETH balance
   */
  async getUserBalance(userAddress) {
    try {
      const balance = await this.provider.getBalance(userAddress);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error('❌ Error fetching balance:', error.message);
      return '0';
    }
  }

  /**
   * Parse purchase state code to name
   */
  getPurchaseStateName(stateCode) {
    const states = {
      0: 'Pending',
      1: 'Opened',
      2: 'Fulfilled',
      3: 'Cancelled',
      4: 'Refunded'
    };
    return states[stateCode] || 'Unknown';
  }

  /**
   * Parse token URI to extract metadata
   */
  parseTokenURI(tokenURI) {
    try {
      // If tokenURI is base64 encoded JSON
      if (tokenURI.startsWith('data:application/json;base64,')) {
        const base64 = tokenURI.replace('data:application/json;base64,', '');
        const json = Buffer.from(base64, 'base64').toString('utf8');
        return JSON.parse(json);
      }
      
      // If tokenURI is IPFS or HTTP URL
      return { uri: tokenURI };
    } catch (error) {
      return { uri: tokenURI };
    }
  }

  /**
   * Listen for contract events
   */
  listenForEvents(callback) {
    // BoxPurchased event
    this.boxContract.on('BoxPurchased', (purchaseId, buyer, boxId, priceWei, timestamp, event) => {
      callback('BoxPurchased', {
        purchaseId: Number(purchaseId),
        buyer,
        boxId,
        priceWei: priceWei.toString(),
        timestamp: Number(timestamp),
        txHash: event.log.transactionHash,
        blockNumber: event.log.blockNumber,
      });
    });

    // BoxOpened event
    this.boxContract.on('BoxOpened', (purchaseId, encryptedHandle, timestamp, event) => {
      callback('BoxOpened', {
        purchaseId: Number(purchaseId),
        encryptedHandle,
        timestamp: Number(timestamp),
        txHash: event.log.transactionHash,
        blockNumber: event.log.blockNumber,
      });
    });

    // NFTRevealed event (renamed from DecryptionFulfilled)
    this.boxContract.on('NFTRevealed', (purchaseId, nftTokenId, rarityTier, timestamp, event) => {
      callback('NFTRevealed', {
        purchaseId: Number(purchaseId),
        nftTokenId: Number(nftTokenId),
        rarityTier,
        timestamp: Number(timestamp),
        txHash: event.log.transactionHash,
        blockNumber: event.log.blockNumber,
      });
    });

    console.log('👂 Listening for contract events...');
  }

  /**
   * Stop listening to events
   */
  removeAllListeners() {
    this.boxContract.removeAllListeners();
    this.nftContract.removeAllListeners();
    console.log('🔇 Stopped listening to contract events');
  }
}

// Export singleton instance
module.exports = new ContractService();
