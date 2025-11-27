import { motion } from 'motion/react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import type { NFT } from './CollectionPage';

interface NFTCardProps {
  nft: NFT;
  onClick: () => void;
}

const rarityColors = {
  Legendary: 'from-yellow-500 to-orange-500',
  Epic: 'from-purple-500 to-pink-500',
  Rare: 'from-blue-500 to-cyan-500',
  Uncommon: 'from-green-500 to-emerald-500',
  Common: 'from-gray-500 to-gray-400',
};

const rarityBorderColors = {
  Legendary: 'border-yellow-500/60',
  Epic: 'border-purple-500/60',
  Rare: 'border-blue-500/60',
  Uncommon: 'border-green-500/60',
  Common: 'border-gray-500/60',
};

export function NFTCard({ nft, onClick }: NFTCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      onClick={onClick}
      className={`group cursor-pointer rounded-xl overflow-hidden bg-gradient-to-br from-purple-900/40 to-blue-900/40 border-2 ${rarityBorderColors[nft.rarity]} hover:shadow-xl transition-all`}
    >
      {/* NFT Image */}
      <div className="aspect-square bg-black/30 overflow-hidden relative">
        <ImageWithFallback
          src={nft.image}
          alt={nft.name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
        />
        {/* Rarity Badge Overlay */}
        <div className="absolute top-2 right-2">
          <div className={`px-3 py-1 rounded-full text-xs text-white bg-gradient-to-r ${rarityColors[nft.rarity]} shadow-lg`}>
            {nft.rarity}
          </div>
        </div>
      </div>

      {/* NFT Info */}
      <div className="p-4">
        <h3 className="text-white mb-1">{nft.name}</h3>
        <p className="text-gray-400 text-sm mb-2">{nft.type}</p>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{nft.mintId}</span>
          <span>{nft.fromBox}</span>
        </div>
      </div>
    </motion.div>
  );
}