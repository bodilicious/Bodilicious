import React, { useEffect, useState, useCallback } from 'react';
import { 
  Search, Plus, Edit2, Eye, EyeOff,
  ChevronLeft, ChevronRight,
  CheckSquare, Square, Upload, BarChart2, Loader2, Check, X, Package
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import StockHistoryDrawer from './StockHistoryDrawer';
import Select from '../components/Select';

const ProductManagement: React.FC = () => {
  const navigate = useNavigate();
  const { getAuthHeaders } = useApp();
  const [products, setProducts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ category: '', isActive: '' });

  // Stock history drawer
  const [stockProduct, setStockProduct] = useState<{ id: string; name: string } | null>(null);

  // Inline editing state
  const [editingStockId, setEditingStockId] = useState<string | null>(null);
  const [editingStockValue, setEditingStockValue] = useState<string>('');

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showCsvPanel, setShowCsvPanel] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [csvResult, setCsvResult] = useState<any>(null);
  const [csvLoading, setCsvLoading] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || '';

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const query = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        search,
        category: filters.category,
        isActive: filters.isActive
      });
      const res = await fetch(`${API_URL}/api/v1/admin/products?${query}`, { headers });
      const data = await res.json();
      if (data.success) {
        setProducts(data.data);
        setTotal(data.total);
        setPages(data.pages);
        setSelectedIds([]);
      }
    } catch {
      toast.error('Failed to fetch products');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, API_URL, page, search, filters]);

  useEffect(() => {
    const timeout = setTimeout(fetchProducts, 300);
    return () => clearTimeout(timeout);
  }, [fetchProducts]);

  // Reset page when search or filters change
  useEffect(() => {
    setPage(1);
  }, [search, filters]);

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/v1/admin/products/${id}/status`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ isActive: !currentStatus })
      });
      if (res.ok) { toast.success(`Product ${!currentStatus ? 'activated' : 'deactivated'}`); fetchProducts(); }
    } catch { toast.error('Failed to update status'); }
  };

  const handleStockEditStart = (product: any) => {
    setEditingStockId(product._id);
    setEditingStockValue(product.stock.toString());
  };

  const handleStockEditCancel = () => {
    setEditingStockId(null);
    setEditingStockValue('');
  };

  const saveStock = async (product: any) => {
    const stock = parseInt(editingStockValue);
    if (isNaN(stock) || stock < 0) { toast.error('Invalid stock value'); return; }
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/v1/admin/products/${product._id}`, {
        method: 'PUT', headers,
        body: JSON.stringify({ stock })
      });
      if (res.ok) { 
        toast.success('Stock updated'); 
        setEditingStockId(null);
        fetchProducts(); 
      }
    } catch { toast.error('Failed to update stock'); }
  };

  const toggleRow = (id: string) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAll = () =>
    setSelectedIds(prev => prev.length === products.length ? [] : products.map(p => p._id));

  const handleBulkVisibility = async (isActive: boolean) => {
    if (!selectedIds.length) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/v1/admin/products/bulk-status`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ ids: selectedIds, isActive })
      });
      if (res.ok) {
        toast.success(`${selectedIds.length} products ${isActive ? 'activated' : 'deactivated'}`);
        fetchProducts();
      }
    } catch { toast.error('Bulk update failed'); }
  };

  const parseCsv = (text: string): { pid: string; stock: string }[] => {
    const lines = text.trim().split('\n');
    return lines
      .slice(lines[0].toLowerCase().includes('pid') ? 1 : 0)
      .map(line => {
        const [pid, stock] = line.split(',').map(s => s.trim());
        return { pid, stock };
      })
      .filter(r => r.pid && r.stock);
  };

  const handleCsvImport = async (dryRun = false) => {
    const rows = parseCsv(csvText);
    if (!rows.length) { toast.error('No valid rows found'); return; }
    setCsvLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/v1/admin/products/bulk-stock?dryRun=${dryRun}`, {
        method: 'POST', headers,
        body: JSON.stringify({ rows, dryRun })
      });
      const data = await res.json();
      setCsvResult({ ...data, dryRun });
      if (!dryRun && data.updated > 0) { toast.success(`Updated ${data.updated} products`); fetchProducts(); }
    } catch { toast.error('Import failed'); }
    finally { setCsvLoading(false); }
  };

  return (
    <div className="space-y-6">
      {/* Actions & Filters */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-grey-beige" size={18} />
          <input
            type="text" placeholder="Search products by name or PID..."
            className="w-full pl-11 pr-4 py-3 bg-silk-light/50 border-none rounded-2xl outline-none focus:ring-2 ring-dark-red/20 transition-all text-dark-red placeholder:text-grey-beige"
            value={search} onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          <Select
            className="w-48"
            value={filters.category}
            onChange={(val) => setFilters(prev => ({ ...prev, category: val as string }))}
            options={[
              { value: '', label: 'All Categories' },
              { value: 'skin', label: 'Skin' },
              { value: 'hair', label: 'Hair' },
              { value: 'body', label: 'Body' }
            ]}
          />
          <Select
            className="w-48"
            value={filters.isActive}
            onChange={(val) => setFilters(prev => ({ ...prev, isActive: val as string }))}
            options={[
              { value: '', label: 'Status: All' },
              { value: 'true', label: 'Visible Only' },
              { value: 'false', label: 'Hidden Only' }
            ]}
          />
          <button
            onClick={() => setShowCsvPanel(s => !s)}
            className="bg-silk-light text-dark-red px-4 py-3 rounded-2xl font-bold flex items-center gap-2 text-sm hover:bg-silk transition-all"
          >
            <Upload size={16} /> CSV Import
          </button>
          <button 
            onClick={() => navigate('/admin/products/new')}
            className="bg-dark-red text-white px-5 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-dark-red/20 hover:scale-[1.02] hover:bg-ruby-red active:scale-[0.98] transition-all text-sm"
          >
            <Plus size={18} /> Add Product
          </button>
        </div>
      </div>

      {/* CSV Import Panel */}
      {showCsvPanel && (
        <div className="bg-silk-light/30 rounded-2xl p-5 border border-silk-light space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-dark-red">Stock CSV Import</p>
            <span className="text-[10px] text-grey-beige font-mono bg-white px-2 py-1 rounded border border-silk-light">pid,stock</span>
          </div>
          <textarea
            rows={5}
            value={csvText}
            onChange={e => { setCsvText(e.target.value); setCsvResult(null); }}
            placeholder={"pid,stock\nBD-SER-NIA-SPF30,25\nBD-LIP-MATT,40"}
            className="w-full font-mono text-xs p-3 bg-white border border-silk-light rounded-xl outline-none focus:ring-2 ring-dark-red/20 resize-y"
          />
          {csvResult && (
            <div className={`text-xs rounded-xl p-3 ${csvResult.dryRun ? 'bg-blue-50 text-blue-800' : 'bg-green-50 text-green-800'}`}>
              <p className="font-bold mb-1">{csvResult.dryRun ? 'Preview' : 'Result'}: {csvResult.updated} updated, {csvResult.failed} failed of {csvResult.total}</p>
              {csvResult.errors?.map((e: any) => (
                <p key={e.row} className="text-red-600">Row {e.row} ({e.pid}): {e.reason}</p>
              ))}
              {csvResult.preview?.map((p: any) => (
                <p key={p.pid}>{p.pid}: {p.from} → {p.to}</p>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => handleCsvImport(true)}
              disabled={csvLoading || !csvText.trim()}
              className="flex-1 py-2.5 rounded-xl border border-blue-200 text-blue-700 text-xs font-bold hover:bg-blue-50 disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {csvLoading ? <Loader2 size={12} className="animate-spin" /> : 'Preview'}
            </button>
            <button
              onClick={() => handleCsvImport(false)}
              disabled={csvLoading || !csvText.trim()}
              className="flex-1 py-2.5 rounded-xl bg-dark-red text-white text-xs font-bold hover:bg-ruby-red disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {csvLoading ? <Loader2 size={12} className="animate-spin" /> : 'Import Now'}
            </button>
          </div>
        </div>
      )}

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-3 bg-dark-red/5 border border-dark-red/20 rounded-2xl px-5 py-3 flex-wrap">
          <span className="text-sm font-bold text-dark-red">{selectedIds.length} selected</span>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <button
              onClick={() => handleBulkVisibility(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-green-700 transition-colors"
            >
              <Eye size={13} /> Make Visible
            </button>
            <button
              onClick={() => handleBulkVisibility(false)}
              className="bg-gray-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-gray-600 transition-colors"
            >
              <EyeOff size={13} /> Hide
            </button>
            <button onClick={() => setSelectedIds([])} className="text-xs text-grey-beige hover:text-dark-red">Clear</button>
          </div>
        </div>
      )}

      {/* Product Table */}
      <div className="table-scroll-container">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-silk-light">
              <th className="px-3 py-4">
                <button onClick={toggleAll} className="text-gray-400 hover:text-gray-700">
                  {selectedIds.length === products.length && products.length > 0
                    ? <CheckSquare size={16} className="text-dark-red" />
                    : <Square size={16} />}
                </button>
              </th>
              <th className="px-4 py-4 text-xs font-bold text-grey-beige uppercase tracking-wider">Product</th>
              <th className="px-4 py-4 text-xs font-bold text-grey-beige uppercase tracking-wider">Category</th>
              <th className="px-4 py-4 text-xs font-bold text-grey-beige uppercase tracking-wider">Price</th>
              <th className="px-4 py-4 text-xs font-bold text-grey-beige uppercase tracking-wider">Stock</th>
              <th className="px-4 py-4 text-xs font-bold text-grey-beige uppercase tracking-wider">Status</th>
              <th className="px-4 py-4 text-xs font-bold text-grey-beige uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-silk-light/50">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-silk-light/50">
                  <td className="px-3 py-4"><div className="skeleton h-4 w-4" /></td>
                  <td className="px-4 py-4"><div className="flex gap-4"><div className="skeleton h-12 w-12 rounded-xl" /><div><div className="skeleton h-5 w-32 mb-1" /><div className="skeleton h-3 w-20" /></div></div></td>
                  <td className="px-4 py-4"><div className="skeleton h-5 w-16 rounded-full" /></td>
                  <td className="px-4 py-4"><div className="skeleton h-5 w-16" /></td>
                  <td className="px-4 py-4"><div className="skeleton h-5 w-12" /></td>
                  <td className="px-4 py-4"><div className="skeleton h-5 w-20" /></td>
                  <td className="px-4 py-4"><div className="skeleton h-8 w-20 ml-auto" /></td>
                </tr>
              ))
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-16 text-center text-gray-400">
                  <Package size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No products found</p>
                </td>
              </tr>
            ) : products.map((product) => (
              <tr key={product._id || product.pid} className={`group hover:bg-silk-light/30 transition-colors ${selectedIds.includes(product._id) ? 'bg-red-50/40' : ''}`}>
                <td className="px-3 py-4">
                  <button onClick={() => toggleRow(product._id)} className="text-gray-400 hover:text-dark-red">
                    {selectedIds.includes(product._id)
                      ? <CheckSquare size={16} className="text-dark-red" />
                      : <Square size={16} />}
                  </button>
                </td>
                <td className="px-4 py-4">
                  <button
                    onClick={() => navigate(`/admin/products/${product.pid}`)}
                    title="Edit Product"
                    className="flex items-center gap-4 text-left group/name"
                  >
                    <div className="w-12 h-12 rounded-xl bg-silk-light/50 overflow-hidden border border-silk-light flex-shrink-0 group-hover/name:border-dark-red/40 transition-colors">
                      <img src={product.images?.[0]?.startsWith('assets/') ? `/${product.images[0]}` : product.images?.[0]} alt={product.name} loading="lazy" decoding="async" className="w-full h-full object-cover mix-blend-multiply" />
                    </div>
                    <div>
                      <p className="font-bold text-dark-red text-sm line-clamp-1 group-hover/name:text-ruby-red group-hover/name:underline">
                        {product.name}
                      </p>
                      <p className="text-xs text-grey-beige font-medium">#{product.pid}</p>
                    </div>
                  </button>
                </td>
                <td className="px-4 py-4">
                  <span className="px-3 py-1 bg-silk-light text-dark-red rounded-full text-[10px] font-bold uppercase tracking-wider">
                    {product.category}
                  </span>
                </td>
                <td className="px-4 py-4 font-bold text-dark-red">₹{product.price}</td>
                <td className="px-4 py-4">
                  {editingStockId === product._id ? (
                    <div className="flex items-center gap-2">
                      <input 
                        type="number"
                        min="0"
                        className="w-16 p-1 text-sm border border-dark-red rounded outline-none focus:ring-1 focus:ring-dark-red"
                        value={editingStockValue}
                        onChange={(e) => setEditingStockValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveStock(product);
                          if (e.key === 'Escape') handleStockEditCancel();
                        }}
                        autoFocus
                      />
                      <button onClick={() => saveStock(product)} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Save"><Check size={14} /></button>
                      <button onClick={handleStockEditCancel} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Cancel"><X size={14} /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-dark-red">
                        {product.stock}
                      </span>
                      <button
                        onClick={() => handleStockEditStart(product)}
                        className="p-1 hover:bg-silk-light rounded text-grey-beige hover:text-dark-red transition-all"
                        title="Edit Stock"
                      >
                        <Edit2 size={12} />
                      </button>
                    </div>
                  )}
                </td>
                <td className="px-4 py-4">
                  <button
                    onClick={() => toggleStatus(product._id, product.isActive)}
                    className={`flex items-center gap-2 text-xs font-bold ${product.isActive ? 'text-green-600' : 'text-grey-beige'}`}
                  >
                    {product.isActive ? <Eye size={15} /> : <EyeOff size={15} />}
                    {product.isActive ? 'VISIBLE' : 'HIDDEN'}
                  </button>
                </td>
                <td className="px-4 py-4 text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => setStockProduct({ id: product._id, name: product.name })}
                      title="Stock History"
                      className="admin-action-btn text-grey-beige"
                    >
                      <BarChart2 size={15} />
                    </button>
                    <button
                      onClick={() => navigate(`/admin/products/${product.pid}`)}
                      title="Edit Product"
                      className="admin-action-btn bg-dark-red/10 text-dark-red hover:bg-dark-red hover:text-white"
                    >
                      <Edit2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center pt-6 border-t border-silk-light">
        <p className="text-sm text-grey-beige">
          Showing <span className="font-bold text-dark-red">{products.length}</span> of <span className="font-bold text-dark-red">{total}</span> products
        </p>
        <div className="flex gap-2">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-4 py-2 flex items-center gap-1 border border-silk-light rounded-xl disabled:opacity-30 hover:bg-silk-light text-dark-red font-bold text-sm transition-colors">
            <ChevronLeft size={16} /> <span className="hidden sm:inline">Previous</span>
          </button>
          <div className="flex items-center px-4 font-bold text-sm text-dark-red">
            Page {pages === 0 ? 0 : page} of {pages}
          </div>
          <button disabled={page >= pages || pages === 0} onClick={() => setPage(p => p + 1)} className="px-4 py-2 flex items-center gap-1 border border-silk-light rounded-xl disabled:opacity-30 hover:bg-silk-light text-dark-red font-bold text-sm transition-colors">
            <span className="hidden sm:inline">Next</span> <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Stock History Drawer */}
      {stockProduct && (
        <StockHistoryDrawer
          productId={stockProduct.id}
          productName={stockProduct.name}
          onClose={() => setStockProduct(null)}
        />
      )}
    </div>
  );
};

export default ProductManagement;
