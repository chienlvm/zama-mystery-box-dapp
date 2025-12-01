import { useState, useEffect } from 'react';
import { MysteryBoxCard } from './MysteryBoxCard';
import { DropRateChart } from './DropRateChart';
import { BoxOpeningAnimation } from './BoxOpeningAnimation';
import { Package, Lock, Shield, Sparkles, ExternalLink, AlertTriangle } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { API_BASE } from '../App';
import { useWeb3Auth } from '../hooks/useWeb3Auth';
import { useBoxContract } from '../hooks/useBoxContract';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from './ui/carousel';
import Autoplay from 'embla-carousel-autoplay';

/**
 * HomePage Component
 * 
 * Mystery Box DApp with FHE encryption for provable fairness
 * Implementation based on Zama documentation:
 * https://docs.zama.org/protocol/relayer-sdk-guides/development-guide/webapp
 */

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

interface Box {
  id: string;
  name: string;
  price: number;
  currency: string;
  rarityPool: string[];
  description: string;
  color: string;
  glowColor: string;
}

interface GalleryItem {
  id: string;
  name: string;
  rarity: string;
  imageBase64?: string;
  imagePath?: string;
  type: string;
  attributes?: {
    power: number;
    speed: number;
    element: string;
  };
}

export function HomePage() {
  const { isAuthenticated, wallet } = useWeb3Auth();
  const [showAnimation, setShowAnimation] = useState(false);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [gallery, setGallery] = useState<Record<string, GalleryItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchaseStatus, setPurchaseStatus] = useState<string>('');
  const [openedNFT, setOpenedNFT] = useState<GalleryItem | null>(null);

  // Contract integration following Zama FHE documentation
  // Reference: https://docs.zama.org/protocol/relayer-sdk-guides/development-guide/webapp
  const CONTRACT_ADDRESS = import.meta.env.VITE_BOX_ADDRESS;
  const {
    fheReady,
    buyAndOpenWithUserSeed,
  } = useBoxContract(CONTRACT_ADDRESS, wallet);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        const [boxesData, galleryData] = await Promise.all([
          apiGet('/boxes'),
          apiGet('/gallery/featured') // Get all NFTs
        ]);

        setBoxes(boxesData);

        // Group NFTs by rarity
        const groupedByRarity = galleryData.reduce((acc: Record<string, GalleryItem[]>, nft: GalleryItem) => {
          if (!acc[nft.rarity]) {
            acc[nft.rarity] = [];
          }
          acc[nft.rarity].push(nft);
          return acc;
        }, {});

        // Create groups of 3 NFTs where each group has 3 different rarities
        const availableRarities = Object.keys(groupedByRarity);
        const nftGroups: GalleryItem[][] = [];

        // Create multiple groups, each with 3 different rarities
        const maxGroups = Math.min(
          ...availableRarities.map(r => groupedByRarity[r].length)
        ) * Math.floor(availableRarities.length / 3);

        // Track used indices per rarity to avoid duplicates
        const usedIndices: Record<string, Set<number>> = {};
        availableRarities.forEach(r => usedIndices[r] = new Set());

        for (let i = 0; i < Math.max(maxGroups, 6); i++) {
          // Shuffle rarities for this group
          const shuffledRarities = [...availableRarities].sort(() => Math.random() - 0.5);
          const selectedRarities = shuffledRarities.slice(0, 3);

          const group: GalleryItem[] = [];
          selectedRarities.forEach(rarity => {
            const nftsInRarity = groupedByRarity[rarity];
            // Find unused index or reset if all used
            let availableIndices: number[] = nftsInRarity
              .map((_: GalleryItem, idx: number) => idx)
              .filter((idx: number) => !usedIndices[rarity].has(idx));

            if (availableIndices.length === 0) {
              usedIndices[rarity].clear();
              availableIndices = nftsInRarity.map((_: GalleryItem, idx: number) => idx);
            }

            const randomIdx = availableIndices[Math.floor(Math.random() * availableIndices.length)];
            usedIndices[rarity].add(randomIdx);
            group.push(nftsInRarity[randomIdx]);
          });

          nftGroups.push(group);
        }

        // Flatten groups into single array (groups of 3 will be shown together)
        setGallery({ featured: nftGroups.flat() });
      } catch (err) {
        setError('Failed to load data');
        console.error('Error loading homepage data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  /**
   * Handle box purchase with FHE-encrypted user seed
   * 
   * Flow:
   * 1. User generates random seed in browser
   * 2. Seed is encrypted with FHE (client-side)
   * 3. Encrypted seed sent to blockchain
   * 4. Relayer decrypts and processes
   * 
   * Reference: https://docs.zama.org/protocol/relayer-sdk-guides/development-guide/webapp#encrypt-values
   */
  const handlePurchaseBox = async (boxId: string) => {
    if (!isAuthenticated) {
      alert('Please connect your wallet first!');
      return;
    }

    if (!fheReady) {
      alert('🔐 FHE encryption is loading... Please wait a moment and try again.');
      return;
    }

    try {
      // Don't show animation yet - wait for NFT data
      setPurchaseStatus('⏳ Purchasing box...');

      // Buy and open with user-encrypted seed (FHE encryption happens in useBoxContract)
      const result = await buyAndOpenWithUserSeed(boxId);

      if (!result.success) {
        throw new Error(result.error || 'Transaction failed');
      }

      setPurchaseStatus('⏳ Transaction confirmed! Opening box...');
      console.log('🎉 Purchase complete:', result);

      // Poll for decryption result (relayer will process)
      if (result.purchaseId) {
        await pollForNFTResult(result.purchaseId.toString());
      }

    } catch (err: any) {
      console.error('❌ Purchase failed:', err);
      setError(err.message || 'Purchase failed');
      setPurchaseStatus('❌ ' + err.message);
      setTimeout(() => {
        setShowAnimation(false);
        setPurchaseStatus('');
        setError(null);
      }, 3000);
    }
  };

  // Poll backend for NFT reveal
  const pollForNFTResult = async (purchaseId: string) => {
    const maxAttempts = 60; // 2 minutes
    const pollInterval = 2000; // 2 seconds

    console.log(`📊 Starting to poll purchase ${purchaseId}...`);

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));

      try {
        const response = await fetch(`${API_BASE}/purchases/${purchaseId}`);
        const data = await response.json();

        console.log(`📊 Poll ${i + 1}/${maxAttempts}:`, data.data?.state);

        if (data.success && data.data) {
          const { state, nft, status } = data.data;

          // Update status message
          if (status?.message) {
            setPurchaseStatus(status.message);
          }

          // Check if NFT is revealed
          if (state === 'Fulfilled' && nft) {
            console.log('🎉 NFT revealed!', nft);

            setOpenedNFT({
              id: nft.tokenId,
              name: nft.name || `NFT #${nft.tokenId}`,
              rarity: nft.rarity || 'Common',
              imageBase64: nft.imageBase64,
              imagePath: nft.image || nft.tokenURI,
              type: nft.type || 'Item',
            });

            // Show animation with congratulations message
            setPurchaseStatus(`🎉 BoxOpeningAnimation appears - NFT data available!`);
            setShowAnimation(true);

            // Hide animation after 5 seconds
            setTimeout(() => {
              setShowAnimation(false);
              setPurchaseStatus('');
              setOpenedNFT(null);
            }, 5000);

            break;
          }
        }
      } catch (err) {
        console.error('Poll error:', err);
      }
    }

    // Timeout
    if (openedNFT === null) {
      setPurchaseStatus('⏱️ Still processing... Check your collection later.');
      setTimeout(() => {
        setShowAnimation(false);
        setPurchaseStatus('');
      }, 3000);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-20">
        <div className="text-center text-purple-300">Loading...</div>
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

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Testnet Warning Banner */}
      <div className="mb-8 -mt-4">
        <div className="bg-gradient-to-r from-yellow-500/20 via-orange-500/20 to-yellow-500/20 border border-yellow-500/50 rounded-xl px-4 py-3">
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-400 animate-pulse" />
              <span className="text-yellow-300 font-semibold">⚠️ TESTNET ONLY</span>
            </div>
            <span className="text-yellow-200/80 text-sm">
              This is a demo on Sepolia testnet. Please use a testnet wallet with test ETH only. Do NOT use real funds.
            </span>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="text-center mb-16">
        <div className="inline-block mb-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-purple-600/20 border border-purple-500/50 text-purple-300">
            <Shield className="w-4 h-4" />
            <span>Powered by ZAMA FHE</span>
          </div>
        </div>
        <h1 className="mb-4 bg-gradient-to-r from-purple-300 via-pink-300 to-blue-300 bg-clip-text text-transparent text-5xl font-bold">
          Open Mystery Box – Reveal Encrypted Rewards
        </h1>
        <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-4">
          Powered by ZAMA FHE – fair, encrypted, provable randomness.
        </p>

        {/* Documentation Link */}
        <a
          href="https://docs.zama.org/protocol/relayer-sdk-guides/development-guide/webapp"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors mb-8"
        >
          <ExternalLink className="w-4 h-4" />
          <span>Learn how FHE encryption works →</span>
        </a>

        {/* Feature Pills */}
        <div className="flex flex-wrap justify-center gap-4 mb-8 mt-8">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-900/30 border border-purple-500/30 text-purple-200 hover:bg-purple-900/40 transition-colors">
            <Lock className="w-4 h-4" />
            <span>Fully Encrypted</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-900/30 border border-blue-500/30 text-blue-200 hover:bg-blue-900/40 transition-colors">
            <Package className="w-4 h-4" />
            <span>Provable Fairness</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-pink-900/30 border border-pink-500/30 text-pink-200 hover:bg-pink-900/40 transition-colors">
            <Sparkles className="w-4 h-4" />
            <span>Rare NFTs</span>
          </div>
        </div>
      </div>

      {/* FHE Status Indicator */}
      {isAuthenticated && (
        <div className="mb-8 text-center">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${fheReady
              ? 'bg-green-600/20 border border-green-500/50 text-green-300'
              : 'bg-yellow-600/20 border border-yellow-500/50 text-yellow-300'
            }`}>
            <div className={`w-2 h-2 rounded-full ${fheReady ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'}`} />
            <span className="text-sm font-medium inline-block px-3 py-1 rounded-full text-sm bg-green-500/80 text-white">
              {fheReady ? '🔐 FHE Encryption Ready' : '⏳ Initializing FHE SDK...'}
            </span>
          </div>
          {fheReady && (
            <p className="text-xs text-gray-400 mt-2">
              Your random seed will be encrypted client-side before sending to blockchain
            </p>
          )}
        </div>
      )}

      {/* Purchase Status */}
      {purchaseStatus && (
        <div className="mb-8 text-center">
          <div className="inline-block px-6 py-3 rounded-lg bg-purple-600/20 border border-purple-500/50 text-purple-200">
            {purchaseStatus}
          </div>
        </div>
      )}

      {/* Mystery Boxes */}
      <div className="mb-20">
        <h2 className="text-center mb-8 text-transparent bg-gradient-to-r from-purple-300 to-blue-300 bg-clip-text">
          Choose Your Mystery Box
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {boxes.map((box) => (
            <MysteryBoxCard
              key={box.id}
              tier={box.name}
              price={box.price}
              color={box.color}
              glowColor={box.glowColor}
              isWalletConnected={isAuthenticated}
              onBuy={() => handlePurchaseBox(box.id)}
            />
          ))}
        </div>
      </div>

      {/* Drop Rate Transparency */}
      <div className="mb-20">
        <DropRateChart />
      </div>

      {/* Featured Items Gallery */}
      <div className="mb-20">
        <h2 className="text-center mb-12 text-4xl font-bold text-transparent bg-gradient-to-r from-purple-300 to-blue-300 bg-clip-text">
          Featured Items Gallery
        </h2>

        {/* Carousel with 3 items visible, scrolls by 3 */}
        <Carousel
          opts={{
            align: 'start',
            loop: true,
            slidesToScroll: 3,
          }}
          plugins={[
            Autoplay({
              delay: 3000,
              stopOnInteraction: false,
            }),
          ]}
          className="w-full max-w-5xl mx-auto"
        >
          <CarouselContent className="-ml-8">
            {(() => {
              // Flatten all NFTs from all rarities
              const allNfts = Object.values(gallery).flat();

              const getRarityColor = (rarity: string) => {
                switch (rarity) {
                  case 'Legendary': return { bg: 'from-yellow-500 to-orange-500', border: 'border-yellow-500/50', text: 'text-yellow-300' };
                  case 'Epic': return { bg: 'from-purple-500 to-pink-500', border: 'border-purple-500/50', text: 'text-purple-300' };
                  case 'Rare': return { bg: 'from-blue-500 to-cyan-500', border: 'border-blue-500/50', text: 'text-blue-300' };
                  case 'Uncommon': return { bg: 'from-green-500 to-emerald-500', border: 'border-green-500/50', text: 'text-green-300' };
                  default: return { bg: 'from-gray-500 to-slate-500', border: 'border-gray-500/50', text: 'text-gray-300' };
                }
              };

              return allNfts.map((nft) => {
                const colors = getRarityColor(nft.rarity);
                return (
                  <CarouselItem key={nft.id} className="pl-8" style={{ flex: '0 0 calc(33.333% - 1.33rem)', minWidth: 0 }}>
                    <div className="h-full">
                      <div className={`group relative rounded-2xl overflow-hidden bg-gradient-to-br from-gray-900/80 to-gray-800/80 border-2 ${colors.border} hover:border-opacity-100 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl h-full flex flex-col`}>
                        {/* Image Container */}
                        <div className="relative aspect-square bg-gradient-to-br from-gray-800/50 to-gray-900/50 overflow-hidden">
                          {nft.imageBase64 ? (
                            <img
                              src={nft.imageBase64}
                              alt={nft.name}
                              className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
                            />
                          ) : (
                            <ImageWithFallback
                              src={nft.imagePath || ''}
                              alt={nft.name}
                              className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
                            />
                          )}
                          {/* Gradient Overlay on Hover */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        </div>

                        {/* Content */}
                        <div className="p-4 flex-1 flex flex-col bg-gradient-to-b from-gray-900/90 to-black/95">
                          <div className={`inline-block px-3 py-1 rounded-full text-sm ${nft.rarity === 'Legendary' ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white' :
                              nft.rarity === 'Epic' ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' :
                                nft.rarity === 'Rare' ? 'bg-blue-500/80 text-white' :
                                  nft.rarity === 'Uncommon' ? 'bg-green-500/80 text-white' :
                                    'bg-gray-500/80 text-white'
                            }`}>
                            {nft.rarity}
                          </div>
                          <h4 className={`${colors.text} mb-3 font-bold text-lg truncate`}>{nft.name}</h4>

                          {nft.attributes && (
                            <>
                              {/* Stats Grid */}
                              <div className="grid grid-cols-2 gap-2 mb-3">
                                <div className="bg-gradient-to-br from-purple-900/60 to-purple-800/40 backdrop-blur-sm px-3 py-2.5 rounded-lg border border-purple-500/30 hover:border-purple-500/60 transition-colors">
                                  <div className="text-gray-400 text-[11px] font-medium mb-1">⚡ Power</div>
                                  <div className="text-purple-300 font-bold text-lg">{nft.attributes.power}</div>
                                </div>
                                <div className="bg-gradient-to-br from-blue-900/60 to-blue-800/40 backdrop-blur-sm px-3 py-2.5 rounded-lg border border-blue-500/30 hover:border-blue-500/60 transition-colors">
                                  <div className="text-gray-400 text-[11px] font-medium mb-1">⚡ Speed</div>
                                  <div className="text-blue-300 font-bold text-lg">{nft.attributes.speed}</div>
                                </div>
                              </div>

                              {/* Element Badge */}
                              {nft.attributes.element && (
                                <div className="mt-auto pt-2 border-t border-gray-700/50">
                                  <div className="flex items-center justify-center gap-2 bg-gradient-to-r from-gray-800/80 to-gray-700/80 px-3 py-2 rounded-lg">
                                    <span className="text-gray-400 text-xs">Element:</span>
                                    <span className={`${colors.text} font-bold text-sm`}>{nft.attributes.element}</span>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </CarouselItem>
                );
              });
            })()}
          </CarouselContent>
        </Carousel>
      </div>

      {/* Footer */}
      <footer className="border-t border-purple-500/20 pt-12 pb-8 mt-20">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div>
            <h3 className="text-white mb-4">Mystery Box</h3>
            <p className="text-gray-400 text-sm">
              Fair, encrypted, and provable NFT mystery boxes powered by ZAMA FHE technology.
            </p>
          </div>
          <div>
            <h4 className="text-white mb-4">Product</h4>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li><a href="#" className="hover:text-purple-400 transition-colors">Mystery Boxes</a></li>
              <li><a href="#" className="hover:text-purple-400 transition-colors">Collections</a></li>
              <li><a href="#" className="hover:text-purple-400 transition-colors">Marketplace</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white mb-4">Resources</h4>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li>
                <a
                  href="https://docs.zama.org/protocol/relayer-sdk-guides/development-guide/webapp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-purple-400 transition-colors inline-flex items-center gap-1"
                >
                  Zama FHE Documentation
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li><a href="#" className="hover:text-purple-400 transition-colors">FAQ</a></li>
              <li><a href="#" className="hover:text-purple-400 transition-colors">Support</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white mb-4">Community</h4>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li><a href="#" className="hover:text-purple-400 transition-colors">Discord</a></li>
              <li><a href="#" className="hover:text-purple-400 transition-colors">Twitter</a></li>
              <li>
                <a
                  href="https://github.com/zama-ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-purple-400 transition-colors inline-flex items-center gap-1"
                >
                  GitHub
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
            </ul>
          </div>
        </div>
        {/* Testnet Disclaimer */}
        <div className="mb-8 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
            <div className="text-left">
              <h5 className="text-yellow-300 font-semibold mb-1">Disclaimer - Testnet Environment</h5>
              <p className="text-yellow-200/70 text-xs leading-relaxed">
                This application is deployed on <strong>Sepolia Testnet</strong> for demonstration purposes only. 
                All transactions use test ETH with no real monetary value. 
                <strong> Do NOT send real cryptocurrency to any addresses shown in this application.</strong> 
                The developers are not responsible for any loss of funds resulting from misuse. 
                By using this application, you acknowledge that you understand this is a test environment.
              </p>
            </div>
          </div>
        </div>

        <div className="text-center text-gray-500 text-sm">
          <p>© 2025 s1mple9730. All rights reserved.</p>
          <p className="mt-2 text-xs">
            Secured by{' '}
            <a
              href="https://www.zama.ai/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 transition-colors"
            >
              Zama FHE Technology
            </a>
            {' '}• Implementation Guide:{' '}
            <a
              href="https://docs.zama.org/protocol/relayer-sdk-guides/development-guide/webapp"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 transition-colors"
            >
              Relayer SDK Documentation
            </a>
          </p>
        </div>
      </footer>

      {/* Box Opening Animation Modal */}
      {showAnimation && (
        <BoxOpeningAnimation
          onClose={() => {
            setShowAnimation(false);
            setOpenedNFT(null);
          }}
          nft={openedNFT}
        />
      )}
    </div>
  );
}