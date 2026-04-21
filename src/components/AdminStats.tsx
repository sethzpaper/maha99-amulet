import { useEffect, useState } from 'react';
import { ADMIN_STATS, ATTENDANCE_RECORDS } from '../data/mockData';
import { dataService } from '../lib/dataService';
import { AdminStats as AdminStatsType } from '../types';
import { Trophy, Star, Calendar, BarChart3, Timer } from 'lucide-react';
import { cn } from '../lib/utils';

export function AdminStats() {
  const [admins, setAdmins] = useState<AdminStatsType[]>(ADMIN_STATS);

  useEffect(() => {
    const loadAdmins = async () => {
      try {
        const data = await dataService.fetchAdminStats();
        if (data?.length) setAdmins(data);
      } catch (err) {
        console.error('Failed to load admins:', err);
      }
    };
    loadAdmins();
  }, []);

  const sortedAdmins = [...admins].sort((a, b) => b.monthly - a.monthly);
  const topAdmin = sortedAdmins[0];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif text-zinc-100 italic">สถิติแอดมิน (Admin Performance)</h2>
          <p className="text-zinc-500 text-sm">การจัดอันดับและสถิติการทำงานรายบุคคล</p>
        </div>
        <div className="flex items-center gap-2 bg-zinc-900 px-4 py-2 rounded-xl border border-zinc-800">
          <Calendar className="w-4 h-4 text-zinc-500" />
          <span className="text-xs text-zinc-300">ประจำเดือน เมษายน 2567</span>
        </div>
      </div>

      {topAdmin && (
        <div className="bg-gradient-to-br from-amber-500/20 via-zinc-900 to-zinc-900 border border-amber-500/30 p-8 rounded-3xl relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
            <div className="relative">
              <div className="w-32 h-32 rounded-full border-4 border-amber-500/50 p-1">
                <img src={topAdmin.avatar} alt={topAdmin.name} className="w-full h-full rounded-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <div className="absolute -bottom-2 -right-2 bg-amber-500 p-2 rounded-full shadow-lg">
                <Trophy className="w-5 h-5 text-black" />
              </div>
            </div>

            <div className="text-center md:text-left space-y-2">
              <div className="flex items-center justify-center md:justify-start gap-2">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                <span className="text-amber-500 text-xs font-bold uppercase tracking-widest">Admin of the Month</span>
              </div>
              <h3 className="text-3xl font-serif italic text-zinc-100">{topAdmin.name}</h3>
              <p className="text-zinc-400 text-sm max-w-md">
                ผลงานยอดเยี่ยมประจำเดือนด้วยคะแนน Performance {topAdmin.performance}% และยอดจัดการข้อมูลรวม {topAdmin.monthly.toLocaleString()} รายการ
              </p>
            </div>

            <div className="flex-1 grid grid-cols-2 gap-4 w-full">
              <div className="bg-black/40 backdrop-blur-md p-4 rounded-2xl border border-white/5">
                <p className="text-[10px] text-zinc-500 uppercase mb-1">ยอดรวมเดือนนี้</p>
                <p className="text-xl font-bold text-amber-500">{topAdmin.monthly.toLocaleString()}</p>
              </div>
              <div className="bg-black/40 backdrop-blur-md p-4 rounded-2xl border border-white/5">
                <p className="text-[10px] text-zinc-500 uppercase mb-1">ความเร็วเฉลี่ย</p>
                <p className="text-xl font-bold text-emerald-500">98%</p>
              </div>
            </div>
          </div>
          <BarChart3 className="absolute -right-8 -bottom-8 w-64 h-64 text-amber-500/5 -rotate-12" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-12">
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-zinc-800">
            <h3 className="text-zinc-100 font-medium">ตารางสรุปสถิติแอดมินทั้งหมด</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-zinc-950 text-[10px] text-zinc-500 uppercase tracking-widest">
                  <th className="px-6 py-4 font-semibold">อันดับ</th>
                  <th className="px-6 py-4 font-semibold">แอดมิน</th>
                  <th className="px-6 py-4 font-semibold text-center">รายวัน</th>
                  <th className="px-6 py-4 font-semibold text-center">รายเดือน</th>
                  <th className="px-6 py-4 font-semibold text-right">Performance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {sortedAdmins.map((admin, i) => (
                  <tr key={admin.id} className="hover:bg-zinc-800/30 transition-colors group">
                    <td className="px-6 py-4">
                      <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono", i === 0 ? "bg-amber-500 text-black" : "bg-zinc-800 text-zinc-500")}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img src={admin.avatar} alt="" className="w-8 h-8 rounded-full grayscale group-hover:grayscale-0 transition-all" referrerPolicy="no-referrer" />
                        <span className="text-sm font-medium text-zinc-200">{admin.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-zinc-400">{admin.daily}</td>
                    <td className="px-6 py-4 text-center text-sm text-zinc-100 font-medium">{admin.monthly.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-xs font-mono text-amber-500 font-bold">{admin.performance}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="glass-card p-6 rounded-3xl gold-border-glow">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-bold gold-text-gradient uppercase tracking-widest leading-none">สถานะปัจจุบัน</h3>
              <p className="text-[9px] text-zinc-600 mt-1 uppercase tracking-tighter">Real-time Shift Status</p>
            </div>
            <Timer className="w-4 h-4 text-gold/30" />
          </div>
          <div className="space-y-3">
            {ATTENDANCE_RECORDS.map(rec => (
              <div key={rec.id} className="flex items-center justify-between p-3 bg-zinc-950/50 rounded-xl border border-zinc-900 group hover:border-gold/20 transition-all">
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${rec.status === 'out' ? 'bg-zinc-700' : 'bg-emerald-500 animate-pulse'}`} />
                  <span className="text-xs text-zinc-300 font-medium">{rec.adminName}</span>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-mono text-zinc-500 italic">IN: {rec.checkIn || '--:--'}</p>
                  <p className={`text-[9px] uppercase font-bold ${rec.status === 'out' ? 'text-zinc-600' : 'text-emerald-500'}`}>{rec.status === 'out' ? 'OUT' : 'ON-DUTY'}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 p-4 bg-gold/5 rounded-xl border border-gold/10">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1 font-bold">สรุปวันลาเดือนนี้</p>
            <div className="flex justify-between items-end">
              <p className="text-2xl font-serif italic text-gold">4 <span className="text-xs text-zinc-600 font-normal">รายการ</span></p>
              <button className="text-[9px] text-zinc-400 hover:text-gold transition-colors font-bold uppercase tracking-widest underline decoration-zinc-800">ดูรายละเอียด</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
