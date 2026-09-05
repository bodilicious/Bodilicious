import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Tag, Plus, X, ChevronDown, ChevronUp, CheckSquare, Square, AlertCircle, Trash2, Package, Search, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { useApp } from '../context/AppContext';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const TYPE_LABELS: Record<string, string> = {
  percentage: 'Percentage',
  flat: 'Flat Amount',
  free_shipping: 'Free Shipping',
};

interface ProductOption {
  _id: string;
  name: string;
  pid: string;
}

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
  applicableProducts: ProductOption[];
}

interface CouponStats {
  totalUses: number;
  totalRevenue: number;
  averageOrderValue: number;
  totalDiscount: number;
  dailyUsage: Array<{ _id: string; count: number }>;
}

type FormState = {
  code: string;
  type: string;
  value: string;
  minOrderValue: string;
  perUserLimit: string;
  totalCap: string;
  allowsStacking: boolean;
  expiresAt: string;
  description: string;
  applicableProducts: ProductOption[];
};

const blankForm = (): FormState => ({
  code: Math.random().toString(36).substring(2, 10).toUpperCase(),
  type: 'percentage',
  value: '',
  minOrderValue: '',
  perUserLimit: '',
  totalCap: '',
  allowsStacking: false,
  expiresAt: '',
  description: '',
  applicableProducts: [],
});

const couponToForm = (c: Coupon): FormState => ({
  code: c.code,
  type: c.type,
  value: String(c.value ?? ''),
  minOrderValue: c.minOrderValue ? String(c.minOrderValue) : '',
  perUserLimit: c.perUserLimit != null ? String(c.perUserLimit) : '',
  totalCap: c.totalCap != null ? String(c.totalCap) : '',
  allowsStacking: c.allowsStacking,
  expiresAt: c.expiresAt ? c.expiresAt.substring(0, 10) : '',
  description: c.description ?? '',
  applicableProducts: c.applicableProducts ?? [],
});

// ── Sparkline ────────────────────────────────────────────────────────────────
const SparklineChart: React.FC<{ data: Array<{ _id: string; count: number }> }> = ({ data }) => {
  if (!data.length) return <span className="text-xs text-gray-400">No data</span>;
  const max = Math.max(...data.map(d => d.count), 1);
  const width = 120, height = 30;
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

// ── Product Picker ───────────────────────────────────────────────────────────
interface ProductPickerProps {
  selected: ProductOption[];
  onChange: (products: ProductOption[]) => void;
}

const ProductPicker: React.FC<ProductPickerProps> = ({ selected, onChange }) => {
  const { getAuthHeaders } = useApp();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductOption[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedIds = new Set(selected.map(p => p._id));

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const headers = await getAuthHeaders();
      const r = await fetch(
        `${API}/api/v1/products?search=${encodeURIComponent(q)}&slim=true&limit=10`,
        { headers },
      );
      const d = await r.json();
      // The products endpoint returns `products` (canonical) and `data` (compat alias).
      if (d.success) {
        setResults((d.products || []).map((p: { _id: string; name: string; pid: string }) => ({
          _id: p._id, name: p.name, pid: p.pid,
        })));
      }
    } catch { /* silent — empty results are safe */ } finally { setSearching(false); }
  }, [getAuthHeaders]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  };

  // Prevent Enter in the search field from submitting the parent coupon form
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.preventDefault();
  };

  const select = (p: ProductOption) => {
    if (!selectedIds.has(p._id)) onChange([...selected, p]);
    setQuery(''); setResults([]); setOpen(false);
  };
  const remove = (id: string) => onChange(selected.filter(p => p._id !== id));

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div ref={containerRef}>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map(p => (
            <span key={p._id} className="flex items-center gap-1 px-2 py-1 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-700">
              <Package size={10} />
              <span className="font-medium">{p.name}</span>
              <span className="text-purple-400">({p.pid})</span>
              <button type="button" onClick={() => remove(p._id)} className="ml-0.5 hover:text-purple-900 transition-colors">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-dark-red/20">
          <Search size={14} className="text-gray-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onFocus={() => query && setOpen(true)}
            placeholder="Search products to restrict&hellip;"
            className="flex-1 text-sm bg-transparent focus:outline-none"
          />
          {searching && <div className="w-3 h-3 border border-dark-red border-t-transparent rounded-full animate-spin shrink-0" />}
        </div>
        {open && results.length > 0 && (
          <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
            {results.map(p => (
              <button
                key={p._id} type="button" onClick={() => select(p)} disabled={selectedIds.has(p._id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-silk-light/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Package size={12} className="text-gray-400 shrink-0" />
                <span className="font-medium text-gray-800 truncate">{p.name}</span>
                <span className="text-gray-400 text-xs ml-auto shrink-0">{p.pid}</span>
                {selectedIds.has(p._id) && <span className="text-xs text-green-600 shrink-0">Added</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400 mt-1.5">
        {selected.length === 0
          ? 'Leave empty to apply discount to the entire cart'
          : `Discount applies to ${selected.length} selected product${selected.length > 1 ? 's' : ''} only`}
      </p>
    </div>
  );
};

// ── Shared coupon form (create + edit) ───────────────────────────────────────
interface CouponFormProps {
  formData: FormState;
  setFormData: React.Dispatch<React.SetStateAction<FormState>>;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
  isEdit?: boolean;
}

const CouponForm: React.FC<CouponFormProps> = ({
  formData, setFormData, onSubmit, onCancel, submitLabel, isEdit = false,
}) => {
  const handleTypeChange = (newType: string) => {
    const update: Partial<FormState> = { type: newType };
    // When switching to free_shipping, clear any product restrictions and notify
    // so the admin understands why they disappeared and doesn't resubmit with both.
    if (newType === 'free_shipping' && formData.applicableProducts.length > 0) {
      update.applicableProducts = [];
      toast('Product restrictions cleared \u2014 free shipping applies to the whole order', { icon: '\u2139\ufe0f' });
    }
    setFormData(f => ({ ...f, ...update }));
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Code — read-only in edit mode (code is the identifier, not editable) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Coupon Code</label>
        <div className="flex gap-2">
          <input
            value={formData.code}
            onChange={e => setFormData(f => ({ ...f, code: e.target.value.toUpperCase() }))}
            readOnly={isEdit}
            className={`flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-dark-red/20 ${isEdit ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
            required
          />
          {!isEdit && (
            <button
              type="button"
              onClick={() => setFormData(f => ({ ...f, code: Math.random().toString(36).substring(2, 10).toUpperCase() }))}
              className="px-3 py-2 bg-silk-light/50 rounded-xl text-xs text-dark-red hover:bg-silk-light transition-all whitespace-nowrap"
            >
              Auto-generate
            </button>
          )}
        </div>
      </div>

      {/* Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Discount Type</label>
        <div className="grid grid-cols-3 gap-2">
          {(['percentage', 'flat', 'free_shipping'] as const).map(t => (
            <button
              key={t} type="button" onClick={() => handleTypeChange(t)}
              className={`py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                formData.type === t
                  ? 'border-dark-red bg-red-50 text-dark-red'
                  : 'border-silk-light text-grey-beige hover:border-silk'
              }`}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Value (hidden for free_shipping) */}
      {formData.type !== 'free_shipping' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {formData.type === 'percentage' ? 'Percentage Value (1-100)' : 'Flat Amount (Rs.)'}
          </label>
          <input
            type="number" value={formData.value}
            onChange={e => setFormData(f => ({ ...f, value: e.target.value }))}
            min={1} max={formData.type === 'percentage' ? 100 : undefined}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dark-red/20"
            required
          />
        </div>
      )}

      {/* Grid: limits + expiry */}
      <div className="grid grid-cols-2 gap-3">
        {([
          { key: 'minOrderValue', label: 'Min Order Value (Rs.)', placeholder: 'Optional' },
          { key: 'perUserLimit',  label: 'Per-User Limit',        placeholder: 'Unlimited' },
          { key: 'totalCap',      label: 'Total Redemption Cap',  placeholder: 'Unlimited' },
        ] as const).map(f => (
          <div key={f.key}>
            <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
            <input
              type="number" placeholder={f.placeholder}
              value={(formData as unknown as Record<string, string>)[f.key]}
              onChange={e => setFormData(prev => ({ ...prev, [f.key]: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dark-red/20"
            />
          </div>
        ))}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Expiry Date</label>
          <input
            type="date" value={formData.expiresAt}
            onChange={e => setFormData(f => ({ ...f, expiresAt: e.target.value }))}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dark-red/20"
          />
        </div>
      </div>

      {/* Product picker — hidden entirely for free_shipping (not just disabled) */}
      {formData.type !== 'free_shipping' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Restrict to Specific Products
            <span className="ml-1 text-xs font-normal text-gray-400">(optional)</span>
          </label>
          <ProductPicker
            selected={formData.applicableProducts}
            onChange={products => setFormData(f => ({ ...f, applicableProducts: products }))}
          />
        </div>
      )}

      {/* Stacking */}
      <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer">
        <input
          type="checkbox" checked={formData.allowsStacking}
          onChange={e => setFormData(f => ({ ...f, allowsStacking: e.target.checked }))}
          className="w-4 h-4 accent-red-700"
        />
        <div>
          <p className="text-sm font-medium text-gray-800">Allow stacking</p>
          <p className="text-xs text-gray-500">Can be combined with other coupons at checkout</p>
        </div>
      </label>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
        <input
          value={formData.description}
          onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
          placeholder="Internal note about this coupon..."
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dark-red/20"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel}
          className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-all">
          Cancel
        </button>
        <button type="submit"
          className="flex-1 px-4 py-2.5 bg-dark-red text-white rounded-xl text-sm font-medium hover:bg-red-800 transition-all">
          {submitLabel}
        </button>
      </div>
    </form>
  );
};

// ── Modal wrapper ────────────────────────────────────────────────────────────
const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg my-4">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-bold text-gray-800">{title}</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-all"><X size={20} /></button>
      </div>
      {children}
    </div>
  </div>
);

// ── Main component ───────────────────────────────────────────────────────────
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
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [deactivateConfirm, setDeactivateConfirm] = useState(false);
  const [createForm, setCreateForm] = useState<FormState>(blankForm());
  const [editForm, setEditForm] = useState<FormState>(blankForm());

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
    setExpandedId(id); fetchStats(id);
  };

  const openEdit = (coupon: Coupon, e: React.MouseEvent) => {
    e.stopPropagation(); // don't simultaneously toggle the stats panel
    setEditingCoupon(coupon);
    setEditForm(couponToForm(coupon));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const body: Record<string, unknown> = {
        code: createForm.code,
        type: createForm.type,
        value: parseFloat(createForm.value) || 0,
        allowsStacking: createForm.allowsStacking,
        applicableProducts: createForm.applicableProducts.map(p => p._id),
      };
      if (createForm.minOrderValue) body.minOrderValue = parseFloat(createForm.minOrderValue);
      if (createForm.perUserLimit)  body.perUserLimit  = parseInt(createForm.perUserLimit);
      if (createForm.totalCap)      body.totalCap      = parseInt(createForm.totalCap);
      if (createForm.expiresAt)     body.expiresAt     = createForm.expiresAt;
      if (createForm.description)   body.description   = createForm.description;

      const headers = await getAuthHeaders();
      const r = await fetch(`${API}/api/v1/admin/coupons`, { method: 'POST', headers, body: JSON.stringify(body) });
      const d = await r.json();
      if (d.success) {
        toast.success(`Coupon "${d.data.code}" created`);
        setShowBuilder(false);
        setCreateForm(blankForm());
        fetchCoupons();
      } else toast.error(d.message);
    } catch { toast.error('Create failed'); }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCoupon) return;
    try {
      const body: Record<string, unknown> = {
        type: editForm.type,
        value: parseFloat(editForm.value) || 0,
        allowsStacking: editForm.allowsStacking,
        // Preserve active state; deactivation goes through bulk-deactivate
        isActive: editingCoupon.isActive,
        // Always send applicableProducts so clearing to [] is honoured
        applicableProducts: editForm.applicableProducts.map(p => p._id),
        // Always send nullable fields so clearing them to empty is honoured
        minOrderValue: editForm.minOrderValue ? parseFloat(editForm.minOrderValue) : 0,
        perUserLimit:  editForm.perUserLimit  ? parseInt(editForm.perUserLimit)   : null,
        totalCap:      editForm.totalCap      ? parseInt(editForm.totalCap)       : null,
        expiresAt:     editForm.expiresAt     || null,
        description:   editForm.description,
      };

      const headers = await getAuthHeaders();
      const r = await fetch(`${API}/api/v1/admin/coupons/${editingCoupon._id}`, {
        method: 'PUT', headers, body: JSON.stringify(body),
      });
      const d = await r.json();
      if (d.success) {
        toast.success(`Coupon "${d.data.code}" updated`);
        setEditingCoupon(null);
        // Invalidate cached stats so expanding the row again fetches fresh data
        setExpandedStats(s => { const n = { ...s }; delete n[editingCoupon._id]; return n; });
        fetchCoupons();
      } else toast.error(d.message);
    } catch { toast.error('Update failed'); }
  };

  const handleBulkDeactivate = async () => {
    try {
      const headers = await getAuthHeaders();
      const r = await fetch(`${API}/api/v1/admin/coupons/bulk-deactivate`, {
        method: 'PATCH', headers, body: JSON.stringify({ ids: [...selectedIds] }),
      });
      const d = await r.json();
      if (d.success) {
        toast.success(`${d.deactivated} coupons deactivated`);
        setSelectedIds(new Set());
        fetchCoupons();
      } else toast.error(d.message);
    } catch { toast.error('Deactivation failed'); }
    finally { setDeactivateConfirm(false); }
  };

  const selectAllExpired = () => {
    const expiredIds = coupons
      .filter(c => c.expiresAt && new Date(c.expiresAt) < new Date())
      .map(c => c._id);
    setSelectedIds(new Set(expiredIds));
    if (expiredIds.length === 0) toast('No expired coupons on this page', { icon: '\u2139\ufe0f' });
  };

  const isExpired = (c: Coupon) => !!(c.expiresAt && new Date(c.expiresAt) < new Date());

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Tag size={22} className="text-dark-red" /> Coupon Management
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">{total} total coupons</p>
        </div>
        <button
          onClick={() => { setCreateForm(blankForm()); setShowBuilder(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-dark-red text-white rounded-xl text-sm font-medium hover:bg-ruby-red transition-all shadow-sm"
        >
          <Plus size={16} /> New Coupon
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap items-center">
        {([['', 'All'], ['true', 'Active'], ['false', 'Inactive']] as const).map(([val, label]) => (
          <button
            key={val} onClick={() => { setActiveFilter(val); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
              activeFilter === val
                ? 'bg-dark-red text-white border-dark-red'
                : 'bg-silk-light/50 text-grey-beige border-transparent hover:border-silk'
            }`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={selectAllExpired}
          className="px-3 py-1.5 rounded-lg text-sm border border-transparent bg-silk-light/50 text-grey-beige hover:border-amber-400 hover:text-amber-600 transition-all"
        >
          Select All Expired
        </button>
      </div>

      {/* Coupon List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-dark-red border-t-transparent rounded-full animate-spin" />
        </div>
      ) : coupons.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Tag size={36} className="mx-auto mb-3 opacity-30" /><p>No coupons found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {coupons.map(coupon => {
            const isSelected = selectedIds.has(coupon._id);
            const expired = isExpired(coupon);
            const isOpen = expandedId === coupon._id;
            const stats = expandedStats[coupon._id];
            return (
              <div
                key={coupon._id}
                className={`border rounded-2xl overflow-hidden transition-all ${
                  isSelected ? 'border-dark-red bg-red-50/50' : 'border-silk-light bg-white hover:bg-silk-light/10'
                }`}
              >
                <div className="flex items-center gap-3 p-4">
                  {/* Select */}
                  <button onClick={() => setSelectedIds(s => {
                    const n = new Set(s); isSelected ? n.delete(coupon._id) : n.add(coupon._id); return n;
                  })}>
                    {isSelected
                      ? <CheckSquare size={18} className="text-dark-red" />
                      : <Square size={18} className="text-gray-300" />}
                  </button>

                  {/* Summary (click to expand stats) */}
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleToggleExpand(coupon._id)}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-gray-800">{coupon.code}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        coupon.isActive && !expired ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {expired ? 'Expired' : coupon.isActive ? 'Active' : 'Inactive'}
                      </span>
                      {coupon.allowsStacking && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-600">Stackable</span>
                      )}
                      {/* Product-restriction badge */}
                      {coupon.applicableProducts?.length > 0 && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-600">
                          <Package size={10} />
                          {coupon.applicableProducts.length} product{coupon.applicableProducts.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {TYPE_LABELS[coupon.type]}
                      {coupon.type !== 'free_shipping' && (
                        ` \u00b7 ${coupon.type === 'percentage' ? `${coupon.value}%` : `\u20b9${coupon.value}`} off`
                      )}
                      {coupon.minOrderValue > 0 && ` \u00b7 Min \u20b9${coupon.minOrderValue}`}
                      {coupon.expiresAt && ` \u00b7 Expires ${new Date(coupon.expiresAt).toLocaleDateString('en-IN')}`}
                    </p>
                  </div>

                  <div className="text-sm text-gray-500 hidden sm:block">
                    {coupon.usageCount}{coupon.totalCap ? `/${coupon.totalCap}` : ''} uses
                  </div>

                  {/* Edit button */}
                  <button
                    onClick={e => openEdit(coupon, e)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-dark-red hover:bg-red-50 transition-all"
                    title="Edit coupon"
                  >
                    <Pencil size={15} />
                  </button>

                  {/* Expand toggle */}
                  <button onClick={() => handleToggleExpand(coupon._id)}>
                    {isOpen
                      ? <ChevronUp size={16} className="text-gray-400" />
                      : <ChevronDown size={16} className="text-gray-400" />}
                  </button>
                </div>

                {/* Stats Panel */}
                {isOpen && (
                  <div className="border-t border-silk-light p-5 bg-silk-light/20">
                    {/* Restricted products list */}
                    {coupon.applicableProducts?.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs text-gray-500 mb-2 font-medium">Restricted to Products</p>
                        <div className="flex flex-wrap gap-1.5">
                          {coupon.applicableProducts.map(p => (
                            <span key={p._id} className="flex items-center gap-1 px-2 py-1 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-700">
                              <Package size={10} />
                              <span className="font-medium">{p.name}</span>
                              <span className="text-purple-400">({p.pid})</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {!stats ? (
                      <div className="flex justify-center py-4">
                        <div className="w-5 h-5 border-2 border-dark-red border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                        {[
                          { label: 'Total Uses',           value: stats.totalUses },
                          { label: 'Revenue Attributed',   value: `\u20b9${(stats.totalRevenue || 0).toLocaleString('en-IN')}` },
                          { label: 'Avg. Order Value',     value: `\u20b9${stats.averageOrderValue?.toLocaleString('en-IN') || 0}` },
                          { label: 'Total Discount Given', value: `\u20b9${(stats.totalDiscount || 0).toLocaleString('en-IN')}` },
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
            <button
              key={p} onClick={() => setPage(p)}
              className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                page === p ? 'bg-dark-red text-white' : 'bg-silk-light text-dark-red hover:bg-silk'
              }`}
            >{p}</button>
          ))}
        </div>
      )}

      {/* Bulk deactivate bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white rounded-2xl shadow-2xl px-5 py-3.5 flex items-center gap-4 z-40">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <button onClick={() => setSelectedIds(new Set())} className="text-gray-400 hover:text-white transition-colors">
            <X size={16} />
          </button>
          <button
            onClick={() => setDeactivateConfirm(true)}
            className="flex items-center gap-2 px-4 py-1.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-all"
          >
            <Trash2 size={14} /> Deactivate Selected
          </button>
        </div>
      )}

      {/* Deactivate confirm */}
      {deactivateConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center">
            <AlertCircle size={36} className="mx-auto mb-3 text-red-500" />
            <h3 className="text-lg font-bold text-gray-800 mb-2">
              Deactivate {selectedIds.size} Coupon{selectedIds.size > 1 ? 's' : ''}?
            </h3>
            <p className="text-sm text-gray-500 mb-5">These coupons will no longer be usable at checkout.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeactivateConfirm(false)} className="flex-1 px-4 py-2.5 border border-silk-light rounded-xl text-sm font-medium hover:bg-silk-light/50 transition-all">
                Cancel
              </button>
              <button onClick={handleBulkDeactivate} className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-all">
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showBuilder && (
        <Modal title="New Coupon" onClose={() => setShowBuilder(false)}>
          <CouponForm
            formData={createForm}
            setFormData={setCreateForm}
            onSubmit={handleCreate}
            onCancel={() => setShowBuilder(false)}
            submitLabel="Create Coupon"
          />
        </Modal>
      )}

      {/* Edit modal */}
      {editingCoupon && (
        <Modal title={`Edit \u2014 ${editingCoupon.code}`} onClose={() => setEditingCoupon(null)}>
          <CouponForm
            formData={editForm}
            setFormData={setEditForm}
            onSubmit={handleUpdate}
            onCancel={() => setEditingCoupon(null)}
            submitLabel="Save Changes"
            isEdit
          />
        </Modal>
      )}
    </div>
  );
};

export default CouponManagement;
