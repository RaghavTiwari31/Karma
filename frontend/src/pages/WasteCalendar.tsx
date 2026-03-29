import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Calendar, RefreshCw, AlertCircle, Clock, CheckCircle } from 'lucide-react';

export default function WasteCalendar() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchCalendar = () => {
    setLoading(true);
    api.get('/api/waste-calendar').then(res => {
      setData(res.data.data);
      setLoading(false);
    });
  };

  const handleRefresh = () => {
    setLoading(true);
    api.post('/api/waste-calendar/refresh').then(res => {
      setData(res.data.data);
      setLoading(false);
    });
  };

  const assignTask = (id: string) => {
    api.post('/api/waste-calendar/assign', { event_id: id, assigned_to: 'engineering_lead' }).then(() => fetchCalendar());
  };

  const completeTask = (id: string) => {
    api.post('/api/waste-calendar/complete', { event_id: id, team: 'engineering' }).then(() => fetchCalendar());
  };

  useEffect(() => {
    fetchCalendar();
  }, []);

  if (!data && loading) return <div className="p-8 text-center text-teal-400 animate-pulse font-mono">Loading Waste Grid...</div>;

  const events = data?.events || [];

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
       <div className="flex justify-between items-end mb-8 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-black text-rose-300 tracking-tight flex items-center gap-3">
              <Calendar className="h-8 w-8 text-rose-500" />
              Waste Calendar
            </h1>
            <p className="text-slate-400 mt-2">Prioritized expiring contracts, idle software, and SLA breach risks mapped on a timeline.</p>
          </div>
          <button 
            onClick={handleRefresh} 
            disabled={loading}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh Agents
          </button>
       </div>

       <div className="grid grid-cols-1 gap-4">
         {events.map((ev: any) => {
            let badgeColors = "bg-slate-800 text-slate-300 border-slate-600";
            if (ev.urgency_label.includes('CRITICAL')) badgeColors = "bg-rose-950/50 text-rose-300 border-rose-500/50";
            if (ev.urgency_label.includes('HIGH')) badgeColors = "bg-amber-950/50 text-amber-300 border-amber-500/50";
            
            return (
              <div key={ev.id} className={`group relative bg-slate-900 border rounded-xl p-5 hover:border-slate-500 transition-colors ${ev.status === 'done' ? 'opacity-50 grayscale' : 'border-slate-800'}`}>
                 <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                    
                    <div className="flex-1">
                       <div className="flex flex-wrap items-center gap-3 mb-2">
                         <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${badgeColors}`}>
                           {ev.urgency_label}
                         </span>
                         {ev.status === 'open' ? (
                            <span className="flex items-center gap-1 text-xs font-mono text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded">
                              <Clock className="w-3 h-3" /> Ends: {ev.renewal_date}
                            </span>
                         ) : (
                            <span className="flex items-center gap-1 text-xs font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded">
                              <CheckCircle className="w-3 h-3" /> Resolved
                            </span>
                         )}
                         <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                           Agent: {ev.category}
                         </span>
                       </div>
                       
                       <h3 className="text-xl font-bold text-slate-100 mb-1">{ev.vendor}</h3>
                       <p className="text-sm text-slate-400 leading-relaxed font-mono tracking-tight">{ev.summary}</p>
                    </div>

                    <div className="flex flex-col items-end gap-3 min-w-[150px]">
                       <div className="text-right">
                         <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">Exposure</div>
                         <div className="text-2xl font-black text-rose-400 font-mono">₹{ev.estimated_savings_inr.toLocaleString()}</div>
                       </div>
                       
                       {ev.status === 'open' && (
                         <div className="flex items-center gap-2 mt-2 w-full justify-end">
                            <button onClick={() => assignTask(ev.id)} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded border border-slate-600 transition-colors">
                              Assign
                            </button>
                            <button onClick={() => completeTask(ev.id)} className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded border border-teal-500 transition-colors flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> Fix
                            </button>
                         </div>
                       )}
                    </div>
                 </div>
                 
                 {ev.status === 'open' && (
                   <div className="absolute top-0 left-0 w-1 h-full rounded-l-xl opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-b from-rose-500 to-amber-500"></div>
                 )}
              </div>
            );
         })}
         
         {events.length === 0 && (
           <div className="text-center p-12 text-slate-500 border border-slate-800 border-dashed rounded-2xl flex flex-col items-center">
              <CheckCircle className="w-12 h-12 text-teal-900 mb-4" />
              <p className="text-lg">No waste events found. Run agents to scan for risks.</p>
           </div>
         )}
       </div>
    </div>
  );
}
