import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Users, 
  Filter, 
  Download, 
  Trash2, 
  Search, 
  ChevronDown,
  UserCheck,
  User as UserIcon,
  AlertTriangle,
  Activity,
  ShieldAlert,
  Key,
  UserPlus,
  UserMinus,
  Skull,
  Clock,
  MapPin,
  BookOpen,
  History,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface User {
  full_name: string;
  matric_number: string;
  department: string;
  level: string;
  is_hoc: boolean;
  is_admin: boolean;
}

interface Session {
  id: string;
  course_code: string;
  department: string;
  level: string;
  target_level?: string;
  hoc_matric?: string;
  passcode?: string;
  is_active: boolean;
  created_at: string;
  signedCount?: number;
  totalCount?: number;
}

interface AttendanceLog {
  id: string;
  student_name: string;
  matric_number: string;
  student_matric?: string;
  session_id: string;
  course_code: string;
  signed_at: string;
  signature_data?: string;
}

interface DashboardProps {
  admin: User;
}

const AttendanceChart: React.FC<{ signedCount: number; totalCount: number }> = ({ signedCount, totalCount }) => {
  const data = [
    { name: 'Signed', value: signedCount },
    { name: 'Remaining', value: Math.max(0, totalCount - signedCount) }
  ];
  const COLORS = ['#22c55e', '#374151']; // Green for signed, Dark Gray for remaining
  const percentage = totalCount > 0 ? Math.round((signedCount / totalCount) * 100) : 0;

  return (
    <div className="w-full h-32 relative flex items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie 
            data={data} 
            innerRadius={40} 
            outerRadius={55} 
            paddingAngle={5}
            dataKey="value"
            stroke="none"
            cx="50%"
            cy="50%"
          >
            {data.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index]} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-lg font-bold text-zinc-100">{percentage}%</span>
        <span className="text-[8px] text-zinc-500 uppercase tracking-widest font-bold">Present</span>
      </div>
    </div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ admin }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [history, setHistory] = useState<Session[]>([]);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [sessionAttendees, setSessionAttendees] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [selectedLog, setSelectedLog] = useState<AttendanceLog | null>(null);
  const [view, setView] = useState<'users' | 'sessions' | 'history' | 'logs'>('users');
  const [filterDept, setFilterDept] = useState('All');
  const [filterLevel, setFilterLevel] = useState('All');
  const [histDept, setHistDept] = useState('All');
  const [histLevel, setHistLevel] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); // Auto-refresh every 5s
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .order('full_name', { ascending: true });
    
    // 1. Get Live Sessions
    const { data: liveData } = await supabase
      .from('sessions')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    // Fetch stats for live sessions
    const liveWithStats = liveData ? await Promise.all(liveData.map(async (s) => {
      // 1. Get Signed Students
      const { count: signed } = await supabase
        .from('attendance_logs')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', s.id);

      // 2. Get Total Students in that Dept/Level
      const { count: total } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('department', s.department)
        .eq('level', s.target_level || s.level);

      return { ...s, signedCount: signed || 0, totalCount: total || 0 };
    })) : [];

    // 2. Get Old Sessions (History)
    const { data: oldData } = await supabase
      .from('sessions')
      .select('*')
      .eq('is_active', false)
      .order('created_at', { ascending: false });

    // 3. Get All Attendance Logs
    const { data: logData } = await supabase
      .from('attendance_logs')
      .select('*')
      .order('signed_at', { ascending: false });

    if (userData) setUsers(userData);
    if (liveData) setSessions(liveWithStats);
    if (oldData) setHistory(oldData);
    if (logData) setLogs(logData);
    setLoading(false);
  };

  const handleDeleteUser = async (matric: string, name: string) => {
    const confirmDelete = window.confirm(`Permanently delete ${name} (${matric})?`);
    if (confirmDelete) {
      const { error } = await supabase.from('users').delete().eq('matric_number', matric);
      if (!error) {
        fetchData();
      } else {
        alert("Error deleting user: " + error.message);
      }
    }
  };

  const resetPassword = async (matric: string, name: string) => {
    const newPass = prompt(`Enter new password for ${name}:`); 
    if (newPass && newPass.trim() !== "") {
      const { error } = await supabase.from('users').update({ password: newPass }).eq('matric_number', matric);
      if (!error) {
        alert(`Password for ${name} has been updated to: ${newPass}`);
      } else {
        alert("Error updating password: " + error.message);
      }
    }
  };

  const toggleHoc = async (matric: string, currentStatus: boolean) => {
    const { error } = await supabase.from('users').update({ is_hoc: !currentStatus }).eq('matric_number', matric);
    if (!error) {
      fetchData();
    } else {
      alert("Error toggling HOC status: " + error.message);
    }
  };

  const killSession = async (sessionId: string) => {
    // This updates the 'is_active' column from your screenshot to 'false'
    const { error } = await supabase
      .from('sessions')
      .update({ is_active: false })
      .eq('id', sessionId);

    if (!error) {
      alert("Session Terminated. Students can no longer sign in.");
      fetchData(); // Refresh your list
    } else {
      alert("Error stopping session: " + error.message);
    }
  };

  const wipeAllLogs = async () => {
    const confirmWipe = confirm("Are you sure? This will delete ALL attendance signatures permanently.");
    
    if (confirmWipe) {
      // This targets the 'attendance_logs' table from your schema
      const { error } = await supabase
        .from('attendance_logs')
        .delete()
        .neq('id', 0); // Logic to 'Select All' rows

      if (!error) {
        alert("System Cleaned: All attendance logs have been wiped.");
      } else {
        alert("Error clearing logs: " + error.message);
      }
    }
  };

  const deleteSession = async (id: string) => {
    if (confirm("Permanently delete this session and all its attendance records?")) {
      const { error } = await supabase.from('sessions').delete().eq('id', id);
      if (!error) {
        setSelectedSession(null);
        fetchData();
      } else {
        alert("Error deleting session: " + error.message);
      }
    }
  };

  const deleteLog = async (id: string) => {
    if (confirm("Delete this attendance entry?")) {
      const { error } = await supabase.from('attendance_logs').delete().eq('id', id);
      if (!error) {
        setSelectedLog(null);
        fetchData();
      } else {
        alert("Error deleting log: " + error.message);
      }
    }
  };

  const viewSessionDetails = async (session: Session) => {
    setSelectedSession(session);
    
    // Fetch students for THIS session, ordered by time signed
    // Pulling name from users table automatically via join
    const { data, error } = await supabase
      .from('attendance_logs')
      .select(`
        id,
        signed_at,
        student_matric,
        signature_data,
        users (full_name)
      `)
      .eq('session_id', session.id)
      .order('signed_at', { ascending: true });

    if (!error) {
      setSessionAttendees(data || []);
    } else {
      alert("Error fetching attendees: " + error.message);
    }
  };

  const filteredUsers = users.filter(u => {
    // 1. Check if the Department matches your selection (or 'All')
    const deptMatch = filterDept === 'All' || u.department === filterDept;
    
    // 2. Check if the Level matches your selection (or 'All')
    const levelMatch = filterLevel === 'All' || u.level === filterLevel;
    
    // 3. Keep 'LovethDc' hidden from the table
    const notAdmin = u.matric_number !== 'LovethDc';

    // 4. Search match (keeping this to ensure the search bar remains functional)
    const searchMatch = u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                       u.matric_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       u.level.toLowerCase().includes(searchTerm.toLowerCase());

    // Only return 'true' if the student meets all conditions
    return deptMatch && levelMatch && notAdmin && searchMatch; 
  });

  const filteredHistory = history.filter(s => 
    (histDept === 'All' || s.department === histDept) && 
    (histLevel === 'All' || (s.target_level || s.level) === histLevel)
  );

  const downloadPDF = (session?: Session, attendees?: any[]) => {
    const doc = new jsPDF();
    
    if (session && attendees) {
      // Session Specific Report with Signatures
      const deptLabel = session.department || "Not Specified"; 
      
      doc.setFontSize(16);
      doc.setTextColor(20, 20, 20);
      doc.text(`OFFICIAL ATTENDANCE: ${session.course_code}`, 14, 20);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Department: ${deptLabel} | Level: ${session.target_level || session.level}`, 14, 28);
      doc.text(`Date: ${new Date(session.created_at).toLocaleDateString()} | Generated: ${new Date().toLocaleString()}`, 14, 34);

      autoTable(doc, {
        startY: 40,
        head: [['S/N', 'Full Name', 'Matric Number', 'Signature', 'Time']],
        body: attendees.map((student, index) => [
          index + 1,
          student.users?.full_name || student.student_name || 'N/A',
          student.student_matric,
          '', // Signature cell placeholder
          new Date(student.signed_at).toLocaleTimeString()
        ]),
        didDrawCell: (data) => {
          if (data.section === 'body' && data.column.index === 3) {
            const student = attendees[data.row.index];
            if (student.signature_data) {
              try {
                doc.addImage(
                  student.signature_data, 
                  'PNG', 
                  data.cell.x + 2, 
                  data.cell.y + 2, 
                  15, 
                  6
                );
              } catch (e) {
                console.error("Error adding image to PDF", e);
              }
            }
          }
        },
        columnStyles: {
          3: { cellWidth: 25 },
        },
        styles: { 
          minCellHeight: 12,
          valign: 'middle'
        },
        headStyles: { fillColor: [16, 185, 129] },
      });

      doc.save(`${session.course_code}_Final_Report.pdf`);
    } else {
      // General Student List Report
      const currentHOC = filteredUsers.find(u => u.is_hoc === true);
      const hocName = currentHOC ? currentHOC.full_name : "Not Assigned";

      doc.setFontSize(18);
      doc.setTextColor(20, 20, 20);
      doc.text("FACULTY OF ENGINEERING STUDENT LIST", 14, 20);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);
      
      doc.setFontSize(11);
      doc.setTextColor(40, 40, 40);
      doc.text(`Department: ${filterDept}`, 14, 38);
      doc.text(`Level: ${filterLevel}`, 14, 44);
      doc.text(`Class Representative (HOC): ${hocName}`, 14, 50);

      autoTable(doc, {
        startY: 58,
        head: [['S/N', 'Full Name', 'Matric Number', 'Department', 'Level', 'Status']],
        body: filteredUsers.map((u, i) => [
          i + 1, 
          u.full_name, 
          u.matric_number, 
          u.department,
          u.level,
          u.is_hoc ? 'HOC' : 'Student'
        ]),
        headStyles: { fillColor: [16, 185, 129] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
      });

      doc.save(`${filterDept}_${filterLevel}_List.pdf`);
    }
  };

  const departments = [
    "Mechanical Engineering",
    "Electrical & Electronics Engineering",
    "Civil Engineering",
    "Computer Engineering",
    "Chemical Engineering",
    "Petroleum Engineering",
    "Mechatronics Engineering",
    "Agricultural Engineering"
  ];

  const levels = ['100L', '200L', '300L', '400L', '500L'];

  return (
    <div className="flex flex-col md:flex-row gap-8 w-full max-w-7xl mx-auto">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 space-y-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-2 mb-2">Management</p>
          <button 
            onClick={() => setView('users')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'users' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'text-zinc-400 hover:bg-zinc-800 border border-transparent'}`}
          >
            <Users className="w-5 h-5" />
            <span className="font-medium">Students</span>
          </button>
          <button 
            onClick={() => setView('sessions')}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${view === 'sessions' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'text-zinc-400 hover:bg-zinc-800 border border-transparent'}`}
          >
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5" />
              <span className="font-medium">Live Sessions</span>
            </div>
            {sessions.length > 0 && (
              <span className="bg-emerald-500 text-zinc-950 text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                {sessions.length}
              </span>
            )}
          </button>
          <button 
            onClick={() => setView('history')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'history' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'text-zinc-400 hover:bg-zinc-800 border border-transparent'}`}
          >
            <History className="w-5 h-5" />
            <span className="font-medium">Session History</span>
          </button>
          <button 
            onClick={() => setView('logs')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'logs' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'text-zinc-400 hover:bg-zinc-800 border border-transparent'}`}
          >
            <FileText className="w-5 h-5" />
            <span className="font-medium">Attendance Logs</span>
          </button>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2">
          <p className="text-[10px] font-bold text-rose-500/80 uppercase tracking-widest px-2 mb-2">Danger Zone</p>
          <button 
            onClick={wipeAllLogs}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all"
          >
            <ShieldAlert className="w-5 h-5" />
            <span className="font-medium">Wipe Logs</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 space-y-6">
        <AnimatePresence mode="wait">
          {view === 'users' ? (
            <motion.div 
              key="users-view"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Stats & Controls for Users */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex items-center gap-4">
                  <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm text-zinc-500 font-medium">Filtered Students</p>
                    <h3 className="text-2xl font-bold text-zinc-100">{filteredUsers.length}</h3>
                  </div>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex items-center gap-4">
                  <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500">
                    <Filter className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm text-zinc-500 font-medium">Active Filters</p>
                    <h3 className="text-lg font-bold text-zinc-100 truncate">
                      {filterDept === 'All' ? 'All Depts' : filterDept.split(' ')[0]} • {filterLevel}
                    </h3>
                  </div>
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
                <div className="flex flex-col md:flex-row gap-4 items-end">
                  <div className="flex-1 space-y-2 w-full">
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider ml-1">Search</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input 
                        type="text" 
                        placeholder="Search by name or matric..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2.5 pl-10 pr-4 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 w-full md:w-48">
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider ml-1">Dept</label>
                    <div className="relative">
                      <select 
                        onChange={(e) => setFilterDept(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2.5 pl-4 pr-10 text-zinc-100 appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all"
                      >
                        <option value="All">All</option>
                        {departments.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-2 w-full md:w-32">
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider ml-1">Level</label>
                    <div className="relative">
                      <select 
                        onChange={(e) => setFilterLevel(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2.5 pl-4 pr-10 text-zinc-100 appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all"
                      >
                        <option value="All">All</option>
                        {levels.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                    </div>
                  </div>

                  <button 
                    onClick={downloadPDF}
                    className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 px-6 rounded-xl shadow-lg shadow-emerald-900/20 transition-all flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    PDF
                  </button>
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-800/50 border-bottom border-zinc-800">
                        <th className="p-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Student</th>
                        <th className="p-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Matric</th>
                        <th className="p-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Status</th>
                        <th className="p-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {filteredUsers.length > 0 ? (
                        filteredUsers.map((u) => (
                          <tr key={u.matric_number} className="hover:bg-zinc-800/30 transition-colors group">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:bg-emerald-500/10 group-hover:text-emerald-500 transition-colors">
                                  <UserIcon className="w-4 h-4" />
                                </div>
                                <span className="font-medium text-zinc-200">{u.full_name}</span>
                              </div>
                            </td>
                            <td className="p-4 text-zinc-400 font-mono text-sm">{u.matric_number}</td>
                            <td className="p-4">
                              {u.is_hoc ? (
                                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full">
                                  <UserCheck className="w-3 h-3" />
                                  HOC
                                </span>
                              ) : (
                                <span className="text-xs font-medium text-zinc-500 px-2 py-1">Student</span>
                              )}
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button 
                                  onClick={() => toggleHoc(u.matric_number, u.is_hoc)}
                                  className={`p-2 rounded-lg transition-all ${u.is_hoc ? 'text-amber-500 hover:bg-amber-500/10' : 'text-zinc-500 hover:text-emerald-500 hover:bg-emerald-500/10'}`}
                                  title={u.is_hoc ? "Demote from HOC" : "Promote to HOC"}
                                >
                                  {u.is_hoc ? <UserMinus className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                                </button>
                                <button 
                                  onClick={() => resetPassword(u.matric_number, u.full_name)}
                                  className="p-2 text-zinc-500 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-all"
                                  title="Reset Password"
                                >
                                  <Key className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => handleDeleteUser(u.matric_number, u.full_name)}
                                  className="p-2 text-zinc-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                                  title="Delete Student"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="p-12 text-center text-zinc-500">No students found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          ) : view === 'sessions' ? (
            <motion.div 
              key="sessions-view"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-3">
                  <Activity className="w-6 h-6 text-emerald-500" />
                  Active Attendance Sessions
                </h2>
                <span className="text-xs text-zinc-500 font-medium flex items-center gap-2">
                  <Clock className="w-3 h-3" />
                  Auto-refreshing every 5s
                </span>
              </div>

              {sessions.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {sessions.map((s) => (
                    <motion.div 
                      key={s.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl space-y-4 relative overflow-hidden group"
                    >
                      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl -mr-16 -mt-16 group-hover:bg-emerald-500/10 transition-all" />
                      
                      <div className="flex items-start justify-between relative">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-emerald-500" />
                            <h4 className="text-lg font-bold text-zinc-100 tracking-tight">{s.course_code}</h4>
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-xs font-medium text-emerald-500/80">
                              <strong>Dept:</strong> {s.department}
                            </p>
                            <p className="text-xs text-zinc-500">
                              Level: {s.target_level}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="bg-emerald-500/10 text-emerald-500 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest border border-emerald-500/20">
                            Live
                          </span>
                          <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter">
                            {s.signedCount} / {s.totalCount} Signed
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <AttendanceChart 
                            signedCount={s.signedCount || 0} 
                            totalCount={s.totalCount || 0} 
                          />
                        </div>
                        <div className="flex flex-col gap-2 text-[10px] uppercase tracking-widest font-bold">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-[#22c55e]" />
                            <span className="text-zinc-400">Signed: {s.signedCount}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-[#374151]" />
                            <span className="text-zinc-400">Remaining: {Math.max(0, (s.totalCount || 0) - (s.signedCount || 0))}</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 flex items-center justify-between border-t border-zinc-800">
                        <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                          Started: {new Date(s.created_at).toLocaleTimeString()}
                        </div>
                        <button 
                          onClick={() => killSession(s.id)}
                          className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white text-xs font-bold rounded-xl border border-rose-500/20 transition-all"
                        >
                          <Skull className="w-3 h-3" />
                          FORCE STOP
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center space-y-4">
                  <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto text-zinc-600">
                    <Activity className="w-8 h-8 opacity-20" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-zinc-200 font-semibold">No active sessions</h3>
                    <p className="text-zinc-500 text-sm">There are currently no live attendance sessions being conducted.</p>
                  </div>
                </div>
              )}
            </motion.div>
          ) : view === 'history' ? (
            <motion.div 
              key="history-view"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-3">
                  <History className="w-6 h-6 text-emerald-500" />
                  Session History
                </h2>
              </div>

              {!selectedSession && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
                  <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="space-y-2 flex-1">
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider ml-1">Department</label>
                      <div className="relative">
                        <select 
                          value={histDept}
                          onChange={(e) => setHistDept(e.target.value)}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2.5 pl-4 pr-10 text-zinc-100 appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all"
                        >
                          <option value="All">All Departments</option>
                          {departments.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                      </div>
                    </div>

                    <div className="space-y-2 w-full md:w-48">
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider ml-1">Level</label>
                      <div className="relative">
                        <select 
                          value={histLevel}
                          onChange={(e) => setHistLevel(e.target.value)}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2.5 pl-4 pr-10 text-zinc-100 appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all"
                        >
                          <option value="All">All Levels</option>
                          {levels.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!selectedSession ? (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-zinc-800/50 border-bottom border-zinc-800">
                          <th className="p-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Course</th>
                          <th className="p-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Date</th>
                          <th className="p-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800">
                        {filteredHistory.length > 0 ? (
                          filteredHistory.map((s) => (
                            <tr 
                              key={s.id} 
                              onClick={() => viewSessionDetails(s)}
                              className="hover:bg-zinc-800/30 transition-colors cursor-pointer group"
                            >
                              <td className="p-4 font-medium text-zinc-200">{s.course_code}</td>
                              <td className="p-4 text-zinc-400 text-sm">{new Date(s.created_at).toLocaleDateString()}</td>
                              <td className="p-4 text-right">
                                <button className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 group-hover:bg-emerald-500 group-hover:text-zinc-950 transition-all">
                                  View Details
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={3} className="p-12 text-center text-zinc-500">No session history found matching filters.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <button 
                    onClick={() => setSelectedSession(null)}
                    className="flex items-center gap-2 text-sm font-bold text-zinc-400 hover:text-zinc-100 transition-colors"
                  >
                    ← Back to History
                  </button>
                  
                  <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl space-y-6">
                    <div className="space-y-1">
                      <h3 className="text-2xl font-bold text-zinc-100">{selectedSession.course_code} - Attendance List</h3>
                      <p className="text-zinc-500">Target: {selectedSession.target_level || selectedSession.level} | Date: {new Date(selectedSession.created_at).toLocaleDateString()}</p>
                    </div>

                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-zinc-800/50 border-bottom border-zinc-800">
                              <th className="p-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">S/N</th>
                              <th className="p-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Full Name</th>
                              <th className="p-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Matric</th>
                              <th className="p-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Signature</th>
                              <th className="p-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Time</th>
                              <th className="p-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-800">
                            {sessionAttendees.length > 0 ? (
                              sessionAttendees.map((attendee, index) => (
                                <tr key={attendee.id} className="hover:bg-zinc-800/30 transition-colors">
                                  <td className="p-4 text-zinc-400 text-sm">{index + 1}</td>
                                  <td className="p-4 font-medium text-zinc-200">{attendee.users?.full_name || 'N/A'}</td>
                                  <td className="p-4 text-zinc-400 font-mono text-sm">{attendee.student_matric}</td>
                                  <td className="p-4">
                                    {attendee.signature_data ? (
                                      <img 
                                        src={attendee.signature_data} 
                                        alt="sig" 
                                        className="h-8 object-contain filter contrast-125 brightness-110" 
                                      />
                                    ) : (
                                      <span className="text-[10px] text-zinc-600 italic">No sig</span>
                                    )}
                                  </td>
                                  <td className="p-4 text-zinc-400 text-sm">{new Date(attendee.signed_at).toLocaleTimeString()}</td>
                                  <td className="p-4">
                                    <span className="text-xs font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full">✅ Present</span>
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={5} className="p-12 text-center text-zinc-500">No attendees recorded for this session.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4 pt-4 border-t border-zinc-800">
                      <button 
                        onClick={() => downloadPDF(selectedSession, sessionAttendees)}
                        className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-900/20 transition-all"
                      >
                        <Download className="w-4 h-4" />
                        Download This List
                      </button>
                      <button 
                        onClick={() => deleteSession(selectedSession.id)}
                        className="flex items-center gap-2 px-6 py-3 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white font-bold rounded-xl border border-rose-500/20 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Session Record
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="logs-view"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-3">
                  <FileText className="w-6 h-6 text-emerald-500" />
                  Attendance Logs
                </h2>
              </div>

              {!selectedLog ? (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-zinc-800/50 border-bottom border-zinc-800">
                          <th className="p-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Matric</th>
                          <th className="p-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Time Signed</th>
                          <th className="p-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800">
                        {logs.length > 0 ? (
                          logs.map((l) => (
                            <tr 
                              key={l.id} 
                              onClick={() => setSelectedLog(l)}
                              className="hover:bg-zinc-800/30 transition-colors cursor-pointer group"
                            >
                              <td className="p-4 text-zinc-400 font-mono text-sm">{l.student_matric || l.matric_number}</td>
                              <td className="p-4 text-zinc-400 text-sm">{new Date(l.signed_at).toLocaleTimeString()}</td>
                              <td className="p-4 text-right">
                                <button className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 group-hover:bg-emerald-500 group-hover:text-zinc-950 transition-all">
                                  View Signature
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={3} className="p-12 text-center text-zinc-500">No attendance logs found.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <button 
                    onClick={() => setSelectedLog(null)}
                    className="flex items-center gap-2 text-sm font-bold text-zinc-400 hover:text-zinc-100 transition-colors"
                  >
                    ← Back to List
                  </button>
                  
                  <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl space-y-6">
                    <div className="space-y-1">
                      <h3 className="text-2xl font-bold text-zinc-100">Attendance Signature</h3>
                      <p className="text-zinc-500">Student: <span className="text-zinc-200 font-mono">{selectedLog.student_matric || selectedLog.matric_number}</span></p>
                      <p className="text-zinc-500">Course: <span className="text-zinc-200">{selectedLog.course_code}</span></p>
                      <p className="text-zinc-500">Signed at: <span className="text-zinc-200">{new Date(selectedLog.signed_at).toLocaleString()}</span></p>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Signature Preview</p>
                      <div className="bg-white rounded-xl p-4 flex items-center justify-center min-h-[200px]">
                        {selectedLog.signature_data ? (
                          <img 
                            src={selectedLog.signature_data} 
                            alt="Student Signature" 
                            className="max-w-full h-auto max-h-[300px] object-contain"
                          />
                        ) : (
                          <div className="text-zinc-400 flex flex-col items-center gap-2">
                            <AlertTriangle className="w-8 h-8 opacity-20" />
                            <p className="text-sm">No signature data available</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-zinc-800">
                      <button 
                        onClick={() => deleteLog(selectedLog.id)}
                        className="flex items-center gap-2 px-6 py-3 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white font-bold rounded-xl border border-rose-500/20 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Entry
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Dashboard;
