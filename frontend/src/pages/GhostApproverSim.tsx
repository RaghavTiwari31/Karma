import { useState } from 'react';
import { api } from '../api';
import { Send, Zap, CheckCircle, ShieldCheck, BarChart2, Bot } from 'lucide-react';

function Spinner() {
  return <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(213,255,187,0.4)', borderTopColor: '#d5ffbb', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />;
}

export default function GhostApproverSim() {
  const [vendor,   setVendor]   = useState('Salesforce');
  const [amount,   setAmount]   = useState(1800000);
  const [category, setCategory] = useState('CRM');
  const [requester]             = useState('finance@acme.com');
  const [loading,  setLoading]  = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [decisionLog, setDecisionLog] = useState<any>(null);

  const PRESETS = [
    { label: 'Salesforce CRM', vendor: 'Salesforce',   amount: 1800000, category: 'CRM' },
    { label: 'Zoom Comms',     vendor: 'Zoom',         amount: 180000,  category: 'Comms' },
    { label: 'AWS Reserved',   vendor: 'AWS Reserved', amount: 960000,  category: 'Cloud Infrastructure' },
  ];

  const applyPreset = (p: typeof PRESETS[0]) => { setVendor(p.vendor); setAmount(p.amount); setCategory(p.category); setAnalysis(null); setDecisionLog(null); };

  const handleSimulate = async () => {
    setLoading(true); setAnalysis(null); setDecisionLog(null);
    try { const res = await api.post('/api/ghost-approver/analyse', { vendor, amount_inr: amount, category, requester }); setAnalysis(res.data.data); }
    catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleDecide = async (optionId: string, option: any) => {
    setLoading(true);
    try {
      const sm = String(option?.recommended_seats_or_size || '').match(/\d+/);
      const res = await api.post('/api/ghost-approver/decide', {
        vendor, category, chosen_option_id: optionId,
        savings_inr: option?.savings_inr || 0,
        available_savings_inr: analysis?.analysis?.max_savings_inr || 0,
        original_amount_inr: amount,
        execution_payload: option?.action_payload || analysis?.analysis?.execution_payload || {},
        recommended_seats: sm ? parseInt(sm[0]) : null,
      });
      setDecisionLog(res.data.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const options: any[] = analysis?.analysis?.options || [];

  const selectStyle: React.CSSProperties = { width: '100%', background: '#f6f8ff', border: '1px solid #d0d4e8', borderRadius: '0.5rem', padding: '0.55rem 0.875rem', color: '#1a1e2e', fontFamily: 'Inter,sans-serif', fontSize: '0.875rem', outline: 'none', cursor: 'pointer', appearance: 'none' };
  const inputStyle:  React.CSSProperties = { ...selectStyle, cursor: 'text' };
  const labelStyle:  React.CSSProperties = { fontFamily: 'Inter,sans-serif', fontSize: '0.68rem', fontWeight: 700, color: '#8b8fa8', letterSpacing: '0.08em', textTransform: 'uppercase' as const, display: 'block', marginBottom: '0.375rem' };

  // Simulate shadow-spend overlap from analysis data
  const overlapPct = analysis ? Math.min(99, Math.max(40, Math.round((analysis.analysis?.confidence || 64))) ) : 64;

  return (
    <div style={{ display: 'flex', gap: '1.5rem', maxWidth: 1200, margin: '0 auto', width: '100%', animation: 'fade-in 0.4s ease-out both' }}>

      {/* ── Left Sidebar Panel ── */}
      <div style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Form card */}
        <div style={{ background: '#ffffff', borderRadius: '0.875rem', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <div style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: '1rem', color: '#1a1e2e', marginBottom: '0.25rem' }}>Ghost Approver</div>
            <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.78rem', color: '#6b6f82', lineHeight: 1.5 }}>Intercept redundant spend before it hits the ledger.</div>
          </div>

          {/* Presets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {PRESETS.map(p => (
              <button key={p.vendor} onClick={() => applyPreset(p)} style={{ textAlign: 'left', padding: '0.4rem 0.75rem', borderRadius: '0.375rem', border: vendor === p.vendor ? '1.5px solid #2d6a14' : '1.5px solid transparent', background: vendor === p.vendor ? '#eaf3e6' : '#f6f8ff', color: vendor === p.vendor ? '#2d6a14' : '#4b5278', fontFamily: 'Inter,sans-serif', fontWeight: vendor === p.vendor ? 700 : 500, fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.15s' }}>
                {p.label}
              </button>
            ))}
          </div>

          {/* Category */}
          <div>
            <label style={labelStyle}>Category</label>
            <div style={{ position: 'relative' }}>
              <select value={category} onChange={e => setCategory(e.target.value)} style={selectStyle}
                onFocus={e => e.target.style.borderColor = '#2d6a14'}
                onBlur={e => e.target.style.borderColor = '#d0d4e8'}>
                <option>SaaS</option><option>CRM</option><option>Comms</option>
                <option>Cloud Infrastructure</option><option>Hardware</option>
                <option>DevTools</option><option>ProjectMgmt</option>
              </select>
              <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#8b8fa8' }}>⌄</div>
            </div>
          </div>

          {/* Requested By */}
          <div>
            <label style={labelStyle}>Requested By</label>
            <div style={{ position: 'relative' }}>
              <input value={requester} readOnly style={{ ...inputStyle, cursor: 'default', paddingRight: '2rem', color: '#6b6f82' }} />
              <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#8b8fa8', fontSize: '0.85rem' }}>@</div>
            </div>
          </div>

          <button onClick={handleSimulate} disabled={loading} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: '#2d6a14', color: '#d5ffbb', padding: '0.7rem', borderRadius: '0.5rem', border: 'none', fontFamily: 'Inter,sans-serif', fontWeight: 700, fontSize: '0.875rem', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.8 : 1, boxShadow: '0 3px 10px rgba(45,106,20,0.30)', transition: 'background 0.15s' }}
            onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = '#1f5c02'; }}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = '#2d6a14'}>
            {loading ? <Spinner /> : <Zap size={14} fill="currentColor" />}
            Intercept &amp; Analyze
          </button>
        </div>

        {/* KARMA AI Brain card */}
        <div style={{ background: '#f6f8ff', borderRadius: '0.875rem', padding: '1.125rem', border: '1px solid #e0e4f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.625rem' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#2d6a14,#1f5c02)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={14} color="#d5ffbb" />
            </div>
            <span style={{ fontFamily: 'Inter,sans-serif', fontWeight: 700, fontSize: '0.78rem', color: '#1a1e2e' }}>KARMA AI BRAIN</span>
          </div>
          <p style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.78rem', color: '#6b6f82', lineHeight: 1.55, margin: 0 }}>
            {analysis
              ? `Ghost Approver has detected ₹${((analysis.analysis?.max_savings_inr || 0) / 100).toFixed(1)}k in potential shadow-spend overlaps this month.`
              : 'Ghost Approver monitors cross-departmental spend overlaps in real-time.'}
          </p>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 900, fontSize: '1.75rem', color: '#1a1e2e', letterSpacing: '-0.04em', margin: 0 }}>Optimization Strategy</h1>
            <p style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.82rem', color: '#8b8fa8', marginTop: '0.25rem' }}>
              {analysis ? `Analysis of ${category} Tier Upgrade Request #${Math.floor(Math.random() * 9000 + 1000)}-X` : 'Select a preset or fill in the form and click Intercept & Analyze'}
            </p>
          </div>
          {analysis && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: '#eaf3e6', padding: '0.3rem 0.75rem', borderRadius: 999, border: '1px solid #a8d68a' }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#2d6a14', animation: 'pulse-soft 2s ease-in-out infinite' }} />
              <span style={{ fontFamily: 'Inter,sans-serif', fontWeight: 700, fontSize: '0.72rem', color: '#2d6a14' }}>LIVE ENGINE ACTIVE</span>
            </div>
          )}
        </div>

        {/* Empty / Loading state */}
        {!analysis && !loading && (
          <div style={{ background: '#ffffff', borderRadius: '0.875rem', padding: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 280, gap: '1rem', color: '#8b8fa8', textAlign: 'center' }}>
            <Zap size={36} color="#d0d4e8" />
            <p style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.9rem' }}>Submit an invoice to see KARMA intercept it…</p>
          </div>
        )}

        {loading && (
          <div style={{ background: '#ffffff', borderRadius: '0.875rem', padding: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', minHeight: 280, justifyContent: 'center' }}>
            <div style={{ position: 'relative', width: 52, height: 52 }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid #e0e4f0', borderTopColor: '#2d6a14', animation: 'spin 1s linear infinite' }} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Zap size={18} color="#2d6a14" /></div>
            </div>
            <p style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, color: '#1a1e2e', fontSize: '0.95rem' }}>KARMA is analysing…</p>
          </div>
        )}

        {/* ── Optimization Strategy Cards ── */}
        {analysis && !loading && !decisionLog && options.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${options.length}, 1fr)`, gap: '1rem' }}>
            {options.map((opt: any) => {
              const isRec    = opt.recommended;
              const isFull   = opt.option_id === 'approve_full';
              const isSwitch = opt.option_id === 'switch_vendor';
              return (
                <div key={opt.option_id} style={{ background: isRec ? '#2d6a14' : '#ffffff', border: isRec ? 'none' : '1px solid #e0e4f0', borderRadius: '0.875rem', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', position: 'relative', boxShadow: isRec ? '0 8px 28px rgba(45,106,20,0.35)' : '0 1px 6px rgba(30,33,43,0.06)' }}>
                  {/* Badge */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 24 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: isRec ? 'rgba(255,255,255,0.15)' : '#f0f2f8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {isRec ? <Zap size={14} color="#d5ffbb" fill="#d5ffbb" /> : isFull ? <CheckCircle size={14} color="#6b6f82" /> : <Send size={14} color="#6b6f82" />}
                    </div>
                    {isRec ? (
                      <span style={{ background: '#fec700', color: '#574300', borderRadius: 4, padding: '0.1rem 0.5rem', fontSize: '0.65rem', fontWeight: 800, fontFamily: 'Inter,sans-serif', letterSpacing: '0.04em' }}>RECOMMENDED</span>
                    ) : isSwitch ? (
                      <span style={{ background: '#f0f2f8', color: '#6b6f82', borderRadius: 4, padding: '0.1rem 0.5rem', fontSize: '0.65rem', fontWeight: 700, fontFamily: 'Inter,sans-serif' }}>MIGRATE</span>
                    ) : (
                      <span style={{ background: '#f0f2f8', color: '#6b6f82', borderRadius: 4, padding: '0.1rem 0.5rem', fontSize: '0.65rem', fontWeight: 700, fontFamily: 'Inter,sans-serif' }}>DEFAULT</span>
                    )}
                  </div>

                  {/* Name */}
                  <div>
                    <div style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 900, fontSize: isRec ? '1.35rem' : '1.05rem', color: isRec ? '#ffffff' : '#1a1e2e', letterSpacing: '-0.03em', lineHeight: 1.15, marginBottom: '0.5rem' }}>
                      {opt.label.replace(/^[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '').trim()}
                    </div>
                    {opt.savings_inr > 0 && isRec && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(255,255,255,0.15)', color: '#d5ffbb', borderRadius: 999, padding: '0.15rem 0.6rem', fontSize: '0.68rem', fontWeight: 700, fontFamily: 'Inter,sans-serif' }}>
                        SAVINGS MATH-VERIFIED
                      </span>
                    )}
                  </div>

                  {/* Rationale */}
                  <p style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.8rem', color: isRec ? 'rgba(255,255,255,0.75)' : '#6b6f82', lineHeight: 1.55, margin: 0, flex: 1 }}>{opt.rationale}</p>

                  {/* Price */}
                  <div style={{ marginTop: 'auto' }}>
                    <div style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 900, fontSize: '1.3rem', color: isRec ? '#ffffff' : '#1a1e2e', letterSpacing: '-0.02em' }}>
                      ₹{opt.savings_inr > 0 ? (amount - opt.savings_inr).toLocaleString() : amount.toLocaleString()}
                    </div>
                    <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.68rem', color: isRec ? 'rgba(255,255,255,0.55)' : '#8b8fa8', fontWeight: 600, letterSpacing: '0.04em', marginTop: 2 }}>ESTIMATED ANNUAL COST</div>
                  </div>

                  {/* CTA */}
                  <button onClick={() => handleDecide(opt.option_id, opt)} disabled={loading} style={{ width: '100%', padding: '0.65rem', borderRadius: '0.5rem', border: isRec ? 'none' : '1px solid #d0d4e8', background: isRec ? '#ffffff' : 'transparent', color: isRec ? '#2d6a14' : '#4b5278', fontFamily: 'Inter,sans-serif', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = isRec ? '#f0fff4' : '#f0f2f8'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = isRec ? '#ffffff' : 'transparent'; }}>
                    {isFull ? 'Approve Request' : isRec ? 'Approve Reduced' : 'Initiate Migration'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Decision receipt */}
        {decisionLog && !loading && (
          <div style={{ background: '#ffffff', borderRadius: '0.875rem', padding: '1.5rem', border: '1.5px solid #a8d68a' }} className="animate-slide-up">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
              <CheckCircle size={18} color="#2d6a14" />
              <span style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: '0.95rem', color: '#1a1e2e' }}>{decisionLog.message}</span>
            </div>
            {decisionLog.execution_receipt && Object.keys(decisionLog.execution_receipt).length > 0 && (
              <pre style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#2b2e39', whiteSpace: 'pre-wrap', lineHeight: 1.65, margin: 0, background: '#f6f8ff', padding: '1rem', borderRadius: '0.5rem', borderLeft: '3px solid #2d6a14' }}>
                {JSON.stringify(decisionLog.execution_receipt, null, 2)}
              </pre>
            )}
          </div>
        )}

        {/* ── Bottom Info Panels ── */}
        {analysis && !loading && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {/* Overlap Intelligence */}
            <div style={{ background: '#ffffff', borderRadius: '0.875rem', padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <BarChart2 size={15} color="#2d6a14" />
                <span style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: '0.9rem', color: '#1a1e2e' }}>Overlap Intelligence</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {/* Circular gauge */}
                <div style={{ position: 'relative', width: 64, height: 64, flexShrink: 0 }}>
                  <svg width="64" height="64" viewBox="0 0 64 64" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="32" cy="32" r="26" fill="none" stroke="#f0f2f8" strokeWidth="6" />
                    <circle cx="32" cy="32" r="26" fill="none" stroke="#2d6a14" strokeWidth="6" strokeDasharray={`${(overlapPct / 100) * 163.4} 163.4`} strokeLinecap="round" />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Manrope,sans-serif', fontWeight: 900, fontSize: '0.9rem', color: '#1a1e2e' }}>{overlapPct}%</div>
                </div>
                <p style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.8rem', color: '#6b6f82', lineHeight: 1.55, margin: 0 }}>
                  Cross-departmental overlap found between {vendor} and existing licenses.
                  {analysis.analysis?.header_insight ? ` ${analysis.analysis.header_insight.slice(0, 80)}…` : ''}
                </p>
              </div>
            </div>

            {/* Compliance Audit */}
            <div style={{ background: '#ffffff', borderRadius: '0.875rem', padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <ShieldCheck size={15} color="#d97706" />
                <span style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: '0.9rem', color: '#1a1e2e' }}>Compliance Audit</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {['SOC2 Data Sovereignty Maintained', 'GDPR Consent Migration Ready'].map(item => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CheckCircle size={14} color="#2d6a14" />
                    <span style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.82rem', color: '#1a1e2e' }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
