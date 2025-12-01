/**
 * RPC Manager - Load balancing and failover for multiple RPC endpoints
 * 
 * Automatically switches between RPC endpoints when rate limits are hit
 */

const { ethers } = require('ethers');

class RPCManager {
    constructor() {
        this.endpoints = [];
        this.currentIndex = 0;
        this.failedEndpoints = new Map(); // endpoint -> { count, lastFailed }
        this.maxFailures = 3;
        this.cooldownMs = 60000; // 1 minute cooldown after failures
        
        this.loadEndpoints();
    }

    loadEndpoints() {
        // Load all SEPOLIA_RPC_URL* from environment
        const envKeys = Object.keys(process.env)
            .filter(key => key.startsWith('SEPOLIA_RPC_URL'))
            .sort(); // SEPOLIA_RPC_URL, SEPOLIA_RPC_URL_01, etc.

        for (const key of envKeys) {
            const url = process.env[key];
            if (url && url.trim()) {
                this.endpoints.push({
                    url,
                    name: key,
                    isWebSocket: /^wss?:\/\//i.test(url)
                });
            }
        }

        if (this.endpoints.length === 0) {
            throw new Error('No RPC endpoints found in environment variables (SEPOLIA_RPC_URL*)');
        }

        console.log(`\n📡 RPC Manager initialized with ${this.endpoints.length} endpoints:`);
        this.endpoints.forEach((ep, i) => {
            console.log(`   ${i + 1}. ${ep.name}: ${ep.url.substring(0, 60)}...`);
        });
    }

    /**
     * Get next available endpoint with failover
     */
    getNextEndpoint() {
        const now = Date.now();
        
        // Try to find a healthy endpoint
        for (let i = 0; i < this.endpoints.length; i++) {
            const endpoint = this.endpoints[this.currentIndex];
            const failures = this.failedEndpoints.get(endpoint.url);
            
            // Check if endpoint is in cooldown
            if (failures) {
                const timeSinceLastFail = now - failures.lastFailed;
                if (failures.count >= this.maxFailures && timeSinceLastFail < this.cooldownMs) {
                    console.log(`⏭️  Skipping ${endpoint.name} (in cooldown for ${Math.round((this.cooldownMs - timeSinceLastFail) / 1000)}s)`);
                    this.currentIndex = (this.currentIndex + 1) % this.endpoints.length;
                    continue;
                }
                
                // Reset if cooldown expired
                if (timeSinceLastFail >= this.cooldownMs) {
                    console.log(`✅ ${endpoint.name} cooldown expired, retrying...`);
                    this.failedEndpoints.delete(endpoint.url);
                }
            }
            
            return endpoint;
        }
        
        // All endpoints failed, return first one anyway
        console.warn('⚠️  All endpoints failed, using first endpoint');
        return this.endpoints[0];
    }

    /**
     * Create provider for current endpoint
     */
    createProvider() {
        const endpoint = this.getNextEndpoint();
        
        console.log(`🔌 Connecting to ${endpoint.name}...`);
        
        if (endpoint.isWebSocket) {
            return {
                provider: new ethers.WebSocketProvider(endpoint.url),
                endpoint,
                type: 'websocket'
            };
        } else {
            return {
                provider: new ethers.JsonRpcProvider(endpoint.url),
                endpoint,
                type: 'http'
            };
        }
    }

    /**
     * Mark endpoint as failed (rate limited or error)
     */
    markFailed(endpointUrl, error) {
        const failures = this.failedEndpoints.get(endpointUrl) || { count: 0, lastFailed: 0 };
        failures.count++;
        failures.lastFailed = Date.now();
        this.failedEndpoints.set(endpointUrl, failures);
        
        console.log(`❌ Endpoint failed (${failures.count}/${this.maxFailures}): ${error.message || error}`);
        
        // Move to next endpoint
        this.currentIndex = (this.currentIndex + 1) % this.endpoints.length;
    }

    /**
     * Check if error is rate limit related
     */
    isRateLimitError(error) {
        const message = error.message?.toLowerCase() || '';
        return (
            message.includes('rate limit') ||
            message.includes('too many requests') ||
            message.includes('429') ||
            error.code === 'RATE_LIMIT' ||
            error.code === 429
        );
    }

    /**
     * Check if error is filter related (method disabled)
     */
    isFilterError(error) {
        const message = error.message?.toLowerCase() || '';
        return (
            message.includes('filter not found') ||
            message.includes('method disabled') ||
            message.includes('eth_newfilter') ||
            error.code === -32000 ||
            error.code === -32075
        );
    }

    /**
     * Wrap provider call with automatic failover
     */
    async callWithFailover(providerCall, maxRetries = 3) {
        let lastError;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const result = await providerCall();
                return result;
            } catch (error) {
                lastError = error;
                
                if (this.isRateLimitError(error)) {
                    console.log(`⚠️  Rate limit hit, switching endpoint... (attempt ${attempt + 1}/${maxRetries})`);
                    const currentEndpoint = this.endpoints[this.currentIndex];
                    this.markFailed(currentEndpoint.url, error);
                    
                    // Wait a bit before retry
                    await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
                    continue;
                }
                
                // Non-rate-limit error, throw immediately
                throw error;
            }
        }
        
        throw lastError;
    }

    /**
     * Get health status of all endpoints
     */
    getHealthStatus() {
        const now = Date.now();
        return this.endpoints.map(ep => {
            const failures = this.failedEndpoints.get(ep.url);
            const isHealthy = !failures || failures.count < this.maxFailures || 
                             (now - failures.lastFailed) >= this.cooldownMs;
            
            return {
                name: ep.name,
                url: ep.url.substring(0, 50) + '...',
                type: ep.isWebSocket ? 'WebSocket' : 'HTTP',
                healthy: isHealthy,
                failures: failures?.count || 0,
                cooldownRemaining: failures ? Math.max(0, this.cooldownMs - (now - failures.lastFailed)) : 0
            };
        });
    }
}

module.exports = RPCManager;
