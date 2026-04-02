import { useEffect, useState } from 'react';
import { api } from '../api';
import { RefreshCw, CheckCircle, Clock, AlertTriangle, Database, Cloud, CreditCard } from 'lucide-react';

const CATEGORY_ICONS: Record<string, any> = {
  CRM:       CreditCard,
  Cloud:     Cloud,
  Default:   Database,
};

function categoryIcon(cat: string) {
  const Icon = CATEGORY_ICONS[cat] || CATEGORY_ICONS.Default;
  return <Icon size={18} />;
}

type FilterTab = 'ALL' | 'EXPIRING' | 'BREACHES';

export default function WasteCalendar() {
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<FilterTab>('ALL');
  const [completing, setCompleting] = useState<string | null>(null);

  const fetchCalendar = () => {
    setLoading(true);
    api.get('/api/waste-calendar').then(res => {
      setData(res.data.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  const handleRefresh = () => {
    setLoading(true);
    api.post('/api/waste-calendar/refresh').then(() => fetchCalendar()).catch(fetchCalendar);
  };

  const assignTask   = (id: string) => api.post('/api/waste-calendar/assign', { event_id: id, assigned_to: 'engineering_lead' }).then(fetchCalendar);
  const completeTask = async (id: string) => {
    setCompleting(id);
    await api.post('/api/waste-calendar/complete', { event_id: id, team: 'engineering' });
    setCompleting(null);
    fetchCalendar();
  };

  useEffect(() => { fetchCalendar(); }, []);

  if (!data && loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: '1rem' }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #2d6a14', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
      <p style={{ color: '#6b6f82', fontFamily: 'Inter,sans-serif' }}>Loading Waste Grid…</p>
    </div>
  );

  const events     = data?.events || [];
  const totalRisk  = events.filter((e: any) => e.status === 'open').reduce((s: number, e: any) => s + (e.estimated_savings_inr || 0), 0);
  const resolved   = events.filter((e: any) => e.status === 'done').length;
  const expiring   = events.filter((e: any) => e.status === 'open' && e.urgency_label?.includes('HIGH')).length;

  const filteredEvents = events.filter((ev: any) => {
    if (filter === 'ALL')      return true;
    if (filter === 'EXPIRING') return ev.urgency_label?.includes('HIGH') || ev.urgency_label?.includes('CRITICAL');
    if (filter === 'BREACHES') return ev.urgency_label?.includes('CRITICAL') || ev.category?.toLowerCase().includes('sla');
    return true;
  });

  // Top remediation item
  const topRemediationItem = events.find((e: any) => e.status === 'open');

  const urgencyBadge = (label: string, status: string) => {
    if (status === 'done')               return { text: 'RESOLVED', bg: '#eaf3e6', color: '#2d6a14', border: '#a8d68a' };
    if (label?.includes('CRITICAL'))     return { text: 'EXPIRING', bg: '#fef2f2', color: '#ef4444', border: '#fca5a5' };
    if (label?.includes('HIGH'))         return { text: 'BREACH-RISK', bg: '#fffbeb', color: '#d97706', border: '#fcd34d' };
    return { text: label || 'NORMAL', bg: '#f0f2f8', color: '#6b6f82', border: '#d0d4e8' };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: 1200, margin: '0 auto', width: '100%', animation: 'fade-in 0.4s ease-out both' }}>

      {/* ── Page Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.68rem', fontWeight: 700, color: '#2d6a14', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '0.375rem' }}>OPTIMIZATION ENGINE</div>
          <h1 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 900, fontSize: '2rem', color: '#1a1e2e', letterSpacing: '-0.04em', margin: 0, lineHeight: 1 }}>Waste Calendar</h1>
          <p style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.875rem', color: '#6b6f82', marginTop: '0.375rem' }}>Manage contract lifecycle and service-level risks with AI-prioritised remediation steps.</p>
        </div>
        <button onClick={handleRefresh} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#ffffff', border: '1px solid #d0d4e8', borderRadius: '0.5rem', padding: '0.55rem 1rem', fontFamily: 'Inter,sans-serif', fontWeight: 600, fontSize: '0.85rem', color: '#1a1e2e', cursor: 'pointer', transition: 'background 0.15s', flexShrink: 0 }}
          onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = '#f6f8ff'}
          onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = '#ffffff'}>
          <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : {}} color="#2d6a14" />
          Refresh Agents
        </button>
      </div>

      {/* ── Hero Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.6fr', gap: '1rem' }}>
        {/* High Exposure Card */}
        <div style={{ background: '#ffffff', borderRadius: '0.875rem', padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
          {/* Subtle warning icon watermark */}
          <div style={{ position: 'absolute', right: '1.5rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.06 }}>
            <AlertTriangle size={80} color="#d97706" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.75rem' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', animation: 'pulse-soft 2s ease-in-out infinite' }} />
            <span style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.68rem', fontWeight: 700, color: '#ef4444', letterSpacing: '0.1em', textTransform: 'uppercase' }}>HIGH EXPOSURE DETECTED</span>
          </div>
          <div style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 900, fontSize: '2.25rem', color: '#1a1e2e', letterSpacing: '-0.04em', marginBottom: '0.375rem' }}>
            ₹{totalRisk.toLocaleString()}
          </div>
          <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.82rem', color: '#6b6f82', marginBottom: '1.25rem' }}>Total At-Risk Exposure this quarter</div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: '#eaf3e6', color: '#2d6a14', borderRadius: 999, padding: '0.25rem 0.75rem', fontFamily: 'Inter,sans-serif', fontSize: '0.75rem', fontWeight: 700 }}>
              <CheckCircle size={11} /> {resolved} Issues Resolved
            </span>
            {expiring > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: '#fffbeb', color: '#d97706', border: '1px solid #fcd34d', borderRadius: 999, padding: '0.25rem 0.75rem', fontFamily: 'Inter,sans-serif', fontSize: '0.75rem', fontWeight: 700 }}>
                <Clock size={11} /> {expiring} Expiring Soon
              </span>
            )}
          </div>
        </div>

        {/* Remediation Insight Card */}
        <div style={{ background: '#ffffff', borderRadius: '0.875rem', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#eaf3e6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#2d6a14' }} />
            </div>
            <span style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: '0.9rem', color: '#1a1e2e' }}>Remediation Insight</span>
          </div>
          <p style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.82rem', color: '#6b6f82', lineHeight: 1.6, marginBottom: '1rem' }}>
            {topRemediationItem
              ? `Switching ${topRemediationItem.vendor} to a reserved instance could save ₹${Math.round((topRemediationItem.estimated_savings_inr || 0) / 12000)}k/mo.`
              : 'All high-impact risks have been resolved this cycle.'}
          </p>
          <button style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.8rem', fontWeight: 700, color: '#2d6a14', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            Review Plan →
          </button>
        </div>
      </div>

      {/* ── Risk Matrix ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: '1.05rem', color: '#1a1e2e', margin: 0 }}>Prioritized Risk Matrix</h2>
          {/* Filter tabs */}
          <div style={{ display: 'flex', background: '#f0f2f8', borderRadius: '0.5rem', padding: '0.2rem' }}>
            {(['ALL', 'EXPIRING', 'BREACHES'] as FilterTab[]).map(tab => (
              <button key={tab} onClick={() => setFilter(tab)} style={{ fontFamily: 'Inter,sans-serif', fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.06em', padding: '0.3rem 0.75rem', borderRadius: '0.375rem', border: 'none', cursor: 'pointer', transition: 'background 0.15s, color 0.15s', background: filter === tab ? '#ffffff' : 'transparent', color: filter === tab ? '#1a1e2e' : '#8b8fa8', boxShadow: filter === tab ? '0 1px 4px rgba(30,33,43,0.10)' : 'none' }}>
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filteredEvents.map((ev: any) => {
            const badge = urgencyBadge(ev.urgency_label, ev.status);
            const isDone = ev.status === 'done';
            return (
              <div key={ev.id} style={{ background: '#ffffff', borderRadius: '0.75rem', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', opacity: isDone ? 0.7 : 1, transition: 'box-shadow 0.15s', boxShadow: '0 1px 6px rgba(30,33,43,0.05)' }}
                onMouseEnter={e => { if (!isDone) (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(30,33,43,0.10)'; }}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 6px rgba(30,33,43,0.05)'}>

                {/* Category icon */}
                <div style={{ width: 36, height: 36, borderRadius: '0.625rem', background: isDone ? '#eaf3e6' : badge.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: isDone ? '#2d6a14' : badge.color }}>
                  {isDone ? <CheckCircle size={18} /> : categoryIcon(ev.category)}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: '0.9rem', color: '#1a1e2e' }}>{ev.vendor}</span>
                    <span style={{ fontFamily: 'Inter,sans-serif', fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.06em', padding: '0.15rem 0.5rem', borderRadius: 4, background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, flexShrink: 0 }}>
                      {badge.text}
                    </span>
                  </div>
                  <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.8rem', color: '#6b6f82', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 340 }}>
                    {ev.summary}
                  </div>
                </div>

                {/* Exposure */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.65rem', fontWeight: 700, color: '#8b8fa8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
                    {isDone ? 'SAVED' : 'EXPOSURE'}
                  </div>
                  <div style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 900, fontSize: '1.1rem', color: isDone ? '#2d6a14' : '#ef4444', letterSpacing: '-0.02em' }}>
                    ₹{ev.estimated_savings_inr?.toLocaleString()}
                  </div>
                </div>

                {/* Actions */}
                {!isDone ? (
                  <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                    <button onClick={() => assignTask(ev.id)} style={{ fontFamily: 'Inter,sans-serif', fontWeight: 700, fontSize: '0.78rem', padding: '0.4rem 0.875rem', borderRadius: '0.375rem', border: '1px solid #d0d4e8', background: '#ffffff', color: '#4b5278', cursor: 'pointer', transition: 'background 0.15s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = '#f0f2f8'}
                      onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = '#ffffff'}>
                      Assign
                    </button>
                    <button onClick={() => completeTask(ev.id)} disabled={completing === ev.id} style={{ fontFamily: 'Inter,sans-serif', fontWeight: 700, fontSize: '0.78rem', padding: '0.4rem 0.875rem', borderRadius: '0.375rem', border: 'none', background: '#2d6a14', color: '#d5ffbb', cursor: 'pointer', transition: 'background 0.15s', display: 'flex', alignItems: 'center', gap: '0.25rem', opacity: completing === ev.id ? 0.7 : 1 }}
                      onMouseEnter={e => { if (completing !== ev.id) (e.currentTarget as HTMLButtonElement).style.background = '#1f5c02'; }}
                      onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = '#2d6a14'}>
                      {completing === ev.id ? <RefreshCw size={11} style={{ animation: 'spin 0.8s linear infinite' }} /> : <CheckCircle size={11} />} Fix
                    </button>
                  </div>
                ) : (
                  <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.8rem', fontWeight: 600, color: '#8b8fa8', flexShrink: 0 }}>Completed</div>
                )}
              </div>
            );
          })}

          {filteredEvents.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', background: '#ffffff', borderRadius: '0.75rem', color: '#8b8fa8' }}>
              <CheckCircle size={32} color="#2d6a14" style={{ margin: '0 auto 0.75rem' }} />
              <p style={{ fontFamily: 'Inter,sans-serif' }}>No events in this category.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
