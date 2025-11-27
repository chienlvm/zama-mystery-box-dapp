import { useWeb3Auth } from '../contexts/Web3AuthContext';
import { Button } from './ui/button';
import { Wallet, LogOut, Loader, AlertCircle } from 'lucide-react';

export const Web3AuthHeader = () => {
  const {
    isAuthenticated,
    isAuthenticating,
    wallet,
    token,
    expiresAt,
    error,
    connectAndAuthenticate,
    disconnect,
    clearError,
    isTokenExpired,
  } = useWeb3Auth();

  const formatAddress = (addr: string | null): string => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const getTimeLeft = (): string => {
    if (!expiresAt) return '';
    const now = Date.now();
    const diff = expiresAt - now;

    if (diff <= 0) return 'Hết hạn';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <div className="flex items-center gap-4">
      {/* Lỗi thông báo */}
      {error && (
        <div className="px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/50 text-red-300 text-sm flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <Button
            onClick={clearError}
            className="text-red-400 hover:text-red-300"
          >
            ✕
          </Button>
        </div>
      )}

      {isAuthenticated && wallet && token ? (
        <div className="flex items-center gap-3">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-4 px-4 py-2 rounded-lg bg-purple-600/20 border border-purple-500/50 text-purple-300 cursor-pointer">
                <Wallet size={16} className="text-purple-400" />
                  {formatAddress(wallet)}
                </div>
                <Button
                  onClick={disconnect}
                  className="flex items-center gap-4 px-4 py-2 rounded-lg bg-red-600/20 border border-red-500/50 text-red-300 hover:bg-red-600/30 transition-colors cursor-pointer"
                >
                  <LogOut size={16} />
                  Disconnect
                </Button>
              </div>
        </div>
      ) : (
        <Button
          onClick={connectAndAuthenticate}
          disabled={isAuthenticating}
          className="gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg shadow-purple-500/50"
        >
          {isAuthenticating ? (
            <>
              <Loader size={16} className="animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <Wallet size={16} />
              Connect Web3
            </>
          )}
        </Button>
      )}
    </div>
  );
};
