import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Search, X, Plus, Loader2 } from 'lucide-react';

export interface ProductLite {
  pid: string;
  name: string;
  price: number;
  images?: string[];
}

interface BlogProductPickerProps {
  selected: string[];
  onChange: (pids: string[]) => void;
  initialDetails?: ProductLite[];
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

const BlogProductPicker: React.FC<BlogProductPickerProps> = ({ selected, onChange, initialDetails }) => {
  const { getAuthHeaders } = useApp();
  const [detailsMap, setDetailsMap] = useState<Record<string, ProductLite>>({});
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductLite[]>([]);
  const [searching, setSearching] = useState(false);
  const debouncedQuery = useDebouncedValue(query, 350);

  // Seed display details for products already attached to the post (edit mode)
  useEffect(() => {
    if (!initialDetails?.length) return;
    setDetailsMap(prev => {
      const next = { ...prev };
      initialDetails.forEach(p => { next[p.pid] = p; });
      return next;
    });
  }, [initialDetails]);

  useEffect(() => {
    if (!showSearch) return;
    let cancelled = false;
    const run = async () => {
      setSearching(true);
      try {
        const headers = await getAuthHeaders();
        const params = new URLSearchParams({ limit: '8', isActive: 'true' });
        if (debouncedQuery.trim()) params.set('search', debouncedQuery.trim());
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/admin/products?${params}`, { headers });
        const data = await res.json();
        if (!cancelled && data.success) setResults(data.data);
      } catch {
        /* non-critical */
      } finally {
        if (!cancelled) setSearching(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [debouncedQuery, showSearch, getAuthHeaders]);

  const addProduct = (product: ProductLite) => {
    setDetailsMap(prev => ({ ...prev, [product.pid]: product }));
    if (!selected.includes(product.pid)) onChange([...selected, product.pid]);
  };

  const removeProduct = (pid: string) => {
    onChange(selected.filter(id => id !== pid));
  };

  return (
    <div>
      {selected.length > 0 && (
        <ul className="space-y-2 mb-3">
          {selected.map(pid => {
            const p = detailsMap[pid];
            return (
              <li key={pid} className="flex items-center gap-2.5 bg-gray-50 border border-gray-200 rounded-lg p-2">
                <div className="w-9 h-9 rounded bg-gray-100 shrink-0 overflow-hidden">
                  {p?.images?.[0] && <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />}
                </div>
                <span className="flex-1 text-sm text-gray-700 truncate">{p?.name || pid}</span>
                <button
                  type="button"
                  onClick={() => removeProduct(pid)}
                  className="text-gray-400 hover:text-red-500 shrink-0"
                  title="Remove"
                >
                  <X size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {showSearch ? (
        <div className="border border-gray-200 rounded-lg p-3">
          <div className="relative mb-2">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search products by name or ID…"
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B2E2E]/30"
            />
          </div>
          <div className="max-h-52 overflow-y-auto space-y-1">
            {searching ? (
              <div className="flex justify-center py-3"><Loader2 size={16} className="animate-spin text-gray-400" /></div>
            ) : results.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">No products found</p>
            ) : (
              results.map(p => {
                const isSelected = selected.includes(p.pid);
                return (
                  <button
                    type="button"
                    key={p.pid}
                    disabled={isSelected}
                    onClick={() => addProduct(p)}
                    className={`w-full flex items-center gap-2.5 p-2 rounded-lg text-left transition-colors ${
                      isSelected ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="w-8 h-8 rounded bg-gray-100 shrink-0 overflow-hidden">
                      {p.images?.[0] && <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />}
                    </div>
                    <span className="flex-1 text-sm text-gray-700 truncate">{p.name}</span>
                    {isSelected ? <span className="text-[10px] text-gray-400 shrink-0">Added</span> : <Plus size={14} className="text-gray-400 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowSearch(false)}
            className="text-xs text-gray-400 hover:text-gray-600 mt-2"
          >
            Close search
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowSearch(true)}
          className="w-full border-2 border-dashed border-gray-200 rounded-lg py-2.5 text-sm text-gray-400 hover:border-[#8B2E2E]/40 hover:text-[#8B2E2E] transition-colors flex items-center justify-center gap-1.5"
        >
          <Plus size={14} /> Add product
        </button>
      )}
    </div>
  );
};

export default BlogProductPicker;
