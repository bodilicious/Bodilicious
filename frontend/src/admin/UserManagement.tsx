import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Search, 
  Shield, 
  ChevronLeft,
  ChevronRight,
  Mail,
  Calendar,
  Download,
  Crown,
  Users
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { User } from '../types';
import toast from 'react-hot-toast';
import Select from '../components/Select';

const UserManagement: React.FC = () => {
  const { getAuthHeaders, user: currentUser, isPrimaryAdmin } = useApp();
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const [filters, setFilters] = useState({ 
    role: '', 
    isBlocked: '', 
    segment: queryParams.get('segment') || '' 
  });

  const SEGMENT_CONFIG = [
    { key: 'high_value', label: 'High Value', color: 'bg-amber-50 border-amber-200 text-amber-700', dot: 'bg-amber-400' },
    { key: 'loyal', label: 'Loyal', color: 'bg-teal-50 border-teal-200 text-teal-700', dot: 'bg-teal-400' },
    { key: 'at_risk', label: 'At Risk', color: 'bg-red-50 border-red-200 text-red-600', dot: 'bg-red-400' },
    { key: 'new', label: 'New', color: 'bg-blue-50 border-blue-200 text-blue-700', dot: 'bg-blue-400' },
  ];

  const [segmentStats, setSegmentStats] = useState<Array<{
    segment: string; customerCount: number; aov: number; revenueShare: number;
  }>>([]);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const query = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        search,
        role: filters.role,
        isBlocked: filters.isBlocked
      });
      if (filters.segment) query.set('segment', filters.segment);

      const res = await fetch(`${API_URL}/api/v1/admin/users?${query}`, { headers });
      const data = await res.json();
      
      if (data.success) {
        setUsers(data.data);
        setTotal(data.total);
        setPages(data.pages);
      }
    } catch (err) {
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, API_URL, page, search, filters]);

  useEffect(() => {
    const timeout = setTimeout(fetchUsers, 300);
    return () => clearTimeout(timeout);
  }, [fetchUsers]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, filters]);

  // Fetch segment stats
  useEffect(() => {
    const loadStats = async () => {
      try {
        const headers = await getAuthHeaders();
        const r = await fetch(`${API_URL}/api/v1/admin/segments/stats`, { headers });
        const d = await r.json();
        if (d.success) setSegmentStats(d.data);
      } catch { /* non-critical */ }
    };
    loadStats();
  }, [getAuthHeaders, API_URL]);

  const handleSegmentExport = async (segment: string) => {
    try {
      const headers = await getAuthHeaders();
      const r = await fetch(`${API_URL}/api/v1/admin/segments/${segment}/export`, { headers });
      if (!r.ok) { toast.error('Export failed'); return; }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `customers_${segment}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Export failed'); }
  };

  const handleCompute = async () => {
    setComputing(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/v1/admin/segments/compute`, {
        method: 'POST',
        headers
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        // Refresh stats
        const r = await fetch(`${API_URL}/api/v1/admin/segments/stats`, { headers });
        const d = await r.json();
        if (d.success) setSegmentStats(d.data);
        fetchUsers();
      } else {
        throw new Error(data.message);
      }
    } catch (err: any) {
      toast.error(err.message || 'Computation failed');
    } finally {
      setComputing(false);
    }
  };

  // @ts-ignore
  const handleToggleBlock = async (id: string, currentlyBlocked: boolean) => {
    if (id === currentUser?.uid) {
      toast.error("You cannot block yourself");
      return;
    }
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/v1/admin/users/${id}/block`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ isBlocked: !currentlyBlocked })
      });
      if (res.ok) {
        toast.success(`User ${!currentlyBlocked ? 'blocked' : 'unblocked'}`);
        fetchUsers();
      } else {
        const error = await res.json();
        toast.error(error.message);
      }
    } catch (err) {
      toast.error('Operation failed');
    }
  };

  const handleChangeRole = async (id: string, currentRole: string) => {
    if (!isPrimaryAdmin) {
      toast.error('Only the Primary Admin can change roles');
      return;
    }
    if (id === currentUser?.uid) {
      toast.error("You cannot demote yourself");
      return;
    }
    if (currentRole === 'primary_admin') {
      toast.error('Cannot change the role of a Primary Admin');
      return;
    }
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/v1/admin/users/${id}/role`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ role: newRole })
      });
      if (res.ok) {
        toast.success(`User promoted to ${newRole}`);
        fetchUsers();
      } else {
        const error = await res.json();
        toast.error(error.message);
      }
    } catch (err) {
      toast.error('Failed to update role');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-serif font-bold text-dark-red">Users & Segments</h2>
        <button
          onClick={handleCompute}
          disabled={computing}
          className="bg-white border border-silk-light px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-sm text-dark-red hover:bg-silk-light transition-all text-sm disabled:opacity-50"
        >
          {computing ? 'Computing...' : 'Recompute Segments'}
        </button>
      </div>

      {/* Segment Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {SEGMENT_CONFIG.map(seg => {
          const stats = segmentStats.find(s => s.segment === seg.key);
          const isSelected = filters.segment === seg.key;
          return (
            <div 
              key={seg.key} 
              onClick={() => setFilters(prev => ({ ...prev, segment: isSelected ? '' : seg.key }))}
              className={`rounded-2xl border p-4 cursor-pointer transition-all hover:shadow-md ${seg.color} ${isSelected ? 'ring-2 ring-offset-2 ring-current opacity-100' : 'opacity-80 hover:opacity-100'}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${seg.dot}`} />
                  <span className="text-sm font-semibold">{seg.label}</span>
                </div>
                <button onClick={(e) => { e.stopPropagation(); handleSegmentExport(seg.key); }}
                  title="Download CSV"
                  className="p-1 hover:opacity-70 transition-opacity">
                  <Download size={14} />
                </button>
              </div>
              <p className="text-2xl font-bold">{stats?.customerCount ?? '—'}</p>
              <p className="text-xs mt-1 opacity-70">
                AOV ₹{stats?.aov?.toLocaleString('en-IN') ?? '—'} · {stats?.revenueShare ?? '—'}% revenue
              </p>
            </div>
          );
        })}
      </div>
      {/* Actions & Filters */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-grey-beige" size={18} />
          <input 
            type="text" 
            placeholder="Search by name or email..." 
            className="w-full pl-11 pr-4 py-3 bg-silk-light/50 border-none rounded-2xl outline-none focus:ring-2 ring-dark-red/20 transition-all text-dark-red placeholder:text-grey-beige"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <Select
            className="w-48"
            value={filters.role}
            onChange={(val) => setFilters(prev => ({ ...prev, role: val as string }))}
            options={[
              { value: '', label: 'All Roles' },
              { value: 'primary_admin', label: 'Primary Admin' },
              { value: 'admin', label: 'Admin' },
              { value: 'user', label: 'Users' }
            ]}
          />
          <Select
            className="w-48"
            value={filters.segment}
            onChange={(val) => setFilters(prev => ({ ...prev, segment: val as string }))}
            options={[
              { value: '', label: 'All Segments' },
              { value: 'high_value', label: 'High Value' },
              { value: 'loyal', label: 'Loyal' },
              { value: 'at_risk', label: 'At Risk' },
              { value: 'new', label: 'New' }
            ]}
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="table-scroll-container">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-silk-light">
              <th className="px-6 py-4 text-xs font-bold text-grey-beige uppercase tracking-wider">User</th>
              <th className="px-6 py-4 text-xs font-bold text-grey-beige uppercase tracking-wider">Segments</th>
              <th className="px-6 py-4 text-xs font-bold text-grey-beige uppercase tracking-wider">Role</th>
              <th className="px-6 py-4 text-xs font-bold text-grey-beige uppercase tracking-wider">Orders</th>
              <th className="px-6 py-4 text-xs font-bold text-grey-beige uppercase tracking-wider">Revenue</th>
              <th className="px-6 py-4 text-xs font-bold text-grey-beige uppercase tracking-wider">Last Login</th>
              <th className="px-6 py-4 text-xs font-bold text-grey-beige uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-silk-light/50">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-silk-light/50 animate-pulse">
                  <td className="px-6 py-4"><div className="flex items-center gap-4"><div className="skeleton h-10 w-10 rounded-full" /><div><div className="skeleton h-4 w-32 mb-1" /><div className="skeleton h-3 w-40" /></div></div></td>
                  <td className="px-6 py-4"><div className="flex gap-1"><div className="skeleton h-4 w-16 rounded" /><div className="skeleton h-4 w-12 rounded" /></div></td>
                  <td className="px-6 py-4"><div className="skeleton h-5 w-20 rounded-full" /></td>
                  <td className="px-6 py-4"><div className="skeleton h-4 w-10" /></td>
                  <td className="px-6 py-4"><div className="skeleton h-4 w-16" /></td>
                  <td className="px-6 py-4"><div className="skeleton h-4 w-24" /></td>
                  <td className="px-6 py-4"><div className="skeleton h-8 w-20 ml-auto" /></td>
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-16 text-center text-gray-400">
                  <Users size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No users found</p>
                </td>
              </tr>
            ) : users.map((u) => (
              <tr
                key={(u as any)._id || u.uid}
                className={`group transition-colors cursor-pointer border-l-4 ${
                  (u as any).hasOpenQuery || (u as any).hasPaymentFailure
                    ? 'bg-rose-50 hover:bg-rose-100 border-ruby-red'
                    : 'hover:bg-silk-light/30 border-transparent'
                }`}
                onClick={() => navigate(`/admin/users/${(u as any)._id || u.uid}`)}
                title="Click to view full customer profile"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-silk-light overflow-hidden flex items-center justify-center text-dark-red font-bold border border-silk-light">
                      {u.photoURL ? <img src={u.photoURL} alt="" /> : ((u as any).name || u.displayName || 'U')[0]}
                    </div>
                    <div>
                      <h4 className="font-bold text-dark-red text-sm flex items-center gap-2">
                        {(u as any).name || u.displayName || u.email?.split('@')[0] || 'Unknown User'}
                        {((u as any).hasOpenQuery || (u as any).hasPaymentFailure) && (
                          <span className="w-2 h-2 rounded-full bg-ruby-red animate-pulse" title="Requires Attention" />
                        )}
                      </h4>
                      <p className="flex items-center gap-1 text-xs text-grey-beige font-medium font-mono lowercase">
                        <Mail size={12} /> {u.email}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-1 flex-wrap">
                    {((u as any).segment || []).map((seg: string) => (
                      <span key={seg} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-bold uppercase tracking-wider">
                        {seg.replace('_', ' ')}
                      </span>
                    ))}
                    {((u as any).segment || []).length === 0 && (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    u.role === 'primary_admin'
                      ? 'bg-amber-100 text-amber-700'
                      : u.role === 'admin'
                      ? 'bg-dark-red/10 text-dark-red'
                      : 'bg-silk-light text-grey-beige'
                  }`}>
                    {u.role === 'primary_admin' && <Crown size={10} />}
                    {u.role === 'primary_admin' ? 'Primary Admin' : u.role || 'user'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm font-bold text-dark-red">
                  {((u as any).totalOrders || 0).toLocaleString()}
                </td>
                <td className="px-6 py-4 text-sm font-bold text-dark-red">
                  ₹{((u as any).totalRevenue || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </td>
                <td className="px-6 py-4 text-sm text-grey-beige">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} />
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    {/* Role-change button: only visible to Primary Admin, hidden for primary_admin targets */}
                    {isPrimaryAdmin && u.role !== 'primary_admin' && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleChangeRole((u as any)._id, u.role || 'user'); }}
                        className="admin-action-btn text-grey-beige"
                        title={u.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}
                      >
                        <Shield size={18} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center pt-6 border-t border-silk-light">
        <p className="text-sm text-grey-beige">
          Showing <span className="font-bold text-dark-red">{users.length}</span> of <span className="font-bold text-dark-red">{total}</span> users
        </p>
        <div className="flex gap-2">
          <button 
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 flex items-center gap-1 border border-silk-light rounded-xl disabled:opacity-30 hover:bg-silk-light text-dark-red font-bold text-sm transition-colors"
          >
            <ChevronLeft size={16} /> <span className="hidden sm:inline">Previous</span>
          </button>
          <div className="flex items-center px-4 font-bold text-sm text-dark-red">
            Page {pages === 0 ? 0 : page} of {pages}
          </div>
          <button 
            disabled={page >= pages || pages === 0}
            onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 flex items-center gap-1 border border-silk-light rounded-xl disabled:opacity-30 hover:bg-silk-light text-dark-red font-bold text-sm transition-colors"
          >
            <span className="hidden sm:inline">Next</span> <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
