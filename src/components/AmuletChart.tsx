import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const data = [
  { name: 'Sun', fb: 40000, tt: 24000 },
  { name: 'Mon', fb: 70000, tt: 40000 },
  { name: 'Wed', fb: 60000, tt: 50000 },
  { name: 'Tuc', fb: 40000, tt: 68000 },
  { name: 'Wed', fb: 80000, tt: 48000 },
  { name: 'Thu', fb: 65000, tt: 40000 },
  { name: 'Fri', fb: 75000, tt: 55000 },
  { name: 'Sat', fb: 60000, tt: 68000 },
  { name: 'Sun', fb: 85000, tt: 95000 },
];

export function AmuletChart() {
  return (
    <div className="glass-card p-8 rounded-3xl h-[450px] flex flex-col gold-border-glow">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-xl font-serif italic font-bold text-zinc-100 gold-text-gradient">กราฟความนิยมรายสัปดาห์</h3>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">Comparison: Facebook vs TikTok</p>
        </div>
        <div className="flex items-center gap-2">
           <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-600/10 rounded-full border border-blue-600/20 text-[10px] text-blue-400">
              <span className="w-2 h-2 rounded-full bg-blue-600" /> Facebook
           </div>
           <div className="flex items-center gap-1.5 px-3 py-1 bg-pink-600/10 rounded-full border border-pink-600/20 text-[10px] text-pink-400">
              <span className="w-2 h-2 rounded-full bg-pink-600" /> TikTok
           </div>
        </div>
      </div>

      <div className="flex-1 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
            <XAxis 
              dataKey="name" 
              stroke="#444" 
              fontSize={10} 
              tickLine={false} 
              axisLine={false}
              dy={10}
            />
            <YAxis 
              stroke="#444" 
              fontSize={10} 
              tickLine={false} 
              axisLine={false}
              tickFormatter={(val) => `${val / 1000}k`}
              dx={-10}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'rgba(5, 5, 5, 0.9)', 
                border: '1px solid rgba(212, 175, 55, 0.2)', 
                borderRadius: '16px',
                backdropFilter: 'blur(10px)'
              }}
              itemStyle={{ fontSize: '12px' }}
            />
            <Line 
              type="monotone" 
              dataKey="fb" 
              stroke="#2563eb" 
              strokeWidth={3} 
              dot={{ r: 4, fill: '#2563eb', strokeWidth: 2, stroke: '#050505' }}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
            <Line 
              type="monotone" 
              dataKey="tt" 
              stroke="#db2777" 
              strokeWidth={3} 
              dot={{ r: 4, fill: '#db2777', strokeWidth: 2, stroke: '#050505' }}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
