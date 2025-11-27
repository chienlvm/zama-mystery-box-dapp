import { useState, useEffect } from 'react';
import { NFTCard } from './NFTCard';
import { NFTDetailModal } from './NFTDetailModal';
import { Package, Filter, Wallet, RefreshCw } from 'lucide-react';
import { API_BASE } from '../App';
import { useWeb3Auth, useAuthenticatedUserData } from '../hooks/useWeb3Auth';

// API Helper
async function apiGet(path: string) {
  try {
    const res = await fetch(`${API_BASE}${path}`);
    const json = await res.json();
    return json.data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

export interface NFT {
  id: string;
  name: string;
  image: string;
  rarity: 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';
  type: string;
  mintId: string;
  txHash: string;
  fromBox: string;
  acquiredDate: string;
  attributes: Record<string, any>;
}

interface UserData {
  wallet: string;
  balance: number;
  unopenedBoxes: number;
  totalNFTs: number;
}

export function CollectionPage() {
  const { isAuthenticated, wallet } = useWeb3Auth();
  const { 
    userData, 
    isLoading: userDataLoading, 
    error: userDataError,
    refetch: refetchUserData 
  } = useAuthenticatedUserData();
  
  const [selectedNFT, setSelectedNFT] = useState<NFT | null>(null);
  const [rarityFilter, setRarityFilter] = useState<string>('All');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<string>('date');
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch user's NFTs from database (backend endpoint: /api/nfts/user/:address)
  useEffect(() => {
    if (!isAuthenticated || !wallet) {
      console.log('❌ Cannot load NFTs:', { isAuthenticated, wallet });
      return;
    }

    async function loadNFTs() {
      try {
        setLoading(true);
        setError(null);
        
        console.log('📡 Fetching NFTs for wallet:', wallet);
        console.log('🔗 API endpoint:', `${API_BASE}/nfts/user/${wallet}`);
        
        // Use correct backend endpoint: /nfts/user/:address
        const nftsData = await apiGet(`/nfts/user/${wallet}`);
        
        console.log('✅ Raw NFT data from backend:', nftsData);
        console.log('📊 Number of NFTs:', Array.isArray(nftsData) ? nftsData.length : 'Not an array!');
        
        if (!Array.isArray(nftsData)) {
          console.error('⚠️ Expected array but got:', typeof nftsData, nftsData);
          setError('Invalid data format from server');
          return;
        }
        
        // Map backend fields to frontend NFT interface
        const mappedNFTs = nftsData.map((nft: any) => ({
          id: String(nft.tokenId),
          name: nft.name,
          image: nft.imageURL || nft.ipfsImageURI,
          rarity: nft.rarity,
          type: nft.type || 'Item',
          mintId: String(nft.tokenId),
          txHash: nft.transactionHash || '',
          fromBox: `Purchase #${nft.purchaseId || ''}`,
          acquiredDate: nft.createdAt || new Date().toISOString(),
          attributes: typeof nft.attributes === 'string' 
            ? JSON.parse(nft.attributes) 
            : (nft.attributes || {})
        }));
        
        console.log('✨ Mapped NFTs:', mappedNFTs);
        setNfts(mappedNFTs);
      } catch (err: any) {
        const errorMsg = err.message || 'Failed to load NFTs';
        setError(errorMsg);
        console.error('❌ Error loading NFTs:', err);
        console.error('📍 Error details:', {
          message: err.message,
          stack: err.stack,
          response: err.response
        });
      } finally {
        setLoading(false);
      }
    }
    
    loadNFTs();
  }, [isAuthenticated, wallet]);

  // Apply client-side filtering (backend doesn't support query params yet)
  const filteredNFTs = nfts.filter(nft => {
    if (rarityFilter !== 'All' && nft.rarity !== rarityFilter) return false;
    if (typeFilter !== 'All' && nft.type !== typeFilter) return false;
    return true;
  });
  
  console.log('🔍 Filter applied:', { rarityFilter, typeFilter });
  console.log('📊 Total NFTs:', nfts.length, '| Filtered:', filteredNFTs.length);

  // Apply client-side sorting
  const sortedNFTs = [...filteredNFTs].sort((a, b) => {
    switch (sortBy) {
      case 'date':
        return new Date(b.acquiredDate).getTime() - new Date(a.acquiredDate).getTime();
      case 'rarity':
        const rarityOrder = { 'Legendary': 5, 'Epic': 4, 'Rare': 3, 'Uncommon': 2, 'Common': 1 };
        return (rarityOrder[b.rarity] || 0) - (rarityOrder[a.rarity] || 0);
      case 'name':
        return a.name.localeCompare(b.name);
      default:
        return 0;
    }
  });

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-md mx-auto text-center">
          <Wallet className="w-16 h-16 mx-auto mb-4 text-purple-400" />
          <h2 className="text-white mb-4">Connect Your Wallet</h2>
          <p className="text-gray-400">
            Please connect your wallet to view your NFT collection.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-20">
        <div className="text-center text-purple-300">Loading your collection...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-20">
        <div className="text-center text-red-400">{error}</div>
      </div>
    );
  }

  // Convert attributes object to array format for modal (use sorted/filtered NFTs)
  const convertedNFTs = sortedNFTs.map(nft => ({
    ...nft,
    attributes: Object.entries(nft.attributes || {}).map(([trait, value]) => ({
      trait,
      value: String(value)
    }))
  }));

  return (
    <div className="container mx-auto px-4 py-12">
      {/* User Profile Header */}
      <div className="mb-12 p-6 rounded-xl bg-gradient-to-br from-purple-900/40 to-blue-900/40 border border-purple-500/30">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <Wallet className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-white mb-1">My Collection</h2>
              <p className="text-purple-300 text-sm font-mono">{wallet?.substring(0, 6)}...{wallet?.substring(wallet.length - 4)}</p>
            </div>
          </div>
          <div className="flex gap-6 items-center">
            <div className="text-center">
              <div className="text-3xl text-white mb-1">
                {userDataLoading ? '...' : userData?.totalNFTs || 0}
              </div>
              <div className="text-gray-400 text-sm">Total NFTs</div>
            </div>
            <div className="text-center">
              <div className="text-3xl text-white mb-1">
                {userDataLoading ? '...' : userData?.unopenedBoxes || 0}
              </div>
              <div className="text-gray-400 text-sm">Unopened Boxes</div>
            </div>
            <div className="text-center">
              <div className="text-3xl text-purple-400 mb-1">
                {userDataLoading ? '...' : userData?.balance || 0}
              </div>
              <div className="text-gray-400 text-sm">{userData?.currency || 'ETH'}</div>
            </div>
            <button
              onClick={refetchUserData}
              disabled={userDataLoading}
              className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white transition-colors flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${userDataLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
        {userDataError && (
          <div className="mt-4 text-red-400 text-sm">
            ⚠️ {userDataError}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="mb-8 p-4 rounded-xl bg-black/30 border border-purple-500/20">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex items-center gap-2 text-purple-300">
            <Filter className="w-5 h-5" />
            <span>Filters</span>
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor="rarity-filter" className="text-gray-400 text-sm">Rarity:</label>
              <select
                id="rarity-filter"
                value={rarityFilter}
                onChange={(e) => setRarityFilter(e.target.value)}
                className="px-3 py-1 rounded-lg bg-purple-900/30 border border-purple-500/30 text-white text-sm focus:outline-none focus:border-purple-500/60"
              >
                <option value="All">All</option>
                <option value="Common">Common</option>
                <option value="Uncommon">Uncommon</option>
                <option value="Rare">Rare</option>
                <option value="Epic">Epic</option>
                <option value="Legendary">Legendary</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="type-filter" className="text-gray-400 text-sm">Type:</label>
              <select
                id="type-filter"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-1 rounded-lg bg-purple-900/30 border border-purple-500/30 text-white text-sm focus:outline-none focus:border-purple-500/60"
              >
                <option value="All">All</option>
                <option value="Creature">Creature</option>
                <option value="Weapon">Weapon</option>
                <option value="Armor">Armor</option>
                <option value="Accessory">Accessory</option>
                <option value="Currency">Currency</option>
                <option value="Artifact">Artifact</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="sort-filter" className="text-gray-400 text-sm">Sort By:</label>
              <select
                id="sort-filter"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-1 rounded-lg bg-purple-900/30 border border-purple-500/30 text-white text-sm focus:outline-none focus:border-purple-500/60"
              >
                <option value="date">Date Acquired</option>
                <option value="rarity">Rarity</option>
                <option value="name">Name (A-Z)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* NFT Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-12">
        {convertedNFTs.map((nft) => (
          <NFTCard key={nft.id} nft={nft} onClick={() => setSelectedNFT(nft)} />
        ))}
      </div>

      {convertedNFTs.length === 0 && (
        <div className="text-center py-20">
          <Package className="w-16 h-16 mx-auto mb-4 text-gray-600" />
          <p className="text-gray-400">No NFTs found matching your filters.</p>
        </div>
      )}

      {/* NFT Detail Modal */}
      {selectedNFT && (
        <NFTDetailModal nft={selectedNFT} onClose={() => setSelectedNFT(null)} />
      )}
    </div>
  );
}