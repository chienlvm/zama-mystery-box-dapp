/**
 * useBoxContract Hook - Smart Contract Interaction
 * 
 * Manages interactions with MysteryBox contract on Sepolia.
 * Integrates with useFHE for client-side FHE encryption.
 */

import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useFHE } from './useFHE';

// ABI for MysteryBox contract
const BOX_ABI = [
  'function boxes(string memory boxId) external view returns (string id, string name, uint256 priceWei)',
  'function buyBox(string memory boxId) external payable',
  'function openBoxWithUserSeed(uint256 purchaseId, bytes memory encryptedUserSeed, bytes memory inputProof) external',
  'event BoxPurchased(uint256 indexed purchaseId, address buyer, string boxId)',
  'event BoxOpened(uint256 indexed purchaseId, bytes32 encryptedIndexHandle)',
];

interface UseBoxContractReturn {
  fheReady: boolean;
  isLoading: boolean;
  error: string | null;
  buyAndOpenWithUserSeed: (boxId: string) => Promise<{ success: boolean; txHash?: string; purchaseId?: number; error?: string }>;
}

export function useBoxContract(
  contractAddress: string,
  wallet: any
): UseBoxContractReturn {
  const { isReady: fheReady, encryptUint32 } = useFHE();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buyAndOpenWithUserSeed = useCallback(async (boxId: string): Promise<{ 
    success: boolean; 
    txHash?: string; 
    purchaseId?: number; 
    error?: string;
  }> => {
    // Check if wallet is connected (wallet is the address string from Web3Auth)
    if (!wallet) {
      return { success: false, error: 'Wallet not connected' };
    }

    // Check if MetaMask/injected provider is available
    if (!(window as any).ethereum) {
      return { success: false, error: 'MetaMask not detected' };
    }

    if (!fheReady) {
      return { success: false, error: 'FHE encryption not ready. Please wait...' };
    }

    try {
      setIsLoading(true);
      setError(null);

      // Use window.ethereum as provider (MetaMask)
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();
      const contract = new ethers.Contract(contractAddress, BOX_ABI, signer);

      // Step 1: Buy box
      console.log('[useBoxContract] 💰 Step 1: Buying box:', boxId);
      const boxConfig = await contract.boxes(boxId);
      const priceWei = boxConfig[2]; // priceWei is 3rd element
      
      const buyTx = await contract.buyBox(boxId, { value: priceWei, gasLimit: 300000 });
      console.log('[useBoxContract] Transaction sent:', buyTx.hash);
      
      const buyReceipt = await buyTx.wait();
      console.log('[useBoxContract] ✅ Box purchased at block:', buyReceipt.blockNumber);

      // Parse BoxPurchased event to get purchaseId
      let purchaseId: number | undefined;
      for (const log of buyReceipt.logs) {
        try {
          const parsedLog = contract.interface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          });
          
          if (parsedLog?.name === 'BoxPurchased') {
            purchaseId = Number(parsedLog.args[0]);
            console.log('[useBoxContract] ✅ Purchase ID:', purchaseId);
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (purchaseId === undefined) {
        throw new Error('Could not find purchase ID from transaction');
      }

      // Step 2: Let relayer handle box opening
      console.log('[useBoxContract] � Box purchased successfully!');
      console.log('[useBoxContract] � Relayer will automatically:');
      console.log('   1. Open box with encrypted random seed');
      console.log('   2. Request decryption from KMS');
      console.log('   3. Mint NFT to your wallet');
      console.log('[useBoxContract] ⏳ This usually takes 10-30 seconds...');
      console.log('[useBoxContract] 📊 Purchase ID:', purchaseId);

      // Return success - relayer handles the rest
      return { 
        success: true, 
        txHash: buyTx.hash, 
        purchaseId 
      };

    } catch (err: any) {
      const errorMsg = err.message || 'Transaction failed';
      console.error('[useBoxContract] ❌ Flow failed:', errorMsg);
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  }, [wallet, contractAddress, fheReady, encryptUint32]);

  return {
    fheReady,
    isLoading,
    error,
    buyAndOpenWithUserSeed,
  };
}
