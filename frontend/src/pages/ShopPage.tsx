 
import { useEffect, useMemo, useState } from 'react';
import { X, SlidersHorizontal, ChevronDown, Search } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import ProductCard from '../components/ProductCard';
import Footer from '../components/Footer';
import { m, AnimatePresence, useReducedMotion } from 'framer-motion';
import { fadeUpVariant, getAccessibleVariant, staggerContainerVariant } from '../utils/motionTokens';
import { useSEO } from '../hooks/useSEO';

type Option = { value: string; label: string };

const titleCase = (s: string) =>
  s
    .replace(/[_\-/]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

const parseCSV = (v: string | null) => (v ? v.split(',').map(x => x.trim()).filter(Boolean) : []);

// ─── Collapsible Filter Accordion ──────────────────────────────────────────
const FilterAccordion = ({
  title,
  items,
  paramKey,
  selected,
  handleToggle,
  defaultOpen = false,
  searchable = false,
  limit = 6,
}: {
  title: string;
  items: Option[];
  paramKey: string;
  selected: string[];
  handleToggle: (key: string, value: string) => void;
  defaultOpen?: boolean;
  searchable?: boolean;
  limit?: number;
}) => {
  const [open, setOpen] = useState(defaultOpen || selected.length > 0);
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);

  const filtered = searchable
    ? items.filter(i => i.label.toLowerCase().includes(query.toLowerCase()))
    : items;
  const visible = showAll ? filtered : filtered.slice(0, limit);
  const hasMore = filtered.length > limit;

  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-4 text-left group"
        aria-expanded={open}
      >
        <span className={`font-sans text-sm font-medium transition-colors ${open ? 'text-dark-red' : 'text-gray-700 group-hover:text-dark-red'}`}>
          {title}
          {selected.length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-ruby-red text-white text-[10px] font-bold">
              {selected.length}
            </span>
          )}
        </span>
        <ChevronDown
          size={14}
          className={`text-gray-400 transition-transform duration-300 ${open ? 'rotate-180 text-dark-red' : ''}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="pb-4 space-y-1">
              {searchable && (
                <div className="relative mb-3">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder={`Search ${title.toLowerCase()}...`}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-xs font-sans border border-gray-200 rounded-md focus:outline-none focus:border-dark-red bg-gray-50"
                  />
                </div>
              )}

              {visible.length === 0 ? (
                <p className="text-xs font-sans text-gray-400 italic py-2">No results</p>
              ) : (
                visible.map(item => {
                  const isSelected = selected.includes(item.value);
                  return (
                    <button
                      key={item.value}
                      onClick={() => handleToggle(paramKey, item.value)}
                      className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left transition-all duration-150 ${
                        isSelected
                          ? 'bg-ruby-red/8 text-dark-red'
                          : 'hover:bg-gray-50 text-gray-600 hover:text-dark-red'
                      }`}
                    >
                      <span className={`flex-shrink-0 w-4 h-4 rounded border-[1.5px] flex items-center justify-center transition-all ${
                        isSelected ? 'bg-dark-red border-dark-red' : 'border-gray-300'
                      }`}>
                        {isSelected && (
                          <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                            <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      <span className="font-sans text-sm leading-tight">{item.label}</span>
                    </button>
                  );
                })
              )}

              {hasMore && (
                <button
                  onClick={() => setShowAll(s => !s)}
                  className="mt-1 ml-2 text-[11px] font-sans text-grey-beige hover:text-dark-red transition-colors underline"
                >
                  {showAll ? 'Show less' : `+${filtered.length - limit} more`}
                </button>
              )}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function ShopPage() {
  const { products, isLoading, filters } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  useSEO({
    title: 'Shop Skincare & Haircare — Bodilicious',
    description:
      'Browse our complete range of premium herbal skincare, haircare, lip care and makeup. Filter by skin concern, ingredient, or skin type and find your perfect match.',
    canonical: '/shop',
  });

  const selectedCategories = parseCSV(searchParams.get('category'));
  const selectedSubCategories = parseCSV(searchParams.get('sub_category'));
  const selectedTypes = parseCSV(searchParams.get('type')); // ← backend param is 'type'
  const selectedConcerns = parseCSV(searchParams.get('concern'));
  const selectedIngredients = parseCSV(searchParams.get('ingredient'));
  const sort = searchParams.get('sort') || 'best_selling';
  const inStock = searchParams.get('inStock') || '';
  const searchQuery = searchParams.get('search') || '';

  // Use a stable max price since we are now filtering server-side
  const computedMaxPrice = 5000;

  const priceMax = searchParams.get('priceMax') || String(computedMaxPrice);
  const [localPriceMax, setLocalPriceMax] = useState(priceMax);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (localPriceMax !== priceMax) {
        const newParams = new URLSearchParams(searchParams);
        newParams.set('priceMax', localPriceMax);
        setSearchParams(newParams);
      }
    }, 400); // Slightly higher debounce for server-side
    return () => clearTimeout(timeout);
  }, [localPriceMax, priceMax, searchParams, setSearchParams]);

  const shouldReduceMotion = useReducedMotion();
  const fadeUp = getAccessibleVariant(fadeUpVariant, !!shouldReduceMotion);
  const stagger = getAccessibleVariant(staggerContainerVariant, !!shouldReduceMotion);

  const CATEGORY_OPTIONS: Option[] = useMemo(() => {
    if (!filters?.categories) return [];
    return filters.categories.map((v: string) => ({ value: v, label: titleCase(v) }));
  }, [filters]);

  // When a category is selected, narrow sub-categories by checking which products
  // have both the selected category AND the sub-category. Falls back to all if no category selected.
  const SUBCATEGORY_OPTIONS: Option[] = useMemo(() => {
    const all: string[] = filters?.subCategories || [];
    if (selectedCategories.length === 0) {
      return all.map((v: string) => ({ value: v, label: titleCase(v) }));
    }
    // Filter sub-categories that exist on products matching selected categories
    const relevant = all.filter(sub =>
      products.some(p =>
        selectedCategories.includes((p as any).category?.toLowerCase?.() || '') &&
        (p as any).sub_category?.toLowerCase?.() === sub.toLowerCase()
      )
    );
    // If no matches yet (loading), show all
    const list = relevant.length > 0 ? relevant : all;
    return list.map((v: string) => ({ value: v, label: titleCase(v) }));
  }, [filters, selectedCategories, products]);

  const TYPE_OPTIONS: Option[] = useMemo(() =>
    (filters?.productTypes || []).map((v: string) => ({ value: v, label: titleCase(v) })),
    [filters]);

  const CONCERN_OPTIONS: Option[] = useMemo(() =>
    (filters?.concerns || []).map((v: string) => ({ value: v, label: titleCase(v) })),
    [filters]);

  const INGREDIENT_OPTIONS: Option[] = useMemo(() =>
    (filters?.ingredients || []).map((v: string) => ({ value: v, label: v })),
    [filters]);

  const handleToggle = (key: string, value: string) => {
    const current = parseCSV(searchParams.get(key));
    const newParams = new URLSearchParams(searchParams);
    if (current.includes(value)) {
      const filtered = current.filter(v => v !== value);
      if (filtered.length) newParams.set(key, filtered.join(','));
      else newParams.delete(key);
    } else {
      newParams.set(key, [...current, value].join(','));
    }
    // Reset to page 1 on filter change
    newParams.delete('page');
    setSearchParams(newParams);
  };

  const setSingleParam = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) newParams.set(key, value); else newParams.delete(key);
    newParams.delete('page');
    setSearchParams(newParams);
  };

  const handleClear = () => {
    setSearchParams(new URLSearchParams());
    setLocalPriceMax(String(computedMaxPrice));
  };

  // Products are already filtered by the API via AppContext listening to location.search
  const filteredProducts = products;

  const totalProducts = filteredProducts.length;

  const totalActiveFilters =
    selectedCategories.length + selectedSubCategories.length + selectedTypes.length +
    selectedConcerns.length + selectedIngredients.length +
    (inStock !== '' ? 1 : 0) +
    (priceMax && priceMax !== String(computedMaxPrice) ? 1 : 0);

  // Correct URL param name for product_type filter pill removal
  const handleTypePillRemove = (value: string) => handleToggle('type', value);

  // ─── Shared filter panel content ──────────────────────────────────────────
  const FilterPanelContent = () => (
    <div className="space-y-0">
      {/* Sort */}
      <div className="border-b border-gray-100 pb-4 mb-0">
        <p className="text-[10px] font-sans tracking-[0.2em] uppercase text-gray-400 mb-3">Sort By</p>
        <div className="grid grid-cols-1 gap-1">
          {[
            { value: 'best_selling', label: 'Best Selling' },
            { value: 'price_asc', label: 'Price: Low → High' },
            { value: 'price_desc', label: 'Price: High → Low' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setSingleParam('sort', opt.value)}
              className={`w-full text-left px-2 py-1.5 rounded-md text-sm font-sans transition-all ${
                sort === opt.value
                  ? 'bg-ruby-red/8 text-dark-red font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-dark-red'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <FilterAccordion title="Category" items={CATEGORY_OPTIONS} paramKey="category" selected={selectedCategories} handleToggle={handleToggle} defaultOpen limit={8} />
      <FilterAccordion title="Sub-category" items={SUBCATEGORY_OPTIONS} paramKey="sub_category" selected={selectedSubCategories} handleToggle={handleToggle} limit={8} />
      <FilterAccordion title="Product Type" items={TYPE_OPTIONS} paramKey="type" selected={selectedTypes} handleToggle={handleToggle} limit={6} />
      <FilterAccordion title="Skin Concern" items={CONCERN_OPTIONS} paramKey="concern" selected={selectedConcerns} handleToggle={handleToggle} limit={8} />
      <FilterAccordion title="Ingredients" items={INGREDIENT_OPTIONS} paramKey="ingredient" selected={selectedIngredients} handleToggle={handleToggle} searchable limit={6} />

      {/* Price Range */}
      <div className="border-b border-gray-100 py-4">
        <p className="font-sans text-sm font-medium text-gray-700 mb-3">Price Range</p>
        <div className="px-1">
          <input
            type="range"
            min="0"
            max={String(computedMaxPrice)}
            value={localPriceMax}
            onChange={(e) => setLocalPriceMax(e.target.value)}
            className="w-full accent-dark-red mb-3"
          />
          <div className="flex items-center justify-between text-xs font-sans text-gray-500">
            <span>₹0</span>
            <span className="font-medium text-dark-red">Up to ₹{Number(localPriceMax).toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* Availability */}
      <div className="border-b border-gray-100 py-4">
        <p className="font-sans text-sm font-medium text-gray-700 mb-3">Availability</p>
        <div className="flex gap-2">
          {[
            { v: 'true', label: 'In Stock' },
            { v: 'false', label: 'Out of Stock' },
            { v: '', label: 'All' },
          ].map(opt => (
            <button
              key={opt.v}
              onClick={() => setSingleParam('inStock', opt.v)}
              className={`flex-1 py-1.5 text-xs font-sans rounded-full border transition-all ${
                inStock === opt.v
                  ? 'bg-dark-red text-white border-dark-red'
                  : 'border-gray-200 text-gray-600 hover:border-dark-red hover:text-dark-red'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-neutral-50 min-h-screen pt-28">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-end mb-6 border-b border-gray-200 pb-6">
          <m.div initial="hidden" animate="visible" variants={stagger}>
            <m.h1 variants={fadeUp} className="font-serif text-dark-red text-4xl">
              {searchQuery ? `Results for "${searchQuery}"` : 'All Products'}
            </m.h1>
            <m.p variants={fadeUp} className="text-sm font-sans text-gray-500 mt-2">
              {totalProducts} product{totalProducts !== 1 ? 's' : ''} found
            </m.p>
          </m.div>

          {/* Mobile Filter Toggle */}
          <button
            onClick={() => setIsMobileFiltersOpen(true)}
            className="md:hidden mt-4 flex items-center gap-2 text-sm font-sans font-medium text-dark-red border border-dark-red/30 px-4 py-2 rounded-full hover:bg-dark-red hover:text-white transition-all"
          >
            <SlidersHorizontal size={15} />
            Filters
            {totalActiveFilters > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-ruby-red text-white text-[10px] font-bold -mr-1">
                {totalActiveFilters}
              </span>
            )}
          </button>
        </div>

        {/* Active Filter Pills */}
        {totalActiveFilters > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-8 md:mb-10">
            {[
              ...selectedCategories.map(v => ({ key: 'category', value: v, label: `Category: ${titleCase(v)}` })),
              ...selectedSubCategories.map(v => ({ key: 'sub_category', value: v, label: titleCase(v) })),
              ...selectedTypes.map(v => ({ key: 'type', value: v, label: titleCase(v) })),
              ...selectedConcerns.map(v => ({ key: 'concern', value: v, label: titleCase(v) })),
              ...selectedIngredients.map(v => ({ key: 'ingredient', value: v, label: v })),
            ].map(filter => (
              <span
                key={`${filter.key}-${filter.value}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-silk-dark/50 rounded-full text-[11px] font-sans tracking-widest uppercase text-dark-red shadow-sm"
              >
                {filter.label}
                <button
                  onClick={() => handleToggle(filter.key, filter.value)}
                  className="hover:bg-indian-red/10 rounded-full p-0.5 transition-colors"
                  aria-label={`Remove ${filter.label} filter`}
                >
                  <X size={10} className="text-dark-red/60 hover:text-indian-red transition-colors" />
                </button>
              </span>
            ))}
            {inStock !== '' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-silk-dark/50 rounded-full text-[11px] font-sans tracking-widest uppercase text-dark-red shadow-sm">
                {inStock === 'true' ? 'In Stock' : 'Out of Stock'}
                <button onClick={() => setSingleParam('inStock', '')} className="hover:bg-indian-red/10 rounded-full p-0.5 transition-colors">
                  <X size={10} className="text-dark-red/60 hover:text-indian-red transition-colors" />
                </button>
              </span>
            )}
            {priceMax && priceMax !== String(computedMaxPrice) && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-silk-dark/50 rounded-full text-[11px] font-sans tracking-widest uppercase text-dark-red shadow-sm">
                Under ₹{priceMax}
                <button onClick={() => { setLocalPriceMax(String(computedMaxPrice)); setSingleParam('priceMax', ''); }} className="hover:bg-indian-red/10 rounded-full p-0.5 transition-colors">
                  <X size={10} className="text-dark-red/60 hover:text-indian-red transition-colors" />
                </button>
              </span>
            )}
            <button
              onClick={handleClear}
              className="text-[10px] font-sans tracking-widest uppercase text-grey-beige hover:text-dark-red underline ml-1 transition-colors"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Mobile Filters Drawer */}
        <AnimatePresence>
          {isMobileFiltersOpen && (
            <>
              <m.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobileFiltersOpen(false)}
                className="fixed inset-0 bg-black/50 z-[60] md:hidden"
              />
              <m.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed inset-y-0 left-0 w-4/5 max-w-sm bg-white z-[70] md:hidden flex flex-col shadow-xl"
              >
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <h2 className="font-serif text-xl text-dark-red">Filters</h2>
                    {totalActiveFilters > 0 && (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-ruby-red text-white text-[10px] font-bold">
                        {totalActiveFilters}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {totalActiveFilters > 0 && (
                      <button onClick={handleClear} className="text-xs font-sans text-grey-beige hover:text-dark-red underline transition-colors">
                        Clear all
                      </button>
                    )}
                    <button onClick={() => setIsMobileFiltersOpen(false)} className="text-gray-400 hover:text-dark-red p-1">
                      <X size={20} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4">
                  <FilterPanelContent />
                </div>

                <div className="px-5 py-4 border-t border-gray-100">
                  <button
                    onClick={() => setIsMobileFiltersOpen(false)}
                    className="w-full py-3.5 bg-dark-red text-silk font-sans text-sm uppercase tracking-widest hover:bg-ruby-red transition-colors rounded-sm"
                  >
                    View {totalProducts} result{totalProducts !== 1 ? 's' : ''}
                  </button>
                </div>
              </m.div>
            </>
          )}
        </AnimatePresence>

        <div className="flex gap-10">
          {/* Sidebar Filters (Desktop) */}
          <div className="hidden md:block w-56 flex-shrink-0">
            <div className="sticky top-32 max-h-[calc(100vh-140px)] overflow-y-auto pr-2 custom-scrollbar">
              <div className="flex justify-between items-center mb-5">
                <h2 className="font-serif text-lg text-dark-red">
                  Filters
                  {totalActiveFilters > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-ruby-red text-white text-[10px] font-bold">
                      {totalActiveFilters}
                    </span>
                  )}
                </h2>
                {totalActiveFilters > 0 && (
                  <button onClick={handleClear} className="text-[10px] font-sans text-grey-beige hover:text-dark-red underline transition-colors tracking-widest uppercase">
                    Clear
                  </button>
                )}
              </div>

              <FilterPanelContent />
            </div>
          </div>

          {/* Product Grid */}
          <div className="flex-1 pb-20">
            {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="animate-pulse bg-white border border-gray-100 shadow-sm p-4">
                    <div className="w-full aspect-[4/5] bg-gray-200 mb-4"></div>
                    <div className="h-4 bg-gray-200 w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-20 bg-white border border-gray-100 rounded-sm">
                <SlidersHorizontal size={48} className="mx-auto text-gray-300 mb-4" />
                <h3 className="font-serif text-2xl text-dark-red mb-2">No products found</h3>
                <p className="font-sans text-gray-500 mb-6">We couldn't find anything matching your current filters.</p>
                <button
                  onClick={handleClear}
                  className="px-6 py-2 bg-dark-red text-silk font-sans text-sm uppercase tracking-widest hover:bg-ruby-red transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <m.div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6" layout>
                <AnimatePresence mode="popLayout">
                  {filteredProducts.map(product => (
                    <m.div
                      key={product.pid}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.4 }}
                    >
                      <ProductCard product={product} />
                    </m.div>
                  ))}
                </AnimatePresence>
              </m.div>
            )}

            {/* Pagination */}
            {totalProducts > 50 && (
              <div className="mt-12 flex items-center justify-center gap-2">
                {Array.from({ length: Math.ceil(totalProducts / 50) }).map((_, i) => {
                  const pNum = i + 1;
                  const isCurrent = (searchParams.get('page') || '1') === String(pNum);
                  return (
                    <button
                      key={pNum}
                      onClick={() => {
                        const newParams = new URLSearchParams(searchParams);
                        newParams.set('page', String(pNum));
                        setSearchParams(newParams);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className={`w-10 h-10 rounded-full font-sans text-sm transition-all ${
                        isCurrent
                          ? 'bg-dark-red text-white shadow-md'
                          : 'bg-white text-gray-600 hover:bg-silk-light border border-gray-100'
                      }`}
                    >
                      {pNum}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}