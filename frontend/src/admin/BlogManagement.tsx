import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import BlogCategoryManagement from './BlogCategoryManagement';
import { PlusCircle, Edit2, Trash2, Search, ChevronLeft, ChevronRight, Loader2, FileText, AlertCircle, BookOpen } from 'lucide-react';
import { useApp } from '../context/AppContext';
import toast from 'react-hot-toast';

interface Blog {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImage: string;
  status: 'draft' | 'published';
  publishedAt: string | null;
  createdAt: string;
  categories: { _id: string; name: string; slug: string }[];
  author: { name: string; email: string };
}

const StatusBadge: React.FC<{ status: 'draft' | 'published' }> = ({ status }) => (
  <span
    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
      status === 'published'
        ? 'bg-green-100 text-green-800'
        : 'bg-amber-100 text-amber-700'
    }`}
  >
    <span className={`w-1.5 h-1.5 rounded-full ${status === 'published' ? 'bg-green-500' : 'bg-amber-400'}`} />
    {status === 'published' ? 'Published' : 'Draft'}
  </span>
);

const BlogManagement: React.FC = () => {
  const { getAuthHeaders } = useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'posts';

  const setTab = (tab: string) => {
    setSearchParams({ tab });
  };

  const [blogs, setBlogs]     = useState<Blog[]>([]);
  const [, setTotal]          = useState(0);
  const [pages, setPages]     = useState(1);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const [search, setSearch]         = useState('');
  const [statusFilter, setStatus]   = useState('');
  const [debouncedSearch, setDebounced] = useState('');

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<Blog | null>(null);
  const [deleting, setDeleting]         = useState(false);

  // Debounce search input 400 ms
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchBlogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (statusFilter) params.set('status', statusFilter);

      const res  = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/admin/blogs?${params}`, { headers });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setBlogs(data.data);
      setTotal(data.total);
      setPages(data.pages);
    } catch (err: any) {
      setError(err.message || 'Failed to load blogs');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, page, debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchBlogs();
  }, [fetchBlogs]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/admin/blogs/${deleteTarget._id}`, {
        method: 'DELETE',
        headers,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      toast.success('Blog post deleted');
      setDeleteTarget(null);
      fetchBlogs();
    } catch (err: any) {
      toast.error(err.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Blog Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your blog posts and categories.</p>
        </div>
        {activeTab === 'posts' && (
          <Link
            to="/admin/blogs/new"
            id="new-blog-btn"
            className="flex items-center gap-2 bg-[#8B2E2E] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#7a2828] transition-colors"
          >
            <PlusCircle size={16} />
            New Post
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-gray-200 mb-6" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === 'posts'}
          onClick={() => setTab('posts')}
          className={`pb-3 text-sm font-semibold transition-all duration-200 ease-out border-b-2 ${
            activeTab === 'posts'
              ? 'border-[#8B2E2E] text-gray-900'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          Posts
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'categories'}
          onClick={() => setTab('categories')}
          className={`pb-3 text-sm font-semibold transition-all duration-200 ease-out border-b-2 ${
            activeTab === 'categories'
              ? 'border-[#8B2E2E] text-gray-900'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          Categories
        </button>
      </div>

      {activeTab === 'posts' && (
        <div className="space-y-5 animate-in fade-in duration-300">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
          <input
            id="blog-search"
            type="text"
            placeholder="Search posts…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B2E2E]/30"
          />
        </div>
        <select
          id="blog-status-filter"
          value={statusFilter}
          onChange={e => setStatus(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#8B2E2E]/30"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
          <Loader2 size={32} className="animate-spin" />
          <span className="text-sm">Loading posts…</span>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-red-500">
          <AlertCircle size={32} />
          <span className="text-sm">{error}</span>
          <button onClick={fetchBlogs} className="text-sm underline text-gray-600">Retry</button>
        </div>
      ) : blogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
          <BookOpen size={40} className="text-gray-300" />
          <p className="font-medium text-gray-500">No blog posts yet</p>
          <p className="text-sm">
            {debouncedSearch || statusFilter ? 'Try adjusting your filters.' : 'Click "New Post" to write your first one.'}
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Post</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Categories</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Date</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {blogs.map(blog => (
                  <tr key={blog._id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {blog.coverImage ? (
                          <img src={blog.coverImage} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-gray-100" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <FileText size={16} className="text-gray-300" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-900 line-clamp-1">{blog.title}</p>
                          <p className="text-xs text-gray-400 font-mono">{blog.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {blog.categories.length > 0
                          ? blog.categories.map(c => (
                              <span key={c._id} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">{c.name}</span>
                            ))
                          : <span className="text-gray-300 text-xs">—</span>
                        }
                      </div>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={blog.status} /></td>
                    <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">
                      {blog.publishedAt
                        ? new Date(blog.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                        : new Date(blog.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                      }
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => navigate(`/admin/blogs/${blog._id}`)}
                          className="p-1.5 text-gray-400 hover:text-[#8B2E2E] hover:bg-gray-100 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(blog)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
              <span>Page {page} of {pages}</span>
              <div className="flex gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="p-2 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  disabled={page === pages}
                  onClick={() => setPage(p => p + 1)}
                  className="p-2 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
        </div>
      )}

      {activeTab === 'categories' && (
        <div className="animate-in fade-in duration-300">
          <BlogCategoryManagement />
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 size={18} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Delete Post</h3>
                <p className="text-sm text-gray-500">This cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-6">
              Are you sure you want to delete <span className="font-semibold">"{deleteTarget.title}"</span>?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                id="confirm-delete-blog-btn"
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60 transition-colors flex items-center gap-2"
              >
                {deleting && <Loader2 size={14} className="animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BlogManagement;
