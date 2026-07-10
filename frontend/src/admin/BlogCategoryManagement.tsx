import React, { useState, useEffect } from 'react';
import { PlusCircle, Trash2, Loader2, FolderOpen, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import toast from 'react-hot-toast';

interface Category { _id: string; name: string; slug: string; createdAt: string; }

const BlogCategoryManagement: React.FC = () => {
  const { getAuthHeaders } = useApp();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [newName, setNewName]       = useState('');
  const [creating, setCreating]     = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleting, setDeleting]     = useState(false);

  const fetchCategories = async () => {
    setLoading(true);
    setError('');
    try {
      const headers = await getAuthHeaders();
      const res  = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/admin/blog-categories`, { headers });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setCategories(data.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCategories(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/admin/blog-categories`, {
        method: 'POST',
        headers: { ...(headers as any), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      toast.success('Category created');
      setNewName('');
      fetchCategories();
    } catch (err: any) {
      toast.error(err.message || 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/admin/blog-categories/${deleteTarget._id}`, {
        method: 'DELETE',
        headers,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      toast.success('Category deleted');
      setDeleteTarget(null);
      fetchCategories();
    } catch (err: any) {
      toast.error(err.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-3xl">
      {/* Create form */}
      <form onSubmit={handleCreate} className="flex gap-3 mb-6">
        <input
          id="new-category-name"
          type="text"
          placeholder="New category name…"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B2E2E]/30"
        />
        <button
          id="create-category-btn"
          type="submit"
          disabled={creating || !newName.trim()}
          className="flex items-center gap-2 bg-[#8B2E2E] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#7a2828] disabled:opacity-60 transition-colors"
        >
          {creating ? <Loader2 size={15} className="animate-spin" /> : <PlusCircle size={15} />}
          Add
        </button>
      </form>

      {/* List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
          <Loader2 size={28} className="animate-spin text-[#8B2E2E]" />
          <span className="text-sm font-medium">Loading categories...</span>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-2 py-16 text-red-500">
          <AlertCircle size={28} />
          <span className="text-sm">{error}</span>
        </div>
      ) : categories.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-gray-400">
          <FolderOpen size={36} className="text-gray-300" />
          <p className="text-sm">No categories yet. Create one above.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {categories.map((cat, i) => (
            <div
              key={cat._id}
              className={`flex items-center justify-between px-4 py-3 hover:bg-gray-50/60 transition-colors ${i < categories.length - 1 ? 'border-b border-gray-100' : ''}`}
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{cat.name}</p>
                <p className="text-xs font-mono text-gray-400">{cat.slug}</p>
              </div>
              <button
                onClick={() => setDeleteTarget(cat)}
                className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete category"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
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
                <h3 className="font-semibold text-gray-900">Delete Category</h3>
                <p className="text-sm text-gray-500">Existing posts won't be deleted, only unlinked.</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-6">
              Delete <span className="font-semibold">"{deleteTarget.name}"</span>?
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button
                id="confirm-delete-category-btn"
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

export default BlogCategoryManagement;
