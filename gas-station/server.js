/**
 * Gas Station Server - Sponsors Sui Transactions
 * 
 * This server acts as a "gas station" that pays for user transactions on the Sui blockchain.
 * 
 * What is "Sponsoring"?
 * - Users can submit transactions without paying gas fees
 * - The sponsor (this server) pays the gas fees on behalf of users
 * - This enables a better user experience (no need to hold SUI for gas)
 * - The sponsor validates transactions to ensure only approved operations are sponsored
 * 
 * Security Model:
 * - Only transactions targeting ALLOWED_PACKAGE_ID are sponsored
 * - This prevents abuse (users can't use our gas for arbitrary transactions)
 * - Transactions are validated before signing to ensure they match our package
 * - The sponsor's private key is kept secure in environment variables
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromBase64, toBase64 } from '@mysten/sui/utils';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Load environment variables
const SPONSOR_SECRET_KEY = process.env.SPONSOR_SECRET_KEY;
const ALLOWED_PACKAGE_ID = process.env.ALLOWED_PACKAGE_ID;
const SUI_NETWORK = process.env.SUI_NETWORK || 'testnet';
const PORT = process.env.PORT || 3001;
const RATE_LIMIT_DISABLED = process.env.RATE_LIMIT_DISABLED === 'true';
const ADMIN_KEY = process.env.ADMIN_KEY; // Optional admin key for accessing logs
const LOGS_FILE = path.join(__dirname, 'logs.json');

// Validate required environment variables
if (!SPONSOR_SECRET_KEY) {
  console.error('❌ SPONSOR_SECRET_KEY is required in .env file');
  process.exit(1);
}

if (!ALLOWED_PACKAGE_ID || ALLOWED_PACKAGE_ID === 'your_drSui_package_id_here') {
  console.warn('⚠️  ALLOWED_PACKAGE_ID not set or using placeholder. Update .env with your package ID!');
}

// Initialize Express app
const app = express();

// Middleware
// CORS: Allow all origins for development (restrict in production!)
app.use(cors({
  origin: '*', // In production, specify allowed origins
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parse JSON request bodies
app.use(express.json());

/**
 * Request Logging Middleware
 * 
 * Logs all incoming requests with timestamp, endpoint, and sender address.
 * Tracks total requests and successful sponsorships for monitoring.
 * 
 * This helps monitor gas usage during hackathon demos by showing:
 * - How many requests are coming in
 * - Which addresses are using the service
 * - Request patterns and timing
 */
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const endpoint = req.path;
  const method = req.method;
  
  // Extract sender from request body for POST requests
  const sender = req.body?.sender || 'N/A';
  
  // Log the request
  console.log(`[${timestamp}] ${method} ${endpoint} | Sender: ${sender}`);
  
  // Track statistics
  stats.totalRequests++;
  
  // Store request in history (keep last 100)
  stats.requestHistory.push({
    timestamp,
    method,
    endpoint,
    sender
  });
  
  if (stats.requestHistory.length > 100) {
    stats.requestHistory.shift(); // Remove oldest
  }
  
  next();
});

/**
 * Rate Limiting System
 * 
 * Why Rate Limiting is Critical:
 * - Prevents abuse: Malicious users could spam transactions and drain the sponsor wallet
 * - Cost control: Limits gas spending to prevent unexpected expenses
 * - Fair usage: Ensures all users get fair access to sponsored transactions
 * - Security: Protects against DoS attacks and wallet draining
 * 
 * We implement three layers of rate limiting:
 * 1. Per-IP limiting: Max 10 requests per IP per hour (prevents single IP abuse)
 * 2. Global limiting: Max 50 requests total per hour (prevents overall abuse)
 * 3. Per-address limiting: Max 5 requests per Sui address per hour (prevents wallet abuse)
 */

// Per-address rate limiting storage
// Maps Sui address -> { count: number, resetTime: number }
const addressLimits = new Map();

// Global rate limit counter
let globalRequestCount = 0;
let globalResetTime = Date.now() + (60 * 60 * 1000); // 1 hour from now

/**
 * Clean up expired address limits
 * Runs every 5 minutes to prevent memory leaks
 */
setInterval(() => {
  const now = Date.now();
  for (const [address, data] of addressLimits.entries()) {
    if (now > data.resetTime) {
      addressLimits.delete(address);
    }
  }
  
  // Reset global counter if time expired
  if (now > globalResetTime) {
    globalRequestCount = 0;
    globalResetTime = now + (60 * 60 * 1000);
  }
}, 5 * 60 * 1000); // Every 5 minutes

/**
 * Check per-address rate limit
 * @param {string} address - Sui address to check
 * @returns {Object} { allowed: boolean, remaining: number, resetTime: number }
 */
function checkAddressLimit(address) {
  const now = Date.now();
  const limit = addressLimits.get(address);
  
  // Max 5 requests per address per hour
  const MAX_PER_ADDRESS = 5;
  const WINDOW_MS = 60 * 60 * 1000; // 1 hour
  
  if (!limit || now > limit.resetTime) {
    // No limit or expired, create new entry
    addressLimits.set(address, {
      count: 0,
      resetTime: now + WINDOW_MS
    });
    return {
      allowed: true,
      remaining: MAX_PER_ADDRESS,
      resetTime: now + WINDOW_MS
    };
  }
  
  if (limit.count >= MAX_PER_ADDRESS) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: limit.resetTime
    };
  }
  
  return {
    allowed: true,
    remaining: MAX_PER_ADDRESS - limit.count,
    resetTime: limit.resetTime
  };
}

/**
 * Increment per-address rate limit counter
 * @param {string} address - Sui address
 */
function incrementAddressLimit(address) {
  const limit = addressLimits.get(address);
  if (limit) {
    limit.count++;
  }
}

/**
 * Check global rate limit
 * @returns {Object} { allowed: boolean, remaining: number, resetTime: number }
 */
function checkGlobalLimit() {
  const now = Date.now();
  const MAX_GLOBAL = 50; // Max 50 requests per hour globally
  
  if (now > globalResetTime) {
    // Reset window
    globalRequestCount = 0;
    globalResetTime = now + (60 * 60 * 1000);
  }
  
  return {
    allowed: globalRequestCount < MAX_GLOBAL,
    remaining: Math.max(0, MAX_GLOBAL - globalRequestCount),
    resetTime: globalResetTime
  };
}

/**
 * Increment global rate limit counter
 */
function incrementGlobalLimit() {
  globalRequestCount++;
}

// IP-based rate limiter using express-rate-limit
// Max 10 requests per IP per hour
const ipRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Max 10 requests per IP per hour
  message: {
    error: 'Rate limit exceeded',
    message: 'Too many requests from this IP. Maximum 10 sponsored transactions per hour per IP.',
    retryAfter: '1 hour'
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skip: () => RATE_LIMIT_DISABLED // Skip if rate limiting is disabled
});

// Log rate limiting status
if (RATE_LIMIT_DISABLED) {
  console.warn('⚠️  WARNING: Rate limiting is DISABLED. This should only be used in development!');
} else {
  console.log('🛡️  Rate limiting enabled:');
  console.log('   - Max 10 requests per IP per hour');
  console.log('   - Max 50 requests globally per hour');
  console.log('   - Max 5 requests per Sui address per hour');
}

// Initialize Sui client
const client = new SuiClient({
  url: getFullnodeUrl(SUI_NETWORK)
});

// Initialize sponsor keypair
// Handle both bech32 format (suiprivkey...) and hex format
let sponsorKeypair;
try {
  // Try to create keypair from the secret key
  // Ed25519Keypair.fromSecretKey() can handle bech32 format
  sponsorKeypair = Ed25519Keypair.fromSecretKey(SPONSOR_SECRET_KEY);
} catch (error) {
  console.error('❌ Failed to create keypair from SPONSOR_SECRET_KEY:', error.message);
  process.exit(1);
}

const sponsorAddress = sponsorKeypair.toSuiAddress();

// Statistics tracking for monitoring
const stats = {
  totalRequests: 0,
  successfulSponsorships: 0,
  transactionsToday: 0,
  totalGasSpent: 0n, // In MIST
  lastResetDate: new Date().toDateString(),
  requestHistory: [] // Store last 100 requests for analysis
};

/**
 * Transaction Logging System
 * 
 * Comprehensive logging of all sponsored transactions for:
 * - Debugging issues during hackathon demos
 * - Impressing judges with observability
 * - Tracking gas usage and patterns
 * - Identifying abuse or anomalies
 * 
 * Each log entry contains:
 * - timestamp: When the transaction was sponsored
 * - sender: Sui address of the user
 * - transactionDigest: Transaction digest (if available after execution)
 * - gasCost: Estimated gas cost in MIST
 * - status: 'success' | 'failed' | 'pending'
 * - ipAddress: IP address of the requester
 * - error: Error message if transaction failed
 */
const transactionLogs = [];

// Maximum number of logs to keep in memory
const MAX_LOGS = 1000;

/**
 * Load logs from file on startup (if file exists)
 */
function loadLogsFromFile() {
  try {
    if (fs.existsSync(LOGS_FILE)) {
      const fileContent = fs.readFileSync(LOGS_FILE, 'utf8');
      const logs = JSON.parse(fileContent);
      transactionLogs.push(...logs);
      // Keep only the most recent logs
      if (transactionLogs.length > MAX_LOGS) {
        transactionLogs.splice(0, transactionLogs.length - MAX_LOGS);
      }
      console.log(`📋 Loaded ${logs.length} transaction logs from file`);
    }
  } catch (error) {
    console.warn('⚠️  Failed to load logs from file:', error.message);
  }
}

/**
 * Save logs to file periodically
 */
function saveLogsToFile() {
  try {
    // Keep only last 1000 logs in file
    const logsToSave = transactionLogs.slice(-MAX_LOGS);
    fs.writeFileSync(LOGS_FILE, JSON.stringify(logsToSave, null, 2), 'utf8');
    console.log(`💾 Saved ${logsToSave.length} transaction logs to file`);
  } catch (error) {
    console.error('❌ Failed to save logs to file:', error.message);
  }
}

// Load logs on startup
loadLogsFromFile();

// Save logs every 5 minutes
setInterval(saveLogsToFile, 5 * 60 * 1000);

// Save logs on graceful shutdown
process.on('SIGINT', () => {
  saveLogsToFile();
  process.exit(0);
});

process.on('SIGTERM', () => {
  saveLogsToFile();
  process.exit(0);
});

/**
 * Log a transaction
 * @param {Object} logData - Transaction log data
 */
function logTransaction(logData) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    sender: logData.sender || 'unknown',
    transactionDigest: logData.transactionDigest || null,
    gasCost: logData.gasCost || 0,
    gasCostSUI: logData.gasCost ? (Number(logData.gasCost) / 1_000_000_000).toFixed(6) : '0',
    status: logData.status || 'pending',
    ipAddress: logData.ipAddress || 'unknown',
    error: logData.error || null
  };
  
  transactionLogs.push(logEntry);
  
  // Keep only last MAX_LOGS entries
  if (transactionLogs.length > MAX_LOGS) {
    transactionLogs.shift(); // Remove oldest
  }
  
  return logEntry;
}

// Reset daily counter if it's a new day
function resetDailyStatsIfNeeded() {
  const today = new Date().toDateString();
  if (stats.lastResetDate !== today) {
    console.log('📅 New day detected, resetting daily transaction counter');
    stats.transactionsToday = 0;
    stats.lastResetDate = today;
  }
}

/**
 * Check Sponsor Balance
 * 
 * Monitors the sponsor wallet balance and logs warnings if it gets low.
 * This is critical for hackathon demos - you need to know when to refill!
 * 
 * @returns {Promise<number>} Balance in SUI (not MIST)
 */
async function checkSponsorBalance() {
  try {
    const balance = await client.getBalance({
      owner: sponsorAddress,
      coinType: '0x2::sui::SUI'
    });

    // Convert MIST to SUI (1 SUI = 1,000,000,000 MIST)
    const balanceInSUI = Number(balance.totalBalance) / 1_000_000_000;

    // Log warnings based on balance thresholds
    if (balanceInSUI < 0.1) {
      console.error('🚨 CRITICAL: Sponsor balance is below 0.1 SUI!');
      console.error(`   Current balance: ${balanceInSUI.toFixed(4)} SUI`);
      console.error('   ⚠️  Refill immediately or gas station will stop working!');
    } else if (balanceInSUI < 1) {
      console.warn('⚠️  WARNING: Sponsor balance is below 1 SUI');
      console.warn(`   Current balance: ${balanceInSUI.toFixed(4)} SUI`);
      console.warn('   Consider refilling soon to avoid interruptions');
    } else {
      console.log(`💰 Sponsor balance: ${balanceInSUI.toFixed(4)} SUI (${balance.coinObjectCount} coins)`);
    }

    return balanceInSUI;
  } catch (error) {
    console.error('❌ Failed to check sponsor balance:', error.message);
    return 0;
  }
}

console.log('🚀 Gas Station Server Starting...');
console.log(`📍 Sponsor Address: ${sponsorAddress}`);
console.log(`📦 Allowed Package: ${ALLOWED_PACKAGE_ID}`);
console.log(`🌐 Network: ${SUI_NETWORK}`);
console.log(`🔌 Port: ${PORT}`);

/**
 * Validate Transaction Middleware
 * 
 * This function ensures that the transaction only calls functions from our allowed package.
 * 
 * Why validate?
 * - Prevents abuse: Users could submit transactions to any package and drain our gas
 * - Security: We only sponsor transactions for our Dr. Sui package
 * - Cost control: Limits gas spending to approved operations only
 * 
 * How it works:
 * - Extracts all MoveCall commands from the transaction
 * - Checks if each MoveCall's target starts with ALLOWED_PACKAGE_ID
 * - Throws an error if any MoveCall targets a different package
 * 
 * @param {Object} txData - The transaction data to validate
 * @returns {boolean} - True if all MoveCalls are valid
 * @throws {Error} - If any MoveCall targets an unauthorized package
 */
function validateTransaction(txData) {
  if (!txData || !txData.transactions) {
    throw new Error('Invalid transaction data: missing transactions array');
  }

  const transactions = txData.transactions;
  console.log(`🔍 Validating transaction with ${transactions.length} command(s)...`);

  // Loop through each command in the transaction
  for (let i = 0; i < transactions.length; i++) {
    const command = transactions[i];
    
    // Only validate MoveCall commands (other commands like TransferObject are fine)
    if (command.kind === 'MoveCall') {
      const target = command.target;
      console.log(`  📋 Command ${i + 1}: MoveCall to ${target}`);
      
      // Check if the target starts with our allowed package ID
      // Package IDs in Sui are like: 0x1234567890abcdef...::module::function
      if (!target.startsWith(ALLOWED_PACKAGE_ID)) {
        const errorMsg = `❌ Unauthorized package: ${target} does not start with ${ALLOWED_PACKAGE_ID}`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      }
      
      console.log(`  ✅ Command ${i + 1} validated: ${target}`);
    } else {
      console.log(`  ℹ️  Command ${i + 1}: ${command.kind} (skipping validation)`);
    }
  }

  console.log('✅ All transaction commands validated successfully');
  return true;
}

/**
 * POST /sponsor - Sponsor a Sui transaction
 * 
 * This endpoint accepts a transaction from the frontend, sets up gas sponsorship,
 * validates it, signs it, and returns it for execution.
 * 
 * Flow of bytes:
 * 1. Frontend creates a transaction (without gas payment)
 * 2. Frontend builds transaction bytes and sends base64-encoded bytes to this endpoint
 * 3. This server decodes the bytes and reconstructs the Transaction object
 * 4. Server sets up gas sponsorship (gasOwner, gasPayment, gasBudget)
 * 5. Server validates the transaction targets only our package
 * 6. Server builds final transaction bytes and signs with sponsor keypair
 * 7. Server returns signed transaction bytes and signature to frontend
 * 8. Frontend can now execute the transaction (user signs + sponsor signature)
 * 
 * Why this is secure:
 * - Transaction is validated before signing (can't sponsor unauthorized operations)
 * - Only our package ID is allowed (prevents abuse)
 * - Sponsor signature is separate from user signature (both required for execution)
 * - Gas budget is limited (0.01 SUI max) to prevent excessive spending
 * 
 * Request body:
 * {
 *   transactionBlockBytes: string (base64-encoded transaction bytes),
 *   sender: string (user's Sui address)
 * }
 * 
 * Response:
 * {
 *   bytes: string (base64-encoded final transaction bytes),
 *   sponsorSignature: string (sponsor's signature),
 *   sponsorAddress: string (sponsor's address for verification)
 * }
 */
/**
 * Rate Limiting Middleware for /sponsor endpoint
 * 
 * This middleware checks all three rate limits:
 * 1. IP-based limit (handled by express-rate-limit)
 * 2. Global limit (checked manually)
 * 3. Per-address limit (checked manually)
 * 
 * Returns 429 Too Many Requests if any limit is exceeded.
 */
const sponsorRateLimitMiddleware = async (req, res, next) => {
  // Skip rate limiting if disabled
  if (RATE_LIMIT_DISABLED) {
    return next();
  }
  
  const { sender } = req.body;
  
  // Check global rate limit
  const globalLimit = checkGlobalLimit();
  if (!globalLimit.allowed) {
    const retryAfter = Math.ceil((globalLimit.resetTime - Date.now()) / 1000);
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Global rate limit exceeded. Maximum 50 sponsored transactions per hour globally.',
      retryAfter: retryAfter,
      resetTime: new Date(globalLimit.resetTime).toISOString()
    }).setHeader('Retry-After', retryAfter);
  }
  
  // Check per-address rate limit
  if (sender) {
    const addressLimit = checkAddressLimit(sender);
    if (!addressLimit.allowed) {
      const retryAfter = Math.ceil((addressLimit.resetTime - Date.now()) / 1000);
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: `Rate limit exceeded for address ${sender.slice(0, 6)}...${sender.slice(-4)}. Maximum 5 sponsored transactions per hour per address.`,
        retryAfter: retryAfter,
        resetTime: new Date(addressLimit.resetTime).toISOString()
      }).setHeader('Retry-After', retryAfter);
    }
  }
  
  // All checks passed, continue to handler
  next();
};

app.post('/sponsor', ipRateLimiter, sponsorRateLimitMiddleware, async (req, res) => {
  // Get client IP address for logging
  const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
  
  // Create log entry for this transaction (will be updated with result)
  // We'll find and update it later by timestamp
  let logTimestamp = null;
  
  try {
    const { transactionBlockBytes, sender } = req.body;
    
    // Initialize log entry
    const logEntry = logTransaction({
      sender: sender || 'unknown',
      status: 'pending',
      ipAddress: clientIp,
      gasCost: 0
    });
    logTimestamp = logEntry.timestamp; // Store timestamp to find entry later

    // Validate inputs
    if (!transactionBlockBytes) {
      return res.status(400).json({
        error: 'Missing transactionBlockBytes in request body'
      });
    }

    if (!sender) {
      return res.status(400).json({
        error: 'Missing sender address in request body'
      });
    }

    console.log(`\n📥 Received sponsorship request from: ${sender}`);

    // Decode the base64 transaction bytes
    let transactionBytes;
    try {
      transactionBytes = fromBase64(transactionBlockBytes);
      console.log(`📦 Decoded transaction bytes (${transactionBytes.length} bytes)`);
    } catch (error) {
      return res.status(400).json({
        error: 'Invalid base64 transaction bytes',
        details: error.message
      });
    }

    // Reconstruct Transaction from bytes
    // Transaction.from() parses the bytes and recreates the transaction object
    let tx;
    try {
      tx = Transaction.from(transactionBytes);
      console.log('✅ Transaction reconstructed successfully');
    } catch (error) {
      return res.status(400).json({
        error: 'Failed to reconstruct transaction from bytes',
        details: error.message
      });
    }

    // ===== SPONSORSHIP LOGIC =====
    
    // a. Get sponsor's gas coins
    console.log('💰 Fetching sponsor gas coins...');
    const gasCoins = await client.getCoins({
      owner: sponsorAddress,
      coinType: '0x2::sui::SUI' // SUI coin type
    });

    if (!gasCoins.data || gasCoins.data.length === 0) {
      return res.status(500).json({
        error: 'Sponsor has no gas coins available',
        sponsorAddress: sponsorAddress
      });
    }

    // b. Select a coin with sufficient balance (at least 0.1 SUI = 100000000 MIST)
    // MIST is the smallest unit of SUI (1 SUI = 1,000,000,000 MIST)
    const MIN_GAS_BALANCE = 100000000n; // 0.1 SUI
    const gasCoin = gasCoins.data.find(coin => {
      const balance = BigInt(coin.balance);
      return balance >= MIN_GAS_BALANCE;
    });

    if (!gasCoin) {
      return res.status(500).json({
        error: 'No sponsor gas coin with sufficient balance (need at least 0.1 SUI)',
        availableCoins: gasCoins.data.length,
        sponsorAddress: sponsorAddress
      });
    }

    console.log(`✅ Selected gas coin: ${gasCoin.coinObjectId} (balance: ${gasCoin.balance} MIST)`);

    // c. Set transaction sender to the user's address
    tx.setSender(sender);
    console.log(`👤 Set sender to: ${sender}`);

    // d. Set gasOwner to sponsor's address
    // This tells Sui that the sponsor will pay for gas, not the sender
    tx.setGasOwner(sponsorAddress);
    console.log(`💳 Set gas owner to sponsor: ${sponsorAddress}`);

    // e. Set gas budget (maximum gas to spend)
    // 0.01 SUI = 10,000,000 MIST is a reasonable budget for most transactions
    const GAS_BUDGET = 10000000n; // 0.01 SUI
    tx.setGasBudget(GAS_BUDGET);
    console.log(`⛽ Set gas budget to: ${GAS_BUDGET} MIST (0.01 SUI)`);

    // f. Set gas payment (the coin that will be used to pay for gas)
    // We need to provide the coin's object ID, version, and digest
    tx.setGasPayment([{
      objectId: gasCoin.coinObjectId,
      version: gasCoin.version,
      digest: gasCoin.digest
    }]);
    console.log(`💸 Set gas payment coin: ${gasCoin.coinObjectId}`);

    // ===== SECURITY CHECK =====
    
    // Build the transaction to inspect it
    // This doesn't execute it, just prepares it for validation
    console.log('🔒 Building transaction for validation...');
    const txData = tx.getData();
    
    // Validate the transaction
    try {
      validateTransaction(txData);
    } catch (validationError) {
      console.error('🚫 Transaction validation failed:', validationError.message);
      return res.status(403).json({
        error: 'Transaction validation failed',
        details: validationError.message,
        message: 'This transaction targets an unauthorized package. Only transactions to the allowed package will be sponsored.'
      });
    }

    // ===== SIGN THE TRANSACTION =====
    
    // Build final transaction bytes
    // This creates the final byte representation that will be executed
    console.log('📝 Building final transaction bytes...');
    const finalBytes = await tx.build({ client });
    console.log(`✅ Built final transaction bytes (${finalBytes.length} bytes)`);

    // Sign with sponsor keypair
    // This creates a signature that proves the sponsor authorized paying for this transaction
    console.log('✍️  Signing transaction with sponsor keypair...');
    const signature = await sponsorKeypair.signTransaction(finalBytes);
    console.log('✅ Transaction signed successfully');

    // Track successful sponsorship
    stats.successfulSponsorships++;
    resetDailyStatsIfNeeded();
    stats.transactionsToday++;
    
    // Increment rate limit counters (only if rate limiting is enabled)
    if (!RATE_LIMIT_DISABLED) {
      incrementGlobalLimit();
      if (sender) {
        incrementAddressLimit(sender);
      }
    }
    
    // Estimate gas cost (we set budget to 0.01 SUI, actual may be less)
    const estimatedGasCost = 10000000n; // 0.01 SUI in MIST
    stats.totalGasSpent += estimatedGasCost;

    // Check balance after sponsorship
    const remainingBalance = await checkSponsorBalance();

    // Update log entry with success status
    if (logTimestamp) {
      const logEntry = transactionLogs.find(log => log.timestamp === logTimestamp);
      if (logEntry) {
        logEntry.status = 'success';
        logEntry.gasCost = estimatedGasCost.toString();
        // Note: transactionDigest will be updated if frontend sends it back
        // For now, we log the sponsorship (transaction execution happens on frontend)
      }
    }

    // Return the signed transaction data
    // Frontend will combine this with the user's signature and execute
    const response = {
      bytes: toBase64(finalBytes),
      sponsorSignature: signature.signature,
      sponsorAddress: sponsorAddress,
      remainingBalance: remainingBalance // Current sponsor balance after transaction
    };

    console.log(`✅ Sponsorship complete! Returning signed transaction to ${sender}`);
    console.log(`📊 Stats: ${stats.transactionsToday} transactions today, ${stats.successfulSponsorships} total sponsorships\n`);

    res.json(response);

  } catch (error) {
    console.error('❌ Error in /sponsor endpoint:', error);
    
    // Update log entry with failure status
    if (logTimestamp) {
      const logEntry = transactionLogs.find(log => log.timestamp === logTimestamp);
      if (logEntry) {
        logEntry.status = 'failed';
        logEntry.error = error.message || 'Unknown error';
      }
    }
    
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * GET /status - Get gas station status
 * 
 * Returns information about the gas station, including:
 * - Sponsor address (so users know who's paying)
 * - Allowed package ID
 * - Network
 * - Sponsor's current SUI balance
 * 
 * This endpoint is public and can be called by anyone to verify the gas station is operational.
 */
app.get('/status', async (req, res) => {
  try {
    // Fetch sponsor's SUI balance
    const balance = await client.getBalance({
      owner: sponsorAddress,
      coinType: '0x2::sui::SUI'
    });

    res.json({
      sponsorAddress: sponsorAddress,
      allowedPackage: ALLOWED_PACKAGE_ID,
      network: SUI_NETWORK,
      balance: {
        totalBalance: balance.totalBalance,
        coinObjectCount: balance.coinObjectCount
      },
      status: 'operational'
    });
  } catch (error) {
    console.error('❌ Error in /status endpoint:', error);
    res.status(500).json({
      error: 'Failed to fetch status',
      details: error.message
    });
  }
});

/**
 * GET /balance - Get detailed balance and statistics
 * 
 * Returns comprehensive information about the gas station:
 * - Current sponsor balance
 * - Number of sponsored transactions today
 * - Total successful sponsorships
 * - Average gas cost per transaction
 * - Total requests received
 * 
 * This endpoint is useful for monitoring gas usage during hackathon demos.
 */
app.get('/balance', async (req, res) => {
  try {
    // Fetch current balance
    const balance = await client.getBalance({
      owner: sponsorAddress,
      coinType: '0x2::sui::SUI'
    });

    const balanceInSUI = Number(balance.totalBalance) / 1_000_000_000;
    const totalGasSpentInSUI = Number(stats.totalGasSpent) / 1_000_000_000;
    
    // Calculate average gas cost per transaction
    const avgGasCost = stats.successfulSponsorships > 0
      ? totalGasSpentInSUI / stats.successfulSponsorships
      : 0;

    res.json({
      sponsorAddress: sponsorAddress,
      currentBalance: {
        sui: balanceInSUI.toFixed(4),
        mist: balance.totalBalance,
        coinCount: balance.coinObjectCount
      },
      statistics: {
        transactionsToday: stats.transactionsToday,
        totalSuccessfulSponsorships: stats.successfulSponsorships,
        totalRequests: stats.totalRequests,
        totalGasSpent: {
          sui: totalGasSpentInSUI.toFixed(6),
          mist: stats.totalGasSpent.toString()
        },
        averageGasCostPerTransaction: {
          sui: avgGasCost.toFixed(6),
          mist: stats.successfulSponsorships > 0 
            ? (Number(stats.totalGasSpent) / stats.successfulSponsorships).toFixed(0)
            : '0'
        }
      },
      warnings: {
        lowBalance: balanceInSUI < 1,
        criticalBalance: balanceInSUI < 0.1,
        estimatedTransactionsRemaining: balanceInSUI > 0 
          ? Math.floor(balanceInSUI / (avgGasCost || 0.01))
          : 0
      },
      lastResetDate: stats.lastResetDate
    });
  } catch (error) {
    console.error('❌ Error in /balance endpoint:', error);
    res.status(500).json({
      error: 'Failed to fetch balance information',
      details: error.message
    });
  }
});

/**
 * Admin Authentication Middleware
 * 
 * Checks if ADMIN_KEY header matches the configured admin key.
 * Used to protect sensitive endpoints like /logs.
 */
const adminAuth = (req, res, next) => {
  const providedKey = req.headers['admin-key'] || req.headers['x-admin-key'];
  
  if (!ADMIN_KEY) {
    return res.status(503).json({
      error: 'Admin access not configured',
      message: 'ADMIN_KEY environment variable is not set. This endpoint is disabled.'
    });
  }
  
  if (providedKey !== ADMIN_KEY) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid admin key. Provide ADMIN_KEY in header.'
    });
  }
  
  next();
};

/**
 * GET /logs - Get transaction logs
 * 
 * Returns comprehensive transaction logs for debugging and monitoring.
 * 
 * Query parameters:
 * - limit: Number of logs to return (default: 100, max: 1000)
 * - sender: Filter by sender address
 * 
 * Headers:
 * - admin-key or x-admin-key: Admin authentication key
 * 
 * This endpoint requires admin authentication to prevent unauthorized access
 * to sensitive transaction data.
 */
app.get('/logs', adminAuth, (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
    const senderFilter = req.query.sender;
    
    let logs = [...transactionLogs].reverse(); // Most recent first
    
    // Filter by sender if provided
    if (senderFilter) {
      logs = logs.filter(log => 
        log.sender.toLowerCase().includes(senderFilter.toLowerCase())
      );
    }
    
    // Limit results
    logs = logs.slice(0, limit);
    
    res.json({
      total: transactionLogs.length,
      returned: logs.length,
      logs: logs,
      filters: {
        limit: limit,
        sender: senderFilter || null
      }
    });
  } catch (error) {
    console.error('❌ Error in /logs endpoint:', error);
    res.status(500).json({
      error: 'Failed to fetch logs',
      details: error.message
    });
  }
});

/**
 * GET /stats - Get comprehensive statistics
 * 
 * Returns detailed analytics about sponsored transactions:
 * - Total transactions sponsored
 * - Total gas spent
 * - Transactions per hour (last 24h)
 * - Most active senders
 * - Success rate
 * 
 * This endpoint is public (no auth required) and helps demonstrate
 * observability to hackathon judges.
 */
app.get('/stats', (req, res) => {
  try {
    const now = Date.now();
    const last24Hours = now - (24 * 60 * 60 * 1000);
    
    // Filter logs from last 24 hours
    const recentLogs = transactionLogs.filter(log => {
      const logTime = new Date(log.timestamp).getTime();
      return logTime >= last24Hours;
    });
    
    // Calculate transactions per hour (last 24h)
    const transactionsPerHour = recentLogs.length / 24;
    
    // Calculate success rate
    const successful = transactionLogs.filter(log => log.status === 'success').length;
    const failed = transactionLogs.filter(log => log.status === 'failed').length;
    const total = transactionLogs.length;
    const successRate = total > 0 ? (successful / total) * 100 : 0;
    
    // Calculate total gas spent
    const totalGasSpentMIST = transactionLogs.reduce((sum, log) => {
      return sum + BigInt(log.gasCost || 0);
    }, 0n);
    const totalGasSpentSUI = Number(totalGasSpentMIST) / 1_000_000_000;
    
    // Find most active senders
    const senderCounts = {};
    transactionLogs.forEach(log => {
      if (log.sender && log.sender !== 'unknown') {
        senderCounts[log.sender] = (senderCounts[log.sender] || 0) + 1;
      }
    });
    
    const mostActiveSenders = Object.entries(senderCounts)
      .map(([address, count]) => ({ address, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10) // Top 10
      .map(({ address, count }) => ({
        address: `${address.slice(0, 6)}...${address.slice(-4)}`,
        fullAddress: address,
        transactions: count
      }));
    
    // Status breakdown
    const statusBreakdown = {
      success: transactionLogs.filter(log => log.status === 'success').length,
      failed: transactionLogs.filter(log => log.status === 'failed').length,
      pending: transactionLogs.filter(log => log.status === 'pending').length
    };
    
    res.json({
      overview: {
        totalTransactions: total,
        successfulTransactions: successful,
        failedTransactions: failed,
        successRate: successRate.toFixed(2) + '%',
        totalGasSpent: {
          sui: totalGasSpentSUI.toFixed(6),
          mist: totalGasSpentMIST.toString()
        }
      },
      last24Hours: {
        transactions: recentLogs.length,
        transactionsPerHour: transactionsPerHour.toFixed(2),
        successful: recentLogs.filter(log => log.status === 'success').length,
        failed: recentLogs.filter(log => log.status === 'failed').length
      },
      statusBreakdown: statusBreakdown,
      mostActiveSenders: mostActiveSenders,
      timeRange: {
        oldestLog: transactionLogs.length > 0 ? transactionLogs[0].timestamp : null,
        newestLog: transactionLogs.length > 0 ? transactionLogs[transactionLogs.length - 1].timestamp : null,
        totalLogs: transactionLogs.length
      }
    });
  } catch (error) {
    console.error('❌ Error in /stats endpoint:', error);
    res.status(500).json({
      error: 'Failed to fetch statistics',
      details: error.message
    });
  }
});

/**
 * GET /limits - Get rate limit status for requester
 * 
 * Returns current rate limit status including:
 * - IP-based limit status (from express-rate-limit headers)
 * - Global limit status
 * - Per-address limit status (if sender address provided)
 * - Remaining requests
 * - When limits reset
 * 
 * Query parameters:
 * - address (optional): Sui address to check per-address limits
 * 
 * This endpoint helps users understand their rate limit status
 * and when they can make more requests.
 */
app.get('/limits', (req, res) => {
  try {
    const { address } = req.query;
    const clientIp = req.ip || req.connection.remoteAddress;
    
    // Get IP-based limit info (from express-rate-limit)
    // Note: express-rate-limit doesn't expose this easily, so we'll estimate
    const ipLimit = {
      max: 10,
      windowMs: 60 * 60 * 1000,
      note: 'Check RateLimit-* headers for exact IP limit status'
    };
    
    // Get global limit status
    const globalLimit = checkGlobalLimit();
    
    // Get per-address limit status (if address provided)
    let addressLimit = null;
    if (address) {
      addressLimit = checkAddressLimit(address);
    }
    
    res.json({
      rateLimiting: {
        enabled: !RATE_LIMIT_DISABLED,
        disabled: RATE_LIMIT_DISABLED
      },
      limits: {
        perIp: {
          max: 10,
          window: '1 hour',
          description: 'Maximum 10 sponsored transactions per IP address per hour'
        },
        global: {
          max: 50,
          current: globalRequestCount,
          remaining: globalLimit.remaining,
          resetTime: new Date(globalLimit.resetTime).toISOString(),
          resetIn: Math.ceil((globalLimit.resetTime - Date.now()) / 1000),
          window: '1 hour',
          description: 'Maximum 50 sponsored transactions globally per hour'
        },
        perAddress: {
          max: 5,
          window: '1 hour',
          description: 'Maximum 5 sponsored transactions per Sui address per hour',
          ...(address ? {
            address: `${address.slice(0, 6)}...${address.slice(-4)}`,
            current: addressLimits.get(address)?.count || 0,
            remaining: addressLimit?.remaining || 0,
            resetTime: addressLimit ? new Date(addressLimit.resetTime).toISOString() : null,
            resetIn: addressLimit ? Math.ceil((addressLimit.resetTime - Date.now()) / 1000) : null
          } : {
            note: 'Provide ?address=YOUR_SUI_ADDRESS to check per-address limits'
          })
        }
      },
      clientInfo: {
        ip: clientIp,
        note: 'IP-based limits are enforced per request'
      }
    });
  } catch (error) {
    console.error('❌ Error in /limits endpoint:', error);
    res.status(500).json({
      error: 'Failed to fetch rate limit status',
      details: error.message
    });
  }
});

/**
 * GET /health - Health check endpoint
 * 
 * Simple endpoint to check if the server is running.
 * Useful for monitoring and load balancers.
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Error handling middleware (catches errors not handled by routes)
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    details: err.message
  });
});

// Start server
app.listen(PORT, async () => {
  console.log(`\n🎉 Gas Station Server running on port ${PORT}`);
  console.log(`📍 Sponsor Address: ${sponsorAddress}`);
  console.log(`📦 Allowed Package: ${ALLOWED_PACKAGE_ID}`);
  console.log(`🌐 Network: ${SUI_NETWORK}`);
  console.log(`\n📡 Endpoints:`);
  console.log(`   POST /sponsor - Sponsor a transaction`);
  console.log(`   GET  /status  - Get gas station status`);
  console.log(`   GET  /balance - Get detailed balance and statistics`);
  console.log(`   GET  /stats   - Get comprehensive transaction statistics`);
  console.log(`   GET  /logs    - Get transaction logs (requires admin key)`);
  console.log(`   GET  /limits  - Get rate limit status`);
  console.log(`   GET  /health  - Health check`);
  
  if (ADMIN_KEY) {
    console.log(`\n🔐 Admin endpoints enabled (ADMIN_KEY configured)`);
  } else {
    console.log(`\n⚠️  Admin endpoints disabled (set ADMIN_KEY in .env to enable /logs)`);
  }
  
  // Check balance on startup
  console.log(`\n💰 Checking initial sponsor balance...`);
  await checkSponsorBalance();
  
  // Set up periodic balance checking (every 5 minutes)
  // This helps monitor gas usage during hackathon demos
  setInterval(async () => {
    console.log('\n⏰ Periodic balance check (every 5 minutes)...');
    await checkSponsorBalance();
    resetDailyStatsIfNeeded();
  }, 5 * 60 * 1000); // 5 minutes in milliseconds
  
  console.log(`\n✨ Ready to sponsor transactions!`);
  console.log(`📊 Balance monitoring active (checks every 5 minutes)\n`);
});

