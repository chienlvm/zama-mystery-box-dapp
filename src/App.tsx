import { useState } from 'react';
import { HomePage } from './components/HomePage';
import { CollectionPage } from './components/CollectionPage';
import { Web3AuthProvider } from './contexts/Web3AuthContext';
import { Web3AuthHeader } from './components/Web3AuthHeader';

// API Base URL
export const API_BASE = 'https://chienlvm.network/api';

function AppContent() {
  const [currentPage, setCurrentPage] = useState<'home' | 'collection'>('home');
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900">
      {/* Navigation */}
      <nav className="border-b border-purple-500/20 bg-black/30 backdrop-blur-md">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <h1 className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                ZAMA Mystery Box Dapp
              </h1>
              <div className="flex gap-4">
                <button
                  onClick={() => setCurrentPage('home')}
                  className={`px-4 py-2 rounded-lg transition-colors cursor-pointer ${
                    currentPage === 'home'
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  Home
                </button>
                <button
                  onClick={() => setCurrentPage('collection')}
                  className={`px-4 py-2 rounded-lg transition-colors cursor-pointer ${
                    currentPage === 'collection'
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  My Collection
                </button>
              </div>
            </div>
            <Web3AuthHeader />
          </div>
        </div>
      </nav>

      {/* Page Content */}
      {currentPage === 'home' ? (
        <HomePage />
      ) : (
        <CollectionPage />
      )}
    </div>
  );
}

export default function App() {
  return (
    <Web3AuthProvider>
      <AppContent />
    </Web3AuthProvider>
  );
}