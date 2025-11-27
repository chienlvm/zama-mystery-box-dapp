import { motion } from 'motion/react';
import { Package, Lock } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { Button } from './ui/button';

interface MysteryBoxCardProps {
  tier: string;
  price: number;
  color: string;
  glowColor: string;
  isWalletConnected: boolean;
  isLoading?: boolean;
  onBuy: () => void;
}

export function MysteryBoxCard({
  tier,
  price,
  color,
  glowColor,
  isWalletConnected,
  isLoading = false,
  onBuy,
}: MysteryBoxCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      className={`relative rounded-2xl overflow-hidden bg-gradient-to-br from-purple-900/50 to-blue-900/50 border-2 border-purple-500/30 hover:border-purple-500/60 transition-all shadow-xl ${glowColor}`}
    >
      {/* Glow Effect */}
      <div className={`absolute inset-0 bg-gradient-to-r ${color} opacity-10 blur-2xl`}></div>
      
      <div className="relative p-6">
        {/* Box Image */}
        <div className="mb-6 relative">
          <div className={`absolute inset-0 bg-gradient-to-r ${color} opacity-20 blur-3xl animate-pulse`}></div>
          <div className="relative aspect-square bg-gradient-to-br from-black/50 to-purple-900/30 rounded-xl flex items-center justify-center">
            <div className={`w-32 h-32 bg-gradient-to-br ${color} rounded-lg shadow-2xl flex items-center justify-center transform rotate-12 hover:rotate-0 transition-transform duration-300`}>
              <Package className="w-16 h-16 text-white" />
            </div>
          </div>
        </div>

        {/* Box Info */}
        <div className="text-center mb-4">
          <h3 className={`text-white mb-2 bg-gradient-to-r ${color} bg-clip-text text-transparent`}>
            {tier} Box
          </h3>
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className={`px-4 py-2 rounded-lg bg-gradient-to-r ${color} text-white shadow-lg`}>
              <span className="text-2xl">{price}</span>
              <span className="text-sm ml-1">ETH</span>
            </div>
          </div>
        </div>

        {/* Buy Button */}
        <Button
          onClick={onBuy}
          disabled={!isWalletConnected || isLoading}
          className={`w-full py-3 rounded-lg transition-all shadow-lg ${
            isWalletConnected && !isLoading
              ? `bg-gradient-to-r ${color} text-white hover:shadow-xl hover:scale-105`
              : 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
          }`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processing...
            </span>
          ) : isWalletConnected ? (
            <span className="flex items-center justify-center gap-2 cursor-pointer">
              <Package className="w-5 h-5" />
              Buy Box
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2 cursor-pointer">
              <Lock className="w-5 h-5" />
              Connect Wallet
            </span>
          )}
        </Button>

        {/* Drop Hints */}
        <div className="mt-4 text-center text-xs text-gray-400">
          {tier === 'Bronze' && 'Common & Uncommon items'}
          {tier === 'Silver' && 'Uncommon, Rare & Epic items'}
          {tier === 'Gold' && 'Rare, Epic & Legendary items'}
        </div>
      </div>
    </motion.div>
  );
}
