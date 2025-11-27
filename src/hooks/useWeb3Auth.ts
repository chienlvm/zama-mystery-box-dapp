import { useWeb3Auth as useWeb3AuthContext } from '../contexts/Web3AuthContext';
import { useEffect, useState } from 'react';
import { API_BASE } from '../App';

// Export the main hook
export { useWeb3Auth } from '../contexts/Web3AuthContext';

interface UserData {
  wallet: string;
  fullWallet: string;
  balance: number;
  currency: string;
  unopenedBoxes: number;
  totalNFTs: number;
  stats: any;
}

interface CacheData {
  data: UserData | null;
  timestamp: number;
  expiresAt: number;
}

// Cache duration (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

/**
 * Hook: Fetch user data from backend with cache
 *
 * Example:
 * const { userData, isLoading, error, refetch } = useAuthenticatedUserData()
 */
export const useAuthenticatedUserData = () => {
  const { isAuthenticated, wallet: address, getAuthHeader } = useWeb3AuthContext();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cache, setCache] = useState<CacheData>({
    data: null,
    timestamp: 0,
    expiresAt: 0,
  });

  // Check if cache is still valid
  const isCacheValid = (): boolean => {
    const now = Date.now();
    return now < cache.expiresAt && cache.data !== null;
  };

  // Fetch user data from backend
  const fetchUserData = async () => {
    if (!isAuthenticated || !address) {
      console.log('⚠️  Not authenticated, skipping user data fetch');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log('📡 Fetching user data from backend...');

      // Call API with JWT token
      const response = await fetch(`${API_BASE}/user?wallet=${address}`, {
        headers: getAuthHeader(),
      });

      if (!response.ok) {
        throw new Error(`Lỗi API: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Error fetching data');
      }

      const data = result.data;
      setUserData(data);

      // Save to cache
      const now = Date.now();
      setCache({
        data,
        timestamp: now,
        expiresAt: now + CACHE_DURATION,
      });

      console.log('✅ Data fetched successfully');
      console.log(`📦 Cache valid for ${Math.round(CACHE_DURATION / 1000)}s`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error not known';
      setError(errorMsg);
      console.error('❌ Error:', errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh data
  const refetch = async () => {
    console.log('🔄 Refreshing data...');
    setCache({ data: null, timestamp: 0, expiresAt: 0 });
    await fetchUserData();
  };

  // auto get and cache user data
  useEffect(() => {
    if (!isAuthenticated) {
      setUserData(null);
      return;
    }

    // If cache is valid, use cache
    if (isCacheValid()) {
      console.log('📦 Using data from cache');
      setUserData(cache.data);
      return;
    }

    // Otherwise, fetch from backend
    fetchUserData();
  }, [isAuthenticated, address]);

  return {
    userData,
    isLoading,
    error,
    refetch,
    isCached: isCacheValid(),
  };
};

/**
 * Hook: Check authentication status
 *
 * Ví dụ:
 * const { isReady, isAuthenticated } = useAuthStatus()
 */
export const useAuthStatus = () => {
  const { isAuthenticated, wallet, token, isAuthenticating } = useWeb3AuthContext();

  return {
    isReady: !isAuthenticating,
    isAuthenticated,
    wallet,
    hasToken: !!token,
  };
};

/**
 * Hook: Protect API calls with token
 *
 * Example:
 * const fetchProtected = useProtectedFetch()
 * const data = await fetchProtected('/api/protected-endpoint')
 */
export const useProtectedFetch = () => {
  const { token, getAuthHeader, isAuthenticated } = useWeb3AuthContext();

  const fetchProtected = async (url: string, options: RequestInit = {}) => {
    if (!isAuthenticated || !token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        ...getAuthHeader(),
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    return response.json();
  };

  return fetchProtected;
};

/**
 * Hook: Mangager multiple authenticated requests
 *
 * Example:
 * const results = useMultipleProtectedFetch(['/api/user', '/api/nfts'])
 */
export const useMultipleProtectedFetch = (urls: string[]) => {
  const fetchProtected = useProtectedFetch();
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setIsLoading(true);
        setError(null);

        console.log(`📡 Fetching ${urls.length} requests from backend...`);

        const responses = await Promise.all(urls.map(url => fetchProtected(url)));
        setResults(responses);

        console.log('✅ All requests successful');
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Error not known';
        setError(errorMsg);
        console.error('❌ Error:', errorMsg);
      } finally {
        setIsLoading(false);
      }
    };

    if (urls.length > 0) {
      fetchAll();
    }
  }, [urls.join(',')]);

  return { results, isLoading, error };
};
