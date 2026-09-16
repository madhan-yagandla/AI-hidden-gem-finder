import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dbInstance = null;

export const connectDB = async () => {
  if (dbInstance) return dbInstance;
  
  try {
    const dbPath = path.resolve(__dirname, '../../hiddengems.sqlite');
    dbInstance = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });
    
    // Enable foreign keys
    await dbInstance.exec('PRAGMA foreign_keys = ON;');

    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS favorites (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        gemId TEXT NOT NULL,
        gemData TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(userId, gemId)
      );
    `);
    
    console.log(`📦 SQLite Database Connected: ${dbPath}`);
    return dbInstance;
  } catch (error) {
    console.error(`❌ SQLite Connection Error: ${error.message}`);
    console.warn(`⚠️ The app is running, but database features will fail.`);
    return null;
  }
};

export const getDB = () => dbInstance;
