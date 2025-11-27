const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Import services
const contractService = require('./services/contractService');
const nftDB = require('./services/nftDatabase');
const galleryDB = require('./services/galleryDatabase');

// Import routes
const boxesRouter = require('./routes/boxes');
const galleryRouter = require('./routes/gallery');
const userRouter = require('./routes/user');
const dropsRouter = require('./routes/drops');
const { router: authRouter } = require('./routes/auth');
const relayerRouter = require('./routes/relayer');
const purchasesRouter = require('./routes/purchases');
const fheRouter = require('./routes/fhe');
const nftsRouter = require('./routes/nfts');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS Configuration
// Allow requests from Vercel frontend and localhost
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://zama-mystery-box-dapp.vercel.app',
  'https://zama-mystery-box-dapp-*.vercel.app', // Preview deployments
  process.env.FRONTEND_URL, // Custom frontend URL from env
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    // Check if origin matches allowed patterns
    const isAllowed = allowedOrigins.some(pattern => {
      if (pattern.includes('*')) {
        // Wildcard matching for Vercel preview deployments
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(origin);
      }
      return pattern === origin;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`⚠️  CORS blocked request from: ${origin}`);
      callback(new Error(`CORS policy: Origin ${origin} not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 600 // Cache preflight for 10 minutes
};

// Middleware
app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/boxes', boxesRouter);
app.use('/api/gallery', galleryRouter);
app.use('/api/user', userRouter);
app.use('/api/drop-rates', dropsRouter);
app.use('/api/auth', authRouter);
app.use('/api/relayer', relayerRouter);
app.use('/api/decrypt', relayerRouter);
app.use('/api/purchases', purchasesRouter);
app.use('/api/fhe', fheRouter); // FHE encryption API (server-side)
app.use('/api/nfts', nftsRouter); // NFT metadata API

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Mystery Box API is running' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// Start listening for blockchain events
contractService.listenForEvents((eventName, data) => {
  console.log(`\n📡 [${new Date().toISOString()}] Event: ${eventName}`);
  console.log('   Data:', JSON.stringify(data, null, 2));
  // In production: emit to WebSocket clients, update database, trigger notifications
});

// Initialize database and start server
async function startServer() {
  try {
    // Initialize SQLite databases
    await nftDB.initDatabase();
    await galleryDB.initialize();
    
    app.listen(PORT, () => {
      console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎁 Mystery Box Backend Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 Server running on: http://localhost:${PORT}

📦 API Endpoints:
   GET  /api/boxes              - List all mystery boxes
   GET  /api/boxes/:id          - Get specific box details
   GET  /api/nfts/stats         - NFT statistics
   GET  /api/nfts/user/:address - User's NFTs
   GET  /api/nfts/:tokenId      - Get NFT details

🔗 Smart Contracts:
   📦 Box: ${contractService.BOX_ADDRESS}
   🎨 NFT: ${contractService.NFT_ADDRESS}

👂 Listening for blockchain events...
      `);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

module.exports = app;
