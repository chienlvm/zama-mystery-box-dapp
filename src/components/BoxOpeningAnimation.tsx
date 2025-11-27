import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Sparkles } from 'lucide-react';
import { Button } from './ui/button';

interface NFTData {
  id: string;
  name: string;
  rarity: string;
  imageBase64?: string;
  imagePath?: string;
  type: string;
}

interface BoxOpeningAnimationProps {
  onClose: () => void;
  nft?: NFTData | null;
}

export function BoxOpeningAnimation({ onClose, nft }: BoxOpeningAnimationProps) {
  const [stage, setStage] = useState<'opening' | 'reveal'>('opening');
  
  // Get rarity color
  const getRarityStyle = (rarity: string) => {
    switch (rarity) {
      case 'Legendary': return { border: 'border-yellow-500', shadow: 'shadow-yellow-500/50', bg: 'from-yellow-500 to-orange-500', text: 'text-yellow-300' };
      case 'Epic': return { border: 'border-purple-500', shadow: 'shadow-purple-500/50', bg: 'from-purple-500 to-pink-500', text: 'text-purple-300' };
      case 'Rare': return { border: 'border-blue-500', shadow: 'shadow-blue-500/50', bg: 'from-blue-500 to-cyan-500', text: 'text-blue-300' };
      case 'Uncommon': return { border: 'border-green-500', shadow: 'shadow-green-500/50', bg: 'from-green-500 to-emerald-500', text: 'text-green-300' };
      default: return { border: 'border-gray-500', shadow: 'shadow-gray-500/50', bg: 'from-gray-500 to-slate-500', text: 'text-gray-300' };
    }
  };
  
  const rarityStyle = getRarityStyle(nft?.rarity || 'Common');

  useEffect(() => {
    const timer = setTimeout(() => {
      setStage('reveal');
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md">
      <Button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
      >
        <X className="w-6 h-6" />
      </Button>

      <div className="text-center">
        {stage === 'opening' && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, rotate: 360 }}
            transition={{ duration: 2 }}
            className="relative"
          >
            {/* Box Opening Animation */}
            <div className="relative w-64 h-64 mx-auto">
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                  rotate: [0, 360],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                }}
                className="absolute inset-0 bg-gradient-to-br from-purple-500 to-blue-500 rounded-3xl blur-3xl opacity-50"
              />
              <motion.div
                animate={{
                  boxShadow: [
                    '0 0 20px rgba(168, 85, 247, 0.5)',
                    '0 0 60px rgba(168, 85, 247, 0.8)',
                    '0 0 20px rgba(168, 85, 247, 0.5)',
                  ],
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="relative w-64 h-64 bg-gradient-to-br from-purple-600 to-blue-600 rounded-3xl flex items-center justify-center"
              >
                <Sparkles className="w-32 h-32 text-white" />
              </motion.div>
            </div>
            <motion.p
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="text-white text-xl mt-8"
            >
              Opening Mystery Box...
            </motion.p>
          </motion.div>
        )}

        {stage === 'reveal' && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', duration: 0.8 }}
          >
            {/* Revealed NFT */}
            <div className="relative">
              <motion.div
                animate={{
                  scale: [1, 1.05, 1],
                }}
                transition={{ duration: 2, repeat: Infinity }}
                className={`w-80 h-80 mx-auto rounded-2xl overflow-hidden border-4 ${rarityStyle.border} shadow-2xl ${rarityStyle.shadow}`}
              >
                {nft?.imageBase64 || nft?.imagePath ? (
                  <img 
                    src={nft.imageBase64 || nft.imagePath} 
                    alt={nft.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${rarityStyle.bg} flex items-center justify-center`}>
                    <div className="text-center text-white">
                      <Sparkles className="w-24 h-24 mx-auto mb-4" />
                      <h2 className="text-2xl font-bold">{nft?.name || 'Mystery NFT'}</h2>
                      <div className="mt-2 px-4 py-2 rounded-full bg-white/20 inline-block">
                        {nft?.rarity || 'Common'}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
              
              {/* NFT Name Overlay (when has image) */}
              {(nft?.imageBase64 || nft?.imagePath) && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 bg-black/80 backdrop-blur-sm px-6 py-3 rounded-xl border border-white/20">
                  <h3 className={`text-xl font-bold ${rarityStyle.text}`}>{nft?.name}</h3>
                  <div className={`text-center text-sm px-3 py-1 rounded-full bg-gradient-to-r ${rarityStyle.bg} text-white mt-1`}>
                    {nft?.rarity}
                  </div>
                </div>
              )}
              
              {/* Sparkle Effects */}
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{
                    opacity: [0, 1, 0],
                    x: [0, Math.cos(i * 45 * Math.PI / 180) * 100],
                    y: [0, Math.sin(i * 45 * Math.PI / 180) * 100],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: i * 0.1,
                  }}
                  className="absolute top-1/2 left-1/2 w-2 h-2 bg-yellow-400 rounded-full"
                />
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-12"
            >
              <h2 className="text-white mb-2 text-3xl">🎉 Congratulations!</h2>
              <p className="text-gray-300 mb-6">You've received a <span className={rarityStyle.text}>{nft?.rarity || 'Common'}</span> NFT!</p>
              <button
                onClick={onClose}
                className="px-8 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg"
              >
                View in Collection
              </button>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
