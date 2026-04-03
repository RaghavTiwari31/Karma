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

  const confidence  = item ? Math.min(99.9, 90 + (item.context_missing?.length || 0) * 1.5).toFixed(1) : '98.4';
  const estSavings  = item ? `₹${(Math.abs(item.cost_impact_inr || item.money_leaked_inr || 12400) / 1000).toFixed(1)}k` : '₹12.4k';
  const histLabel   = item?.historical_confidence_rating || 'High';
  const histPaths   = item?.historical_paths_count ? `${(item.historical_paths_count / 1000).toFixed(1)}k similar paths` : '2.4k similar paths';
  const slaImpactPct = item?.sla_impact_pct ? `${item.sla_impact_pct}%` : '0.02%';
  const slaImpactMsg = item?.sla_impact_msg || 'Latency buffer intact';
  const vendorLabel = item ? `${item.actor || item.vendor || 'AWS Production'} ${item.category || 'Environment'}` : 'AWS Production Cluster-04';
  const aiSuggestion = item?.karma_intervention || item?.karma_fix_annotation || 'Automated Spot-Migration: Reduce reserved capacity by 42%';
  const humanBaseline = item?.action || item?.decision_taken || 'Standard On-Demand approval without utilisation analysis';
  const aiStrategyName = item?.karma_intervention ? (item.context_visibility === 'blind' ? 'Real-Time Block' : 'Cost Enforcement') : 'Automated Action';
  const aiInsightText = item?.missing_context?.length ? `KARMA would have explicitly shown: ${item.missing_context.join(', ')}.` : (item?.context_human_missed?.[0] || `Cost and utilization tracking enabled to improve DNA confidence to 99.2%.`);
  const humanMethodName = item?.context_visibility === 'blind' ? 'Blind Execution' : (item?.context_visibility === 'partial' ? 'Partial Check' : 'Standard Routine');
  const humanInsightText = item?.note || `Standard manual approval process exposes the system to severe cost leakage during active traffic spikes.`;
  const aiSpeed = item?.intervention_timing || 'Instant';
  const costImpactPct = item?.cost_impact_inr ? `${item.cost_impact_inr < 0 ? '' : '+'}${(item.cost_impact_inr / 5000).toFixed(1)}%` : '-42.8%';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: 1200, margin: '0 auto', width: '100%', animation: 'fade-in 0.4s ease-out both' }}>

      {/* ── Header Row ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1.5rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 900, fontSize: '2rem', color: '#1a1e2e', letterSpacing: '-0.04em', margin: '0 0 0.375rem' }}>Decision DNA</h1>
          <p style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.875rem', color: '#6b6f82', margin: 0, lineHeight: 1.5 }}>
            Visualizing the logical helix of AI-driven cost optimizations for {vendorLabel}.
          </p>
        </div>
        {/* Stats */}
        <div style={{ display: 'flex', gap: '1rem', flexShrink: 0, alignItems: 'stretch' }}>
          {/* Moved ACTIVE node */}
          <div style={{ background: '#2d6a14', borderRadius: '0.75rem', padding: '0.875rem 1.25rem', textAlign: 'center', border: '2px solid #4a8a30', boxShadow: '0 4px 12px rgba(45,106,20,0.20)', minWidth: 110, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.65rem', fontWeight: 800, color: '#d5ffbb', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>DECISION DNA</div>
            <div style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 900, fontSize: '1.25rem', color: '#ffffff', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.375rem', justifyContent: 'center' }}>
              <GitBranch size={18} color="#d5ffbb" /> ACTIVE
            </div>
          </div>
          <div style={{ background: '#ffffff', borderRadius: '0.75rem', padding: '0.875rem 1.25rem', textAlign: 'center', minWidth: 110, border: '1px solid #eceef6', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.65rem', fontWeight: 800, color: '#8b8fa8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>CONFIDENCE</div>
            <div style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 900, fontSize: '1.45rem', color: '#2d6a14', letterSpacing: '-0.03em' }}>{confidence}%</div>
          </div>
          <div style={{ background: '#ffffff', borderRadius: '0.75rem', padding: '0.875rem 1.25rem', textAlign: 'center', minWidth: 110, border: '1px solid #eceef6', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.65rem', fontWeight: 800, color: '#8b8fa8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>EST. SAVINGS</div>
            <div style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 900, fontSize: '1.45rem', color: '#1a1e2e', letterSpacing: '-0.03em' }}>{estSavings}</div>
          </div>
        </div>
      </div>

      {/* Vendor selector pills */}
      {items.length > 1 && (
        <div className="custom-scrollbar" style={{ display: 'flex', gap: '0.5rem', marginTop: '-0.5rem', flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: '0.75rem' }}>
          <style>{`.custom-scrollbar::-webkit-scrollbar { height: 6px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: transparent; border-radius: 999px; } .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: #d0d4e8; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }`}</style>
          {items.map((t: any, i: number) => (
            <button key={i} onClick={(e) => { 
                setActiveIdx(i); 
                setAuthorized(false); 
                const container = e.currentTarget.parentElement;
                if (container) {
                  const btnCenter = e.currentTarget.offsetLeft - container.offsetLeft + e.currentTarget.offsetWidth / 2;
                  const containerCenter = container.offsetWidth / 2;
                  container.scrollTo({ left: btnCenter - containerCenter, behavior: 'smooth' });
                }
              }}
              style={{ fontFamily: 'Inter,sans-serif', fontWeight: 700, fontSize: '0.75rem', padding: '0.4rem 1rem', borderRadius: 999, border: 'none', cursor: 'pointer', transition: 'all 0.15s', background: activeIdx === i ? '#1a1e2e' : '#eceef6', color: activeIdx === i ? '#ffffff' : '#6b6f82', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {t.vendor || t.actor || `Decision Step ${i + 1}`}
            </button>
          ))}
        </div>
      )}

      {/* ── NEW: Historical & SLA Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
        {/* History box */}
        <div style={{ background: '#ffffff', border: '1px solid #eceef6', borderRadius: '0.875rem', padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem', boxShadow: '0 2px 10px rgba(30,33,43,0.03)' }}>
          <div style={{ width: 48, height: 48, borderRadius: '0.5rem', background: '#eaf3e6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ShieldCheck size={24} color="#2d6a14" />
          </div>
          <div>
            <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.65rem', fontWeight: 800, color: '#8b8fa8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>HISTORY</div>
            <div style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: '1.1rem', color: '#1a1e2e' }}>Historical Confidence <span style={{ color: '#2d6a14', marginLeft: '0.25rem' }}>{histLabel}</span></div>
            <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.8rem', color: '#6b6f82', marginTop: 2 }}>{histPaths}</div>
          </div>
        </div>
        
        {/* SLA Impact box */}
        <div style={{ background: '#ffffff', border: '1px solid #eceef6', borderRadius: '0.875rem', padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem', boxShadow: '0 2px 10px rgba(30,33,43,0.03)' }}>
          <div style={{ width: 48, height: 48, borderRadius: '0.5rem', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="24" height="24" viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="13" fill="none" stroke="#fde68a" strokeWidth="4" />
              <circle cx="16" cy="16" r="13" fill="none" stroke="#d97706" strokeWidth="4" strokeDasharray="4 78" strokeLinecap="round" transform="rotate(-90 16 16)" />
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.65rem', fontWeight: 800, color: '#8b8fa8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>SLA SAFETY</div>
            <div style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: '1.1rem', color: '#1a1e2e' }}>SLA Impact <span style={{ color: '#d97706', marginLeft: '0.25rem' }}>{slaImpactPct}</span></div>
            <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.8rem', color: '#6b6f82', marginTop: 2 }}>{slaImpactMsg}</div>
          </div>
        </div>
      </div>

      {/* ── NEW: Execution Comparison ── */}
      <div style={{ background: '#fdfdfd', borderRadius: '1rem', padding: '1.75rem', border: '1px solid #f0f2f8', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem' }}>
          <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: '1.15rem', color: '#1a1e2e', margin: 0 }}>Execution Comparison</h3>
          <div style={{ display: 'flex', gap: '1rem', fontFamily: 'Inter,sans-serif', fontSize: '0.7rem', fontWeight: 700, color: '#6b6f82', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: '#2d6a14' }} /> AI OPTIMIZATION</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6ba1c4' }} /> HUMAN BASELINE</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
          
          {/* LEFT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* AI OPTIMIZATION CARD */}
            <div style={{ border: '2px solid #2d6a14', borderRadius: '1rem', padding: '1.5rem', position: 'relative', boxShadow: '0 8px 32px rgba(45, 106, 20, 0.08)', background: '#ffffff', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ position: 'absolute', top: -12, left: 24, background: '#2d6a14', color: '#ffffff', padding: '0.3rem 0.8rem', borderRadius: 999, fontFamily: 'Inter,sans-serif', fontWeight: 800, fontSize: '0.65rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>RECOMMENDED</div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', marginTop: '0.5rem' }}>
                <div>
                  <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.62rem', fontWeight: 800, color: '#4a8a30', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.375rem' }}>STRATEGY ARCHITECTURE</div>
                  <div style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: '1.35rem', color: '#1a1e2e', lineHeight: 1.25 }} title={aiSuggestion}>{aiStrategyName}</div>
                </div>
                <div style={{ width: 44, height: 44, borderRadius: '0.75rem', background: '#d5ffbb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Zap size={22} color="#2d6a14" fill="#2d6a14" />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem', flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8faf9', padding: '0.875rem 1rem', borderRadius: '0.5rem' }}>
                  <span style={{ fontFamily: 'Inter,sans-serif', fontWeight: 600, fontSize: '0.8rem', color: '#6b6f82' }}>Cost Efficiency</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: '1rem', color: '#1a1e2e' }}>{costImpactPct}</span>
                    <span style={{ background: '#eaf3e6', color: '#2d6a14', borderRadius: 999, padding: '0.15rem 0.5rem', fontFamily: 'Inter,sans-serif', fontSize: '0.65rem', fontWeight: 700 }}>Optimal</span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8faf9', padding: '0.875rem 1rem', borderRadius: '0.5rem' }}>
                  <span style={{ fontFamily: 'Inter,sans-serif', fontWeight: 600, fontSize: '0.8rem', color: '#6b6f82' }}>Execution Speed</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: '1rem', color: '#1a1e2e' }}>{aiSpeed}</span>
                    <span style={{ color: '#8b8fa8', fontFamily: 'Inter,sans-serif', fontSize: '0.65rem', fontWeight: 600 }}>0 ms latency</span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8faf9', padding: '0.875rem 1rem', borderRadius: '0.5rem' }}>
                  <span style={{ fontFamily: 'Inter,sans-serif', fontWeight: 600, fontSize: '0.8rem', color: '#6b6f82' }}>SLA Resilience</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: '1rem', color: '#1a1e2e' }}>High</span>
                    <span style={{ color: '#8b8fa8', fontFamily: 'Inter,sans-serif', fontSize: '0.65rem', fontWeight: 600 }}>buffer maintained</span>
                  </div>
                </div>
              </div>

              <button onClick={() => setAuthorized(true)} disabled={authorized}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: authorized ? '#8b8fa8' : '#2d6a14', color: '#ffffff', padding: '0.875rem', borderRadius: '0.5rem', border: 'none', fontFamily: 'Inter,sans-serif', fontWeight: 700, fontSize: '0.95rem', cursor: authorized ? 'default' : 'pointer', transition: 'background 0.15s' }}>
                <ShieldCheck size={18} /> {authorized ? 'Executing...' : 'Authorize & Execute'}
              </button>
            </div>

            {/* AI Insight Box (Shifted to Left Stack) */}
            <div style={{ background: '#ffffff', borderRadius: '0.875rem', border: '2px solid #fec700', overflow: 'hidden', boxShadow: '0 8px 24px rgba(254, 199, 0, 0.15)' }}>
              <div style={{ background: '#fec700', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: '0.85rem', color: '#000000' }}>AI Insight</div>
              </div>
              <div style={{ padding: '0.75rem 1rem' }}>
                <p style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.75rem', color: '#6b6f82', lineHeight: 1.5, margin: 0 }}>
                  {aiInsightText}
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* HUMAN BASELINE CARD (Vibrant Light blue) */}
            <div style={{ background: '#e0f2fe', borderRadius: '1rem', padding: '1.5rem', position: 'relative', border: '2px solid #38bdf8', flex: 1, boxShadow: '0 8px 32px rgba(56, 189, 248, 0.08)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', marginTop: '0.5rem' }}>
                <div>
                  <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.62rem', fontWeight: 800, color: '#0284c7', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.375rem' }}>CURRENT METHOD</div>
                  <div style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: '1.35rem', color: '#1a1e2e', lineHeight: 1.25 }} title={humanBaseline}>{humanMethodName}</div>
                </div>
                <div style={{ width: 44, height: 44, borderRadius: '0.75rem', background: '#bae6fd', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#0284c7"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem', flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', padding: '0.875rem 1rem', borderRadius: '0.5rem' }}>
                  <span style={{ fontFamily: 'Inter,sans-serif', fontWeight: 600, fontSize: '0.8rem', color: '#475569' }}>Cost Efficiency</span>
                  <span style={{ fontFamily: 'Inter,sans-serif', fontWeight: 700, fontSize: '0.9rem', color: '#0ea5e9' }}>Baseline</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', padding: '0.875rem 1rem', borderRadius: '0.5rem' }}>
                  <span style={{ fontFamily: 'Inter,sans-serif', fontWeight: 600, fontSize: '0.8rem', color: '#475569' }}>Execution Speed</span>
                  <span style={{ fontFamily: 'Inter,sans-serif', fontWeight: 700, fontSize: '0.9rem', color: '#0ea5e9' }}>~2.4h</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', padding: '0.875rem 1rem', borderRadius: '0.5rem' }}>
                  <span style={{ fontFamily: 'Inter,sans-serif', fontWeight: 600, fontSize: '0.8rem', color: '#475569' }}>Manual Effort</span>
                  <span style={{ fontFamily: 'Inter,sans-serif', fontWeight: 700, fontSize: '0.9rem', color: '#0ea5e9' }}>High</span>
                </div>
              </div>

              <div style={{ fontFamily: 'Inter,sans-serif', fontStyle: 'italic', fontSize: '0.7rem', color: '#64748b', textAlign: 'center', marginTop: '0.5rem' }}>
                Historical Human approval latency average: 142 minutes
              </div>
            </div>

            {/* Human Insight Box (Added to Right Stack) */}
            <div style={{ background: '#ffffff', borderRadius: '0.875rem', border: '2px solid #38bdf8', overflow: 'hidden', boxShadow: '0 8px 24px rgba(56, 189, 248, 0.15)' }}>
              <div style={{ background: '#38bdf8', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: '0.85rem', color: '#000000' }}>Human Insight</div>
              </div>
              <div style={{ padding: '0.75rem 1rem' }}>
                <p style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.75rem', color: '#475569', lineHeight: 1.5, margin: 0 }}>
                  {humanInsightText}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── NEW: Decision Audit Trail Scrollable Row (Shifted below Execution Comparison) ── */}
      <div style={{ background: '#ffffff', borderRadius: '0.875rem', padding: '1.5rem', border: '1px solid #eceef6', boxShadow: '0 2px 10px rgba(30,33,43,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={16} color="#6b6f82" />
            <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: '1rem', color: '#1a1e2e', margin: 0 }}>Decision Audit Trail</h3>
          </div>
          <button style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: '#2d6a14', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 1rem', fontFamily: 'Inter,sans-serif', fontWeight: 800, fontSize: '0.8rem', color: '#ffffff', cursor: 'pointer', transition: 'background 0.2s', boxShadow: '0 4px 12px rgba(45,106,20,0.2)' }} onMouseEnter={e => e.currentTarget.style.background = '#225510'} onMouseLeave={e => e.currentTarget.style.background = '#2d6a14'}>
            ↓ Download Full Transcript
          </button>
        </div>

        {(() => {
          const humanKnew: string[] = item?.context_human_had || [];
          const auditSteps = AUDIT_STEPS.map((step, i) => ({
            ...step,
            sub: humanKnew[i] ? humanKnew[i].slice(0, 28) : step.sub,
          }));
          return (
            <div className="custom-scrollbar" style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
              {auditSteps.map((step, i) => (
                <div key={i} style={{ minWidth: 200, flex: 1, background: step.done ? '#f6f8ff' : '#fafafa', borderRadius: '0.75rem', padding: '1.125rem', textAlign: 'center', border: `1px solid ${step.done ? '#e0e4f0' : '#f0f2f8'}`, position: 'relative', opacity: step.done ? 1 : 0.65 }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', maxHeight: '400px', overflowY: 'auto', paddingRight: '0.5rem' }}>
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
