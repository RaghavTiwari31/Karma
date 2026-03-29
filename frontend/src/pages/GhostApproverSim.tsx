import React, { useEffect, useState, useRef } from 'react';
import { api } from '../api';
import { MessageSquare, Send, Bot, FileText, ShieldAlert, Zap, Cpu, Loader, CheckCircle } from 'lucide-react';

function AnalysingLoader() {
  const [elapsed, setElapsed] = useState(0);
  const [step, setStep] = useState(0);
  const steps = [
    "Pulling SAP utilisation data…",
    "Checking rate card benchmarks…",
    "Scanning for alternative vendors…",
    "Querying PO history…",
    "Running KARMA negotiation model…",
    "Preparing Slack options…"
  ];

  useEffect(() => {
    const timer = setInterval(() => setElapsed(e => e + 1), 1000);
    const stepper = setInterval(() => setStep(s => (s + 1) % steps.length), 1600);
    return () => { clearInterval(timer); clearInterval(stepper); };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-14 text-center gap-4">
      <div className="relative w-20 h-20 mb-2">
        <Loader className="w-20 h-20 text-indigo-500/30 animate-spin" />
        <Zap className="absolute inset-0 m-auto w-8 h-8 text-indigo-400" />
      </div>
      <p className="text-lg font-bold text-indigo-300 tracking-tight">KARMA is analysing…</p>
      <p className="text-sm text-slate-400 font-mono animate-pulse">{steps[step]}</p>
      <div className="mt-4 flex items-center gap-2">
        <span className="text-3xl font-black text-slate-200 font-mono tabular-nums">{elapsed}s</span>
        <span className="text-slate-500 text-sm">elapsed</span>
      </div>
    </div>
  );
}

export default function GhostApproverSim() {
  const [vendor, setVendor] = useState('Salesforce');
  const [amount, setAmount] = useState(1800000);
  const [category, setCategory] = useState('CRM');
  const [requester] = useState('finance@acme.com');

  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [decisionLog, setDecisionLog] = useState<any>(null);

  const PRESETS = [
    { label: 'Salesforce CRM', vendor: 'Salesforce', amount: 1800000, category: 'CRM' },
    { label: 'Zoom Comms', vendor: 'Zoom', amount: 180000, category: 'Comms' },
    { label: 'AWS Reserved', vendor: 'AWS Reserved', amount: 960000, category: 'Cloud Infrastructure' },
  ];

  const applyPreset = (p: typeof PRESETS[0]) => {
    setVendor(p.vendor);
    setAmount(p.amount);
    setCategory(p.category);
    setAnalysis(null);
    setDecisionLog(null);
  };

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

  const handleDecide = async (optionId: string, option: any) => {
    setLoading(true);
    try {
      // Extract numeric seats from strings like '32 active seats'
      const seatStr = option?.recommended_seats_or_size || '';
      const seatMatch = String(seatStr).match(/\d+/);
      const recommended_seats = seatMatch ? parseInt(seatMatch[0]) : null;
      
      const res = await api.post('/api/ghost-approver/decide', {
        vendor,
        category,
        chosen_option_id: optionId,
        savings_inr: option?.savings_inr || 0,
        available_savings_inr: analysis?.analysis?.max_savings_inr || 0,
        original_amount_inr: amount,
        execution_payload: option?.action_payload || analysis?.analysis?.execution_payload || {},
        recommended_seats,
      });
      setDecisionLog(res.data.data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const options: any[] = analysis?.analysis?.options || [];

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-5 duration-500 max-w-5xl mx-auto">
      <div className="flex border-b border-slate-800 pb-4 items-center justify-between">
         <h1 className="text-3xl font-black text-indigo-400 flex items-center gap-3">
           <MessageSquare className="h-8 w-8 text-indigo-500" /> Ghost Approver
         </h1>
         <p className="text-slate-500 text-sm">Interception layer — appears BEFORE money moves</p>
      </div>

      {/* Presets */}
      <div className="flex gap-2 flex-wrap">
        {PRESETS.map(p => (
          <button key={p.vendor} onClick={() => applyPreset(p)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${vendor === p.vendor ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-indigo-500'}`}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form */}
        <div className="lg:col-span-4 bg-slate-800/40 p-5 rounded-2xl border border-slate-700/50 flex flex-col gap-4">
           <h3 className="text-slate-200 font-bold flex items-center gap-2 mb-2 uppercase text-xs tracking-widest">
             <Cpu className="w-4 h-4 text-indigo-400"/> New Request
           </h3>
           <div>
             <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Vendor/Service</label>
             <input className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-indigo-500 outline-none"
               value={vendor} onChange={e => setVendor(e.target.value)} />
           </div>
           <div>
             <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Amount (INR)</label>
             <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-indigo-500 font-mono"
               value={amount} onChange={e => setAmount(Number(e.target.value))} />
           </div>
           <div>
             <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Category</label>
             <select className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-indigo-500"
               value={category} onChange={e => setCategory(e.target.value)}>
               <option>SaaS</option>
               <option>CRM</option>
               <option>Comms</option>
               <option>Cloud Infrastructure</option>
               <option>Hardware</option>
               <option>DevTools</option>
               <option>ProjectMgmt</option>
             </select>
           </div>
           <div>
             <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Requested By</label>
             <input className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-500 cursor-not-allowed outline-none font-mono text-sm"
               value={requester} readOnly />
           </div>
           <button
             onClick={handleSimulate} disabled={loading}
             className="mt-4 w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-bold font-mono tracking-tight flex justify-center items-center gap-2 transition-all disabled:opacity-50 shadow-lg shadow-indigo-900/30"
           >
             {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
             Intercept & Analyze
           </button>
        </div>

        {/* Chat Panel */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
           <div className="bg-slate-800/80 px-4 py-3 border-b border-slate-700 flex items-center justify-between">
              <span className="font-mono text-sm font-semibold text-indigo-400 flex items-center gap-2">
                <Bot className="w-4 h-4" /> slack #approvals
              </span>
              {analysis && (
                <span className="text-xs text-slate-500 font-mono bg-slate-900 px-2 py-1 rounded">
                  ⚡ {analysis.latency_ms || 0}ms
                </span>
              )}
           </div>
           <div className="p-6 flex-1 overflow-y-auto space-y-6 min-h-[420px]">

              {!analysis && !loading && (
                <div className="text-slate-600 text-center mt-20 flex flex-col items-center">
                  <ShieldAlert className="w-12 h-12 mb-3 opacity-20" />
                  <p className="text-slate-500">Submit an invoice to see KARMA intercept it...</p>
                  <p className="text-slate-700 text-xs mt-2 font-mono">Demo: select a quick preset above</p>
                </div>
              )}

              {loading && <AnalysingLoader />}

              {analysis && !loading && (
                <div className="animate-in slide-in-from-right-8 duration-300 space-y-4">
                  {/* Header insight */}
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                      <Zap className="w-5 h-5 text-white fill-white" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-indigo-400/80 font-mono mb-1">KARMA Ghost Approver · {new Date().toLocaleDateString()}</div>
                      <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold mb-3 ${
                        analysis?.analysis?.urgency_tag?.includes('🚨') ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                        analysis?.analysis?.urgency_tag?.includes('⚠️') ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                        'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      }`}>
                        {analysis?.analysis?.urgency_tag || '⚠️ REVIEW SUGGESTED'}
                      </div>
                      <div className="bg-slate-800 p-4 rounded-xl rounded-tl-none font-mono text-sm text-slate-200 border border-slate-700 leading-relaxed mb-3">
                        {analysis?.analysis?.header_insight}
                        <div className="mt-2 text-xs text-slate-500">
                          Confidence: {analysis?.analysis?.confidence || 0}/100 — {analysis?.analysis?.confidence_rationale}
                        </div>
                      </div>

                      {/* Options */}
                      {!decisionLog && options.length > 0 && (
                        <div className="space-y-3 mt-4">
                          {options.map((opt: any) => {
                            const isRecommended = opt.recommended;
                            const isFull = opt.option_id === 'approve_full';
                            const isSwitch = opt.option_id === 'switch_vendor';
                            return (
                              <div key={opt.option_id} className={`rounded-xl border p-4 transition-all ${isRecommended ? 'border-emerald-700 bg-emerald-950/30' : 'border-slate-700 bg-slate-800/50'}`}>
                                <div className="flex justify-between items-start mb-2">
                                  <span className={`font-bold text-sm ${isRecommended ? 'text-emerald-300' : 'text-slate-300'}`}>{opt.label}</span>
                                  {isRecommended && <span className="text-xs font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">RECOMMENDED</span>}
                                </div>
                                <p className="text-xs text-slate-400 font-mono mb-3 leading-relaxed">{opt.rationale}</p>
                                {opt.savings_inr > 0 && (
                                  <div className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded mb-3 ${opt.savings_verified !== false ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50' : 'bg-amber-950/60 text-amber-400 border border-amber-800/50'}`}>
                                    {opt.savings_verified !== false ? '✅ Savings Math-Verified' : '⚠️ Estimated (AI)'}
                                  </div>
                                )}
                                {opt.data_note && <p className="text-xs text-slate-600 italic mb-3">{opt.data_note}</p>}
                                <button
                                  onClick={() => handleDecide(opt.option_id, opt)}
                                  disabled={loading}
                                  className={`px-5 py-2 rounded-lg text-sm font-bold transition-all w-full ${
                                    isRecommended ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30' :
                                    isSwitch ? 'bg-slate-700 hover:bg-orange-900 text-orange-300 border border-orange-900/50' :
                                    'bg-slate-700 hover:bg-slate-600 text-slate-300'
                                  }`}
                                >
                                  {isFull ? `✓ Approve Full (₹${opt.savings_inr === 0 ? amount.toLocaleString() : ''})` :
                                   isRecommended ? `✅ ${opt.label.replace('✅ ', '')}` :
                                   opt.label}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {decisionLog && !loading && (
                <div className="animate-in slide-in-from-bottom-4 duration-300 ml-14 space-y-4">
                  <div className={`p-4 rounded-xl border font-mono text-sm ${decisionLog.decision === 'approve_full' ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-emerald-950/40 text-emerald-300 border-emerald-900/60'}`}>
                    <CheckCircle className="w-4 h-4 inline mr-2 text-emerald-500"/>
                    {decisionLog.message}
                  </div>
                  {decisionLog.execution_receipt && Object.keys(decisionLog.execution_receipt).length > 0 && (
                     <div className="bg-slate-950 p-4 border border-indigo-900/50 rounded-xl font-mono text-xs text-indigo-200">
                        <div className="font-bold text-indigo-400 mb-2 uppercase tracking-widest flex items-center gap-2">
                          <FileText className="w-3 h-3"/> KARMA Execution Receipt
                        </div>
                        <pre className="whitespace-pre-wrap leading-relaxed">{JSON.stringify(decisionLog.execution_receipt, null, 2)}</pre>
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
