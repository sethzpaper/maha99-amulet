import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Award } from 'lucide-react';

const amulets = [
  { name: 'พระสมเด็จ', value: 85, color: '#3b82f6' },
  { name: 'หลวงปู่ทวด', value: 70, color: '#ec4899' },
  { name: 'พระปิดตา', value: 55, color: '#d4af37' },
  { name: 'เหรียญ', value: 45, color: '#ef4444' },
  { name: 'รูปหล่อ', value: 35, color: '#10b981' },
];

const pieData = [
  { name: 'Facebook', value: 65, color: '#2563eb' },
  { name: 'TikTok', value: 35, color: '#db2777' },
];

export function PopularityBreakdown() {
  return (
    <div className="glass-card p-8 rounded-3xl h-[450px] flex flex-col gold-border-glow relative overflow-hidden">
      <div className="flex items-center justify-between mb-8 relative z-10">
        <div>
          <h3 className="text-xl font-serif italic font-bold text-zinc-100 gold-text-gradient">Top 10 พระเครื่อง</h3>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">Popularity Distribution</p>
        </div>
        <Award className="w-5 h-5 text-gold/50" />
      </div>

      <div className="flex-1 grid grid-cols-2 gap-8 relative z-10">
        {/* Bars Container */}
        <div className="space-y-4">
          {amulets.map((item, i) => (
            <div key={i} className="space-y-1.5 translate-y-2">
              <div className="flex items-center justify-between text-[10px] text-zinc-400 font-medium">
                <div className="flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                   <span>{item.name}</span>
                </div>
              </div>
              <div className="h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                <div 
                  className="h-full rounded-full transition-all duration-1000" 
                  style={{ width: `${item.value}%`, backgroundColor: item.color }} 
                />
              </div>
            </div>
          ))}
        </div>

        {/* Pie Chart Container */}
        <div className="relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
             <span className="text-xs text-zinc-500 font-medium">Facebook</span>
             <span className="text-2xl font-bold gold-text-gradient">65%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
