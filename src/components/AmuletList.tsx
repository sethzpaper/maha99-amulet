import { useEffect, useState } from 'react';
import { AMULETS } from '../data/mockData';
import { dataService } from '../lib/dataService';
import { Amulet } from '../types';
import { TrendingUp, TrendingDown, Minus, Heart, Share2, MessageSquare } from 'lucide-react';
import { cn } from '../lib/utils';

export function AmuletList() {
  const [amulets, setAmulets] = useState<Amulet[]>(AMULETS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAmulets = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await dataService.fetchAmulets();
        if (data && data.length > 0) {
          setAmulets(data);
        } else {
          // Fallback to mock data if API returns empty
          setAmulets(AMULETS);
        }
      } catch (err) {
        console.error('Failed to load amulets:', err);
        // Keep using mock data as fallback
        setAmulets(AMULETS);
        setError('Using cached data');
      } finally {
        setLoading(false);
      }
    };

    loadAmulets();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-serif text-zinc-100 italic">รายการพระเครื่องยอดนิยม</h2>
        <div className="flex items-center gap-2">
          {loading && <span className="text-[10px] text-yellow-500 animate-pulse">กำลังโหลด...</span>}
          <span className="text-zinc-500 text-sm">{amulets.length} รายการ</span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {amulets.map((amulet) => (
          <div 
            key={amulet.id} 
            className="group bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-amber-500/50 transition-all duration-300"
          >
            <div className="relative h-48 overflow-hidden">
              <img 
                src={amulet.image} 
                alt={amulet.name}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                referrerPolicy="no-referrer"
              />
              <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[10px] font-mono text-amber-500 border border-amber-500/30">
                SCORE: {amulet.popularity}
              </div>
            </div>
            
            <div className="p-4 space-y-3">
              <div>
                <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">{amulet.type}</span>
                <h3 className="text-zinc-100 font-medium line-clamp-1">{amulet.name}</h3>
              </div>
              
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-800">
                <div className="flex flex-col items-center">
                  <Heart className="w-3 h-3 text-zinc-500 mb-1" />
                  <span className="text-[10px] text-zinc-400">{amulet.likes.toLocaleString()}</span>
                </div>
                <div className="flex flex-col items-center">
                  <Share2 className="w-3 h-3 text-zinc-500 mb-1" />
                  <span className="text-[10px] text-zinc-400">{amulet.shares.toLocaleString()}</span>
                </div>
                <div className="flex flex-col items-center">
                  <MessageSquare className="w-3 h-3 text-zinc-500 mb-1" />
                  <span className="text-[10px] text-zinc-400">{amulet.posts.toLocaleString()}</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-2">
                <div className={cn(
                  "flex items-center gap-1 text-[10px] font-medium",
                  amulet.trend === 'up' ? "text-emerald-500" : amulet.trend === 'down' ? "text-rose-500" : "text-zinc-500"
                )}>
                  {amulet.trend === 'up' && <TrendingUp className="w-3 h-3" />}
                  {amulet.trend === 'down' && <TrendingDown className="w-3 h-3" />}
                  {amulet.trend === 'stable' && <Minus className="w-3 h-3" />}
                  {amulet.trend.toUpperCase()}
                </div>
                <button className="text-[10px] text-amber-500 hover:underline">ดูรายละเอียด</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
