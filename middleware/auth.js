const jwt = require('jsonwebtoken');
const db = require('../config/db');
require('dotenv').config();

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Authentication required');
    }
    
    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verify user exists in database
    const [rows] = await db.execute(
      'SELECT id, username, email FROM users WHERE id = ?',
      [decoded.id]
    );
    
    if (rows.length === 0) {
      throw new Error('User not found');
    }
    
    req.user = rows[0];
    next();
  } catch (error) {
    console.error('Authentication error:', error.message);
    res.status(401).json({
      success: false,
      error: 'Please authenticate'
    });
  }
};