# Cập nhật Source Code - Multi-RPC Load Balancing

## Tổng quan

Đã cập nhật source code với 2 thay đổi chính:

### 1. **Relayer Service** - Multi-RPC với Load Balancing
- ✅ Hỗ trợ nhiều RPC endpoints (SEPOLIA_RPC_URL, SEPOLIA_RPC_URL_01, _02, _03...)
- ✅ Automatic failover khi gặp rate limit
- ✅ Smart cooldown system (1 phút)
- ✅ Health monitoring và status reporting
- ✅ Automatic endpoint rotation

### 2. **Contract Service** - Fixed Ankr Endpoint
- ✅ Sử dụng Ankr endpoint cố định
- ✅ Stable connection cho API calls

## Files đã thay đổi

### 1. `/src/backend/env`
```diff
+ SEPOLIA_RPC_URL_01=https://rpc.ankr.com/eth_sepolia/...
+ SEPOLIA_RPC_URL_02=https://autumn-still-emerald.ethereum-sepolia.quiknode.pro/...
+ SEPOLIA_RPC_URL_03=https://eth-sepolia.g.alchemy.com/v2/demo
```

### 2. `/src/backend/scripts/rpcManager.js` (NEW)
- Class quản lý multiple RPC endpoints
- Load balancing và failover logic
- Health monitoring
- Error detection (rate limit, filter errors)

### 3. `/src/backend/scripts/relayer.js`
```diff
- const provider = new ethers.JsonRpcProvider(RPC);
+ const rpcManager = new RPCManager();
+ let providerInfo = rpcManager.createProvider();
+ let provider = providerInfo.provider;
```

- Tích hợp RPCManager
- Automatic provider recreation on failover
- Safe provider calls với retry logic
- Health status display

### 4. `/src/backend/services/contractService.js`
```diff
- const rpcUrl = process.env.SEPOLIA_RPC_URL || '...';
+ const rpcUrl = 'https://rpc.ankr.com/eth_sepolia/d9a298837a9ed9d6b5b551214f6625a3056e7cf1c3c9cb1f5a084fe81927fa33';
```

## Cách sử dụng

### Cấu hình .env

```bash
# Primary endpoint
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY

# Backup endpoints (optional but recommended)
SEPOLIA_RPC_URL_01=https://rpc.ankr.com/eth_sepolia/YOUR_KEY
SEPOLIA_RPC_URL_02=https://YOUR_QUICKNODE_URL
SEPOLIA_RPC_URL_03=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY

# Có thể thêm unlimited: _04, _05, _06...
```

### Chạy Relayer

```bash
cd src/backend
node scripts/relayer.js
```

### Output mẫu

```
📡 RPC Manager initialized with 4 endpoints:
   1. SEPOLIA_RPC_URL: https://sepolia.infura.io/v3/...
   2. SEPOLIA_RPC_URL_01: https://rpc.ankr.com/...
   3. SEPOLIA_RPC_URL_02: https://autumn-still-emerald...
   4. SEPOLIA_RPC_URL_03: https://eth-sepolia.g.alchemy...

🔌 Connecting to SEPOLIA_RPC_URL...
✅ Relayer is now running and listening for events...
🔄 Automatic failover: Enabled
⚡ Current endpoint: SEPOLIA_RPC_URL
```

## Tính năng chính

### Auto Failover
```
⚠️  Rate limit hit, switching endpoint...
❌ Endpoint failed (3/3): too many requests
🔌 Connecting to SEPOLIA_RPC_URL_01...
✅ Switched to SEPOLIA_RPC_URL_01
```

### Health Monitoring
```
📊 RPC Endpoints Status:
   1. ❌ SEPOLIA_RPC_URL (HTTP) (cooldown: 45s)
   2. ✅ SEPOLIA_RPC_URL_01 (HTTP)
   3. ✅ SEPOLIA_RPC_URL_02 (HTTP)
   4. ✅ SEPOLIA_RPC_URL_03 (HTTP)
```

### Smart Cooldown
- Endpoint failed → vào cooldown 1 phút
- Sau 1 phút → tự động retry
- Max 3 failures → cooldown

## Best Practices

1. **Ít nhất 3 endpoints** cho production
2. **Mix providers**: Infura + Ankr + Alchemy
3. **Monitor logs** thường xuyên
4. **Free tier** providers:
   - Ankr: 500M requests/month
   - Alchemy: 300M compute units/month
   - Infura: 100k requests/day

## Testing

Đã test thành công:
- ✅ RPC Manager khởi tạo đúng 4 endpoints
- ✅ Load environment variables correctly
- ✅ ContractService sử dụng Ankr endpoint

## Documentation

Chi tiết xem: `/src/backend/RPC_CONFIGURATION.md`

## Lưu ý

- File `.env` cần có ít nhất `SEPOLIA_RPC_URL`
- Thêm `RELAYER_PRIVATE_KEY` để chạy relayer
- ContractService dùng Ankr endpoint cố định (không cần config)
- Relayer service tự động switch giữa các endpoints
