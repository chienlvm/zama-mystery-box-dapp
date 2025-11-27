const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;

const DB_PATH = path.join(__dirname, '../data/gallery.db');

class GalleryDatabase {
  constructor() {
    this.db = null;
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          console.error('Error opening gallery database:', err);
          reject(err);
        } else {
          console.log('Gallery database connected');
          this.createTables().then(resolve).catch(reject);
        }
      });
    });
  }

  async createTables() {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS gallery_nfts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        rarity TEXT NOT NULL,
        type TEXT NOT NULL,
        imageBase64 TEXT NOT NULL,
        imagePath TEXT NOT NULL,
        attributes TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    return new Promise((resolve, reject) => {
      this.db.run(createTableSQL, (err) => {
        if (err) {
          console.error('Error creating gallery_nfts table:', err);
          reject(err);
        } else {
          console.log('Gallery NFTs table ready');
          resolve();
        }
      });
    });
  }

  async saveGalleryNFT(nftData) {
    const sql = `
      INSERT OR REPLACE INTO gallery_nfts 
      (id, name, rarity, type, imageBase64, imagePath, attributes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    return new Promise((resolve, reject) => {
      this.db.run(
        sql,
        [
          nftData.id,
          nftData.name,
          nftData.rarity,
          nftData.type,
          nftData.imageBase64,
          nftData.imagePath,
          JSON.stringify(nftData.attributes)
        ],
        function(err) {
          if (err) {
            console.error('Error saving gallery NFT:', err);
            reject(err);
          } else {
            resolve({ id: nftData.id, changes: this.changes });
          }
        }
      );
    });
  }

  async getAllGalleryNFTs() {
    const sql = 'SELECT * FROM gallery_nfts ORDER BY rarity DESC, name ASC';

    return new Promise((resolve, reject) => {
      this.db.all(sql, [], (err, rows) => {
        if (err) {
          console.error('Error fetching gallery NFTs:', err);
          reject(err);
        } else {
          const nfts = rows.map(row => ({
            ...row,
            attributes: JSON.parse(row.attributes)
          }));
          resolve(nfts);
        }
      });
    });
  }

  async getGalleryNFTsByRarity(rarity) {
    const sql = 'SELECT * FROM gallery_nfts WHERE rarity = ? ORDER BY name ASC';

    return new Promise((resolve, reject) => {
      this.db.all(sql, [rarity], (err, rows) => {
        if (err) {
          console.error('Error fetching gallery NFTs by rarity:', err);
          reject(err);
        } else {
          const nfts = rows.map(row => ({
            ...row,
            attributes: JSON.parse(row.attributes)
          }));
          resolve(nfts);
        }
      });
    });
  }

  async getGalleryNFTCount() {
    const sql = 'SELECT COUNT(*) as count FROM gallery_nfts';

    return new Promise((resolve, reject) => {
      this.db.get(sql, [], (err, row) => {
        if (err) {
          console.error('Error counting gallery NFTs:', err);
          reject(err);
        } else {
          resolve(row.count);
        }
      });
    });
  }

  async clearGallery() {
    const sql = 'DELETE FROM gallery_nfts';

    return new Promise((resolve, reject) => {
      this.db.run(sql, [], function(err) {
        if (err) {
          console.error('Error clearing gallery:', err);
          reject(err);
        } else {
          resolve({ deleted: this.changes });
        }
      });
    });
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

module.exports = new GalleryDatabase();
