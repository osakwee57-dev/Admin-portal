import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { Database, Shield, CheckCircle2, XCircle, Loader2, LogOut, LayoutDashboard } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import AdminLogin from './components/AdminLogin';
import Dashboard from './components/Dashboard';

export default function App() {
  const [status, setStatus] = useState<'loading' | 'connected' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    async function checkConnection() {
      try {
        const { error } = await supabase.from('users').select('count', { count: 'exact', head: true });
        
        if (error && error.message.includes('fetch')) {
          throw error;
        }
        
        setStatus('connected');
      } catch (err: any) {
        console.error('Supabase connection error:', err);
        setError(err.message || 'Failed to connect to Supabase');
        setStatus('error');
      }
    }

    checkConnection();
  }, []);

  const handleLoginSuccess = (userData: any) => {
    setUser(userData);
  };

  const handleLogout = () => {
    setUser(null);
  };

  if (!user) {
    return <AdminLogin onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col p-6 font-sans">
      <header className="w-full max-w-6xl mx-auto flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 rounded-xl">
            <LayoutDashboard className="w-6 h-6 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Attendance Admin</h1>
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-semibold">Faculty of Engineering</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden md:flex flex-col items-end mr-2">
            <span className="text-sm font-medium text-zinc-200">{user.full_name}</span>
            <span className="text-[10px] text-emerald-500 uppercase font-bold tracking-tighter">Administrator</span>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-rose-400 transition-all flex items-center gap-2 text-sm font-medium shadow-lg"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div 
            key="dashboard-content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Dashboard admin={user} />
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="w-full max-w-6xl mx-auto mt-12 pt-8 border-t border-zinc-900 flex flex-col md:flex-row items-center justify-between gap-4 text-zinc-600 text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${status === 'connected' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <span>Supabase: {status}</span>
          </div>
          <span>•</span>
          <span>System v1.0.4</span>
        </div>
        <p>© {new Date().getFullYear()} Faculty of Engineering Attendance System</p>
      </footer>
    </div>
  );
}
