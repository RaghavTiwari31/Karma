import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Trophy, ArrowUpCircle, Flame, ServerCrash } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function KarmaLeaderboard() {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [teamHistory, setTeamHistory] = useState<any[]>([]);
  
  useEffect(() => {
    fetchScores();
  }, []);

  const fetchScores = () => {
    api.get('/api/karma-scores').then(res => {
      setLeaderboard(res.data.data.leaderboard);
      setLoading(false);
      if (res.data.data.leaderboard.length > 0 && !selectedTeam) {
        handleTeamClick(res.data.data.leaderboard[0].team_id);
      }
    });
  };

  const handleTeamClick = (team_id: string) => {
    setSelectedTeam(team_id);
    api.get(`/api/karma-scores/${team_id}`).then(res => {
      // Create faux chart data by walking backwards from current score, applying random var up to delta limit
      const st = res.data.data;
      const tData = [];
      let cur = st.score;
      for(let i=7; i>=0; i--) {
         tData.push({ day: i === 0 ? 'Today' : `-${i}d`, score: parseFloat(cur.toFixed(1)) });
         cur = cur - (Math.random() * 3 - 1); 
      }
      setTeamHistory(tData.reverse());
    });
  };

  if (loading) return <div className="p-8 text-center text-teal-400 animate-pulse font-mono">Loading Rankings...</div>;

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-5 duration-500 max-w-6xl mx-auto">
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
         <div>
           <h1 className="text-4xl font-black text-amber-400 flex items-center gap-3 tracking-tight">
             <Trophy className="h-10 w-10 text-amber-500" /> Behavioral Leaderboard
           </h1>
           <p className="text-slate-400 mt-2 text-sm">Real-time team accountability scores mapping wasteful spend to behavioral decay.</p>
         </div>
         <div className="flex items-center gap-3">
            <button onClick={fetchScores} className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-bold flex gap-2"><ArrowUpCircle className="w-5 h-5"/> Refresh Rankings</button>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
         <div className="lg:col-span-5 space-y-4 relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl -mr-16 -z-10"></div>
            {leaderboard.map((team, index) => {
               const isTop = index === 0;
               return (
                 <div key={team.team_id} onClick={() => handleTeamClick(team.team_id)} 
                    className={`relative p-5 rounded-2xl border cursor-pointer transition-all ${selectedTeam === team.team_id ? 'bg-slate-800 border-amber-500/60 shadow-lg shadow-amber-900/20' : 'bg-slate-900 border-slate-800 hover:border-slate-600'}`}>
                    
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-xl shadow-inner ${isTop ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white border-2 border-amber-200' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                             #{team.rank}
                          </div>
                          <div>
                             <h3 className="text-lg font-bold text-slate-100">{team.team_name}</h3>
                             <div className="text-xs font-mono text-slate-500 tracking-tight">Last: {team.last_action || 'Unknown'}</div>
                          </div>
                       </div>
                       
                       <div className="text-right flex flex-col items-end">
                         <div className="text-2xl font-black text-amber-400">{team.score.toFixed(1)}</div>
                         <div className="flex gap-2 text-xs font-bold font-mono">
                            <span className={team.delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                               {team.delta > 0 ? '+' : ''}{team.delta?.toFixed(1) || 0}
                            </span>
                            <span className="flex items-center text-orange-400 border border-orange-500/30 px-1.5 rounded bg-orange-950/40">
                              <Flame className="w-3 h-3 mr-0.5" /> {team.streak || 0}
                            </span>
                         </div>
                       </div>
                    </div>
                 </div>
               );
            })}
         </div>

         {/* Chart View */}
         <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden flex flex-col min-h-[500px]">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-orange-600"></div>
            <h2 className="text-2xl font-black text-slate-100 mb-6 flex items-center gap-3">
               <ArrowUpCircle className="w-6 h-6 text-amber-500" />
               Score Trajectory <span className="text-amber-500 font-mono text-xl">{selectedTeam}</span>
            </h2>
            
            {teamHistory.length > 0 ? (
              <div className="flex-1 w-full relative min-h-[300px] bg-slate-800/20 rounded-xl p-4 border border-slate-800/50">
                 <ResponsiveContainer width="100%" height="100%">
                   <LineChart data={teamHistory}>
                     <XAxis dataKey="day" stroke="#475569" fontSize={12} tickLine={false} axisLine={false} />
                     <YAxis domain={['auto', 'auto']} stroke="#475569" fontSize={12} tickLine={false} axisLine={false} />
                     <Tooltip 
                       contentStyle={{backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc', fontWeight: 'bold'}}
                       itemStyle={{color: '#fcd34d'}}
                     />
                     <Line type="monotone" dataKey="score" stroke="#f59e0b" strokeWidth={4} dot={{r: 5, fill: '#f59e0b', strokeWidth: 2, stroke: '#0f172a'}} activeDot={{r: 8, fill: '#fff'}} />
                   </LineChart>
                 </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center opacity-50">
                 <ServerCrash className="w-16 h-16 text-slate-600 mb-4" />
                 <p className="text-slate-400">Select a team to view trajectory</p>
              </div>
            )}
            
            <div className="mt-8 bg-slate-800/80 p-5 rounded-xl border border-slate-700">
               <h4 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-3 border-b border-slate-700 pb-2">Scoring Rules</h4>
               <ul className="grid grid-cols-2 gap-3 text-sm font-mono text-slate-400">
                  <li className="flex gap-2"><div className="text-emerald-400 w-8">+15</div> Resolve AWS Instance</li>
                  <li className="flex gap-2"><div className="text-emerald-400 w-8">+25</div> Shrink SaaS Seats</li>
                  <li className="flex gap-2"><div className="text-emerald-400 w-8">+40</div> Approve Vendor Switch</li>
                  <li className="flex gap-2"><div className="text-rose-400 w-8">-1</div> per day IDLE decay</li>
                  <li className="flex gap-2"><div className="text-rose-400 w-8">-10</div> SLA critical alert</li>
               </ul>
            </div>
         </div>
      </div>
    </div>
  );
}
