/**
 * NFT Database Service - SQLite Storage
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Database file path
const DB_PATH = path.join(__dirname, '../data/nfts.db');

let db = null;

/**
 * Initialize SQLite database
 */
function initDatabase() {
  return new Promise((resolve, reject) => {
    // Create data directory if it doesn't exist
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Open database connection
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('❌ Error opening database:', err);
        return reject(err);
      }
      
      console.log('📦 Connected to NFT database at:', DB_PATH);
      
      // Create nfts table if it doesn't exist
      db.run(`
        CREATE TABLE IF NOT EXISTS nfts (
          tokenId INTEGER PRIMARY KEY,
          ownerAddress TEXT NOT NULL,
          rarity TEXT NOT NULL,
          name TEXT NOT NULL,
          type TEXT,
          attributes TEXT,
          ipfsMetadataURI TEXT,
          ipfsImageURI TEXT,
          purchaseId INTEGER,
          transactionHash TEXT,
          blockNumber INTEGER,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        )
      `, (err) => {
        if (err) {
          console.error('❌ Error creating table:', err);
          return reject(err);
        }
        
        console.log('✅ NFT database initialized successfully');
        
        // Create indexes for better query performance
        db.run('CREATE INDEX IF NOT EXISTS idx_owner ON nfts(ownerAddress)', (err) => {
          if (err) console.error('Error creating owner index:', err);
        });
        
        db.run('CREATE INDEX IF NOT EXISTS idx_rarity ON nfts(rarity)', (err) => {
          if (err) console.error('Error creating rarity index:', err);
        });
        
        resolve();
      });
    });
  });
}

/**
 * Get database connection
 */
function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Save NFT to database after minting
 */
function saveNFT(nftData) {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    
    const sql = `
      INSERT OR REPLACE INTO nfts (
        tokenId, ownerAddress, rarity, name, type, attributes,
        ipfsMetadataURI, ipfsImageURI, purchaseId, transactionHash, blockNumber,
        createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
        COALESCE((SELECT createdAt FROM nfts WHERE tokenId = ?), ?), 
        ?
      )
    `;
    
    const params = [
      nftData.tokenId,
      nftData.ownerAddress,
      nftData.rarity,
      nftData.name,
      nftData.type || 'Creature',
      JSON.stringify(nftData.attributes),
      nftData.ipfsMetadataURI,
      nftData.ipfsImageURI,
      nftData.purchaseId || null,
      nftData.transactionHash || null,
      nftData.blockNumber || null,
      nftData.tokenId, // For COALESCE
      now, // createdAt if new
      now  // updatedAt always
    ];
    
    getDb().run(sql, params, function(err) {
      if (err) {
        console.error('❌ Error saving NFT:', err);
        return reject(err);
      }
      
      console.log(`✅ NFT #${nftData.tokenId} saved to database`);
      resolve({ tokenId: nftData.tokenId, changes: this.changes });
    });
  });
}

/**
 * Get single NFT by tokenId
 */
function getNFT(tokenId) {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM nfts WHERE tokenId = ?';
    
    getDb().get(sql, [tokenId], (err, row) => {
      if (err) {
        console.error('Error fetching NFT:', err);
        return reject(err);
      }
      
      if (row) {
        // Parse JSON attributes
        row.attributes = JSON.parse(row.attributes);
      }
      
      resolve(row || null);
    });
  });
}

/**
 * Get all NFTs owned by a user (case-insensitive address comparison)
 */
function getUserNFTs(ownerAddress) {
  return new Promise((resolve, reject) => {
    // Use LOWER() for case-insensitive comparison
    const sql = 'SELECT * FROM nfts WHERE LOWER(ownerAddress) = LOWER(?) ORDER BY createdAt DESC';
    
    getDb().all(sql, [ownerAddress], (err, rows) => {
      if (err) {
        console.error('Error fetching user NFTs:', err);
        return reject(err);
      }
      
      // Parse JSON attributes for all rows
      const nfts = rows.map(row => ({
        ...row,
        attributes: JSON.parse(row.attributes)
      }));
      
      resolve(nfts);
    });
  });
}

/**
 * Get all NFTs (with optional pagination)
 */
function getAllNFTs(limit = 100, offset = 0) {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM nfts ORDER BY createdAt DESC LIMIT ? OFFSET ?';
    
    getDb().all(sql, [limit, offset], (err, rows) => {
      if (err) {
        console.error('Error fetching all NFTs:', err);
        return reject(err);
      }
      
      // Parse JSON attributes for all rows
      const nfts = rows.map(row => ({
        ...row,
        attributes: JSON.parse(row.attributes)
      }));
      
      resolve(nfts);
    });
  });
}

/**
 * Get NFTs by rarity
 */
function getNFTsByRarity(rarity) {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM nfts WHERE rarity = ? ORDER BY createdAt DESC';
    
    getDb().all(sql, [rarity], (err, rows) => {
      if (err) {
        console.error('Error fetching NFTs by rarity:', err);
        return reject(err);
      }
      
      // Parse JSON attributes for all rows
      const nfts = rows.map(row => ({
        ...row,
        attributes: JSON.parse(row.attributes)
      }));
      
      resolve(nfts);
    });
  });
}

/**
 * Get statistics
 */
function getStats() {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN rarity = 'Common' THEN 1 ELSE 0 END) as common,
        SUM(CASE WHEN rarity = 'Uncommon' THEN 1 ELSE 0 END) as uncommon,
        SUM(CASE WHEN rarity = 'Rare' THEN 1 ELSE 0 END) as rare,
        SUM(CASE WHEN rarity = 'Epic' THEN 1 ELSE 0 END) as epic,
        SUM(CASE WHEN rarity = 'Legendary' THEN 1 ELSE 0 END) as legendary
      FROM nfts
    `;
    
    getDb().get(sql, [], (err, row) => {
      if (err) {
        console.error('Error fetching stats:', err);
        return reject(err);
      }
      
      const stats = {
        total: row.total || 0,
        byRarity: {
          Common: row.common || 0,
          Uncommon: row.uncommon || 0,
          Rare: row.rare || 0,
          Epic: row.epic || 0,
          Legendary: row.legendary || 0
        }
      };
      
      resolve(stats);
    });
  });
}

/**
 * Close database connection
 */
function closeDatabase() {
  return new Promise((resolve, reject) => {
    if (db) {
      db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
          return reject(err);
        }
        console.log('📦 Database connection closed');
        db = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

module.exports = {
  initDatabase,
  saveNFT,
  getNFT,
  getUserNFTs,
  getAllNFTs,
  getNFTsByRarity,
  getStats,
  closeDatabase
};
