const express = require('express');
const router = express.Router();
const { verifyMessage } = require('ethers');
const jwt = require('jsonwebtoken');
const userData = require('../data/user.json');

// Secret key cho JWT (trong production, lưu ở environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
const JWT_EXPIRY = '7d'; // Token hết hạn sau 7 ngày

// Middleware: Xác thực JWT Token
const verifyToken = (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Không tìm thấy token',
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('❌ Lỗi xác thực token:', error.message);
    res.status(401).json({
      success: false,
      error: 'Token không hợp lệ hoặc hết hạn',
      message: error.message,
    });
  }
};

// ============================================
// 1. GET /api/auth/message
// Lấy message để ký
// ============================================
router.get('/message', (req, res) => {
  try {
    const { wallet } = req.query;

    if (!wallet) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng cung cấp địa chỉ wallet',
      });
    }

    // Tạo message duy nhất với timestamp
    const message = `
Chào mừng đến Mystery Box!

Vui lòng ký message này để xác thực.

Địa chỉ: ${wallet}
Thời gian: ${new Date().toISOString()}
Nonce: ${Math.random().toString(36).substring(2)}
    `.trim();

    res.json({
      success: true,
      data: {
        message,
        timestamp: new Date().toISOString(),
      },
      message: 'Message tạo thành công',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Lỗi tạo message',
      message: error.message,
    });
  }
});

// ============================================
// 2. POST /api/auth/verify
// Xác thực signature và tạo JWT
// ============================================
router.post('/verify', (req, res) => {
  try {
    const { wallet, message, signature } = req.body;

    // Kiểm tra input
    if (!wallet || !message || !signature) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng cung cấp wallet, message và signature',
      });
    }

    console.log(`\n🔐 Xác thực ký tên:`);
    console.log(`   Wallet: ${wallet}`);
    console.log(`   Signature: ${signature.substring(0, 20)}...`);

    // Khôi phục địa chỉ từ signature
    let recoveredAddress;
    try {
      // Tạo hash của message theo chuẩn EIP-191
      const messageHash = ethers.utils.hashMessage(message);
      recoveredAddress = ethers.utils.recoverAddress(messageHash, signature);
    } catch (error) {
      // Phiên bản cũ của ethers
      recoveredAddress = verifyMessage(message, signature);
    }

    console.log(`   Khôi phục địa chỉ: ${recoveredAddress}`);

    // So sánh địa chỉ (không phân biệt hoa/thường)
    if (recoveredAddress.toLowerCase() !== wallet.toLowerCase()) {
      console.log(`   ❌ Địa chỉ không khớp!`);
      return res.status(401).json({
        success: false,
        error: 'Chữ ký không hợp lệ',
      });
    }

    console.log(`   ✅ Chữ ký hợp lệ!`);

    // Tạo JWT token
    const token = jwt.sign(
      {
        wallet: wallet.toLowerCase(),
        iat: Math.floor(Date.now() / 1000),
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    console.log(`   ✅ JWT token tạo thành công`);

    res.json({
      success: true,
      data: {
        token,
        wallet: wallet.toLowerCase(),
        expiresIn: JWT_EXPIRY,
      },
      message: 'Xác thực thành công',
    });
  } catch (error) {
    console.error('❌ Lỗi xác thực:', error.message);
    res.status(500).json({
      success: false,
      error: 'Lỗi xác thực chữ ký',
      message: error.message,
    });
  }
});

// ============================================
// 3. GET /api/auth/refresh
// Làm mới JWT token
// ============================================
router.get('/refresh', verifyToken, (req, res) => {
  try {
    const wallet = req.user.wallet;

    // Tạo token mới
    const newToken = jwt.sign(
      {
        wallet,
        iat: Math.floor(Date.now() / 1000),
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    console.log(`✅ Token làm mới cho ${wallet}`);

    res.json({
      success: true,
      data: {
        token: newToken,
        expiresIn: JWT_EXPIRY,
      },
      message: 'Token làm mới thành công',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Lỗi làm mới token',
      message: error.message,
    });
  }
});

// ============================================
// 4. GET /api/auth/verify-token
// Kiểm tra token có hợp lệ không
// ============================================
router.get('/verify-token', verifyToken, (req, res) => {
  res.json({
    success: true,
    data: {
      wallet: req.user.wallet,
      isValid: true,
    },
    message: 'Token hợp lệ',
  });
});

// ============================================
// 5. GET /api/auth/logout
// Logout (client phía frontend xóa token)
// ============================================
router.get('/logout', verifyToken, (req, res) => {
  console.log(`🔌 Logout cho wallet: ${req.user.wallet}`);
  
  res.json({
    success: true,
    message: 'Logout thành công',
  });
});

module.exports = { router, verifyToken };
