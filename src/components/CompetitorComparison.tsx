import { Facebook, Music2, TrendingUp, PieChart as PieIcon, LineChart as LineIcon, ArrowUpRight, Search, Globe, Lightbulb, Zap } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar } from 'recharts';
import { useState, useEffect } from 'react';
import { GOOGLE_TRENDS } from '../data/mockData';
import { dataService } from '../lib/dataService';
import { SocialPost, CompetitorAnalysisResponse } from '../types';

const sovData = [
  { name: 'ร้านมหานิยม 99', value: 45, color: '#D4AF37' },
  { name: 'เซียนพระเจ้าดัง', value: 25, color: '#2563eb' },
  { name: 'กรุพระไทย', value: 20, color: '#db2777' },
  { name: 'อื่นๆ', value: 10, color: '#444' },
];

const priceData = [
  { date: '01/04', price: 480000 },
  { date: '05/04', price: 510000 },
  { date: '10/04', price: 540000 },
  { date: '15/04', price: 580000 },
];

export function CompetitorComparison() {
  const [facebookPosts, setFacebookPosts] = useState<SocialPost[]>([]);
  const [tikTokPosts, setTikTokPosts] = useState<SocialPost[]>([]);
  const [analysis, setAnalysis] = useState<CompetitorAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const fbData = await dataService.fetchCompetitorFacebook();
        const ttData = await dataService.fetchCompetitorTikTok();
        setFacebookPosts(fbData.slice(0, 5));
        setTikTokPosts(ttData.slice(0, 5));
      } catch (error) {
        console.error('Error fetching competitor data:', error);
      }
      setLoading(false);
    };

    fetchData();

    // Set up periodic refresh every 15 minutes
    const interval = setInterval(fetchData, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchAnalysis = async () => {
      setAnalysisLoading(true);
      try {
        const analysisData = await dataService.fetchCompetitorAnalysis();
        setAnalysis(analysisData);
      } catch (error) {
        console.error('Error fetching competitor analysis:', error);
      }
      setAnalysisLoading(false);
    };

    // Fetch analysis after initial data is loaded
    if (!loading && facebookPosts.length > 0) {
      fetchAnalysis();
    }
  }, [loading, facebookPosts.length]);

  return (
    <div className="space-y-8">
      {/* Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* SOV */}
        <div className="glass-card p-8 rounded-3xl gold-border-glow h-[420px] flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl font-serif italic font-bold text-zinc-100 gold-text-gradient">Share of Voice (SOV)</h2>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">Market Sentiment Distribution</p>
            </div>
            <PieIcon className="w-5 h-5 text-gold/30" />
          </div>
          <div className="flex-1 flex flex-col md:flex-row items-center gap-8">
            <div className="w-full h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sovData}
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {sovData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-4 w-full px-4">
               {sovData.map((item, i) => (
                 <div key={i} className="flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                       <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                       <span className="text-[10px] text-zinc-400 truncate">{item.name}</span>
                    </div>
                    <span className="text-lg font-bold text-zinc-100">{item.value}%</span>
                 </div>
               ))}
            </div>
          </div>
        </div>

        {/* Price Tracking */}
        <div className="glass-card p-8 rounded-3xl gold-border-glow h-[420px] flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl font-serif italic font-bold text-zinc-100 gold-text-gradient">การเปลี่ยนแปลงราคาเช่าบูชา</h2>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">Price Trends: พระสมเด็จวัดระฆัง (Benchmark)</p>
            </div>
            <LineIcon className="w-5 h-5 text-gold/30" />
          </div>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={priceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                <XAxis dataKey="date" stroke="#444" fontSize={10} axisLine={false} tickLine={false} dy={10} />
                <YAxis hide />
                <Tooltip 
                   contentStyle={{ backgroundColor: '#050505', border: '1px solid rgba(212,175,55,0.2)', borderRadius: '12px' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="price" 
                  stroke="#D4AF37" 
                  strokeWidth={4} 
                  dot={{ r: 6, fill: '#D4AF37' }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 flex items-center justify-between bg-zinc-950/50 p-4 rounded-xl border border-zinc-900 shadow-inner">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                   <ArrowUpRight className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                   <p className="text-[10px] text-zinc-500 uppercase tracking-widest">การเปลี่ยนแปลงเฉลี่ย</p>
                   <p className="text-lg font-bold text-emerald-500">+18.5% <span className="text-xs text-zinc-500 font-normal ml-1">เดือนนี้</span></p>
                </div>
             </div>
             <button className="text-[10px] text-gold hover:underline uppercase tracking-widest font-bold">ดูรายละเอียด -&gt;</button>
          </div>
        </div>
      </div>

      {/* Market Leaders Comparison */}
      <div className="glass-card p-8 rounded-3xl h-[400px] flex flex-col gold-border-glow">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl font-serif italic font-bold text-zinc-100 gold-text-gradient">เทียบพลังสองฝั่ง</h2>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">Market Leaders Comparison</p>
          </div>
          <TrendingUp className="w-5 h-5 text-gold/30" />
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8 overflow-y-auto pr-2 custom-scrollbar">
          {/* Facebook Col */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
               <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Competitor Facebook Posts</span>
            </div>
            <div className="space-y-3">
               {loading ? (
                 <p className="text-[10px] text-zinc-500">กำลังโหลด...</p>
               ) : facebookPosts.length === 0 ? (
                 <p className="text-[10px] text-zinc-500">ไม่มีข้อมูล</p>
               ) : (
                 facebookPosts.map((post, i) => (
                   <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-[#111] border border-zinc-800/50 hover:border-gold/20 transition-all">
                      <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                         <Facebook className="w-3 h-3 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-zinc-300 line-clamp-2">{post.content}</p>
                        <span className="text-[10px] font-mono font-bold text-gold">{post.engagement} interactions</span>
                      </div>
                   </div>
                 ))
               )}
            </div>
          </div>

          {/* TikTok Col */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
               <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Competitor TikTok Posts</span>
            </div>
            <div className="space-y-3">
               {loading ? (
                 <p className="text-[10px] text-zinc-500">กำลังโหลด...</p>
               ) : tikTokPosts.length === 0 ? (
                 <p className="text-[10px] text-zinc-500">ไม่มีข้อมูล</p>
               ) : (
                 tikTokPosts.map((post, i) => (
                   <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-[#111] border border-zinc-800/50 hover:border-gold/20 transition-all">
                      <div className="w-5 h-5 bg-pink-600 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                         <Music2 className="w-3 h-3 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-zinc-300 line-clamp-2">{post.content}</p>
                        <span className="text-[10px] font-mono font-bold text-gold">{post.engagement} views</span>
                      </div>
                   </div>
                 ))
               )}
            </div>
          </div>
        </div>
      </div>

      {/* ChatGPT Insights Cards */}
      {analysis && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Facebook Insights */}
          <div className="glass-card p-6 rounded-3xl gold-border-glow flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center border border-blue-500/20">
                  <Lightbulb className="w-6 h-6 text-blue-500" />
                </div>
                <h3 className="text-lg font-serif italic font-bold text-zinc-100 gold-text-gradient">Facebook Insights</h3>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Position</h4>
                <p className="text-sm text-zinc-300">{analysis.facebook.marketPosition}</p>
              </div>

              <div>
                <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Summary</h4>
                <p className="text-sm text-zinc-300">{analysis.facebook.summary}</p>
              </div>

              <div>
                <h4 className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-2">💪 Strengths</h4>
                <ul className="space-y-1">
                  {analysis.facebook.strengths.map((s, i) => (
                    <li key={i} className="text-[10px] text-zinc-400">• {s}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-2">⚠️ Weaknesses</h4>
                <ul className="space-y-1">
                  {analysis.facebook.weaknesses.map((w, i) => (
                    <li key={i} className="text-[10px] text-zinc-400">• {w}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">📈 Trends</h4>
                <ul className="space-y-1">
                  {analysis.facebook.trends.map((t, i) => (
                    <li key={i} className="text-[10px] text-zinc-400">• {t}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-[10px] font-bold text-gold uppercase tracking-widest mb-2"><Zap className="w-3 h-3 inline mr-1" />Our Strategy</h4>
                <ul className="space-y-1">
                  {analysis.facebook.recommendations.map((r, i) => (
                    <li key={i} className="text-[10px] text-zinc-300">• {r}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* TikTok Insights */}
          <div className="glass-card p-6 rounded-3xl gold-border-glow flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-pink-500/10 rounded-lg flex items-center justify-center border border-pink-500/20">
                  <Lightbulb className="w-6 h-6 text-pink-500" />
                </div>
                <h3 className="text-lg font-serif italic font-bold text-zinc-100 gold-text-gradient">TikTok Insights</h3>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Position</h4>
                <p className="text-sm text-zinc-300">{analysis.tiktok.marketPosition}</p>
              </div>

              <div>
                <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Summary</h4>
                <p className="text-sm text-zinc-300">{analysis.tiktok.summary}</p>
              </div>

              <div>
                <h4 className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-2">💪 Strengths</h4>
                <ul className="space-y-1">
                  {analysis.tiktok.strengths.map((s, i) => (
                    <li key={i} className="text-[10px] text-zinc-400">• {s}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-2">⚠️ Weaknesses</h4>
                <ul className="space-y-1">
                  {analysis.tiktok.weaknesses.map((w, i) => (
                    <li key={i} className="text-[10px] text-zinc-400">• {w}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-[10px] font-bold text-pink-400 uppercase tracking-widest mb-2">📈 Trends</h4>
                <ul className="space-y-1">
                  {analysis.tiktok.trends.map((t, i) => (
                    <li key={i} className="text-[10px] text-zinc-400">• {t}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-[10px] font-bold text-gold uppercase tracking-widest mb-2"><Zap className="w-3 h-3 inline mr-1" />Our Strategy</h4>
                <ul className="space-y-1">
                  {analysis.tiktok.recommendations.map((r, i) => (
                    <li key={i} className="text-[10px] text-zinc-300">• {r}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Google Trends Section */}
      <div className="glass-card p-8 rounded-3xl gold-border-glow">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20">
                <Globe className="w-6 h-6 text-blue-500" />
             </div>
             <div>
                <h2 className="text-xl font-serif italic font-bold text-zinc-100 gold-text-gradient">Google Trends & Keyword Insight</h2>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">Weekly Amulet Search Volume (Thailand)</p>
             </div>
          </div>
          <Search className="w-5 h-5 text-zinc-600" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
           <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={GOOGLE_TRENDS} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="keyword" type="category" stroke="#666" fontSize={10} width={120} axisLine={false} tickLine={false} />
                    <Tooltip 
                      cursor={{ fill: 'rgba(212,175,55,0.05)' }}
                      contentStyle={{ backgroundColor: '#050505', border: '1px solid rgba(212,175,55,0.2)', borderRadius: '12px' }}
                    />
                    <Bar dataKey="searchVolume" fill="#D4AF37" radius={[0, 4, 4, 0]} barSize={20} />
                 </BarChart>
              </ResponsiveContainer>
           </div>
           
           <div className="space-y-4">
              <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Trending Keywords This Week</h4>
              {GOOGLE_TRENDS.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-zinc-950/50 rounded-2xl border border-zinc-900 group hover:border-blue-500/30 transition-all">
                   <div className="flex items-center gap-4">
                      <span className="text-xs font-mono text-zinc-700">#0{i+1}</span>
                      <span className="text-sm font-bold text-zinc-200 group-hover:text-gold transition-colors">{item.keyword}</span>
                   </div>
                   <div className="text-right">
                      <p className="text-xs font-bold text-emerald-500">{item.growth}</p>
                      <p className="text-[10px] text-zinc-600 font-mono">Vol: {(item.searchVolume/1000).toFixed(0)}k</p>
                   </div>
                </div>
              ))}
           </div>
        </div>
      </div>
    </div>
  );
}
