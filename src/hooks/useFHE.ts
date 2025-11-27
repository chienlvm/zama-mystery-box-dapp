/**
 * useFHE Hook - Browser-side FHE encryption for user inputs
 * 
 * Implementation based on Zama FHEVM v0.9:
 * https://docs.zama.org/protocol/relayer-sdk-guides/development-guide/webapp
 * https://docs.zama.org/protocol/solidity-guides/development-guide/migration
 * 
 * Architecture (v0.9 Self-Relaying):
 * 1. Client encrypts data with FHE (this hook)
 * 2. Contract marks ciphertext as publicly decryptable: FHE.makePubliclyDecryptable()
 * 3. Client fetches decryption via: publicDecrypt()
 * 4. Contract verifies result via: FHE.checkSignatures()
 * 
 * Key Features:
 * - Initialize FHE instance with Sepolia testnet config
 * - Encrypt uint32 values (user random seeds)
 * - Generate input proofs for on-chain verification
 * - Handle async initialization and loading states
 * - CORS headers required for WASM threads
 * 
 * @example
 * const { fheInstance, isReady, encryptUint32 } = useFHE();
 * 
 * const seed = Math.floor(Math.random() * 2**32);
 * const { handle, inputProof } = await encryptUint32(seed, contractAddress, userAddress);
 * await contract.openBoxWithUserSeed(purchaseId, handle, inputProof);
 */

import { useState, useEffect, useCallback } from 'react';

// FHE Instance type from @zama-fhe/relayer-sdk v0.2.0
type FhevmInstance = any; // Will be properly typed after SDK loads

// Encrypted input result
interface EncryptedInput {
  handles: Uint8Array[];
  inputProof: Uint8Array;
}

interface UseFHEReturn {
  fheInstance: FhevmInstance | null;
  isReady: boolean;
  isLoading: boolean;
  error: string | null;
  encryptUint32: (
    value: number,
    contractAddress: string,
    userAddress: string
  ) => Promise<{ handle: string; inputProof: string }>;
}

export function useFHE(): UseFHEReturn {
  const [fheInstance, setFheInstance] = useState<FhevmInstance | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize FHE SDK on mount
  useEffect(() => {
    let isMounted = true;

    async function initializeFHE() {
      if (isReady || isLoading) return; // Prevent double initialization
      
      setIsLoading(true);
      setError(null);

      try {
        console.log('[useFHE] 🚀 Initializing Zama FHE SDK v0.9 for browser...');
        console.log('[useFHE] 📖 Migration Guide: https://docs.zama.org/protocol/solidity-guides/development-guide/migration');
        console.log('[useFHE] 📖 WebApp Guide: https://docs.zama.org/protocol/relayer-sdk-guides/development-guide/webapp');

        // Check for existing ethereum provider before SDK loads
        const existingEthereum = (window as any).ethereum;
        if (!existingEthereum) {
          throw new Error('MetaMask not detected. Please install MetaMask.');
        }
        console.log('[useFHE] ✅ MetaMask detected');

        // Step 1: Import SDK from /web endpoint (for browser environment)
        // IMPORTANT: Use /web for browser, /node for Node.js
        console.log('[useFHE] ⏳ Dynamically importing SDK...');
        
        // @ts-ignore - Dynamic import
        const { initSDK, createInstance, SepoliaConfig } = await import('@zama-fhe/relayer-sdk/web');
        
        console.log('[useFHE] ✅ SDK module loaded');
        console.log('[useFHE] 📦 Available exports:', { 
          hasInitSDK: !!initSDK, 
          hasCreateInstance: !!createInstance,
          hasSepoliaConfig: !!SepoliaConfig 
        });

        // Step 2: Initialize SDK - Load TFHE WASM
        // This loads the WebAssembly module for FHE operations
        console.log('[useFHE] ⏳ Calling initSDK()...');
        console.log('[useFHE] ⚠️  Note: Requires CORS headers for SharedArrayBuffer');
        
        try {
          await initSDK();
          console.log('[useFHE] ✅ TFHE WASM loaded successfully');
        } catch (wasmError: any) {
          // Handle "Cannot redefine property: ethereum" error gracefully
          if (wasmError.message?.includes('Cannot redefine property: ethereum')) {
            console.warn('[useFHE] ⚠️ SDK tried to redefine window.ethereum, continuing...');
            // Continue initialization despite this error
          } else {
            console.error('[useFHE] ❌ WASM loading failed:', wasmError.message);
            console.error('[useFHE] 💡 This might be due to:');
            console.error('   - CORS headers not set correctly');
            console.error('   - WASM file served with wrong MIME type');
            console.error('   - Browser not supporting SharedArrayBuffer');
            throw wasmError;
          }
        }

        if (!isMounted) return;

        // Step 3: Configure for Sepolia testnet
        // SepoliaConfig provides default configuration for Sepolia
        const RELAYER_URL = import.meta.env.VITE_RELAYER_URL || 
                           SepoliaConfig.relayerUrl;

        console.log('[useFHE] 🌐 Network Configuration:');
        console.log('   Chain ID:', SepoliaConfig.chainId);
        console.log('   Gateway Chain ID:', SepoliaConfig.gatewayChainId);
        console.log('   Relayer URL:', RELAYER_URL);
        console.log('   ACL Contract:', SepoliaConfig.aclContractAddress);
        console.log('   KMS Contract:', SepoliaConfig.kmsContractAddress);

        // Step 4: Create FHE instance with MetaMask provider
        // IMPORTANT: Use window.ethereum for MetaMask integration
        console.log('[useFHE] 🔨 Creating FHE instance with MetaMask provider...');
        
        if (!(window as any).ethereum) {
          throw new Error('MetaMask not detected. Please install MetaMask.');
        }

        const config = {
          ...SepoliaConfig,
          network: (window as any).ethereum, // Use MetaMask as network provider
          relayerUrl: RELAYER_URL,
        };

        const instance = await createInstance(config);
        
        if (!isMounted) return;

        setFheInstance(instance);
        setIsReady(true);
        console.log('[useFHE] ✅ FHE instance ready for encryption');
        console.log('[useFHE] 📊 Available methods:', Object.keys(instance || {}).slice(0, 5).join(', ') + '...');

      } catch (err: any) {
        if (!isMounted) return;
        
        const errorMessage = err.message || 'Failed to initialize FHE SDK';
        console.error('[useFHE] ❌ Initialization failed:', errorMessage);
        console.error('[useFHE] 📚 Troubleshooting:');
        console.error('   1. Check CORS headers are set (see vite.config.ts)');
        console.error('   2. Verify MetaMask is installed and connected');
        console.error('   3. Check network RPC URL is correct');
        console.error('   4. Read migration guide: https://docs.zama.org/protocol/solidity-guides/development-guide/migration');
        
        if (err.stack) {
          console.error('[useFHE] Stack trace:', err.stack);
        }
        
        setError(errorMessage);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initializeFHE();

    return () => {
      isMounted = false;
    };
  }, []); // Only run once on mount

  /**
   * Encrypt a uint32 value using FHE
   * 
   * This creates an encrypted input that can be sent to smart contracts.
   * The encryption is done client-side, ensuring the raw value never leaves the user's browser.
   * 
   * Reference: https://docs.zama.org/protocol/relayer-sdk-guides/fhevm-relayer/input
   * 
   * @param value - The uint32 value to encrypt (0 to 2^32-1)
   * @param contractAddress - The contract address that will decrypt the value
   * @param userAddress - The user's wallet address
   * @returns Object with handle (bytes32) and inputProof (bytes)
   * 
   * @example
   * const seed = Math.floor(Math.random() * 2**32);
   * const { handle, inputProof } = await encryptUint32(seed, boxAddress, userAddress);
   * await contract.openBoxWithUserSeed(purchaseId, handle, inputProof);
   */
  const encryptUint32 = useCallback(
    async (
      value: number,
      contractAddress: string,
      userAddress: string
    ): Promise<{ handle: string; inputProof: string }> => {
      if (!fheInstance) {
        throw new Error('FHE instance not initialized. Please wait for initialization to complete.');
      }

      if (!isReady) {
        throw new Error('FHE SDK is still loading. Please wait...');
      }

      // Validate input
      if (!Number.isInteger(value) || value < 0 || value > 2**32 - 1) {
        throw new Error(`Invalid uint32 value: ${value}. Must be an integer between 0 and ${2**32 - 1}`);
      }

      if (!contractAddress || !/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
        throw new Error(`Invalid contract address: ${contractAddress}`);
      }

      if (!userAddress || !/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
        throw new Error(`Invalid user address: ${userAddress}`);
      }

      try {
        console.log('[useFHE] 🔐 Encrypting uint32 value...');
        console.log('   Value:', value);
        console.log('   Contract:', contractAddress);
        console.log('   User:', userAddress);

        // Step 1: Create encrypted input builder
        // This creates a builder that will encrypt the value for the specific contract
        const inputBuilder = fheInstance.createEncryptedInput(
          contractAddress,
          userAddress
        );

        // Step 2: Add uint32 value to encrypt
        // The builder supports multiple types: add8, add16, add32, add64, add128, add256
        inputBuilder.add32(value);

        // Step 3: Encrypt and generate proof
        // This returns: { handles: Uint8Array[], inputProof: Uint8Array }
        // - handles: Array of encrypted values (one per add* call)
        // - inputProof: Zero-knowledge proof that encryption is correct
        console.log('[useFHE] ⏳ Generating encryption and proof...');
        const encryptedInput: EncryptedInput = await inputBuilder.encrypt();

        // Step 4: Extract handle (encrypted ciphertext) and proof
        const handleBytes = encryptedInput.handles[0]; // First handle for first encrypted value
        const proofBytes = encryptedInput.inputProof;

        // Step 5: Convert to hex strings for Solidity
        // Solidity expects:
        // - handle: bytes32 (32 bytes) - represents the encrypted value
        // - inputProof: bytes (variable length) - proves encryption correctness
        const handle = ethersHexlify(handleBytes);
        const inputProof = ethersHexlify(proofBytes);

        console.log('[useFHE] ✅ Encryption successful');
        console.log('   Handle (encrypted):', handle.substring(0, 20) + '...' + handle.substring(handle.length - 10));
        console.log('   Proof length:', inputProof.length, 'chars (' + (inputProof.length / 2 - 1) + ' bytes)');

        return { handle, inputProof };
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to encrypt value';
        console.error('[useFHE] ❌ Encryption failed:', errorMessage);
        console.error('[useFHE] Details:', err);
        throw new Error(`FHE encryption failed: ${errorMessage}`);
      }
    },
    [fheInstance, isReady]
  );

  return {
    fheInstance,
    isReady,
    isLoading,
    error,
    encryptUint32,
  };
}

/**
 * Helper: Convert Uint8Array to hex string (ethers v6 compatible)
 * @param bytes - Uint8Array to convert
 * @returns Hex string with 0x prefix
 */
function ethersHexlify(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
