import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { API_BASE } from '../App';

// Extend Window interface for MetaMask
declare global {
  interface Window {
    ethereum?: any;
  }
}

// Types
export interface AuthContextType {
  // Auth States
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  isLoading: boolean;
  error: string | null;

  // User Data
  wallet: string | null;
  token: string | null;
  expiresAt: number | null;

  // Methods
  connectAndAuthenticate: () => Promise<void>;
  disconnect: () => void;
  refreshToken: () => Promise<void>;
  clearError: () => void;

  // Helpers
  isTokenExpired: () => boolean;
  getAuthHeader: () => Record<string, string>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Constants
const TOKEN_STORAGE_KEY = 'web3_auth_token';
const WALLET_STORAGE_KEY = 'web3_auth_wallet';
const EXPIRY_STORAGE_KEY = 'web3_auth_expiry';
const REFRESH_THRESHOLD = 5 * 60 * 1000; // refesh 5 minutes before expiry
  
// Provider Component
export const Web3AuthProvider = ({ children }: { children: any }) => {
  // Auth states
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // User data
  const [wallet, setWallet] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);

  // ============================================
  // 1. Check if the token has expired
  // ============================================
  const isTokenExpired = useCallback(() => {
    if (!expiresAt) return true;
    const now = Date.now();
    const timeLeft = expiresAt - now;
    console.log(`⏱️  Thời gian token còn lại: ${Math.round(timeLeft / 1000)}s`);
    return timeLeft <= 0;
  }, [expiresAt]);

  // ============================================
  // 2. Get authentication header for API requests
  // ============================================
  const getAuthHeader = useCallback((): Record<string, string> => {
    if (!token) return {};
    return {
      Authorization: `Bearer ${token}`,
    };
  }, [token]);

  // ============================================
  // 3. Kết nối MetaMask và ký message
  // ============================================
  const connectAndAuthenticate = useCallback(async () => {
    try {
      setIsAuthenticating(true);
      setError(null);

      // 3. Connect to MetaMask and sign message
      if (!window.ethereum) {
        throw new Error('Vui lòng cài đặt MetaMask');
      }

      console.log('🔌 Kết nối MetaMask...');

      // Check if MetaMask is on Sepolia network
      const chainId = await (window.ethereum as any).request({
        method: 'eth_chainId',
      });
      
      const SEPOLIA_CHAIN_ID = '0xaa36a7'; // 11155111 in hex
      
      if (chainId !== SEPOLIA_CHAIN_ID) {
        console.warn(`⚠️  Wrong network detected: ${chainId}. Switching to Sepolia...`);
        
        try {
          // Try to switch to Sepolia
          await (window.ethereum as any).request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: SEPOLIA_CHAIN_ID }],
          });
          console.log('✅ Switched to Sepolia network');
        } catch (switchError: any) {
          // This error code indicates that the chain has not been added to MetaMask
          if (switchError.code === 4902) {
            try {
              await (window.ethereum as any).request({
                method: 'wallet_addEthereumChain',
                params: [
                  {
                    chainId: SEPOLIA_CHAIN_ID,
                    chainName: 'Sepolia Testnet',
                    nativeCurrency: {
                      name: 'Sepolia ETH',
                      symbol: 'ETH',
                      decimals: 18,
                    },
                    rpcUrls: ['https://sepolia.infura.io/v3/c25f6035d0984e15a846bb787a238bac'],
                    blockExplorerUrls: ['https://sepolia.etherscan.io'],
                  },
                ],
              });
              console.log('✅ Sepolia network added and switched');
            } catch (addError) {
              throw new Error('Please add Sepolia network to MetaMask manually');
            }
          } else {
            throw new Error('Please switch to Sepolia network in MetaMask');
          }
        }
      }

      // Yêu cầu tài khoản từ MetaMask
      const accounts = await (window.ethereum as any).request({
        method: 'eth_requestAccounts',
      });

      const selectedAccount = accounts[0];
      if (!selectedAccount) {
        throw new Error('Không có tài khoản được chọn');
      }

      console.log(`✅ Kết nối MetaMask thành công: ${selectedAccount}`);

      // ============================================
      // Bước 1: Lấy message từ backend
      // ============================================
      console.log('📝 Lấy message để ký...');
      const messageResponse = await fetch(`${API_BASE}/auth/message?wallet=${selectedAccount}`);

      if (!messageResponse.ok) {
        throw new Error('Lỗi lấy message từ backend');
      }

      const messageData = await messageResponse.json();
      const message = messageData.data.message;

      console.log('📋 Message nhận được');

      // ============================================
      // Bước 2: Ký message bằng MetaMask
      // ============================================
      console.log('✍️  Yêu cầu ký message...');
      const signature = await (window.ethereum as any).request({
        method: 'personal_sign',
        params: [message, selectedAccount],
      });

      console.log(`✅ Message đã được ký: ${signature.substring(0, 20)}...`);

      // ============================================
      // Bước 3: Gửi signature đến backend để xác thực
      // ============================================
      console.log('🔐 Xác thực signature với backend...');
      const verifyResponse = await fetch(`${API_BASE}/auth/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          wallet: selectedAccount,
          message,
          signature,
        }),
      });

      if (!verifyResponse.ok) {
        throw new Error('Xác thực signature thất bại');
      }

      const authData = await verifyResponse.json();

      if (!authData.success) {
        throw new Error(authData.error || 'Xác thực thất bại');
      }

      // ============================================
      // Bước 4: Lưu token và thông tin
      // ============================================
      const receivedToken = authData.data.token;
      const expiryTime = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 ngày

      setWallet(selectedAccount.toLowerCase());
      setToken(receivedToken);
      setExpiresAt(expiryTime);
      setIsAuthenticated(true);

      // Lưu vào localStorage
      localStorage.setItem(TOKEN_STORAGE_KEY, receivedToken);
      localStorage.setItem(WALLET_STORAGE_KEY, selectedAccount.toLowerCase());
      localStorage.setItem(EXPIRY_STORAGE_KEY, expiryTime.toString());

      console.log('✅ Xác thực thành công!');
      console.log(`   Token: ${receivedToken.substring(0, 20)}...`);
      console.log(`   Wallet: ${selectedAccount.toLowerCase()}`);
    } catch (err: any) {
      console.error('❌ Lỗi kết nối:', err);
      
      // Handle specific MetaMask errors
      let errorMsg = 'Đã xảy ra lỗi khi kết nối';
      
      if (err.code === 4001) {
        errorMsg = 'Bạn đã từ chối kết nối MetaMask';
      } else if (err.code === -32002) {
        errorMsg = 'MetaMask đã có yêu cầu đang chờ xử lý. Vui lòng mở MetaMask và hoàn tất yêu cầu.';
      } else if (err.code === -32603) {
        errorMsg = 'Lỗi RPC. Vui lòng kiểm tra kết nối mạng.';
      } else if (err.message?.includes('User rejected')) {
        errorMsg = 'Bạn đã từ chối ký message';
      } else if (err.message?.includes('switch')) {
        errorMsg = 'Vui lòng chuyển sang mạng Sepolia trong MetaMask';
      } else if (err instanceof Error) {
        errorMsg = err.message;
      }
      
      setError(errorMsg);
      setIsAuthenticated(false);
      console.error('❌ Lỗi xác thực:', errorMsg);
    } finally {
      setIsAuthenticating(false);
    }
  }, []);

  // ============================================
  // 5. Làm mới token trước khi hết hạn
  // ============================================
  const refreshToken = useCallback(async () => {
    if (!token) {
      console.warn('⚠️  Không có token để làm mới');
      return;
    }

    try {
      console.log('🔄 Làm mới token...');
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        headers: getAuthHeader(),
      });

      if (!response.ok) {
        throw new Error('Lỗi làm mới token');
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error);
      }

      const newToken = data.data.token;
      const newExpiryTime = Date.now() + 7 * 24 * 60 * 60 * 1000;

      setToken(newToken);
      setExpiresAt(newExpiryTime);

      localStorage.setItem(TOKEN_STORAGE_KEY, newToken);
      localStorage.setItem(EXPIRY_STORAGE_KEY, newExpiryTime.toString());

      console.log('✅ Token làm mới thành công');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'LError not known';
      console.error('❌ Lỗi làm mới token:', errorMsg);
      // Nếu làm mới thất bại, logout
      disconnect();
    }
  }, [token, getAuthHeader]);

  // ============================================
  // 6. Disconnect và xóa token
  // ============================================
  const disconnect = useCallback(() => {
    console.log('🔌 Disconnecting...');

    setWallet(null);
    setToken(null);
    setExpiresAt(null);
    setIsAuthenticated(false);
    setError(null);

    // Xóa khỏi localStorage
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(WALLET_STORAGE_KEY);
    localStorage.removeItem(EXPIRY_STORAGE_KEY);

    console.log('✅ Disconnect thành công');
  }, []);

  // ============================================
  // 7. Clear error message
  // ============================================
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // ============================================
  // 8. Khôi phục session khi reload
  // ============================================
  useEffect(() => {
    console.log('🔍 Kiểm tra session đã lưu...');

    const savedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    const savedWallet = localStorage.getItem(WALLET_STORAGE_KEY);
    const savedExpiry = localStorage.getItem(EXPIRY_STORAGE_KEY);

    if (savedToken && savedWallet && savedExpiry) {
      const expiryTime = parseInt(savedExpiry);

      // Kiểm tra token chưa hết hạn
      if (Date.now() < expiryTime) {
        console.log('✅ Session hợp lệ, khôi phục...');
        setToken(savedToken);
        setWallet(savedWallet);
        setExpiresAt(expiryTime);
        setIsAuthenticated(true);
      } else {
        console.log('⏱️  Session hết hạn');
        disconnect();
      }
    } else {
      console.log('ℹ️  Không có session đã lưu');
    }
  }, []);

  // ============================================
  // 9. Auto refresh token trước hết hạn
  // ============================================
  useEffect(() => {
    if (!token || !expiresAt) return;

    const checkAndRefresh = () => {
      const now = Date.now();
      const timeUntilExpiry = expiresAt - now;

      // Nếu còn ít hơn 5 phút, làm mới
      if (timeUntilExpiry < REFRESH_THRESHOLD && timeUntilExpiry > 0) {
        console.log('⚠️  Token sắp hết hạn, làm mới...');
        refreshToken();
      }
    };

    // Kiểm tra mỗi 1 phút
    const interval = setInterval(checkAndRefresh, 60 * 1000);
    checkAndRefresh(); // Kiểm tra ngay lập tức

    return () => clearInterval(interval);
  }, [token, expiresAt, refreshToken]);

  const value: AuthContextType = {
    isAuthenticated,
    isAuthenticating,
    isLoading,
    error,
    wallet,
    token,
    expiresAt,
    connectAndAuthenticate,
    disconnect,
    refreshToken,
    clearError,
    isTokenExpired,
    getAuthHeader,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Hook để sử dụng Web3Auth Context
export const useWeb3Auth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useWeb3Auth phải được sử dụng trong Web3AuthProvider');
  }
  return context;
};
