import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Trophy, AlertTriangle, CheckCircle, Zap, Monitor, Calendar } from 'lucide-react';
import { NavLink } from 'react-router-dom';

/* ─── Toast ─── */
function LiveToast({ toast }: { toast: any }) {
  const map: Record<string, { bg: string; text: string }> = {
    warning:  { bg: '#fec700', text: '#574300' },
    critical: { bg: '#ef4444', text: '#fff' },
    success:  { bg: '#b0f58d', text: '#225e04' },
    info:     { bg: '#e0e2f0', text: '#2b2e39' },
  };
  const c = map[toast.severity] || map.info;
  return (
    <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 200 }}>
      <div style={{ background: c.bg, color: c.text, padding: '1rem 1.25rem', borderRadius: '0.75rem', maxWidth: 320, boxShadow: '0 16px 40px rgba(30,33,43,0.18)', fontFamily: 'Inter,sans-serif' }}>
        <div style={{ fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{toast.agent}</div>
        <div style={{ fontWeight: 700, fontSize: '0.9rem', fontFamily: 'Manrope,sans-serif', marginBottom: 4 }}>{toast.title}</div>
        <div style={{ fontSize: '0.78rem', opacity: 0.85 }}>
          {JSON.stringify(toast.data).replace(/[{}]/g, '').replace(/"/g, '')}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [toast, setToast] = useState<any>(null);
  const [feedEvents, setFeedEvents] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      api.get('/api/waste-calendar'),
      api.get('/api/karma-scores'),
    ]).then(([wasteRes, karmaRes]) => {
      setStats({ waste: wasteRes.data.data, leaderboard: karmaRes.data.data.leaderboard });
    }).catch(console.error);

    const wsUrl = import.meta.env.VITE_API_URL
      ? import.meta.env.VITE_API_URL.replace(/^http/, 'ws') + '/ws/live-alerts'
      : 'ws://localhost:8000/ws/live-alerts';
    const ws = new WebSocket(wsUrl);
    ws.onmessage = e => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.event_type?.startsWith('ghost_approver.') || payload.event_type?.startsWith('sla_monitor.')) {
          setToast(payload);
          setFeedEvents(prev => [{ ...payload, ts: new Date() }, ...prev].slice(0, 8));
          setTimeout(() => setToast(null), 8000);
        }
      } catch {}
    };
    return () => ws.close();
  }, []);

  if (!stats) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: '1rem' }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #2d6a14', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
      <p style={{ color: '#6b6f82', fontFamily: 'Inter,sans-serif' }}>Loading KARMA Intelligence…</p>
    </div>
  );

  const totalPreventable = stats.waste.total_preventable_inr || 0;
  const activeAlerts     = stats.waste.active_count || stats.waste.events?.length || 0;
  const topUrgent        = stats.waste.events?.[0];
  const criticalEvent    = stats.waste.events?.find((e: any) => e.urgency_label?.includes('CRITICAL'));
  const topTeam          = stats.leaderboard?.[0];

  // Stat card data
  const statCards = [
    {
      label: 'TOTAL EXPOSURE',
      value: `₹${(totalPreventable / 100000).toFixed(2)}L`,
      sub: '+2.4% vs 1w',
      icon: Monitor,
      accentColor: '#d97706', // amber
      borderColor: '#d97706',
    },
    {
      label: 'ACTIVE ALERTS',
      value: String(activeAlerts),
      sub: null,
      icon: AlertTriangle,
      accentColor: '#d97706',
      borderColor: '#d97706',
    },
    {
      label: 'SLA CRITICAL',
      badge: 'CRITICAL',
      value: criticalEvent ? criticalEvent.vendor : (topUrgent?.vendor || 'None'),
      sub: criticalEvent ? criticalEvent.urgency_label : null,
      icon: Zap,
      accentColor: '#ef4444',
      borderColor: '#ef4444',
    },
    {
      label: 'LEADERBOARD',
      value: topTeam ? `#${topTeam.rank}` : '#-',
      sub: `Top\n${topTeam?.team_name || 'Savvy'}`,
      icon: Trophy,
      accentColor: '#2d6a14',
      borderColor: 'transparent',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', maxWidth: 1200, margin: '0 auto', width: '100%', animation: 'fade-in 0.4s ease-out both' }}>
      {toast && <LiveToast toast={toast} />}

      {/* ── Page Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 900, fontSize: '2.25rem', color: '#1a1e2e', letterSpacing: '-0.04em', lineHeight: 1, margin: 0 }}>Engine Overview</h1>
          <p style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.9rem', color: '#6b6f82', marginTop: '0.375rem' }}>Real-time enterprise waste interception protocol active.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#eaf3e6', border: '1px solid #a8d68a', borderRadius: 999, padding: '0.375rem 0.875rem' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#2d6a14', animation: 'pulse-soft 2s ease-in-out infinite' }} />
          <span style={{ fontFamily: 'Inter,sans-serif', fontWeight: 700, fontSize: '0.78rem', color: '#2d6a14' }}>KARMA V4.2 Live</span>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        {statCards.map((card, i) => (
          <div key={i} style={{ background: '#ffffff', borderRadius: '0.75rem', padding: '1.25rem', borderLeft: `3px solid ${card.borderColor}`, boxShadow: '0 2px 12px rgba(30,33,43,0.06)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={{ width: 30, height: 30, borderRadius: '0.5rem', background: card.accentColor + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <card.icon size={15} color={card.accentColor} />
              </div>
              {card.sub === '+2.4% vs 1w' && (
                <span style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.72rem', fontWeight: 700, color: '#2d6a14', background: '#eaf3e6', padding: '0.15rem 0.5rem', borderRadius: 999 }}>+2.4% vs 1w</span>
              )}
              {(card as any).badge && (
                <span style={{ background: '#ef4444', color: '#fff', borderRadius: 4, padding: '0.1rem 0.45rem', fontSize: '0.65rem', fontWeight: 800, fontFamily: 'Inter,sans-serif', letterSpacing: '0.05em' }}>CRITICAL</span>
              )}
            </div>
            <div style={{ fontFamily: 'Inter,sans-serif', fontWeight: 700, fontSize: '0.68rem', color: '#8b8fa8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.375rem' }}>{card.label}</div>
            <div style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 900, fontSize: i === 3 ? '1.8rem' : '1.6rem', color: '#1a1e2e', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
              {card.value}
            </div>
            {card.sub && card.sub !== '+2.4% vs 1w' && (
              <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.8rem', color: '#6b6f82', marginTop: '0.25rem', whiteSpace: 'pre-line' }}>{card.sub}</div>
            )}
          </div>
        ))}
      </div>

      {/* ── Two-Panel Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.65fr', gap: '1.25rem' }}>

        {/* Top Actionable Waste – dark card with image bg */}
        <div style={{ background: 'linear-gradient(160deg, #2f3549 0%, #1a1e2e 100%)', borderRadius: '1rem', overflow: 'hidden', position: 'relative', minHeight: 320 }}>
          {/* Coin stack image texture */}
          <div style={{ position: 'absolute', inset: 0, background: 'url("data:image/svg+xml,%3Csvg width=\'400\' height=\'300\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Ccircle cx=\'200\' cy=\'220\' r=\'120\' fill=\'%23ffffff08\'/%3E%3Ccircle cx=\'200\' cy=\'190\' r=\'90\' fill=\'%23ffffff06\'/%3E%3Ccircle cx=\'200\' cy=\'160\' r=\'70\' fill=\'%23ffffff05\'/%3E%3C/svg%3E") center/cover no-repeat', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', zIndex: 1, padding: '1.5rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', background: '#2d6a14', color: '#d5ffbb', borderRadius: 999, padding: '0.25rem 0.75rem', marginBottom: '0.625rem' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#a0e87a' }} />
                  <span style={{ fontFamily: 'Inter,sans-serif', fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.06em' }}>AI RECOMMENDED</span>
                </div>
                <h2 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 900, fontSize: '1.5rem', color: '#ffffff', letterSpacing: '-0.03em', margin: 0, lineHeight: 1.2 }}>Top Actionable Waste</h2>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.68rem', fontWeight: 700, color: '#8b9dc0', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>EST. RECOVERY</div>
                <div style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 900, fontSize: '1.5rem', color: '#4ade80', letterSpacing: '-0.02em' }}>
                  ₹{topUrgent ? topUrgent.estimated_savings_inr?.toLocaleString() : '0'}
                </div>
              </div>
            </div>

            {/* Spacer for visual depth */}
            <div style={{ height: 80 }} />

            {/* Task item */}
            {topUrgent ? (
              <div style={{ background: '#ffffff', borderRadius: '0.625rem', padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <CheckCircle size={16} color="#2d6a14" style={{ flexShrink: 0 }} />
                  <div>
                    <div style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: '0.9rem', color: '#1a1e2e' }}>{topUrgent.vendor}</div>
                    <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.75rem', color: '#6b6f82', marginTop: 1 }}>{topUrgent.summary?.slice(0, 60)}…</div>
                  </div>
                </div>
                <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.72rem', fontWeight: 700, color: '#ef4444', background: '#fef2f2', padding: '0.2rem 0.5rem', borderRadius: 4, flexShrink: 0, marginLeft: '0.75rem' }}>
                  DUE IN 4H
                </div>
              </div>
            ) : (
              <div style={{ background: '#ffffff10', borderRadius: '0.625rem', padding: '1rem', marginBottom: '1rem', color: '#8b9dc0', fontFamily: 'Inter,sans-serif', fontSize: '0.85rem', textAlign: 'center' }}>No active waste tasks.</div>
            )}

            <NavLink to="/waste-calendar" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#2d6a14', color: '#d5ffbb', padding: '0.625rem 1.25rem', borderRadius: '0.5rem', fontFamily: 'Inter,sans-serif', fontWeight: 700, fontSize: '0.875rem', boxShadow: '0 4px 14px rgba(45,106,20,0.4)' }}>
              View Waste Calendar <Calendar size={14} />
            </NavLink>
          </div>
        </div>

        {/* Intercept a Decision – dark navy card */}
        <div style={{ background: '#1a1e2e', borderRadius: '1rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Icon */}
          <div style={{ width: 42, height: 42, borderRadius: '0.75rem', background: '#2d6a14', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(45,106,20,0.50)' }}>
            <Zap size={20} color="#d5ffbb" fill="#d5ffbb" />
          </div>
          <div>
            <h2 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 900, fontSize: '1.5rem', color: '#ffffff', letterSpacing: '-0.03em', margin: '0 0 0.5rem' }}>Intercept a Decision</h2>
            <p style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.85rem', color: '#8b9dc0', lineHeight: 1.6, margin: 0 }}>Prevent over-provisioning before it hits the ledger. Our DNA engine simulates outcome variance in real-time.</p>
          </div>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Accuracy bar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
              <span style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.68rem', fontWeight: 700, color: '#8b9dc0', textTransform: 'uppercase', letterSpacing: '0.08em' }}>SIMULATION ACCURACY</span>
              <span style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: '0.85rem', color: '#4ade80' }}>99.8%</span>
            </div>
            <div style={{ height: 5, background: '#2a2f40', borderRadius: 999 }}>
              <div style={{ height: '100%', width: '99.8%', background: 'linear-gradient(90deg,#2d6a14,#4ade80)', borderRadius: 999 }} />
            </div>
          </div>

          <NavLink to="/ghost-approver" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: '#2d6a14', color: '#d5ffbb', padding: '0.75rem', borderRadius: '0.5rem', fontFamily: 'Inter,sans-serif', fontWeight: 700, fontSize: '0.9rem', boxShadow: '0 4px 14px rgba(45,106,20,0.50)', transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.background = '#1f5c02'}
            onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.background = '#2d6a14'}>
            Launch Simulator
          </NavLink>
        </div>
      </div>

      {/* ── Optimization Intelligence Feed ── */}
      <div>
        <h2 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: '1.1rem', color: '#1a1e2e', marginBottom: '1.25rem' }}>Optimization Intelligence Feed</h2>

        {/* Static + live events */}
        {(() => {
          const staticItems = [
            { time: 'NOW', dotColor: '#2d6a14', borderColor: '#2d6a14', title: 'Auto-scaling Policy Adjusted', body: "The engine detected inefficient idle thresholds on 'Cluster-X9'. Intercepted ₹1,200/day in projected waste.", actions: null },
            { time: '2 HOURS AGO', dotColor: '#d97706', borderColor: '#d97706', title: 'Anomaly Detected: Storage Bloat', body: 'Sudden increase in unattached volumes across staging. Ghost Approver is requesting immediate purge permission.', actions: ['APPROVE PURGE', 'INVESTIGATE'] },
          ];
          const liveItems = feedEvents.map(ev => ({ time: 'LIVE', dotColor: '#4ade80', borderColor: '#2d6a14', title: ev.title || ev.event_type, body: JSON.stringify(ev.data || {}).replace(/[{}\"]/g, ' ').trim(), actions: null }));
          const allItems = [...liveItems, ...staticItems];

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
              {allItems.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  {/* Dot + line */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, paddingTop: 4 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.dotColor, flexShrink: 0, boxShadow: `0 0 6px ${item.dotColor}80` }} />
                    {i < allItems.length - 1 && <div style={{ width: 1, flex: 1, background: '#e0e4f0', marginTop: 4, minHeight: 24 }} />}
                  </div>
                  {/* Content */}
                  <div style={{ flex: 1, paddingBottom: i < allItems.length - 1 ? '0.5rem' : 0 }}>
                    <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.7rem', fontWeight: 700, color: '#8b8fa8', letterSpacing: '0.06em', marginBottom: '0.375rem' }}>{item.time}</div>
                    <div style={{ background: '#ffffff', borderRadius: '0.625rem', padding: '0.875rem 1rem', borderLeft: `3px solid ${item.borderColor}` }}>
                      <div style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: '0.925rem', color: '#1a1e2e', marginBottom: '0.3rem' }}>{item.title}</div>
                      <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.82rem', color: '#6b6f82', lineHeight: 1.55, marginBottom: item.actions ? '0.75rem' : 0 }}>{item.body}</div>
                      {item.actions && (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {item.actions.map((a: string) => (
                            <button key={a} style={{ fontFamily: 'Inter,sans-serif', fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.06em', padding: '0.3rem 0.75rem', borderRadius: '0.25rem', border: '1.5px solid #d0d4e8', background: 'transparent', color: '#4b5278', cursor: 'pointer', transition: 'background 0.15s' }}
                              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = '#f0f2f8'}
                              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}>
                              {a}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
