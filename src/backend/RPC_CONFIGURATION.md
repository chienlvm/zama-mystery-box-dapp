# RPC Configuration Guide

## Multi-RPC Load Balancing

Relayer service bây giờ hỗ trợ nhiều RPC endpoints với automatic failover khi gặp rate limit.

## Cấu hình trong `.env`

### Thêm nhiều RPC endpoints:

```env
# Primary RPC
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY

# Backup RPCs (tự động failover)
SEPOLIA_RPC_URL_01=https://rpc.ankr.com/eth_sepolia/YOUR_KEY
SEPOLIA_RPC_URL_02=https://autumn-still-emerald.ethereum-sepolia.quiknode.pro/YOUR_KEY
SEPOLIA_RPC_URL_03=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY

# Có thể thêm unlimited endpoints: SEPOLIA_RPC_URL_04, SEPOLIA_RPC_URL_05, etc.
```

## Tính năng

### 1. **Automatic Load Balancing**
- Relayer tự động chuyển sang endpoint khác khi gặp rate limit
- Không cần restart service

### 2. **Smart Cooldown**
- Endpoint bị lỗi sẽ vào cooldown 1 phút
- Sau cooldown, tự động retry

### 3. **Health Monitoring**
- Hiển thị status của tất cả endpoints
- Log health update mỗi 5 phút

### 4. **Error Detection**
- Tự động detect:
  - Rate limit errors (429, "too many requests")
  - Filter errors ("filter not found", "method disabled")
  - Connection errors

## Contract Service

ContractService sử dụng Ankr endpoint cố định để stability:

```javascript
// contractService.js
const rpcUrl = 'https://rpc.ankr.com/eth_sepolia/d9a298837a9ed9d6b5b551214f6625a3056e7cf1c3c9cb1f5a084fe81927fa33';
```

## Logs

### Startup:
```
📡 RPC Manager initialized with 4 endpoints:
   1. SEPOLIA_RPC_URL: https://sepolia.infura.io/v3/...
   2. SEPOLIA_RPC_URL_01: https://rpc.ankr.com/eth_sepolia/...
   3. SEPOLIA_RPC_URL_02: https://autumn-still-emerald...
   4. SEPOLIA_RPC_URL_03: https://eth-sepolia.g.alchemy...

🔌 Connecting to SEPOLIA_RPC_URL...
```

### Failover:
```
⚠️  Rate limit hit, switching endpoint... (attempt 1/3)
❌ Endpoint failed (3/3): too many requests
⏭️  Skipping SEPOLIA_RPC_URL (in cooldown for 58s)
🔌 Connecting to SEPOLIA_RPC_URL_01...
✅ Switched to SEPOLIA_RPC_URL_01
```

### Health Status:
```
📊 RPC Endpoints Status:
   1. ❌ SEPOLIA_RPC_URL (HTTP) (cooldown: 45s)
   2. ✅ SEPOLIA_RPC_URL_01 (HTTP)
   3. ✅ SEPOLIA_RPC_URL_02 (HTTP)
   4. ✅ SEPOLIA_RPC_URL_03 (HTTP)

⚡ Current endpoint: SEPOLIA_RPC_URL_01
```

## Best Practices

1. **Sử dụng ít nhất 3 endpoints** cho production
2. **Mix providers**: Infura, Ankr, Alchemy, QuickNode
3. **WebSocket endpoints** (wss://) được ưu tiên hơn HTTP
4. **Free tier**: Ankr và Alchemy có free tier tốt
5. **Monitor logs**: Check health status thường xuyên

## Recommended Providers

### Free Tier:
- **Ankr**: 500M requests/month
- **Alchemy**: 300M compute units/month  
- **Infura**: 100k requests/day

### Paid:
- **QuickNode**: Unlimited, low latency
- **Alchemy Growth**: Higher limits

## Troubleshooting

### Tất cả endpoints đều failed:
```
⚠️  All endpoints failed, using first endpoint
```
→ Check network, verify API keys

### Không có endpoint nào:
```
❌ No RPC endpoints found in environment variables
```
→ Thêm ít nhất `SEPOLIA_RPC_URL` vào `.env`

### Endpoint bị cooldown liên tục:
→ Rate limit quá thấp, upgrade plan hoặc thêm endpoints
