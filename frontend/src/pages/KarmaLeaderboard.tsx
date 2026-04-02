import { useEffect, useState } from 'react';
import { api } from '../api';
import { Trophy, RefreshCw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

/* ── Tier mapping ── */
function tierInfo(rank: number) {
  if (rank === 1) return { label: 'GLOBAL CHAMPION', bg: '#fec700', color: '#574300', border: '#e6b400' };
  if (rank === 2) return { label: 'SILVER TIER',    bg: '#e0e4f0', color: '#4b5278', border: '#c8cce0' };
  if (rank === 3) return { label: 'BRONZE TIER',    bg: '#fde8d0', color: '#8b4513', border: '#f0c090' };
  return { label: `RANK #${rank}`, bg: '#f0f2f8', color: '#6b6f82', border: '#d0d4e8' };
}

/* ── Avatar circle (initials) ── */
function Avatar({ name, size = 52, bg = '#2d6a14' }: { name: string; size?: number; bg?: string }) {
  const initials = name.split(/\s+/).map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div style={{ margin: '0 auto', width: size, height: size, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Manrope,sans-serif', fontWeight: 900, fontSize: size * 0.35, color: '#ffffff', flexShrink: 0, border: '3px solid #ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
      {initials}
    </div>
  );
}

/* ── Podium Card ── */
function PodiumCard({ team, pos, teamAvgSaved }: { team: any; pos: 1 | 2 | 3; teamAvgSaved: number }) {
  const tier = tierInfo(pos);
  const isChamp = pos === 1;
  const leads: Record<string, string> = { engineering: 'Marcus Thorne', finance: 'David Miller', marketing: 'Sarah Chen' };
  const leadName = leads[team?.team_id] || 'Team Lead';
  const bgColors = ['#9b8ecf', '#3b5bdb', '#1a7a8a', '#c04a4a', '#5cb85c'];
  const avatarBg = bgColors[Math.abs(team?.team_id?.charCodeAt(0) || 0) % bgColors.length];

  return (
    <div style={{
      background: '#ffffff',
      borderRadius: '1rem',
      padding: isChamp ? '1.75rem 1.25rem' : '1.25rem',
      textAlign: 'center',
      flex: 1,
      maxWidth: isChamp ? 260 : 200,
      border: isChamp ? '2px solid #fec700' : '1px solid #eceef6',
      boxShadow: isChamp ? '0 8px 28px rgba(254,199,0,0.25)' : '0 2px 10px rgba(30,33,43,0.06)',
      position: 'relative',
      marginTop: isChamp ? 0 : 24,
      transition: 'transform 0.2s',
    }}
    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'}
    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.transform = ''}>

      {/* Trophy / star / medal */}
      {isChamp && (
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#fec700', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem', boxShadow: '0 4px 12px rgba(254,199,0,0.40)' }}>
          <Trophy size={18} color="#574300" fill="#d97706" />
        </div>
      )}

      <Avatar name={team?.team_name || 'Team'} size={isChamp ? 60 : 46} bg={avatarBg} />

      <div style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: isChamp ? '1.1rem' : '0.95rem', color: '#1a1e2e', marginTop: '0.75rem', marginBottom: '0.125rem' }}>
        {team?.team_name}
      </div>
      <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.75rem', color: '#8b8fa8', marginBottom: '0.875rem' }}>Lead: {leadName}</div>

      <span style={{ display: 'inline-block', fontFamily: 'Inter,sans-serif', fontWeight: 800, fontSize: isChamp ? '0.72rem' : '0.68rem', letterSpacing: '0.06em', padding: '0.25rem 0.875rem', borderRadius: 999, background: tier.bg, color: tier.color, border: `1px solid ${tier.border}`, marginBottom: '0.875rem' }}>
        {tier.label}
      </span>

      <div style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 900, fontSize: isChamp ? '1.5rem' : '1.2rem', color: '#1a1e2e', letterSpacing: '-0.03em' }}>
        ₹{(teamAvgSaved || (team?.score * 1400 || 0)).toLocaleString()}
      </div>
      <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.7rem', fontWeight: 700, color: '#8b8fa8', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 2 }}>RECOVERED</div>
    </div>
  );
}

export default function KarmaLeaderboard() {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [chartData, setChartData]     = useState<any[]>([]);


  const MONTHS = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];

  useEffect(() => { fetchScores(); }, []);

  const fetchScores = () => {
    api.get('/api/karma-scores').then(async res => {
      const lb: any[] = res.data.data.leaderboard || [];
      setLeaderboard(lb);
      setLoading(false);

      // Build chart data for top 2 teams
      const team1 = lb[0]; const team2 = lb[1];
      if (team1) {
        try {
          const [r1, r2] = await Promise.all([
            api.get(`/api/karma-scores/${team1.team_id}`),
            team2 ? api.get(`/api/karma-scores/${team2.team_id}`) : Promise.resolve({ data: { data: { score: 60, delta: 2 } } }),
          ]);
          const s1 = r1.data.data.score; const d1 = r1.data.data.delta || 0;
          const s2 = r2.data.data.score; const d2 = r2.data.data.delta || 0;
          const data = MONTHS.map((m, i) => {
            const frac = i / (MONTHS.length - 1);
            return {
              month: m,
              [team1.team_name]: parseFloat((s1 - d1 * (1 - frac) * 4).toFixed(1)),
              [team2?.team_name || 'Team2']: parseFloat((s2 - d2 * (1 - frac) * 4 + (i > 3 ? -5 + i * 2 : 0)).toFixed(1)),
            };
          });
          setChartData(data);
        } catch {}
      }
    }).catch(() => setLoading(false));
  };

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: '1rem' }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #2d6a14', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
      <p style={{ color: '#6b6f82', fontFamily: 'Inter,sans-serif' }}>Loading Rankings…</p>
    </div>
  );

  const top3   = leaderboard.slice(0, 3);
  const rest   = leaderboard.slice(3);
  const t1 = top3.find(t => t.rank === 1);
  const t2 = top3.find(t => t.rank === 2);
  const t3 = top3.find(t => t.rank === 3);
  const totalRecovered = leaderboard.reduce((s, t) => s + (t.score * 1400), 0);
  const chartKey1 = leaderboard[0]?.team_name;
  const chartKey2 = leaderboard[1]?.team_name;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: 1200, margin: '0 auto', width: '100%', animation: 'fade-in 0.4s ease-out both' }}>

      {/* ── Page Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 900, fontSize: '2.25rem', color: '#1a1e2e', letterSpacing: '-0.04em', margin: '0 0 0.375rem' }}>Efficiency League</h1>
          <p style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.9rem', color: '#6b6f82', margin: 0, lineHeight: 1.55 }}>
            Real-time FinOps performance ranking. Rewarding teams that master the art<br />of waste recovery and cloud precision.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: '#f0f2f8', borderRadius: '0.75rem', padding: '0.875rem 1.25rem', textAlign: 'right', minWidth: 170 }}>
            <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.62rem', fontWeight: 700, color: '#8b8fa8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>GLOBAL WASTE RECOVERED</div>
            <div style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 900, fontSize: '1.5rem', color: '#1a1e2e', letterSpacing: '-0.03em' }}>
              ₹{(totalRecovered / 100000).toFixed(2)}L
            </div>
          </div>
          <button onClick={fetchScores} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: '#ffffff', border: '1px solid #d0d4e8', borderRadius: '0.5rem', padding: '0.55rem 0.875rem', fontFamily: 'Inter,sans-serif', fontWeight: 600, fontSize: '0.82rem', color: '#4b5278', cursor: 'pointer' }}>
            <RefreshCw size={13} color="#2d6a14" /> Refresh
          </button>
        </div>
      </div>

      {/* ── Main two-column layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '1.5rem' }}>

        {/* ── Left column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Podium */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '1rem', padding: '0.5rem 0' }}>
            {t2 && <PodiumCard team={t2} pos={2} teamAvgSaved={t2.score * 1300} />}
            {t1 && <PodiumCard team={t1} pos={1} teamAvgSaved={t1.score * 1400} />}
            {t3 && <PodiumCard team={t3} pos={3} teamAvgSaved={t3.score * 1200} />}
          </div>

          {/* Score Trajectory */}
          <div style={{ background: '#ffffff', borderRadius: '0.875rem', padding: '1.5rem', border: '1px solid #eceef6' }}>
            <div style={{ marginBottom: '0.375rem' }}>
              <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: '1rem', color: '#1a1e2e', margin: 0 }}>Score Trajectory</h3>
              <p style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.78rem', color: '#8b8fa8', margin: '0.25rem 0 0' }}>Efficiency score trends over the last 6 months</p>
            </div>
            {chartData.length > 0 ? (
              <div style={{ height: 220, marginTop: '1rem' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                    <XAxis dataKey="month" stroke="#c8cce0" fontSize={11} tickLine={false} axisLine={false} fontFamily="Inter,sans-serif" />
                    <YAxis stroke="#c8cce0" fontSize={11} tickLine={false} axisLine={false} fontFamily="Inter,sans-serif" domain={['auto', 'auto']} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #eceef6', borderRadius: '0.5rem', boxShadow: '0 8px 24px rgba(30,33,43,0.12)', fontFamily: 'Inter,sans-serif', fontSize: '0.82rem' }}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontFamily: 'Inter,sans-serif', fontSize: '0.78rem', paddingTop: '0.5rem' }} />
                    {chartKey1 && <Line type="monotone" dataKey={chartKey1} stroke="#2d6a14" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />}
                    {chartKey2 && <Line type="monotone" dataKey={chartKey2} stroke="#d97706" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b8fa8', fontFamily: 'Inter,sans-serif' }}>No trajectory data yet</div>
            )}
          </div>

          {/* Department Rankings */}
          {rest.length > 0 && (
            <div style={{ background: '#ffffff', borderRadius: '0.875rem', padding: '1.5rem', border: '1px solid #eceef6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.125rem' }}>
                <h3 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: '1rem', color: '#1a1e2e', margin: 0 }}>Department Rankings</h3>
                <div style={{ display: 'flex', gap: '2rem' }}>
                  <span style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.72rem', fontWeight: 700, color: '#8b8fa8', letterSpacing: '0.06em' }}>Waste Recovered</span>
                  <span style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.72rem', fontWeight: 700, color: '#8b8fa8', letterSpacing: '0.06em' }}>Efficiency Score</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {rest.map((team, i) => {
                  const abbr = team.team_name.split(/\s+/).map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
                  const efficiencyPct = Math.min(95, Math.max(30, Math.round(team.score * 0.65)));
                  const recovered = Math.round(team.score * 1100 + i * 7800);
                  const ghostApprovals = Math.round(8 + i * 4);
                  return (
                    <div key={team.team_id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.875rem 0', borderBottom: i < rest.length - 1 ? '1px solid #f0f2f8' : 'none' }}>
                      <span style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: '0.95rem', color: '#8b8fa8', minWidth: 18, textAlign: 'right' }}>{team.rank}</span>
                      <div style={{ width: 34, height: 34, borderRadius: '0.5rem', background: '#eceef6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: '0.72rem', color: '#4b5278', flexShrink: 0 }}>{abbr}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 700, fontSize: '0.9rem', color: '#1a1e2e' }}>{team.team_name}</div>
                        <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.72rem', color: '#8b8fa8' }}>
                          Lead: {['Elena Rodriguez', 'Thomas Wright', 'Priya Kapoor', 'James Holland'][i] || team.last_action}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', minWidth: 100 }}>
                        <div style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: '0.9rem', color: '#1a1e2e' }}>₹{recovered.toLocaleString()}</div>
                        <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.68rem', color: '#2d6a14', fontWeight: 700 }}>GHOST APPROVALS: {String(ghostApprovals).padStart(2, '0')}</div>
                      </div>
                      {/* Efficiency bar + % */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 100 }}>
                        <div style={{ flex: 1, height: 5, background: '#eceef6', borderRadius: 999 }}>
                          <div style={{ height: '100%', width: `${efficiencyPct}%`, background: '#2d6a14', borderRadius: 999 }} />
                        </div>
                        <span style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: '0.82rem', color: '#1a1e2e', minWidth: 32, textAlign: 'right' }}>{efficiencyPct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Right column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Personal Card (top 1 team) */}
          {t1 && (
            <div style={{ background: '#2d6a14', borderRadius: '0.875rem', padding: '1.25rem', color: '#ffffff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '1rem' }}>
                <Avatar name={t1.team_name} size={44} bg="rgba(255,255,255,0.18)" />
                <div>
                  <div style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: '0.95rem', color: '#ffffff' }}>{t1.team_name} Lead</div>
                  <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.75rem', color: 'rgba(255,255,255,0.65)' }}>Cloud Architect | Engineering</div>
                </div>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>PERSONAL RANK</div>
                <div style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 900, fontSize: '2rem', color: '#ffffff', letterSpacing: '-0.04em', lineHeight: 1 }}>
                  #{t1.rank} <span style={{ fontSize: '1rem', fontWeight: 500, color: 'rgba(255,255,255,0.55)' }}>/ {leaderboard.length * 150}</span>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {[{ label: 'Impact Score', value: Math.round(t1.score * 0.94) }, { label: 'Total Saved', value: `₹${(t1.score * 0.14).toFixed(1)}k` }].map(s => (
                  <div key={s.label} style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '0.5rem', padding: '0.625rem 0.75rem' }}>
                    <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.65rem', color: 'rgba(255,255,255,0.55)', marginBottom: 2 }}>{s.label}</div>
                    <div style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: '1.05rem', color: '#ffffff' }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hall of Fame */}
          <div style={{ background: '#ffffff', borderRadius: '0.875rem', padding: '1.25rem', border: '1px solid #eceef6' }}>
            <h4 style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: '0.95rem', color: '#1a1e2e', marginBottom: '1rem' }}>Hall of Fame</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {[
                { icon: '1', iconBg: '#fec700', tag: 'BEST OPTIMIZATION • OCT 2023', title: 'S3 Storage Tiering', sub: 'Engineering saved ₹45k/mo by migrating cold data.' },
                { icon: '2', iconBg: '#2d6a14', tag: 'GHOST MASTER • SEP 2023', title: 'Auto-Zombie Killer', sub: 'Alex P. automated 120 shadow instance shutdowns.' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: item.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.9rem' }}>{item.icon}</div>
                  <div>
                    <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.62rem', fontWeight: 700, color: '#8b8fa8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.2rem' }}>{item.tag}</div>
                    <div style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: '0.875rem', color: '#1a1e2e', marginBottom: '0.2rem' }}>{item.title}</div>
                    <div style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.75rem', color: '#6b6f82', lineHeight: 1.45 }}>{item.sub}</div>
                  </div>
                </div>
              ))}
            </div>
            <button style={{ width: '100%', marginTop: '1rem', padding: '0.55rem', borderRadius: '0.5rem', border: '1px solid #d0d4e8', background: '#f6f8ff', color: '#4b5278', fontFamily: 'Inter,sans-serif', fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.04em', cursor: 'pointer' }}>
              VIEW ALL RECORDS
            </button>
          </div>

          {/* Karma Insight */}
          <div style={{ background: '#ffffff', borderRadius: '0.875rem', border: '3px solid #004ac2', overflow: 'hidden' }}>
            <div style={{ background: '#004ac2', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <img src="/insight-icon.png" alt="Insight Icon" style={{ width: 22, height: 22, objectFit: 'contain' }} />
              <div style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 800, fontSize: '0.95rem', color: '#ffffff' }}>Karma Insight</div>
            </div>
            <div style={{ padding: '0.875rem 1rem' }}>
              <p style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.78rem', color: '#6b6f82', lineHeight: 1.55, margin: 0, textAlign: 'center' }}>
                {leaderboard[1]?.team_name || 'Marketing'} is currently <strong style={{ color: '#1a1e2e' }}>12% closer</strong> to the top spot than last month. Their efficiency gain is driven by better RI coverage.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
