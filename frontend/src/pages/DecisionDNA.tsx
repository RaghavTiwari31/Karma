import { useEffect, useState } from 'react';
import { api } from '../api';
import { Search, Database, BarChart2, Lock, Zap, ShieldCheck, GitBranch } from 'lucide-react';

/* ─── Audit step icons ─── */
const AUDIT_STEPS = [
  { time: '14:02:11', label: 'Policy Validation',  sub: 'SOC2 Compliant',      icon: Search,    done: true },
  { time: '14:02:12', label: 'Volume Analysis',    sub: 'EBS Optimizing',       icon: Database,  done: true },
  { time: '14:02:15', label: 'Price Comparison',   sub: 'Spot vs RI Sweep',     icon: BarChart2, done: true },
  { time: 'Pending',  label: 'Immutable Commit',   sub: 'Awaiting Execution',   icon: Lock,      done: false },
];

export default function DecisionDNA() {
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    api.get('/api/decision-dna').then(res => {
      setTimeline(res.data.data.results || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: '1rem' }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #2d6a14', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
      <p style={{ color: '#6b6f82', fontFamily: 'Inter,sans-serif' }}>Reconstructing DNA…</p>
    </div>
  );

  const item  = timeline[activeIdx] || null;
  const items = timeline.length > 0 ? timeline : [];

  // Derived stats from item
  const confidence  = item ? Math.min(99.9, 90 + (item.context_missing?.length || 0) * 1.5).toFixed(1) : '98.4';
  const estSavings  = item ? `₹${(Math.abs(item.cost_impact_inr || item.money_leaked_inr || 12400) / 1000).toFixed(1)}k` : '₹12.4k';
  const histLabel   = item?.context_missing?.length > 1 ? 'Medium' : 'High';
  const histPaths   = `${(item?.context_missing?.length || 2) * 1.2}k similar paths`;
  const vendorLabel = item ? `${item.actor || item.vendor || 'AWS Production'} ${item.category || 'Environment'}` : 'AWS Production Cluster-04';
  const aiSuggestion = item?.karma_intervention || item?.karma_fix_annotation || 'Automated Spot-Migration: Reduce reserved capacity by 42%';
  const humanBaseline = item?.action || item?.decision_taken || 'Standard On-Demand approval without utilisation analysis';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: 1200, margin: '0 auto', width: '100%', animation: 'fade-in 0.4s ease-out both' }}>

      {/* ── Header Row ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1.5rem' }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 900, fontSize: '2rem', color: '#1a1e2e', letterSpacing: '-0.04em', margin: '0 0 0.375rem' }}>Decision DNA</h1>
          <p style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.875rem', color: '#6b6f82', margin: 0, lineHeight: 1.5 }}>
            Visualizing the logical helix of AI-driven cost optimizations for {vendorLabel}.
          </p>
          {/* Vendor selector pills */}
          {items.length > 1 && (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
              {items.slice(0, 5).map((t: any, i: number) => (
                <button key={i} onClick={() => { setActiveIdx(i); setAuthorized(false); }}
                  style={{ fontFamily: 'Inter,sans-serif', fontWeight: 700, fontSize: '0.72rem', padding: '0.25rem 0.75rem', borderRadius: 999, border: 'none', cursor: 'pointer', transition: 'all 0.15s', background: activeIdx === i ? '#1a1e2e' : '#eceef6', color: activeIdx === i ? '#ffffff' : '#6b6f82' }}>
                  {t.vendor}
                </button>
              ))}
            </div>
          )}
        </div>
        {/* Stats */}
        <div style={{ display: 'flex', gap: '1rem', flexShrink: 0 }}>
          <div style={{ background: '#ffffff', borderRadius: '0.75rem', padding: '0.875rem 1.25rem', textAlign: 'center', minWidth: 110, border: '1px solid #eceef6' }}>
            <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.65rem', fontWeight: 700, color: '#8b8fa8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>CONFIDENCE</div>
            <div style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 900, fontSize: '1.5rem', color: '#2d6a14', letterSpacing: '-0.03em' }}>{confidence}%</div>
          </div>
          <div style={{ background: '#ffffff', borderRadius: '0.75rem', padding: '0.875rem 1.25rem', textAlign: 'center', minWidth: 110, border: '1px solid #eceef6' }}>
            <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.65rem', fontWeight: 700, color: '#8b8fa8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>EST. SAVINGS</div>
            <div style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 900, fontSize: '1.5rem', color: '#1a1e2e', letterSpacing: '-0.03em' }}>{estSavings}</div>
          </div>
        </div>
      </div>

      {/* ── Main row: DNA viz + Right panel ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.25rem' }}>

        {/* ── DNA Visualization ── */}
        <div style={{ background: '#ffffff', borderRadius: '0.875rem', padding: '2rem', position: 'relative', overflow: 'hidden', minHeight: 380 }}>

          {/* Live logic processing badge */}
          <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: '#f6f8ff', border: '1px solid #e0e4f0', borderRadius: '0.625rem', padding: '0.625rem 1rem', minWidth: 180 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.5rem' }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#2d6a14', animation: 'pulse-soft 2s ease-in-out infinite' }} />
              <span style={{ fontFamily: 'Inter,sans-serif', fontWeight: 700, fontSize: '0.72rem', color: '#1a1e2e' }}>Live Logic Processing</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <div style={{ height: 3, borderRadius: 999, background: '#e0e4f0', overflow: 'hidden' }}><div style={{ height: '100%', width: '75%', background: '#2d6a14', borderRadius: 999 }} /></div>
              <div style={{ height: 3, borderRadius: 999, background: '#e0e4f0', overflow: 'hidden' }}><div style={{ height: '100%', width: '45%', background: '#8b8fa8', borderRadius: 999 }} /></div>
            </div>
          </div>

          {/* Three-node DNA diagram */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginTop: '3rem', marginBottom: '2rem', position: 'relative' }}>

            {/* Dashed connecting line behind nodes */}
            <div style={{ position: 'absolute', top: '50%', left: '10%', right: '10%', height: 0, borderTop: '2.5px dashed #d97706', transform: 'translateY(-50%)', zIndex: 0, opacity: 0.7 }} />

            {/* History node - left */}
            <div style={{ background: '#ffffff', border: '2px solid #e0e4f0', borderRadius: '0.875rem', padding: '1.25rem', minWidth: 130, textAlign: 'center', zIndex: 1, boxShadow: '0 4px 16px rgba(30,33,43,0.08)', flex: 1, maxWidth: 170 }}>
              <div style={{ marginBottom: '0.625rem' }}>
                <ShieldCheck size={22} color="#2d6a14" style={{ margin: '0 auto' }} />
              </div>
              <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.65rem', fontWeight: 700, color: '#8b8fa8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.375rem' }}>HISTORY</div>
              <div style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 900, fontSize: '1.25rem', color: '#1a1e2e' }}>{histLabel}</div>
              <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.75rem', color: '#6b6f82', marginTop: '0.5rem' }}>Historical Confidence</div>
              <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.72rem', color: '#8b8fa8' }}>{histPaths}</div>
            </div>

            {/* Center DNA ACTIVE node */}
            <div style={{ background: '#2d6a14', borderRadius: '0.875rem', padding: '1.5rem 1.25rem', minWidth: 155, textAlign: 'center', zIndex: 2, boxShadow: '0 8px 28px rgba(45,106,20,0.40)', border: '2px solid #4a8a30', flex: 1, maxWidth: 190, margin: '0 -4px' }}>
              <div style={{ marginBottom: '0.75rem' }}>
                <GitBranch size={28} color="#d5ffbb" style={{ margin: '0 auto' }} />
              </div>
              <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.62rem', fontWeight: 700, color: 'rgba(213,255,187,0.7)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '0.375rem' }}>DECISION DNA</div>
              <div style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 900, fontSize: '1.35rem', color: '#ffffff', letterSpacing: '-0.02em' }}>ACTIVE</div>
            </div>

            {/* SLA Safety node - right */}
            <div style={{ background: '#ffffff', border: '2px solid #e0e4f0', borderRadius: '0.875rem', padding: '1.25rem', minWidth: 130, textAlign: 'center', zIndex: 1, boxShadow: '0 4px 16px rgba(30,33,43,0.08)', flex: 1, maxWidth: 170 }}>
              <div style={{ marginBottom: '0.625rem' }}>
                {/* SLA gauge arc */}
                <svg width="32" height="32" viewBox="0 0 32 32" style={{ margin: '0 auto', display: 'block' }}>
                  <circle cx="16" cy="16" r="13" fill="none" stroke="#f0f2f8" strokeWidth="4" />
                  <circle cx="16" cy="16" r="13" fill="none" stroke="#d97706" strokeWidth="4" strokeDasharray="4 78" strokeLinecap="round" transform="rotate(-90 16 16)" />
                </svg>
              </div>
              <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.65rem', fontWeight: 700, color: '#8b8fa8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.375rem' }}>SLA SAFETY</div>
              <div style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 900, fontSize: '1.25rem', color: '#1a1e2e' }}>0.02%</div>
              <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.75rem', color: '#6b6f82', marginTop: '0.5rem' }}>SLA Impact</div>
              <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.72rem', color: '#8b8fa8' }}>Latency buffer intact</div>
            </div>
          </div>

          {/* Amber dot trail at bottom */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingRight: '8%', gap: '4px', opacity: 0.7 }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} style={{ width: i === 4 ? 10 : 6, height: i === 4 ? 10 : 6, borderRadius: '50%', background: '#d97706', opacity: 0.3 + i * 0.15 }} />
            ))}
          </div>
        </div>

        {/* ── Right Panel: Execution Comparison ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ background: '#ffffff', borderRadius: '0.875rem', padding: '1.25rem', flex: 1, border: '1px solid #eceef6' }}>
            <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: '1rem', color: '#1a1e2e', marginBottom: '1.25rem' }}>Execution Comparison</h3>

            {/* AI Suggestion */}
            <div style={{ display: 'flex', gap: '0.875rem', marginBottom: '1.25rem', paddingBottom: '1.25rem', borderBottom: '1px solid #f0f2f8' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#2d6a14', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                <span style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.6rem', fontWeight: 900, color: '#d5ffbb' }}>AI</span>
              </div>
              <div>
                <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.62rem', fontWeight: 700, color: '#8b8fa8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>AI SUGGESTION</div>
                <div style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: '1rem', color: '#1a1e2e', lineHeight: 1.25, marginBottom: '0.5rem' }}>
                  {aiSuggestion.length > 60 ? aiSuggestion.slice(0, 60) + '…' : aiSuggestion}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ background: '#eaf3e6', color: '#2d6a14', borderRadius: 999, padding: '0.15rem 0.6rem', fontFamily: 'Inter,sans-serif', fontSize: '0.7rem', fontWeight: 700 }}>Save 42%</span>
                  <span style={{ background: '#f0f2f8', color: '#6b6f82', borderRadius: 999, padding: '0.15rem 0.6rem', fontFamily: 'Inter,sans-serif', fontSize: '0.7rem', fontWeight: 600 }}>0 ms delay</span>
                </div>
              </div>
            </div>

            {/* Human Baseline */}
            <div style={{ display: 'flex', gap: '0.875rem' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#e0e4f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                <span style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.6rem', fontWeight: 900, color: '#6b6f82' }}>H</span>
              </div>
              <div>
                <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.62rem', fontWeight: 700, color: '#8b8fa8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>HUMAN BASELINE</div>
                <div style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: '1rem', color: '#1a1e2e', lineHeight: 1.25, marginBottom: '0.5rem' }}>
                  {humanBaseline.length > 60 ? humanBaseline.slice(0, 60) + '…' : humanBaseline}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <span style={{ background: '#f0f2f8', color: '#6b6f82', borderRadius: 999, padding: '0.15rem 0.6rem', fontFamily: 'Inter,sans-serif', fontSize: '0.7rem', fontWeight: 600 }}>Baseline</span>
                  <span style={{ background: '#f0f2f8', color: '#8b8fa8', borderRadius: 999, padding: '0.15rem 0.6rem', fontFamily: 'Inter,sans-serif', fontSize: '0.7rem', fontWeight: 600 }}>Manual Approval</span>
                </div>
              </div>
            </div>
          </div>

          {/* Authorize Button */}
          <button onClick={() => setAuthorized(true)} disabled={authorized}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: authorized ? '#8b8fa8' : '#2d6a14', color: authorized ? '#f0f2f8' : '#d5ffbb', padding: '0.875rem', borderRadius: '0.75rem', border: 'none', fontFamily: 'Inter,sans-serif', fontWeight: 700, fontSize: '0.95rem', cursor: authorized ? 'default' : 'pointer', boxShadow: authorized ? 'none' : '0 4px 14px rgba(45,106,20,0.40)', transition: 'background 0.15s' }}>
            <Zap size={16} fill="currentColor" /> {authorized ? '✓ Strategy Authorized' : 'Authorize Strategy'}
          </button>

          {/* AI Insight bubble */}
          <div style={{ background: '#ffffff', borderRadius: '0.875rem', border: '3px solid #fec700', overflow: 'hidden' }}>
            <div style={{ background: '#fec700', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <img src="/insight-icon.png" alt="Insight Icon" style={{ width: 22, height: 22, objectFit: 'contain' }} />
              <div style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: '0.95rem', color: '#000000' }}>AI Insight</div>
            </div>
            <div style={{ padding: '0.875rem 1rem' }}>
              <p style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.78rem', color: '#6b6f82', lineHeight: 1.55, margin: 0, textAlign: 'center' }}>
                {item?.context_human_missed?.[0]
                  ? item.context_human_missed[0]
                  : `Moving to t3.large nodes would improve DNA confidence to 99.2% due to higher historical uptime in us-east-1.`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Decision Audit Trail ── */}
      <div style={{ background: '#ffffff', borderRadius: '0.875rem', padding: '1.5rem', border: '1px solid #eceef6' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <ShieldCheck size={16} color="#6b6f82" />
          <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: '1rem', color: '#1a1e2e', margin: 0 }}>Decision Audit Trail</h3>
        </div>

        {/* Build audit trail from API data if available, otherwise use static */}
        {(() => {
          const humanKnew: string[] = item?.context_human_had || [];
          const auditSteps = AUDIT_STEPS.map((step, i) => ({
            ...step,
            sub: humanKnew[i] ? humanKnew[i].slice(0, 28) : step.sub,
          }));
          return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
              {auditSteps.map((step, i) => (
                <div key={i} style={{ background: step.done ? '#f6f8ff' : '#fafafa', borderRadius: '0.75rem', padding: '1.125rem', textAlign: 'center', border: `1px solid ${step.done ? '#e0e4f0' : '#f0f2f8'}`, position: 'relative', opacity: step.done ? 1 : 0.65 }}>
                  {!step.done && (
                    <div style={{ position: 'absolute', top: '0.625rem', right: '0.75rem', fontFamily: 'Inter,sans-serif', fontSize: '0.65rem', fontWeight: 700, color: '#8b8fa8', letterSpacing: '0.06em' }}>Pending</div>
                  )}
                  <div style={{ fontFamily: 'Inter,monospace,sans-serif', fontSize: '0.72rem', color: step.done ? '#6b6f82' : '#8b8fa8', marginBottom: '0.625rem' }}>{step.time}</div>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: step.done ? '#eaf3e6' : '#eceef6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.625rem' }}>
                    <step.icon size={15} color={step.done ? '#2d6a14' : '#8b8fa8'} />
                  </div>
                  <div style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: '0.85rem', color: '#1a1e2e', marginBottom: '0.25rem' }}>{step.label}</div>
                  <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.75rem', color: '#6b6f82' }}>{step.sub}</div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* ── Past decisions (collapsible) ── */}
      <div>
        <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: '0.95rem', color: '#1a1e2e', marginBottom: '0.875rem' }}>All Reconstruction Logs</h3>
        
        {items.length === 0 ? (
          <div style={{ background: '#ffffff', borderRadius: '0.875rem', padding: '2rem', textAlign: 'center', border: '1px dashed #d0d4e8' }}>
            <div style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: '1.1rem', color: '#1a1e2e', marginBottom: '0.5rem' }}>There is nothing to show.</div>
            <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.85rem', color: '#6b6f82' }}>
              Logs are filled when KARMA automatically reconstructs a decision pipeline after an overrun event,<br/>or when the background API engine dispatches historical scenario workflows.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {items.map((t: any, i: number) => (
              <div key={i} onClick={() => { setActiveIdx(i); setAuthorized(false); }}
                style={{ background: activeIdx === i ? '#eaf3e6' : '#ffffff', borderRadius: '0.75rem', padding: '0.875rem 1.125rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', border: `1px solid ${activeIdx === i ? '#a8d68a' : '#eceef6'}`, transition: 'all 0.15s' }}>
                <div>
                  <div style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: '0.9rem', color: '#1a1e2e' }}>
                    {t.actor || `Actor ${t.step || i+1}`} <span style={{ color: '#8b8fa8', fontWeight: 500, textTransform: 'uppercase', fontSize: '0.75rem' }}> • {t.context_visibility || 'Partial'}</span>
                  </div>
                  <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.75rem', color: '#6b6f82', marginTop: 2, maxWidth: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.action || t.decision_taken}
                  </div>
                </div>
                <div style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 900, fontSize: '1rem', color: '#ef4444', flexShrink: 0, marginLeft: '1rem' }}>
                  ₹{Math.abs(t.cost_impact_inr || t.money_leaked_inr || 0).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
