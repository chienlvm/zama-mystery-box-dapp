import { X, ExternalLink, ShoppingCart } from 'lucide-react';
import { motion } from 'motion/react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import type { NFT } from './CollectionPage';
import { Button } from './ui/button';

interface NFTDetailModalProps {
  nft: NFT;
  onClose: () => void;
}

const rarityColors = {
  Legendary: 'from-yellow-500 to-orange-500',
  Epic: 'from-purple-500 to-pink-500',
  Rare: 'from-blue-500 to-cyan-500',
  Uncommon: 'from-green-500 to-emerald-500',
  Common: 'from-gray-500 to-gray-400',
};

export function NFTDetailModal({ nft, onClose }: NFTDetailModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="relative max-w-4xl w-full bg-gradient-to-br from-purple-900/90 to-blue-900/90 rounded-2xl border border-purple-500/30 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
      >
        {/* Close Button */}
        <Button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-lg bg-black/50 text-white hover:bg-black/70 transition-colors"
        >
          <X className="w-6 h-6" />
        </Button>

        <div className="grid md:grid-cols-2 gap-8 p-8">
          {/* Left: Image */}
          <div>
            <div className="aspect-square rounded-xl overflow-hidden bg-black/30 border-2 border-purple-500/30">
              <ImageWithFallback
                src={nft.image}
                alt={nft.name}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Right: Details */}
          <div>
            {/* Title & Rarity */}
            <div className="mb-6">
              <h2 className="text-white mb-2">{nft.name}</h2>
              <div className={`inline-block px-4 py-2 rounded-full bg-gradient-to-r ${rarityColors[nft.rarity]} text-white shadow-lg`}>
                {nft.rarity}
              </div>
            </div>

            {/* Details Grid */}
            <div className="space-y-4 mb-6">
              <div className="p-3 rounded-lg bg-black/30 border border-purple-500/20">
                <div className="text-gray-400 text-sm mb-1">Mint ID</div>
                <div className="text-white">{nft.mintId}</div>
              </div>

              <div className="p-3 rounded-lg bg-black/30 border border-purple-500/20">
                <div className="text-gray-400 text-sm mb-1">Type</div>
                <div className="text-white">{nft.type}</div>
              </div>

              <div className="p-3 rounded-lg bg-black/30 border border-purple-500/20">
                <div className="text-gray-400 text-sm mb-1">Origin Box</div>
                <div className="text-white">{nft.fromBox}</div>
              </div>

              <div className="p-3 rounded-lg bg-black/30 border border-purple-500/20">
                <div className="text-gray-400 text-sm mb-1">Transaction Hash</div>
                <div className="flex items-center gap-2">
                  <div className="text-purple-300  truncate">{nft.txHash}</div>
                  <a
                    href={`https://sepolia.etherscan.io/tx/${nft.txHash}`}
                    target='_blank'
                    className="text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-black/30 border border-purple-500/20">
                <div className="text-gray-400 text-sm mb-1">Acquired Date</div>
                <div className="text-white">{new Date(nft.acquiredDate).toLocaleDateString()}</div>
              </div>
            </div>

            {/* Attributes */}
            <div className="mb-6">
              <h3 className="text-white mb-3">Attributes</h3>
              <div className="grid grid-cols-2 gap-3">
                {nft.attributes.map((attr, index) => (
                  <div
                    key={index}
                    className="p-3 rounded-lg bg-gradient-to-br from-purple-900/30 to-blue-900/30 border border-purple-500/20"
                  >
                    <div className="text-gray-400 text-sm mb-1">{attr.trait}</div>
                    <div className="text-white">{attr.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Button */}
            <button className="w-full py-3 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Sell on Marketplace
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}