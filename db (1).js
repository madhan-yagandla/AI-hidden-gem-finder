import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure db goes into server directory
const dbPath = path.resolve(__dirname, 'gems.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
  } else {
    console.log('📦 Connected to SQLite database.');
    db.run(`
      CREATE TABLE IF NOT EXISTS favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        gemId TEXT NOT NULL,
        gemData TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(userId, gemId)
      )
    `);
  }
});

// Helper functions (Promise based)
export const getFavorites = (userId) => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT gemData FROM favorites WHERE userId = ?`, [userId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows.map(row => JSON.parse(row.gemData)));
    });
  });
};

export const addFavorite = (userId, gem) => {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT OR REPLACE INTO favorites (userId, gemId, gemData) VALUES (?, ?, ?)`,
      [userId, String(gem.id), JSON.stringify(gem)],
      function (err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
};

export const removeFavorite = (userId, gemId) => {
  return new Promise((resolve, reject) => {
    db.run(
      `DELETE FROM favorites WHERE userId = ? AND gemId = ?`,
      [userId, String(gemId)],
      function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      }
    );
  });
};
