# Dr. Sui - Medical Diagnosis on Sui Blockchain

Dr. Sui is a decentralized medical imaging analysis platform that uses AI to analyze medical images (DICOM files) and stores immutable proof of diagnosis on the Sui blockchain.

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** and npm
- **Python 3.8+** and pip
- **Sui CLI** (for deploying Move contracts)
- **Sui Wallet** (for connecting to the dApp)

### Installation

1. **Clone the repository:**
```bash
git clone <repository-url>
cd DrSui
```

2. **Install frontend dependencies:**
```bash
npm install
```

3. **Set up backend:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

4. **Set up gas station (optional but recommended):**
```bash
cd gas-station
npm install
cd ..
```

5. **Configure environment variables:**
   - Create `backend/.env` with your Atoma SDK credentials
   - Create `gas-station/.env` with sponsor wallet key (see Gas Station setup below)
   - Create `.env` in project root with frontend variables

6. **Start all services:**
```bash
# Unix/Mac/Linux
./scripts/start-all.sh

# Windows
scripts\start-all.bat
```

Or start individually:
- Backend: `cd backend && source venv/bin/activate && uvicorn main:app --reload --port 8000`
- Gas Station: `cd gas-station && npm start`
- Frontend: `npm run dev`

## ⛽ Gasless Transactions

### What Are Gasless Transactions?

Gasless transactions allow users to interact with your dApp **without needing SUI in their wallet**. Instead, a "sponsor" (gas station service) pays the transaction fees on behalf of users.

**Why This Matters:**
- **Better UX**: New users can start using your app immediately without acquiring SUI first
- **Lower barrier to entry**: Removes the friction of needing cryptocurrency for gas
- **Hackathon advantage**: Impresses judges with seamless user experience
- **Professional**: Shows you understand Web3 UX challenges

### Architecture Flow

```
┌─────────────────┐
│ User's Wallet   │  ← Has 0 SUI (no gas needed!)
│ (0 SUI)         │
└────────┬────────┘
         │
         │ 1. User creates transaction
         ↓
┌─────────────────┐
│ Frontend        │  ← Builds transaction (no gas payment)
│ (React/Vite)    │
└────────┬────────┘
         │
         │ 2. Sends transaction bytes
         ↓
┌─────────────────┐
│ Gas Station     │  ← Validates & sponsors transaction
│ (Node.js)       │     - Checks package ID
│                 │     - Sets gasOwner to sponsor
│                 │     - Signs with sponsor keypair
└────────┬────────┘
         │
         │ 3. Returns sponsored transaction
         ↓
┌─────────────────┐
│ User Signs      │  ← User approves transaction in wallet
│ (Wallet Popup)  │
└────────┬────────┘
         │
         │ 4. Execute with both signatures
         ↓
┌─────────────────┐
│ Sui Network     │  ← Transaction executes on-chain
│ (Blockchain)    │
└────────┬────────┘
         │
         │ 5. Gas deducted from sponsor wallet
         ↓
┌─────────────────┐
│ Sponsor Wallet  │  ← Pays ~0.01 SUI per transaction
│ (Funded)        │
└─────────────────┘
```

### Gas Station Setup

#### 1. Create Sponsor Wallet

You need a separate Sui wallet that will pay for gas:

```bash
# Using Sui CLI
sui client new-address ed25519

# Or use a wallet app (Sui Wallet, Ethos, etc.)
# Export the private key in bech32 format: suiprivkey...
```

#### 2. Fund with Test SUI

Get test SUI from the Sui faucet:
- **Testnet**: https://discord.com/channels/916379725201563759/971488439931392130
- **Devnet**: https://discord.com/channels/916379725201563759/1037811694564560966

Or use the Sui CLI:
```bash
sui client faucet
```

**Recommended funding:**
- **Hackathon demo**: 10-50 SUI
- **Development**: 5-10 SUI
- **Minimum**: 1 SUI (service will warn if below 1 SUI)

#### 3. Export Private Key

**From Sui CLI:**
```bash
sui keytool export <key-alias>
# Copy the bech32 private key (starts with suiprivkey...)
```

**From Sui Wallet:**
1. Open Sui Wallet
2. Go to Settings → Export Private Key
3. Copy the private key

#### 4. Configure Environment Variables

Create `gas-station/.env`:

```env
# Sponsor wallet private key (bech32 format)
SPONSOR_SECRET_KEY=suiprivkey1qzv3k0wms7a5t5u939wt85smtzv8esfv543e3cymlk7yhr6h3vpdcx96q02

# Your deployed Move package ID
ALLOWED_PACKAGE_ID=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef

# Sui network
SUI_NETWORK=testnet

# Server port
PORT=3001

# Optional: Admin key for /logs endpoint
# ADMIN_KEY=your-secret-admin-key

# Optional: Disable rate limiting (development only!)
# RATE_LIMIT_DISABLED=false
```

#### 5. Update Frontend Configuration

Add to project root `.env`:

```env
VITE_GAS_STATION_URL=http://localhost:3001
```

### Running the Gas Station

**Start the service:**
```bash
cd gas-station
npm start
```

**Development mode (with auto-reload):**
```bash
npm run dev
```

The service will:
- Start on port 3001 (or PORT from .env)
- Log sponsor address on startup
- Check balance every 5 minutes
- Warn if balance is low

**Verify it's running:**
```bash
curl http://localhost:3001/health
# Should return: {"status":"ok"}

curl http://localhost:3001/status
# Should return sponsor address and balance
```

### Security Considerations

#### Package ID Validation
- **Critical**: Only transactions targeting `ALLOWED_PACKAGE_ID` are sponsored
- Prevents abuse: Users can't use your gas for arbitrary transactions
- All MoveCall commands are validated before sponsorship

#### Rate Limiting
The gas station implements three layers of rate limiting:

1. **Per-IP**: Max 10 requests per IP per hour
2. **Global**: Max 50 requests per hour (all users combined)
3. **Per-Address**: Max 5 requests per Sui address per hour

This prevents:
- Wallet draining attacks
- DoS attacks
- Abuse from single users

**To disable rate limiting (development only):**
```env
RATE_LIMIT_DISABLED=true
```

#### Private Key Security
- **Never commit** `.env` files to version control
- **Never share** your sponsor private key
- **Use separate wallet** for sponsoring (not your main wallet)
- **Monitor balance** regularly using `/status` or `/balance` endpoints

### Troubleshooting

#### "Gas Station Offline"

**Symptoms:**
- Frontend shows red dot "Gas Station Offline"
- Gasless mode is disabled

**Solutions:**
1. Check if gas station is running:
   ```bash
   curl http://localhost:3001/health
   ```

2. Check logs:
   ```bash
   # Unix/Mac
   tail -f /tmp/drsui-gas-station.log
   
   # Or check the terminal where you started it
   ```

3. Verify port 3001 is not in use:
   ```bash
   lsof -i :3001  # Unix/Mac
   netstat -ano | findstr :3001  # Windows
   ```

4. Check environment variables:
   ```bash
   cd gas-station
   cat .env  # Verify SPONSOR_SECRET_KEY is set
   ```

#### "Insufficient Sponsor Balance"

**Symptoms:**
- Gas station returns 500 error
- Error message: "No sponsor gas coin with sufficient balance"

**Solutions:**
1. Check current balance:
   ```bash
   curl http://localhost:3001/status
   ```

2. Fund the sponsor wallet:
   - Use Sui faucet (testnet/devnet)
   - Transfer SUI from another wallet
   - Minimum recommended: 1 SUI

3. Verify wallet address:
   - Check the sponsor address logged on startup
   - Ensure you funded the correct address

#### "Transaction Validation Failed"

**Symptoms:**
- Gas station returns 403 Forbidden
- Error: "Unauthorized package"

**Solutions:**
1. Verify `ALLOWED_PACKAGE_ID` in `gas-station/.env`:
   ```env
   ALLOWED_PACKAGE_ID=0x1234...your-package-id
   ```

2. Check that your transaction calls functions from this package:
   - Transaction target must start with `ALLOWED_PACKAGE_ID`
   - Format: `0x1234...::module::function`

3. Verify package is deployed:
   ```bash
   sui client object <PACKAGE_ID>
   ```

#### Rate Limit Exceeded

**Symptoms:**
- Gas station returns 429 Too Many Requests
- Error: "Rate limit exceeded"

**Solutions:**
1. Check your rate limit status:
   ```bash
   curl http://localhost:3001/limits?address=YOUR_SUI_ADDRESS
   ```

2. Wait for the rate limit window to reset (1 hour)

3. For development, you can disable rate limiting:
   ```env
   RATE_LIMIT_DISABLED=true
   ```

4. For production, consider increasing limits in `server.js` if needed

### Monitoring & Analytics

The gas station provides several endpoints for monitoring:

**Get Statistics:**
```bash
curl http://localhost:3001/stats
```

Returns:
- Total transactions sponsored
- Total gas spent
- Transactions per hour
- Most active senders
- Success rate

**Get Transaction Logs (requires admin key):**
```bash
curl -H "admin-key: YOUR_ADMIN_KEY" http://localhost:3001/logs?limit=50
```

**Get Balance:**
```bash
curl http://localhost:3001/balance
```

### Best Practices

1. **Monitor Balance Regularly**
   - Check `/status` or `/balance` endpoints
   - Set up alerts for low balance (< 1 SUI)

2. **Use Separate Wallet**
   - Don't use your main wallet as sponsor
   - Create dedicated wallet for gas station

3. **Set Appropriate Limits**
   - Adjust rate limits based on your use case
   - Monitor `/stats` to understand usage patterns

4. **Keep Logs**
   - Transaction logs help debug issues
   - Review logs periodically for anomalies

5. **Test Before Demo**
   - Verify gas station is working
   - Test with a few transactions
   - Check balance is sufficient

## 📁 Project Structure

```
DrSui/
├── backend/              # Python FastAPI backend
│   ├── main.py          # AI analysis endpoint
│   └── venv/            # Python virtual environment
├── gas-station/         # Node.js gas station service
│   ├── server.js        # Gas sponsorship server
│   └── .env             # Sponsor wallet config
├── src/                 # React frontend
│   ├── components/      # React components
│   ├── hooks/          # Custom hooks (useSponsoredTx)
│   └── App.tsx         # Main app component
├── dr_sui/             # Sui Move contracts
│   └── sources/        # Move source files
└── scripts/            # Startup scripts
    ├── start-all.sh    # Start all services (Unix/Mac)
    └── start-all.bat   # Start all services (Windows)
```

## 🔧 Development

### Backend (Python FastAPI)
- Port: 8000
- Health: http://localhost:8000/status
- API Docs: http://localhost:8000/docs

### Gas Station (Node.js)
- Port: 3001
- Health: http://localhost:3001/health
- Status: http://localhost:3001/status
- Stats: http://localhost:3001/stats

### Frontend (React/Vite)
- Port: 3000
- URL: http://localhost:3000

## 📚 Additional Resources

- [Sui Documentation](https://docs.sui.io/)
- [Sui Move Book](https://move-language.github.io/move/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)

## 📝 License

ISC
  