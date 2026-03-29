import React, { useState } from 'react';
import { api } from '../api';
import { MessageSquare, Send, Bot, FileText, Check, ShieldAlert, Zap, Cpu } from 'lucide-react';

export default function GhostApproverSim() {
  const [vendor, setVendor] = useState('ZoomWS Test');
  const [amount, setAmount] = useState(350000);
  const [category, setCategory] = useState('SaaS');
  const [requester, setRequester] = useState('finance@acme.com');

  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [decisionLog, setDecisionLog] = useState<any>(null);

  const handleSimulate = async () => {
    setLoading(true);
    setAnalysis(null);
    setDecisionLog(null);
    try {
      const res = await api.post('/api/ghost-approver/analyse', { vendor, amount_inr: amount, category, requester });
      setAnalysis(res.data.data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleDecide = async (optionId: string) => {
    setLoading(true);
    try {
      const execPayload = analysis.analysis.options.find((o: any) => o.id === optionId)?.action_payload || {};
      const res = await api.post('/api/ghost-approver/decide', {
        vendor,
        chosen_option_id: optionId,
        savings_inr: analysis.analysis.options.find((o: any) => o.id === optionId)?.savings_inr || 0,
        ...execPayload,
        original_amount_inr: amount
      });
      setDecisionLog(res.data.data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-5 duration-500 max-w-5xl mx-auto">
      <div className="flex border-b border-slate-800 pb-4 items-center justify-between">
         <h1 className="text-3xl font-black text-indigo-400 flex items-center gap-3">
           <MessageSquare className="h-8 w-8 text-indigo-500" /> Ghost Approver
         </h1>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Simulator Form */}
        <div className="lg:col-span-4 bg-slate-800/40 p-5 rounded-2xl border border-slate-700/50 flex flex-col gap-4">
           <h3 className="text-slate-200 font-bold flex items-center gap-2 mb-2 uppercase text-xs tracking-widest"><Cpu className="w-4 h-4 text-indigo-400"/> New Request</h3>
           <div>
             <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Vendor/Service</label>
             <input className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none" 
               value={vendor} onChange={e => setVendor(e.target.value)} />
           </div>
           <div>
             <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Amount (INR)</label>
             <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono" 
               value={amount} onChange={e => setAmount(Number(e.target.value))} />
           </div>
           <div>
             <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Category</label>
             <select className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-indigo-500"
               value={category} onChange={e => setCategory(e.target.value)}>
               <option>SaaS</option>
               <option>Cloud Infrastructure</option>
               <option>Hardware</option>
             </select>
           </div>
           <div>
             <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Requested By</label>
             <input className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-400 cursor-not-allowed outline-none font-mono text-sm" 
               value={requester} readOnly />
           </div>
           <button 
             onClick={handleSimulate} disabled={loading}
             className="mt-4 w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-bold font-mono tracking-tight flex justify-center items-center gap-2 transition-all disabled:opacity-50"
           >
             {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Intercept & Analyze
           </button>
        </div>

        {/* Chat / Result View */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden relative shadow-2xl">
           <div className="bg-slate-800/80 px-4 py-3 border-b border-slate-700 flex items-center justify-between">
              <span className="font-mono text-sm font-semibold text-indigo-400 flex items-center gap-2"><Bot className="w-4 h-4" /> slack #approvals</span>
              {analysis && <span className="text-xs text-slate-500 font-mono">{analysis.latency_ms}ms</span>}
           </div>
           <div className="p-6 flex-1 overflow-y-auto space-y-6">
              
              {!analysis && !loading && (
                <div className="text-slate-600 text-center mt-20 flex flex-col items-center">
                  <ShieldAlert className="w-12 h-12 mb-3 opacity-20" />
                  <p>Awaiting invoice submission...</p>
                </div>
              )}

              {loading && !analysis && (
                <div className="flex gap-4 opacity-50 animate-pulse">
                  <div className="w-10 h-10 rounded-full bg-indigo-900 flex-shrink-0"></div>
                  <div className="flex-1 bg-slate-800 rounded-2xl rounded-tl-none p-4 h-32"></div>
                </div>
              )}

              {analysis && (
                <div className="animate-in slide-in-from-right-8 duration-300">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                      <Zap className="w-5 h-5 text-white fill-white" />
                    </div>
                    <div className="flex-1 space-y-3">
                       
                       {/* Slack Blocks Render Loop */}
                       {analysis.slack_blocks.map((block: any, idx: number) => {
                         if (block.type === 'section') {
                           return <div key={idx} className="bg-slate-800 text-slate-200 p-4 rounded-xl rounded-tl-none font-mono text-sm whitespace-pre-line border border-slate-700 shadow-md">
                             {block.text.text.replace(/\*/g, '')}
                           </div>;
                         }
                         if (block.type === 'context') {
                           return <div key={idx} className="text-xs text-slate-500 px-2 mt-1">{block.elements[0].text}</div>;
                         }
                         if (block.type === 'actions' && !decisionLog) {
                           return <div key={idx} className="flex flex-wrap gap-2 mt-4 pt-2">
                             {block.elements.map((btn: any, bIdx: number) => {
                               const isPrimary = btn.text.text.includes('Approve Reduced');
                               const isDanger = btn.text.text.includes('Switch');
                               return <button key={bIdx} onClick={() => handleDecide(btn.action_id)}
                                  className={`px-4 py-2 rounded-lg text-sm font-bold shadow-md transition-all
                                   ${isPrimary ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 
                                     isDanger ? 'bg-rose-900 text-rose-300 border border-rose-700 hover:bg-rose-800' : 'bg-slate-700 text-white hover:bg-slate-600'}`
                               }>{btn.text.text}</button>;
                             })}
                           </div>;
                         }
                         return null;
                       })}

                    </div>
                  </div>
                </div>
              )}

              {decisionLog && (
                <div className="animate-in slide-in-from-bottom-4 duration-300 ml-14">
                  <div className={`p-4 rounded-xl border font-mono text-sm max-w-lg mb-4 ${decisionLog.decision === 'approve_full' ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-emerald-950/40 text-emerald-300 border-emerald-900'}`}>
                     <CheckCircle className="w-4 h-4 inline mr-2 text-emerald-500"/>
                     {decisionLog.message}
                  </div>
                  
                  {decisionLog.execution_receipt && Object.keys(decisionLog.execution_receipt).length > 0 && (
                     <div className="bg-dark-900 p-4 border border-indigo-900 rounded-xl max-w-md font-mono text-xs text-indigo-200">
                        <div className="font-bold text-indigo-400 mb-2 uppercase tracking-widest flex items-center gap-2"><FileText className="w-3 h-3"/> KARMA Execution Receipt</div>
                        <pre className="whitespace-pre-wrap">{JSON.stringify(decisionLog.execution_receipt, null, 2)}</pre>
                     </div>
                  )}
                </div>
              )}

           </div>
        </div>
      </div>
    </div>
  );
}

const RefreshCw = ({ className }: {className?:string}) => <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
const CheckCircle = ({ className }: {className?:string}) => <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
