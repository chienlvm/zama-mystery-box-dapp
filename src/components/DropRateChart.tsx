import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { API_BASE } from '../App';

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

export function DropRateChart() {
  const [dropRateData, setDropRateData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDropRates() {
      try {
        setLoading(true);
        setError(null);
        
        const data = await apiGet('/drop-rates/chart');
        setDropRateData(data);
      } catch (err) {
        setError('Failed to load drop rates');
        console.error('Error loading drop rates:', err);
      } finally {
        setLoading(false);
      }
    }
    
    loadDropRates();
  }, []);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto text-center">
        <div className="text-purple-300">Loading drop rates...</div>
      </div>
    );
  }

  if (error || dropRateData.length === 0) {
    return (
      <div className="max-w-5xl mx-auto text-center">
        <div className="text-red-400">{error || 'No drop rate data available'}</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-center mb-4 text-transparent bg-gradient-to-r from-purple-300 to-blue-300 bg-clip-text">
        Drop Rate Transparency
      </h2>
      <p className="text-center text-gray-400 mb-8">
        All drop rates are cryptographically verifiable on-chain
      </p>
      
      <div className="p-6 rounded-xl bg-gradient-to-br from-purple-900/30 to-blue-900/30 border border-purple-500/20">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={dropRateData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#4c1d95" opacity={0.3} />
            <XAxis dataKey="rarity" stroke="#a78bfa" />
            <YAxis stroke="#a78bfa" label={{ value: 'Drop Rate (%)', angle: -90, position: 'insideLeft', fill: '#a78bfa' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e1b4b',
                border: '1px solid #7c3aed',
                borderRadius: '8px',
                color: '#fff',
              }}
            />
            <Legend />
            <Bar dataKey="bronze" fill="#ea580c" name="Bronze Box" />
            <Bar dataKey="silver" fill="#94a3b8" name="Silver Box" />
            <Bar dataKey="gold" fill="#fbbf24" name="Gold Box" />
          </BarChart>
        </ResponsiveContainer>
        
        <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
          {dropRateData.map((item) => (
            <div key={item.rarity} className="p-3 rounded-lg bg-black/30 border border-purple-500/20">
              <div className={`text-sm mb-1 ${
                item.rarity === 'Legendary' ? 'text-yellow-400' :
                item.rarity === 'Epic' ? 'text-purple-400' :
                item.rarity === 'Rare' ? 'text-blue-400' :
                item.rarity === 'Uncommon' ? 'text-green-400' :
                'text-gray-400'
              }`}>
                {item.rarity}
              </div>
              <div className="text-xs text-gray-500">
                G: {item.gold}% | S: {item.silver}% | B: {item.bronze}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}