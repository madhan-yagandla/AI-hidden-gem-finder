import jwt from 'jsonwebtoken';
import { getDB } from '../config/db.js';

export const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_123';
      const decoded = jwt.verify(token, JWT_SECRET);
      
      const db = getDB();
      if (!db) return res.status(500).json({ error: 'Database unavailable' });

      const user = await db.get('SELECT id, email, createdAt FROM users WHERE id = ?', [decoded.id]);
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }
      
      // Add user to request (using _id to stay compatible with existing frontend logic)
      req.user = { _id: user.id, email: user.email, createdAt: user.createdAt };
      next();
    } catch (error) {
      res.status(401).json({ error: 'Not authorized, token failed' });
    }
  } else {
    res.status(401).json({ error: 'Not authorized, no token' });
  }
};
