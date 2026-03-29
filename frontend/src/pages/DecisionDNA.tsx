import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { History, Share2, Filter, Code } from 'lucide-react';

export default function DecisionDNA() {
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    // Generate dummy logs on load via the phase 6 API
    api.get('/api/decision-dna').then(res => {
      setTimeline(res.data.data.results);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-8 text-center text-teal-400 animate-pulse font-mono">Reconstructing DNA...</div>;

  const filtered = filter ? timeline.filter(t => t.vendor.toLowerCase().includes(filter.toLowerCase())) : timeline;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto">
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
         <div>
           <h1 className="text-3xl font-black text-emerald-400 flex items-center gap-3">
             <Share2 className="h-8 w-8 text-emerald-500" /> Decision DNA
           </h1>
           <p className="text-slate-400 mt-2 text-sm">Post-mortem context reconstruction. Replays what humans missed when money leaked.</p>
         </div>
         <div className="flex items-center gap-3">
           <div className="relative">
             <Filter className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
             <input type="text" placeholder="Filter vendor..." onChange={e => setFilter(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500" />
           </div>
         </div>
      </div>

      <div className="space-y-6 mt-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-700 before:to-transparent">
        {filtered.map((item, i) => (
          <div key={item.reconstruction_id || i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
             
             {/* Timeline Node */}
             <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-slate-900 bg-slate-700 text-slate-400 font-bold shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow shadow-slate-950 z-10 transition-colors group-hover:bg-emerald-500 group-hover:text-white">
               {i + 1}
             </div>

             {/* Card */}
             <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-slate-800/60 backdrop-blur-sm p-6 rounded-2xl border border-slate-700/50 shadow-xl transition-all group-hover:border-emerald-500/50 group-hover:shadow-emerald-900/20">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-bold text-slate-100">{item.vendor} {item.category}</h3>
                  <span className="text-xs font-mono px-2 py-1 bg-slate-900 rounded text-slate-400">{item.actor}</span>
                </div>
                <div className="mb-4">
                  <div className="text-rose-400 font-black text-xl font-mono tracking-tight mb-1">Cost of Suboptimal Choice: ₹{item.money_leaked_inr?.toLocaleString() || 0}</div>
                  <div className="text-sm text-slate-300 bg-slate-900 p-3 rounded-lg border border-slate-800 font-mono">
                    <span className="text-rose-400 font-bold block mb-1">Human Choice:</span> {item.decision_taken}
                  </div>
                </div>

                <div className="bg-slate-900/80 rounded-lg p-4 font-mono text-xs border-l-4 border-amber-500 mb-4 shadow-inner">
                  <div className="text-slate-500 mb-1">WHAT THEY KNEW:</div>
                  <ul className="text-slate-300 list-disc list-inside mb-3">
                    {item.context_human_had?.map((c: string, x: number) => <li key={x}>{c}</li>)}
                  </ul>
                  <div className="text-indigo-400 mb-1 mt-2 flex items-center gap-1"><Code className="w-3 h-3"/> WHAT THEY MISSED:</div>
                  <ul className="text-indigo-200 list-disc list-inside">
                    {item.context_human_missed?.map((c: string, x: number) => <li key={x}>{c}</li>)}
                  </ul>
                </div>

                <div className="flex bg-emerald-950/30 rounded-lg p-3 border border-emerald-900/50">
                  <div className="text-emerald-400 font-bold text-xs uppercase tracking-widest mr-2 flex-shrink-0">KARMA FIX:</div>
                  <div className="text-emerald-200 text-sm">{item.karma_fix_annotation}</div>
                </div>
             </div>

          </div>
        ))}
        {filtered.length === 0 && <div className="text-center text-slate-500 py-10">No reconstructable DNA logs found.</div>}
      </div>
    </div>
  );
}
