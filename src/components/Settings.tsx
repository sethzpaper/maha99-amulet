import { useState } from 'react';
import { Download, Printer, FileText, Table, Calendar, Save, History, Activity } from 'lucide-react';
import { ACTIVITY_LOGS } from '../data/mockData';

export function Settings() {
  const [exportType, setExportType] = useState('daily');

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif text-zinc-100 italic">Settings & Export</h2>
          <p className="text-zinc-500 text-sm">จัดการระบบและส่งออกรายงานสถิติ</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Export Section */}
        <div className="glass-card p-8 rounded-3xl gold-border-glow">
          <div className="flex items-center gap-3 mb-8">
             <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center border border-gold/20">
                <Download className="w-6 h-6 text-gold" />
             </div>
             <div>
                <h3 className="text-xl font-serif italic font-bold text-zinc-100 gold-text-gradient">Export รายงาน</h3>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">Daily, Monthly, Yearly Analysis</p>
             </div>
          </div>

          <div className="space-y-6">
            <div>
               <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-3 block">เลือกช่วงเวลา</label>
               <div className="grid grid-cols-3 gap-3">
                  {['daily', 'monthly', 'yearly'].map(type => (
                    <button 
                      key={type}
                      onClick={() => setExportType(type)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                        exportType === type ? 'bg-gold text-black border-gold shadow-[0_0_15px_rgba(212,175,55,0.2)]' : 'bg-transparent text-zinc-500 border-zinc-800 hover:text-zinc-300'
                      }`}
                    >
                      {type === 'daily' ? 'รายวัน' : type === 'monthly' ? 'รายเดือน' : 'รายปี'}
                    </button>
                  ))}
               </div>
            </div>

            <div className="pt-6 border-t border-zinc-900 grid grid-cols-1 sm:grid-cols-2 gap-4">
               <button className="flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 py-3 rounded-2xl transition-all font-bold text-xs">
                  <FileText className="w-4 h-4" /> Export PDF
               </button>
               <button className="flex items-center justify-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 py-3 rounded-2xl transition-all font-bold text-xs">
                  <Table className="w-4 h-4" /> Export Excel
               </button>
               <button className="sm:col-span-2 flex items-center justify-center gap-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 py-3 rounded-2xl transition-all font-bold text-xs">
                  <Printer className="w-4 h-4" /> พิมพ์รายงาน (Print)
               </button>
            </div>
          </div>
        </div>

        {/* System Settings */}
        <div className="glass-card p-8 rounded-3xl gold-border-glow border-zinc-800/50">
           <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-zinc-900/50 rounded-xl flex items-center justify-center border border-zinc-800">
                 <Save className="w-6 h-6 text-zinc-500" />
              </div>
              <div>
                 <h3 className="text-xl font-serif italic font-bold text-zinc-100 gold-text-gradient">การตั้งค่าระบบ</h3>
                 <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">System Configuration</p>
              </div>
           </div>

           <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-zinc-950/50 rounded-2xl border border-zinc-900">
                 <div>
                    <p className="text-sm font-bold text-zinc-300">แจ้งเตือนผ่าน LINE</p>
                    <p className="text-[10px] text-zinc-500">ส่งรายงานสรุปอัตโนมัติทุกสิ้นวัน</p>
                 </div>
                 <div className="w-12 h-6 bg-gold rounded-full relative">
                    <div className="absolute right-1 top-1 w-4 h-4 bg-black rounded-full shadow-sm" />
                 </div>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-zinc-950/50 rounded-2xl border border-zinc-900">
                 <div>
                    <p className="text-sm font-bold text-zinc-300">สำรองข้อมูลอัตโนมัติ</p>
                    <p className="text-[10px] text-zinc-500">Backup ดาต้าเบสไปพื้นที่ Google Drive</p>
                 </div>
                 <div className="w-12 h-6 bg-zinc-800 rounded-full relative">
                    <div className="absolute left-1 top-1 w-4 h-4 bg-zinc-500 rounded-full" />
                 </div>
              </div>
           </div>
        </div>
      </div>

      {/* Activity Log Section */}
      <div className="glass-card p-8 rounded-3xl gold-border-glow">
         <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20">
               <History className="w-6 h-6 text-blue-500" />
            </div>
            <div>
               <h3 className="text-xl font-serif italic font-bold text-zinc-100 gold-text-gradient">บันทึกกิจกรรม (Activity Log)</h3>
               <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">System Audit & User Actions</p>
            </div>
         </div>

         <div className="space-y-4">
            {ACTIVITY_LOGS.map(log => (
              <div key={log.id} className="flex items-start gap-4 p-4 bg-zinc-950/50 rounded-2xl border border-zinc-900 hover:border-zinc-700 transition-all group">
                 <div className={`mt-1 p-2 rounded-lg ${
                    log.type === 'update' ? 'bg-amber-500/10 text-amber-500' :
                    log.type === 'create' ? 'bg-emerald-500/10 text-emerald-500' :
                    log.type === 'delete' ? 'bg-red-500/10 text-red-500' :
                    'bg-blue-500/10 text-blue-500'
                 }`}>
                    {log.type === 'update' ? <Activity className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                 </div>
                 <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                       <p className="text-xs font-bold text-zinc-200 group-hover:text-gold transition-colors">{log.user}</p>
                       <span className="text-[10px] font-mono text-zinc-600">{log.timestamp}</span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">{log.action}</p>
                 </div>
              </div>
            ))}
         </div>
         
         <button className="w-full mt-8 py-3 bg-zinc-900/50 hover:bg-zinc-900 text-[10px] font-bold text-zinc-500 border border-zinc-800 rounded-2xl transition-all uppercase tracking-widest leading-none">
            ดูบันทึกทั้งหมด (Full Audit Log)
         </button>
      </div>
    </div>
  );
}
