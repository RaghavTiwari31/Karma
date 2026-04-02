import React from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import WasteCalendar from './pages/WasteCalendar';
import GhostApproverSim from './pages/GhostApproverSim';
import DecisionDNA from './pages/DecisionDNA';
import KarmaLeaderboard from './pages/KarmaLeaderboard';
import { Bell, Cog, Zap } from 'lucide-react';

const TOP_TABS = [
  { label: 'Dashboard',      path: '/',              end: true },
  { label: 'Waste Calendar', path: '/waste-calendar' },
  { label: 'Ghost Approver', path: '/ghost-approver' },
  { label: 'Decision DNA',   path: '/decision-dna' },
  { label: 'Leaderboard',   path: '/leaderboard' },
];

/* ── Top bar ── */
function TopBar() {
  return (
    <div style={{ background: '#ffffff', borderBottom: '1px solid #eceef6', padding: '0 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 55, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
        <div style={{ fontFamily: 'Manrope,sans-serif', fontWeight: 900, fontSize: '1.2rem', color: '#1a1e2e', letterSpacing: '-0.02em', marginTop: '-2px' }}>KARMA</div>
        <nav style={{ display: 'flex', gap: 0 }}>
          {TOP_TABS.map(tab => (
            <NavLink key={tab.path} to={tab.path} end={tab.end}
              style={({ isActive }) => ({
                textDecoration: 'none', padding: '0 1rem', height: 55, display: 'inline-flex', alignItems: 'center',
                fontFamily: 'Inter,sans-serif', fontWeight: isActive ? 700 : 500, fontSize: '0.875rem',
                color: isActive ? '#1a1e2e' : '#8b8fa8',
                borderBottom: isActive ? '2px solid #1a1e2e' : '2px solid transparent',
                transition: 'color 0.15s, border-color 0.15s',
              })}>
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
        <Bell size={17} color="#8b8fa8" style={{ cursor: 'pointer' }} />
        <Cog size={17} color="#8b8fa8" style={{ cursor: 'pointer' }} />
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#2d6a14,#1a4a08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <Zap size={14} color="#d5ffbb" fill="#d5ffbb" />
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f0f2f8', flexDirection: 'column' }}>
        <TopBar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
            <Routes>
              <Route path="/"               element={<Dashboard />} />
              <Route path="/waste-calendar" element={<WasteCalendar />} />
              <Route path="/ghost-approver" element={<GhostApproverSim />} />
              <Route path="/decision-dna"   element={<DecisionDNA />} />
              <Route path="/leaderboard"    element={<KarmaLeaderboard />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
