import { Award, Target, Layout, User } from 'lucide-react';

export function StatCards() {
  const stats = [
    {
      label: 'ฮิตวันนี้',
      title: 'พระสมเด็จ',
      icon: Award,
      color: 'gold',
      iconBg: 'bg-gold/10'
    },
    {
      label: 'Total Engagement',
      title: '120,450',
      icon: Target,
      color: 'gold',
      iconBg: 'bg-amber-500/10'
    },
    {
      label: 'รายการพระเครื่อง',
      title: '50 รายการ',
      icon: Layout,
      color: 'gold',
      iconBg: 'bg-yellow-500/10'
    },
    {
      label: 'Growth Index',
      title: '+24.5%',
      icon: Target,
      color: 'gold',
      iconBg: 'bg-emerald-500/10'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, i) => (
        <div key={i} className="glass-card p-6 rounded-2xl relative overflow-hidden group hover:border-gold/30 transition-all duration-500 gold-border-glow">
          <div className="flex items-center gap-4 relative z-10">
            <div className={`w-12 h-12 ${stat.iconBg} rounded-xl flex items-center justify-center border border-gold/10`}>
              <stat.icon className="w-6 h-6 text-gold" />
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-0.5">{stat.label}</p>
              <h3 className="text-xl font-serif italic font-bold text-zinc-100 group-hover:gold-text-gradient transition-all">{stat.title}</h3>
            </div>
          </div>
          
          {/* Decorative Background Icon */}
          <stat.icon className="absolute -right-4 -bottom-4 w-24 h-24 text-gold/5 group-hover:text-gold/10 transition-all duration-700 rotate-12" />
          
          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      ))}
    </div>
  );
}
