 
import { useEffect, useMemo, useState } from 'react';
import { X, SlidersHorizontal, ChevronDown, Search } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import ProductCard from '../components/ProductCard';
import Footer from '../components/Footer';
import { m, AnimatePresence, useReducedMotion } from 'framer-motion';
import { fadeUpVariant, getAccessibleVariant, staggerContainerVariant } from '../utils/motionTokens';
import { useSEO } from '../hooks/useSEO';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';

type Option = { value: string; label: string; isDisabled?: boolean };

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
  renderAs = 'pill',
}: {
  title: string;
  items: Option[];
  paramKey: string;
  selected: string[];
  handleToggle: (key: string, value: string) => void;
  defaultOpen?: boolean;
  searchable?: boolean;
  limit?: number;
  renderAs?: 'list' | 'pill';
}) => {
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
  const [open, setOpen] = useState(isDesktop || defaultOpen || selected.length > 0);
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
            <div className="pb-4 space-y-3">
              {searchable && (
                <div className="relative">
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
                <p className="text-xs font-sans text-gray-400 italic">No results</p>
              ) : (
                <div className={renderAs === 'pill' ? "flex flex-wrap gap-2" : "space-y-1"}>
                  {visible.map(item => {
                    const isSelected = selected.includes(item.value);

                    if (renderAs === 'pill') {
                      return (
                        <button
                          key={item.value}
                          onClick={() => !item.isDisabled && handleToggle(paramKey, item.value)}
                          disabled={item.isDisabled}
                          className={`px-3 py-1.5 rounded-full font-sans text-xs transition-all border ${
                            item.isDisabled
                              ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                              : isSelected
                                ? 'bg-white border-ruby-red text-ruby-red font-medium shadow-sm'
                                : 'bg-white border-gray-200 text-gray-600 hover:border-ruby-red hover:text-ruby-red'
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    }

                    return (
                      <button
                        key={item.value}
                        onClick={() => !item.isDisabled && handleToggle(paramKey, item.value)}
                        disabled={item.isDisabled}
                        className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left transition-all duration-150 ${
                          item.isDisabled
                            ? 'opacity-40 cursor-not-allowed'
                            : isSelected
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
                  })}
                </div>
              )}

              {hasMore && (
                <button
                  onClick={() => setShowAll(s => !s)}
                  className="mt-2 text-[11px] font-sans text-grey-beige hover:text-dark-red transition-colors underline uppercase tracking-widest block"
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
  const { products, isLoading, filters, totalProducts } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  const selectedCategories = parseCSV(searchParams.get('category'));
  const selectedSubCategories = parseCSV(searchParams.get('sub_category'));
  const selectedTypes = parseCSV(searchParams.get('type'));
  const selectedConcerns = parseCSV(searchParams.get('concern'));
  const selectedIngredients = parseCSV(searchParams.get('ingredient'));

  // Build dynamic SEO title + description based on active filters
  const seoTitle = useMemo(() => {
    if (selectedCategories.length === 1) {
      const cat = titleCase(selectedCategories[0]);
      return `${cat} Products — Bodilicious`;
    }
    if (selectedTypes.length === 1) return `${titleCase(selectedTypes[0])} — Bodilicious`;
    if (selectedConcerns.length === 1) return `Best Products for ${titleCase(selectedConcerns[0])} — Bodilicious`;
    return 'Shop Skincare & Haircare — Bodilicious';
  }, [selectedCategories, selectedTypes, selectedConcerns]);

  const seoDescription = useMemo(() => {
    if (selectedConcerns.length === 1)
      return `Shop Bodilicious products formulated for ${titleCase(selectedConcerns[0])}. Dermatologically tested, science-backed skincare and haircare made in India.`;
    if (selectedCategories.length === 1)
      return `Explore the Bodilicious ${titleCase(selectedCategories[0])} range. Premium formulas with science-backed actives. Free shipping on orders over ₹1500.`;
    return 'Browse our complete range of premium skincare, haircare, lip care and makeup. Filter by skin concern, ingredient, or skin type and find your perfect match.';
  }, [selectedCategories, selectedConcerns]);

  const seoKeywords = useMemo(() => {
    const keywords = ['shop', 'skincare', 'haircare', 'dermatologically tested', 'Bodilicious'];
    if (selectedCategories.length > 0) keywords.push(...selectedCategories);
    if (selectedSubCategories.length > 0) keywords.push(...selectedSubCategories);
    if (selectedTypes.length > 0) keywords.push(...selectedTypes);
    if (selectedConcerns.length > 0) keywords.push(...selectedConcerns);
    if (selectedIngredients.length > 0) keywords.push(...selectedIngredients);
    return [...new Set(keywords)].join(', ');
  }, [selectedCategories, selectedSubCategories, selectedTypes, selectedConcerns, selectedIngredients]);

  // Build ItemList + BreadcrumbList JSON-LD for Google
  const shopJsonLd = useMemo(() => {
    const itemList = products.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: seoTitle,
          itemListElement: products.slice(0, 20).map((p, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: p.name,
            url: `https://bodilicious.in/product/${p.pid}`,
          })),
        }
      : null;

    const activeCategory = selectedCategories[0];
    const breadcrumb = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://bodilicious.in/' },
        { '@type': 'ListItem', position: 2, name: 'Shop', item: 'https://bodilicious.in/shop' },
        ...(activeCategory
          ? [{
              '@type': 'ListItem',
              position: 3,
              name: titleCase(activeCategory),
              item: `https://bodilicious.in/shop?category=${activeCategory}`,
            }]
          : []),
      ],
    };

    return itemList ? [itemList, breadcrumb] : breadcrumb;
  }, [products, seoTitle, selectedCategories]);

  useSEO({
    title: seoTitle,
    description: seoDescription,
    keywords: seoKeywords,
    canonical: '/shop',
    jsonLd: shopJsonLd,
  });
  const sort = searchParams.get('sort') || 'best_selling';
  const inStock = searchParams.get('inStock') || '';
  const searchQuery = searchParams.get('search') || '';


  const computedMaxPrice = 5000;

  const priceMax = searchParams.get('priceMax') || String(computedMaxPrice);
  const priceMin = searchParams.get('priceMin') || '0';
  const [localPriceMax, setLocalPriceMax] = useState(priceMax);
  const [localPriceMin, setLocalPriceMin] = useState(priceMin);

  // dynamicFilters narrows filter options when a category is active.
  // When NO category is selected, skip the fetch — global `filters` from AppContext
  // already covers the full set (and was already fetched once on mount).
  // This eliminates a redundant hit to /api/v1/products/filters on every page load.
  const [dynamicFilters, setDynamicFilters] = useState<any>(null);

  const categoriesString = selectedCategories.join(',');
  useEffect(() => {
    if (!categoriesString) {
      // No category selected: clear dynamic overrides so global filters apply
      setDynamicFilters(null);
      return;
    }
    let active = true;
    const fetchDynamicFilters = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/products/filters?category=${categoriesString}`);
        const json = await res.json();
        if (active && json.success) {
          setDynamicFilters(json.data);
        }
      } catch (err) {
        console.error("Failed to fetch dynamic filters", err);
      }
    };
    fetchDynamicFilters();
    return () => { active = false; };
  }, [categoriesString]); // only fires when a category is actually selected

  useEffect(() => {
    const timeout = setTimeout(() => {
      let changed = false;
      const newParams = new URLSearchParams(searchParams);
      if (localPriceMax !== priceMax) {
        newParams.set('priceMax', localPriceMax);
        changed = true;
      }
      if (localPriceMin !== priceMin) {
        newParams.set('priceMin', localPriceMin);
        changed = true;
      }
      if (changed) {
        newParams.delete('page');
        setSearchParams(newParams);
      }
    }, 400); // Slightly higher debounce for server-side
    return () => clearTimeout(timeout);
  }, [localPriceMax, priceMax, localPriceMin, priceMin, searchParams, setSearchParams]);

  const shouldReduceMotion = useReducedMotion();
  const fadeUp = getAccessibleVariant(fadeUpVariant, !!shouldReduceMotion);
  const stagger = getAccessibleVariant(staggerContainerVariant, !!shouldReduceMotion);

  const CATEGORY_OPTIONS: Option[] = useMemo(() => {
    if (!filters?.categories) return [];
    return filters.categories.map((v: string) => ({ value: v, label: titleCase(v) }));
  }, [filters]);

  // Sub-categories, Types, Concerns, and Ingredients are derived from dynamicFilters (which are scoped by Category).
  // If dynamicFilters hasn't loaded yet, we fall back to the global filters.
  


  const TYPE_OPTIONS: Option[] = useMemo(() => {
    const all: string[] = filters?.productTypes || [];
    const valid = new Set(dynamicFilters?.productTypes?.map((s: string) => s.toLowerCase()));
    return all
      .filter(v => dynamicFilters ? valid.has(v.toLowerCase()) : true)
      .map((v: string) => ({ value: v, label: titleCase(v) }));
  }, [filters, dynamicFilters]);

  const CONCERN_OPTIONS: Option[] = useMemo(() => {
    const all: string[] = filters?.concerns || [];
    const valid = new Set(dynamicFilters?.concerns?.map((s: string) => s.toLowerCase()));
    return all
      .filter(v => dynamicFilters ? valid.has(v.toLowerCase()) : true)
      .map((v: string) => ({ value: v, label: titleCase(v) }));
  }, [filters, dynamicFilters]);

  const INGREDIENT_OPTIONS: Option[] = useMemo(() => {
    const all: string[] = filters?.ingredients || [];
    const valid = new Set(dynamicFilters?.ingredients?.map((s: string) => s.toLowerCase()));
    return all
      .filter(v => dynamicFilters ? valid.has(v.toLowerCase()) : true)
      .map((v: string) => ({ value: v, label: v }));
  }, [filters, dynamicFilters]);

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
    setLocalPriceMin('0');
  };

  // Products are already filtered by the API via AppContext listening to location.search
  // Cap the array to 50 items to prevent framer-motion layout lag,
  // in case the global context holds more products from another route.
  const filteredProducts = products.slice(0, 50);

  // totalProducts is provided by useApp()

  const totalActiveFilters =
    selectedCategories.length + selectedSubCategories.length + selectedTypes.length +
    selectedConcerns.length + selectedIngredients.length +
    (inStock !== '' ? 1 : 0) +
    (priceMax !== String(computedMaxPrice) || priceMin !== '0' ? 1 : 0);



  // ─── Shared filter panel content ──────────────────────────────────────────
  const FilterPanelContent = () => {
    const [ingredientQuery, setIngredientQuery] = useState('');
    const [showAllIngredients, setShowAllIngredients] = useState(false);
    
    const filteredIngredients = INGREDIENT_OPTIONS.filter(i => i.label.toLowerCase().includes(ingredientQuery.toLowerCase()));
    const visibleIngredients = showAllIngredients ? filteredIngredients : filteredIngredients.slice(0, 6);
    const hasMoreIngredients = filteredIngredients.length > 6;

    return (
      <div className="flex flex-col h-full relative">
        <div className="space-y-0 pb-24">
          
          {/* Active Filters Box */}
          {totalActiveFilters > 0 && (
            <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm mb-6">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-sans font-medium text-gray-900">Active Filters</span>
                <button onClick={handleClear} className="text-xs font-sans text-gray-500 hover:text-ruby-red underline transition-colors">
                  Clear all
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  ...selectedCategories.map(v => ({ key: 'category', value: v, label: `Category: ${titleCase(v)}` })),
                  ...selectedSubCategories.map(v => ({ key: 'sub_category', value: v, label: titleCase(v) })),
                  ...selectedTypes.map(v => ({ key: 'type', value: v, label: titleCase(v) })),
                  ...selectedConcerns.map(v => ({ key: 'concern', value: v, label: titleCase(v) })),
                  ...selectedIngredients.map(v => ({ key: 'ingredient', value: v, label: v })),
                ].map(filter => (
                  <span
                    key={`${filter.key}-${filter.value}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-ruby-red/10 border border-ruby-red/20 rounded-full text-[11px] font-sans text-dark-red"
                  >
                    {filter.label}
                    <button
                      onClick={() => handleToggle(filter.key, filter.value)}
                      className="hover:bg-ruby-red/20 rounded-full p-0.5 transition-colors"
                    >
                      <X size={10} className="text-dark-red" />
                    </button>
                  </span>
                ))}
                {inStock !== '' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-ruby-red/10 border border-ruby-red/20 rounded-full text-[11px] font-sans text-dark-red">
                    {inStock === 'true' ? 'In Stock' : 'Out of Stock'}
                    <button onClick={() => setSingleParam('inStock', '')} className="hover:bg-ruby-red/20 rounded-full p-0.5 transition-colors">
                      <X size={10} className="text-dark-red" />
                    </button>
                  </span>
                )}
                {(priceMax !== String(computedMaxPrice) || priceMin !== '0') && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-ruby-red/10 border border-ruby-red/20 rounded-full text-[11px] font-sans text-dark-red">
                    ₹{priceMin} - ₹{priceMax}
                    <button onClick={() => { 
                      setLocalPriceMax(String(computedMaxPrice)); 
                      setLocalPriceMin('0'); 
                      const newParams = new URLSearchParams(searchParams);
                      newParams.delete('priceMax');
                      newParams.delete('priceMin');
                      setSearchParams(newParams);
                    }} className="hover:bg-ruby-red/20 rounded-full p-0.5 transition-colors">
                      <X size={10} className="text-dark-red" />
                    </button>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Sort */}
          <div className="border-b border-gray-100 pb-5 mb-5">
            <p className="text-sm font-sans font-medium text-gray-900 mb-3">Sort By</p>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'best_selling', label: 'Best Selling' },
                { value: 'price_asc', label: 'Price: Low → High' },
                { value: 'price_desc', label: 'Price: High → Low' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setSingleParam('sort', opt.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-sans transition-all border ${
                    sort === opt.value
                      ? 'bg-white border-ruby-red text-ruby-red font-medium shadow-sm'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-ruby-red hover:text-ruby-red'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <FilterAccordion title="Category" items={CATEGORY_OPTIONS} paramKey="category" selected={selectedCategories} handleToggle={handleToggle} defaultOpen limit={8} />
          <FilterAccordion title="Product Type" items={TYPE_OPTIONS} paramKey="type" selected={selectedTypes} handleToggle={handleToggle} defaultOpen limit={8} />
          <FilterAccordion title="Skin Concern" items={CONCERN_OPTIONS} paramKey="concern" selected={selectedConcerns} handleToggle={handleToggle} limit={5} />

          {/* Ingredients */}
          <div className="border-b border-gray-100 py-4">
            <p className="text-sm font-sans font-medium text-gray-700 mb-3">Ingredients</p>
            <div className="space-y-3">
              {selectedIngredients.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {selectedIngredients.map(ing => (
                    <span key={ing} className="inline-flex items-center gap-1.5 px-2 py-1 bg-ruby-red/10 border border-ruby-red/30 rounded-md text-[10px] font-sans text-dark-red">
                      {ing}
                      <button onClick={() => handleToggle('ingredient', ing)} className="hover:text-ruby-red">
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search ingredients..."
                  value={ingredientQuery}
                  onChange={e => setIngredientQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2.5 text-xs font-sans border border-gray-200 rounded-lg focus:outline-none focus:border-dark-red bg-white shadow-sm"
                />
              </div>

              {visibleIngredients.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No results</p>
              ) : (
                <div className="flex flex-wrap gap-2 mt-3">
                  {visibleIngredients.map(item => {
                    const isSelected = selectedIngredients.includes(item.value);
                    return (
                      <button
                        key={item.value}
                        onClick={() => !item.isDisabled && handleToggle('ingredient', item.value)}
                        disabled={item.isDisabled}
                        className={`px-3 py-1.5 rounded-full font-sans text-xs transition-all border ${
                          item.isDisabled
                            ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                            : isSelected
                              ? 'bg-white border-ruby-red text-ruby-red font-medium shadow-sm'
                              : 'bg-white border-gray-200 text-gray-600 hover:border-ruby-red hover:text-ruby-red'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {hasMoreIngredients && (
                <button
                  onClick={() => setShowAllIngredients(!showAllIngredients)}
                  className="mt-2 text-[11px] font-sans text-grey-beige hover:text-dark-red transition-colors underline uppercase tracking-widest block"
                >
                  {showAllIngredients ? 'Show less' : `+${filteredIngredients.length - 6} more`}
                </button>
              )}
            </div>
          </div>

          {/* Price Range */}
          <div className="border-b border-gray-100 py-4">
            <p className="font-sans text-sm font-medium text-gray-700 mb-3">Price Range</p>
            <div className="px-2 mb-6 mt-6">
              <Slider
                range
                min={0}
                max={computedMaxPrice}
                value={[Number(localPriceMin), Number(localPriceMax)]}
                onChange={(val) => {
                  if (Array.isArray(val)) {
                    setLocalPriceMin(String(val[0]));
                    setLocalPriceMax(String(val[1]));
                  }
                }}
                trackStyle={[{ backgroundColor: '#8B5E3C' }]}
                handleStyle={[
                  { borderColor: '#8B5E3C', backgroundColor: '#fff', opacity: 1, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
                  { borderColor: '#8B5E3C', backgroundColor: '#fff', opacity: 1, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }
                ]}
                railStyle={{ backgroundColor: '#e5e7eb' }}
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-sans text-sm">₹</span>
                <input
                  type="number"
                  min="0"
                  max={computedMaxPrice}
                  value={localPriceMin}
                  onChange={(e) => setLocalPriceMin(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 bg-white text-[#3E2C23] rounded-md text-sm font-sans outline-none focus:ring-1 focus:ring-ruby-red border border-gray-200"
                />
              </div>
              <span className="text-gray-400 font-sans text-sm">to</span>
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-sans text-sm">₹</span>
                <input
                  type="number"
                  min="0"
                  max={computedMaxPrice}
                  value={localPriceMax}
                  onChange={(e) => setLocalPriceMax(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 bg-white text-[#3E2C23] rounded-md text-sm font-sans outline-none focus:ring-1 focus:ring-ruby-red border border-gray-200"
                />
              </div>
            </div>
          </div>

          {/* Availability */}
          <div className="pb-4">
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
                  className={`flex-1 py-2 text-[11px] uppercase tracking-wider font-sans rounded-full border transition-all ${
                    inStock === opt.v
                      ? 'bg-white text-ruby-red border-ruby-red font-medium shadow-sm'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-ruby-red hover:text-ruby-red'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sticky Apply Filters Button */}
        <div className="sticky bottom-0 left-0 right-0 bg-neutral-50 pt-4 pb-2 mt-auto border-t border-gray-200 z-10">
          <button
            onClick={() => setIsMobileFiltersOpen(false)}
            className="w-full py-3.5 bg-white border border-gray-200 text-[#3E2C23] font-sans text-sm uppercase tracking-widest hover:bg-gray-50 hover:border-gray-300 transition-all rounded-md shadow-sm font-medium"
          >
            Apply filters
          </button>
        </div>
      </div>
    );
  };

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

        {/* Active Filter Pills (Mobile Only) */}
        {totalActiveFilters > 0 && (
          <div className="md:hidden flex flex-wrap items-center gap-2 mb-8">
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
            {(priceMax !== String(computedMaxPrice) || priceMin !== '0') && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-silk-dark/50 rounded-full text-[11px] font-sans tracking-widest uppercase text-dark-red shadow-sm">
                ₹{priceMin} - ₹{priceMax}
                <button onClick={() => { 
                  setLocalPriceMax(String(computedMaxPrice)); 
                  setLocalPriceMin('0'); 
                  const newParams = new URLSearchParams(searchParams);
                  newParams.delete('priceMax');
                  newParams.delete('priceMin');
                  setSearchParams(newParams);
                }} className="hover:bg-indian-red/10 rounded-full p-0.5 transition-colors">
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