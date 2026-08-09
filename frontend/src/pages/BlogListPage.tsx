import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSEO } from '../hooks/useSEO';
import { ChevronLeft, ChevronRight, BookOpen, AlertCircle, Search } from 'lucide-react';

interface BlogPost {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImage: string;
  categories: { _id: string; name: string; slug: string }[];
  tags: string[];
  readingTime?: number;
  publishedAt: string;
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

interface Category { _id: string; name: string; slug: string; }

const BlogListPage: React.FC = () => {
  useSEO({
    title: 'Blog | Bodilicious',
    description: 'Skincare tips, ingredient guides, and beauty rituals from the Bodilicious team.',
    canonical: '/blogs',
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFilter = searchParams.get('category') || '';
  const pageParam = parseInt(searchParams.get('page') || '1');
  
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');
  const debouncedSearch = useDebouncedValue(searchInput, 400);

  // Sync debounced input -> URL (shareable link)
  useEffect(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (debouncedSearch.trim()) next.set('search', debouncedSearch.trim());
        else next.delete('search');
        if (debouncedSearch.trim() !== (prev.get('search') || '')) {
          next.set('page', '1'); // reset page on new search
        }
        return next;
      },
      { replace: true }
    );
  }, [debouncedSearch, setSearchParams]);

  const currentSearch = searchParams.get('search') || '';

  const [posts, setPosts]         = useState<BlogPost[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [pages, setPages]         = useState(1);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(pageParam), limit: '12' });
      if (categoryFilter) params.set('category', categoryFilter);
      if (currentSearch) params.set('search', currentSearch);
      const res  = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/blogs?${params}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setPosts(data.data);
      setPages(data.pages);
    } catch (err: any) {
      setError(err.message || 'Failed to load posts');
    } finally {
      setLoading(false);
    }
  }, [pageParam, categoryFilter, currentSearch]);

  const fetchCategories = useCallback(async () => {
    try {
      const res  = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/blogs/categories`);
      const data = await res.json();
      if (data.success) setCategories(data.data);
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);
  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const setPage = (p: number) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(p));
    setSearchParams(next);
  };

  const setCategory = (id: string) => {
    const next = new URLSearchParams();
    if (id) next.set('category', id);
    setSearchParams(next);
  };

  return (
    <main className="min-h-screen bg-b-bg pt-32 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-serif font-bold text-b-text-primary mb-5 tracking-tight">Blogs</h1>
          <p className="text-b-text-secondary max-w-xl mx-auto text-lg leading-relaxed">
            Skincare science, beauty rituals, and ingredient deep-dives from the Bodilicious team.
          </p>
        </div>

        {/* Category filters */}
        {categories.length > 0 && (
          <div className="flex flex-wrap justify-center gap-3 mb-14">
            <button
              onClick={() => setCategory('')}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 ${!categoryFilter ? 'bg-b-burgundy text-white shadow-md' : 'bg-white text-b-text-secondary border border-silk hover:border-b-burgundy/30 hover:text-b-burgundy'}`}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat._id}
                onClick={() => setCategory(cat._id)}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 ${categoryFilter === cat._id ? 'bg-b-burgundy text-white shadow-md' : 'bg-white text-b-text-secondary border border-silk hover:border-b-burgundy/30 hover:text-b-burgundy'}`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {/* Search Bar */}
        <div className="max-w-xl mx-auto mb-12 relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-b-burgundy transition-colors">
            <Search size={20} />
          </div>
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search posts..."
            className="w-full pl-11 pr-4 py-3.5 bg-white border border-silk-light rounded-full shadow-sm outline-none focus:border-b-burgundy/50 focus:ring-4 focus:ring-b-burgundy/10 transition-all text-b-text-primary placeholder:text-gray-400"
          />
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-silk-light flex flex-col h-full">
                <div className="aspect-[16/9] bg-gray-200 animate-pulse w-full"></div>
                <div className="p-6 flex flex-col flex-grow">
                  <div className="flex gap-2 mb-3">
                    <div className="h-4 bg-gray-200 animate-pulse rounded-full w-16"></div>
                    <div className="h-4 bg-gray-200 animate-pulse rounded-full w-20"></div>
                  </div>
                  <div className="h-6 bg-gray-200 animate-pulse rounded w-3/4 mb-2"></div>
                  <div className="h-6 bg-gray-200 animate-pulse rounded w-1/2 mb-4"></div>
                  <div className="h-4 bg-gray-200 animate-pulse rounded w-full mb-1"></div>
                  <div className="h-4 bg-gray-200 animate-pulse rounded w-5/6 mb-5"></div>
                  <div className="mt-auto h-3 bg-gray-200 animate-pulse rounded w-24"></div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-24 text-red-700">
            <AlertCircle size={32} />
            <span className="text-sm">{error}</span>
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-24 text-gray-400">
            <BookOpen size={40} className="text-gray-300" />
            <p className="text-sm">No posts yet. Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map(post => (
              <Link
                key={post._id}
                to={`/blogs/${post.slug}`}
                className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-silk-light flex flex-col h-full motion-reduce:transition-none motion-reduce:hover:transform-none"
              >
                {post.coverImage ? (
                  <div className="aspect-[16/9] overflow-hidden bg-gray-100">
                    <img
                      src={post.coverImage}
                      alt={post.title || 'Blog post cover'}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out motion-reduce:transition-none motion-reduce:group-hover:transform-none"
                    />
                  </div>
                ) : (
                  <div className="aspect-[16/9] bg-gradient-to-br from-silk-light to-silk flex items-center justify-center">
                    <BookOpen size={48} className="text-b-burgundy/20" />
                  </div>
                )}
                <div className="p-6 flex flex-col flex-grow">
                  {post.categories && post.categories.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {post.categories.map(c => (
                        <span key={c._id} className="text-[11px] uppercase tracking-wider font-semibold text-b-burgundy bg-b-burgundy/5 px-2.5 py-1 rounded-full">
                          {c.name}
                        </span>
                      ))}
                    </div>
                  )}
                  <h2 className="font-serif font-bold text-b-text-primary text-xl mb-3 line-clamp-3 group-hover:text-b-burgundy transition-colors leading-snug">
                    {post.title}
                  </h2>
                  {post.excerpt && (
                    <p className="text-sm text-b-text-secondary line-clamp-3 mb-4 leading-relaxed font-sans">{post.excerpt}</p>
                  )}
                  {post.publishedAt && (
                    <div className="flex items-center gap-2 mt-auto">
                      <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">
                        {new Date(post.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                      {post.readingTime && (
                        <>
                          <span className="text-gray-300">•</span>
                          <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">
                            {post.readingTime} min read
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-10">
            <button
              disabled={pageParam === 1}
              onClick={() => setPage(pageParam - 1)}
              className="p-2 border border-gray-200 rounded-lg bg-white disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm text-gray-600">Page {pageParam} of {pages}</span>
            <button
              disabled={pageParam === pages}
              onClick={() => setPage(pageParam + 1)}
              className="p-2 border border-gray-200 rounded-lg bg-white disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>
    </main>
  );
};

export default BlogListPage;
