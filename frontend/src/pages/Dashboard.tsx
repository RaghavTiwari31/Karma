import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Trophy, AlertTriangle, CheckCircle, Zap, MessageSquare } from 'lucide-react';
import { NavLink } from 'react-router-dom';

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [toast, setToast] = useState<any>(null);

  useEffect(() => {
    // Quick load of data directly from other endpoints for dashboard stats
    Promise.all([
      api.get('/api/waste-calendar'),
      api.get('/api/karma-scores')
    ]).then(([wasteRes, karmaRes]) => {
      setStats({
        waste: wasteRes.data.data,
        leaderboard: karmaRes.data.data.leaderboard,
      });
    });

    const wsUrl = import.meta.env.VITE_API_URL 
      ? import.meta.env.VITE_API_URL.replace(/^http/, 'ws') + '/ws/live-alerts'
      : 'ws://localhost:8000/ws/live-alerts';

    const ws = new WebSocket(wsUrl);
    ws.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.event_type.startsWith('ghost_approver.') || payload.event_type.startsWith('sla_monitor.')) {
          setToast(payload);
          setTimeout(() => setToast(null), 8000);
        }
      } catch (err) {}
    };

    return () => ws.close();
  }, []);

  if (!stats) return <div className="text-slate-400 p-8 text-center animate-pulse">Loading KARMA Intelligence...</div>;

  const totalPreventable = stats.waste.total_preventable_inr || 0;
  const activeAlerts = stats.waste.active_count || stats.waste.events?.length || 0;
  const topUrgent = stats.waste.events?.[0];
  const financeRank = stats.leaderboard?.find((t: any) => t.team_id === 'finance')?.rank || '-';
  const engineeringRank = stats.leaderboard?.find((t: any) => t.team_id === 'engineering')?.rank || '-';

  return (
    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
      
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className={`p-4 rounded-xl shadow-2xl border flex flex-col max-w-sm backdrop-blur-xl
            ${toast.severity === 'warning' ? 'bg-amber-900/30 border-amber-500/50 text-amber-50' : ''}
            ${toast.severity === 'critical' ? 'bg-rose-900/30 border-rose-500/50 text-rose-50' : ''}
            ${toast.severity === 'success' ? 'bg-emerald-900/30 border-emerald-500/50 text-emerald-50' : ''}
            ${toast.severity === 'info' ? 'bg-blue-900/30 border-blue-500/50 text-blue-50' : ''}
          `}>
             <div className="flex items-center gap-2 mb-1">
               <Zap className="h-5 w-5" />
               <span className="font-bold text-sm tracking-widest uppercase opacity-80">{toast.agent}</span>
             </div>
             <p className="font-medium text-lg mb-2">{toast.title}</p>
             <p className="text-sm opacity-80 font-mono">
                {JSON.stringify(toast.data).replace(/[{}]/g, '').replace(/"/g, '')}
             </p>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-indigo-400">
          KARMA Engine Overview
        </h1>
        <p className="text-slate-400 mt-2 text-lg">Real-time enterprise waste interception & autonomous execution.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        <div className="relative overflow-hidden bg-slate-800/50 border border-slate-700/50 p-6 rounded-2xl shadow-xl transition-all hover:border-rose-500/50 hover:bg-slate-800">
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
          <p className="text-slate-400 text-sm font-semibold mb-1 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-400" /> TOTAL EXPOSURE
          </p>
          <div className="text-3xl font-bold text-rose-400 tracking-tight">
            ₹{totalPreventable.toLocaleString()}
          </div>
        </div>

        <div className="relative overflow-hidden bg-slate-800/50 border border-slate-700/50 p-6 rounded-2xl shadow-xl transition-all hover:border-amber-500/50 hover:bg-slate-800">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
          <p className="text-slate-400 text-sm font-semibold mb-1 flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-400" /> ACTIVE ALERTS
          </p>
          <div className="text-3xl font-bold text-slate-100">{activeAlerts} Risks</div>
        </div>

        <div className="relative overflow-hidden bg-slate-800/50 border border-slate-700/50 p-6 rounded-2xl shadow-xl transition-all hover:border-emerald-500/50 hover:bg-slate-800">
           <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
           <p className="text-slate-400 text-sm font-semibold mb-1 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-400" /> TOP URGENT FIX
          </p>
          <div className="text-lg font-bold text-slate-100 truncate">
            {topUrgent ? topUrgent.urgency_label : 'None'}
          </div>
          <div className="text-sm text-emerald-400 font-medium">
            ₹{topUrgent?.estimated_savings_inr?.toLocaleString() || 0}
          </div>
        </div>

        <div className="relative overflow-hidden bg-slate-800/50 border border-slate-700/50 p-6 rounded-2xl shadow-xl transition-all hover:border-indigo-500/50 hover:bg-slate-800">
           <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
           <p className="text-slate-400 text-sm font-semibold mb-1 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-indigo-400" /> LEADERBOARD STANDING
          </p>
          <div className="flex justify-between items-end mt-1">
             <div>
               <div className="text-slate-400 text-xs uppercase mb-1">Engineering</div>
               <div className="text-2xl font-bold text-indigo-300">Rank #{engineeringRank}</div>
             </div>
             <div>
               <div className="text-slate-400 text-xs uppercase mb-1">Finance</div>
               <div className="text-2xl font-bold text-indigo-300">Rank #{financeRank}</div>
             </div>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-12">
        <div className="border border-slate-700/50 bg-slate-800/30 rounded-2xl p-8 backdrop-blur-sm">
           <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
             <AlertTriangle className="h-6 w-6 text-rose-400" />
             Top Actionable Waste
           </h2>
           {topUrgent ? (
             <div className="bg-slate-900 rounded-xl p-6 border border-slate-700">
                <div className="flex justify-between items-start mb-4">
                   <h3 className="text-xl font-semibold text-slate-200">{topUrgent.vendor}</h3>
                   <span className="px-3 py-1 bg-rose-500/20 text-rose-400 text-xs font-bold rounded-full border border-rose-500/50">
                     {topUrgent.urgency_label}
                   </span>
                </div>
                <p className="text-slate-400 text-sm leading-relaxed whitespace-pre-line mb-6">
                  {topUrgent.summary}
                </p>
                <div className="flex gap-4">
                  <NavLink to="/waste-calendar" className="bg-teal-600 hover:bg-teal-500 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors">
                     View Calendar
                  </NavLink>
                </div>
             </div>
           ) : (
             <p className="text-slate-500">No active priorities.</p>
           )}
        </div>

        <div className="border border-slate-700/50 bg-slate-800/30 rounded-2xl p-8 backdrop-blur-sm">
           <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
             <MessageSquare className="h-6 w-6 text-indigo-400" />
             Intercept a Decision
           </h2>
           <div className="bg-slate-900 rounded-xl p-6 border border-slate-700 flex flex-col items-center justify-center text-center h-full min-h-[250px]">
              <p className="text-slate-400 mb-6">Test the live Ghost Approver. Simulate a SaaS renewal or Cloud infra purchase to see KARMA intercept and negotiate it automatically.</p>
              <NavLink to="/ghost-approver" className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-xl text-lg font-bold shadow-lg shadow-indigo-500/20 transition-all hover:scale-105">
                 Launch Simulator
              </NavLink>
           </div>
        </div>
      </div>
    </div>
  );
}
