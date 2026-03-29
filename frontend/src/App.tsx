import React from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import WasteCalendar from './pages/WasteCalendar';
import GhostApproverSim from './pages/GhostApproverSim';
import DecisionDNA from './pages/DecisionDNA';
import KarmaLeaderboard from './pages/KarmaLeaderboard';
import { Zap, Calendar, MessageSquare, History, Trophy } from 'lucide-react';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-900 text-slate-50 font-sans flex flex-col">
        {/* Top Navbar */}
        <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex shrink-0 items-center space-x-2">
                <Zap className="h-8 w-8 text-teal-400" />
                <span className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-indigo-400 tracking-tight">
                  KARMA
                </span>
              </div>
              
              <nav className="flex space-x-6">
                {[
                  { name: 'Dashboard', path: '/', icon: Zap },
                  { name: 'Waste Calendar', path: '/waste-calendar', icon: Calendar },
                  { name: 'Ghost Approver', path: '/ghost-approver', icon: MessageSquare },
                  { name: 'Decision DNA', path: '/decision-dna', icon: History },
                  { name: 'Leaderboard', path: '/leaderboard', icon: Trophy },
                ].map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.path}
                    className={({ isActive }) =>
                      `group flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        isActive 
                          ? 'bg-slate-800 text-teal-400 shadow-sm border border-slate-700' 
                          : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                      }`
                    }
                  >
                    <item.icon className="h-4 w-4 opacity-75 group-hover:opacity-100" />
                    <span>{item.name}</span>
                  </NavLink>
                ))}
              </nav>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/waste-calendar" element={<WasteCalendar />} />
            <Route path="/ghost-approver" element={<GhostApproverSim />} />
            <Route path="/decision-dna" element={<DecisionDNA />} />
            <Route path="/leaderboard" element={<KarmaLeaderboard />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
