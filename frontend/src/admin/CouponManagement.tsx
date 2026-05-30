import React, { useState, useEffect, useCallback } from 'react';
import { Tag, Plus, X, ChevronDown, ChevronUp, CheckSquare, Square, AlertCircle, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useApp } from '../context/AppContext';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Removed local authHeaders, using useApp().getAuthHeaders instead

const TYPE_LABELS: Record<string, string> = { percentage: 'Percentage', flat: 'Flat Amount', free_shipping: 'Free Shipping' };

interface Coupon {
  _id: string;
  code: string;
  type: string;
  value: number;
  minOrderValue: number;
  perUserLimit: number | null;
  totalCap: number | null;
  usageCount: number;
  allowsStacking: boolean;
  expiresAt: string | null;
  isActive: boolean;
  description: string;
  createdAt: string;
}

interface CouponStats {
  totalUses: number;
  totalRevenue: number;
  averageOrderValue: number;
  totalDiscount: number;
  dailyUsage: Array<{ _id: string; count: number }>;
}

const generateCode = () => Math.random().toString(36).substring(2, 10).toUpperCase();

const SparklineChart: React.FC<{ data: Array<{ _id: string; count: number }> }> = ({ data }) => {
  if (!data.length) return <span className="text-xs text-gray-400">No data</span>;
  const max = Math.max(...data.map(d => d.count), 1);
  const width = 120;
  const height = 30;
  const points = data.map((d, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * width;
    const y = height - (d.count / max) * height;
    return `${x},${y}`;
  });
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={points.join(' ')} fill="none" stroke="#8B0000" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
};

const CouponManagement: React.FC = () => {
  const { getAuthHeaders } = useApp();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedStats, setExpandedStats] = useState<Record<string, CouponStats>>({});
  const [showBuilder, setShowBuilder] = useState(false);
  const [deactivateConfirm, setDeactivateConfirm] = useState(false);
  const [formData, setFormData] = useState({
    code: generateCode(), type: 'percentage', value: '', minOrderValue: '', perUserLimit: '', totalCap: '',
    allowsStacking: false, expiresAt: '', description: '',
  });

  const LIMIT = 20;

  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (activeFilter) params.set('active', activeFilter);
      const headers = await getAuthHeaders();
      const r = await fetch(`${API}/api/v1/admin/coupons?${params}`, { headers });
      const d = await r.json();
      if (d.success) { setCoupons(d.data); setTotal(d.total); }
    } catch { toast.error('Failed to load coupons'); }
    finally { setLoading(false); }
  }, [page, activeFilter, getAuthHeaders]);

  useEffect(() => { fetchCoupons(); }, [fetchCoupons]);

  const fetchStats = async (id: string) => {
    if (expandedStats[id]) return;
    try {
      const headers = await getAuthHeaders();
      const r = await fetch(`${API}/api/v1/admin/coupons/${id}/stats`, { headers });
      const d = await r.json();
      if (d.success) setExpandedStats(s => ({ ...s, [id]: d.data }));
    } catch { toast.error('Failed to load stats'); }
  };

  const handleToggleExpand = (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    fetchStats(id);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const body: Record<string, unknown> = {
        code: formData.code, type: formData.type, value: parseFloat(formData.value) || 0,
        allowsStacking: formData.allowsStacking,
      };
      if (formData.minOrderValue) body.minOrderValue = parseFloat(formData.minOrderValue);
      if (formData.perUserLimit) body.perUserLimit = parseInt(formData.perUserLimit);
      if (formData.totalCap) body.totalCap = parseInt(formData.totalCap);
      if (formData.expiresAt) body.expiresAt = formData.expiresAt;
      if (formData.description) body.description = formData.description;

      const headers = await getAuthHeaders();
      const r = await fetch(`${API}/api/v1/admin/coupons`, { method: 'POST', headers, body: JSON.stringify(body) });
      const d = await r.json();
      if (d.success) { toast.success(`Coupon "${d.data.code}" created`); setShowBuilder(false); fetchCoupons(); }
      else toast.error(d.message);
    } catch { toast.error('Create failed'); }
  };

  const handleBulkDeactivate = async () => {
    try {
      const headers = await getAuthHeaders();
      const r = await fetch(`${API}/api/v1/admin/coupons/bulk-deactivate`, {
        method: 'PATCH', headers, body: JSON.stringify({ ids: [...selectedIds] }),
      });
      const d = await r.json();
      if (d.success) { toast.success(`${d.deactivated} coupons deactivated`); setSelectedIds(new Set()); fetchCoupons(); }
      else toast.error(d.message);
    } catch { toast.error('Deactivation failed'); }
    finally { setDeactivateConfirm(false); }
  };

  const selectAllExpired = () => {
    const expiredIds = coupons.filter(c => c.expiresAt && new Date(c.expiresAt) < new Date()).map(c => c._id);
    setSelectedIds(new Set(expiredIds));
    if (expiredIds.length === 0) toast('No expired coupons on this page', { icon: 'ℹ️' });
  };

  const isExpired = (c: Coupon) => c.expiresAt && new Date(c.expiresAt) < new Date();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Tag size={22} className="text-dark-red" /> Coupon Management</h2>
          <p className="text-sm text-gray-500 mt-0.5">{total} total coupons</p>
        </div>
        <button onClick={() => { setShowBuilder(true); setFormData(f => ({ ...f, code: generateCode() })); }}
          className="flex items-center gap-2 px-4 py-2 bg-dark-red text-white rounded-xl text-sm font-medium hover:bg-ruby-red transition-all shadow-sm">
          <Plus size={16} /> New Coupon
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap items-center">
        {[['', 'All'], ['true', 'Active'], ['false', 'Inactive']].map(([val, label]) => (
          <button key={val} onClick={() => { setActiveFilter(val); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${activeFilter === val ? 'bg-dark-red text-white border-dark-red' : 'bg-silk-light/50 text-grey-beige border-transparent hover:border-silk'}`}>
            {label}
          </button>
        ))}
        <button onClick={selectAllExpired} className="px-3 py-1.5 rounded-lg text-sm border border-transparent bg-silk-light/50 text-grey-beige hover:border-amber-400 hover:text-amber-600 transition-all">
          Select All Expired
        </button>
      </div>

      {/* Coupon List */}
      {loading ? (
        <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-2 border-dark-red border-t-transparent rounded-full animate-spin" /></div>
      ) : coupons.length === 0 ? (
        <div className="text-center py-16 text-gray-400"><Tag size={36} className="mx-auto mb-3 opacity-30" /><p>No coupons found</p></div>
      ) : (
        <div className="space-y-2">
          {coupons.map(coupon => {
            const isSelected = selectedIds.has(coupon._id);
            const expired = isExpired(coupon);
            const isOpen = expandedId === coupon._id;
            const stats = expandedStats[coupon._id];
            return (
              <div key={coupon._id} className={`border rounded-2xl overflow-hidden transition-all ${isSelected ? 'border-dark-red bg-red-50/50' : 'border-silk-light bg-white hover:bg-silk-light/10'}`}>
                <div className="flex items-center gap-3 p-4">
                  <button onClick={() => setSelectedIds(s => { const n = new Set(s); isSelected ? n.delete(coupon._id) : n.add(coupon._id); return n; })}>
                    {isSelected ? <CheckSquare size={18} className="text-dark-red" /> : <Square size={18} className="text-gray-300" />}
                  </button>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleToggleExpand(coupon._id)}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-gray-800">{coupon.code}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${coupon.isActive && !expired ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {expired ? 'Expired' : coupon.isActive ? 'Active' : 'Inactive'}
                      </span>
                      {coupon.allowsStacking && <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-600">Stackable</span>}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {TYPE_LABELS[coupon.type]}
                      {coupon.type !== 'free_shipping' && ` · ${coupon.type === 'percentage' ? `${coupon.value}%` : `₹${coupon.value}`} off`}
                      {coupon.minOrderValue > 0 && ` · Min ₹${coupon.minOrderValue}`}
                      {coupon.expiresAt && ` · Expires ${new Date(coupon.expiresAt).toLocaleDateString('en-IN')}`}
                    </p>
                  </div>
                  <div className="text-sm text-gray-500 hidden sm:block">
                    {coupon.usageCount}{coupon.totalCap ? `/${coupon.totalCap}` : ''} uses
                  </div>
                  <button onClick={() => handleToggleExpand(coupon._id)}>
                    {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </button>
                </div>

                {/* Stats Panel */}
                {isOpen && (
                  <div className="border-t border-silk-light p-5 bg-silk-light/20">
                    {!stats ? (
                      <div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-dark-red border-t-transparent rounded-full animate-spin" /></div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                        {[
                          { label: 'Total Uses', value: stats.totalUses },
                          { label: 'Revenue Attributed', value: `₹${(stats.totalRevenue || 0).toLocaleString('en-IN')}` },
                          { label: 'Avg. Order Value', value: `₹${stats.averageOrderValue?.toLocaleString('en-IN') || 0}` },
                          { label: 'Total Discount Given', value: `₹${(stats.totalDiscount || 0).toLocaleString('en-IN')}` },
                        ].map(s => (
                          <div key={s.label} className="bg-white rounded-xl p-3 border border-gray-100">
                            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                            <p className="font-bold text-gray-800">{s.value}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {stats?.dailyUsage?.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 mb-2">Daily Usage (30d)</p>
                        <SparklineChart data={stats.dailyUsage} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {Math.ceil(total / LIMIT) > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: Math.ceil(total / LIMIT) }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)}
              className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${page === p ? 'bg-dark-red text-white' : 'bg-silk-light text-dark-red hover:bg-silk'}`}>{p}</button>
          ))}
        </div>
      )}

      {/* Sticky Bulk-Deactivate Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white rounded-2xl shadow-2xl px-5 py-3.5 flex items-center gap-4 z-40">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <button onClick={() => setSelectedIds(new Set())} className="text-gray-400 hover:text-white transition-colors"><X size={16} /></button>
          <button onClick={() => setDeactivateConfirm(true)}
            className="flex items-center gap-2 px-4 py-1.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-all">
            <Trash2 size={14} /> Deactivate Selected
          </button>
        </div>
      )}

      {/* Deactivate Confirm Modal */}
      {deactivateConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center">
            <AlertCircle size={36} className="mx-auto mb-3 text-red-500" />
            <h3 className="text-lg font-bold text-gray-800 mb-2">Deactivate {selectedIds.size} Coupon{selectedIds.size > 1 ? 's' : ''}?</h3>
            <p className="text-sm text-gray-500 mb-5">These coupons will no longer be usable at checkout.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeactivateConfirm(false)} className="flex-1 px-4 py-2.5 border border-silk-light rounded-xl text-sm font-medium hover:bg-silk-light/50 transition-all">Cancel</button>
              <button onClick={handleBulkDeactivate} className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-all">Deactivate</button>
            </div>
          </div>
        </div>
      )}

      {/* Coupon Builder Modal */}
      {showBuilder && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg my-4">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-800">New Coupon</h3>
              <button onClick={() => setShowBuilder(false)} className="p-1 hover:bg-gray-100 rounded-lg transition-all"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              {/* Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Coupon Code</label>
                <div className="flex gap-2">
                  <input value={formData.code} onChange={e => setFormData(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-dark-red/20" required />
                  <button type="button" onClick={() => setFormData(f => ({ ...f, code: generateCode() }))}
                    className="px-3 py-2 bg-silk-light/50 rounded-xl text-xs text-dark-red hover:bg-silk-light transition-all whitespace-nowrap">Auto-generate</button>
                </div>
              </div>
              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Discount Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['percentage', 'flat', 'free_shipping'] as const).map(t => (
                    <button key={t} type="button" onClick={() => setFormData(f => ({ ...f, type: t }))}
                      className={`py-2 rounded-xl border-2 text-sm font-medium transition-all ${formData.type === t ? 'border-dark-red bg-red-50 text-dark-red' : 'border-silk-light text-grey-beige hover:border-silk'}`}>
                      {TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>
              {/* Value */}
              {formData.type !== 'free_shipping' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {formData.type === 'percentage' ? 'Percentage Value (1–100)' : 'Flat Amount (₹)'}
                  </label>
                  <input type="number" value={formData.value} onChange={e => setFormData(f => ({ ...f, value: e.target.value }))}
                    min={1} max={formData.type === 'percentage' ? 100 : undefined}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dark-red/20" required />
                </div>
              )}
              {/* Grid fields */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'minOrderValue', label: 'Min Order Value (₹)', placeholder: 'Optional' },
                  { key: 'perUserLimit', label: 'Per-User Limit', placeholder: 'Unlimited' },
                  { key: 'totalCap', label: 'Total Redemption Cap', placeholder: 'Unlimited' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                    <input type="number" placeholder={f.placeholder} value={(formData as unknown as Record<string, string>)[f.key]}
                      onChange={e => setFormData(prev => ({ ...prev, [f.key]: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dark-red/20" />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Expiry Date</label>
                  <input type="date" value={formData.expiresAt} onChange={e => setFormData(f => ({ ...f, expiresAt: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dark-red/20" />
                </div>
              </div>
              {/* Stacking Toggle */}
              <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer">
                <input type="checkbox" checked={formData.allowsStacking} onChange={e => setFormData(f => ({ ...f, allowsStacking: e.target.checked }))} className="w-4 h-4 accent-red-700" />
                <div>
                  <p className="text-sm font-medium text-gray-800">Allow stacking</p>
                  <p className="text-xs text-gray-500">Can be combined with other coupons at checkout</p>
                </div>
              </label>
              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <input value={formData.description} onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
                  placeholder="Internal note about this coupon..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dark-red/20" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowBuilder(false)} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-all">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2.5 bg-dark-red text-white rounded-xl text-sm font-medium hover:bg-red-800 transition-all">Create Coupon</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CouponManagement;
