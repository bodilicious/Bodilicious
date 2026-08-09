import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import { useApp } from '../context/AppContext';
import BlogProductPicker, { ProductLite } from './BlogProductPicker';
import toast from 'react-hot-toast';
import {
  Bold, Italic, UnderlineIcon, List, ListOrdered,
  Heading2, Heading3, Quote, Undo, Redo,
  ImagePlus, Link2, Loader2, Save, Eye, X,
  Upload, AlertTriangle
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Category { _id: string; name: string; slug: string; }
interface BlogData {
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  coverImage: string;
  categories: string[];
  tags: string[];
  products: string[];
  seo_title: string;
  seo_description: string;
  seo_keywords: any;
  status: 'draft' | 'published';
}

// ── Tiptap toolbar button ─────────────────────────────────────────────────────
const ToolbarBtn: React.FC<{
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}> = ({ onClick, active, title, children }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={`p-1.5 rounded transition-colors ${active ? 'bg-[#8B2E2E] text-white' : 'text-gray-600 hover:bg-gray-100'}`}
  >
    {children}
  </button>
);

// ── ArrayField component for Keywords ─────────────────────────────────────────
function ArrayField({ label, value, onChange }: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [input, setInput] = useState('');
  return (
    <div className="mb-4">
      <label className="block text-sm font-bold text-gray-700 mb-2">{label}</label>
      <div className="flex flex-wrap gap-2 mb-2">
        {value.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-1 bg-gray-100 px-3 py-1 rounded-full text-sm font-medium">
            {item}
            <button 
              type="button"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="text-gray-400 hover:text-red-500 hover:bg-gray-200 rounded-full w-5 h-5 flex items-center justify-center transition-colors"
            >
              ✕
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        className="w-full md:w-1/2 p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#8B2E2E]/30 outline-none transition-colors"
        value={input}
        onChange={e => {
          const val = e.target.value;
          if (val.includes(',')) {
            const newItems = val.split(',').map(s => s.trim()).filter(Boolean);
            if (newItems.length > 0) {
              onChange([...value, ...newItems]);
            }
            setInput('');
          } else {
            setInput(val);
          }
        }}
        onKeyDown={e => {
          if (e.key === 'Enter' && input.trim()) {
            e.preventDefault();
            onChange([...value, input.trim()]);
            setInput('');
          }
        }}
        placeholder={`Add ${label.toLowerCase()} (press Enter or comma)`}
      />
    </div>
  );
}

// ── Slug derivation ───────────────────────────────────────────────────────────
const toSlug = (str: string) =>
  str.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/^-+|-+$/g, '');

// ─────────────────────────────────────────────────────────────────────────────
const EMPTY_FORM: BlogData = {
  title: '', slug: '', content: '', excerpt: '',
  coverImage: '', categories: [], tags: [], products: [],
  seo_title: '', seo_description: '', seo_keywords: { primary: [], secondary: [] },
  status: 'draft',
};

const BlogForm: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { getAuthHeaders } = useApp();

  const [form, setForm]               = useState<BlogData>(EMPTY_FORM);
  const [initialForm, setInitialForm] = useState<BlogData>(EMPTY_FORM);
  const [isDirty, setIsDirty]         = useState(false);

  const [categories, setCategories]     = useState<Category[]>([]);
  const [loading, setLoading]           = useState(isEdit);
  const [saving, setSaving]             = useState(false);
  const [tagInput, setTagInput]         = useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  // Cover image
  const [coverPreview, setCoverPreview]   = useState('');
  const [coverUploading, setCoverUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Product details for hydrating the picker when editing an existing post
  const [productDetails, setProductDetails] = useState<ProductLite[]>([]);

  // Track dirty state
  useEffect(() => {
    setIsDirty(JSON.stringify(form) !== JSON.stringify(initialForm));
  }, [form, initialForm]);

  // Unsaved-changes guard for page reloads/closes
  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // ── Tiptap editor ───────────────────────────────────────────────────────────
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Image,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: 'Start writing your post…' }),
    ],
    content: form.content,
    onUpdate: ({ editor }) => {
      setForm(f => ({ ...f, content: editor.getHTML() }));
    },
  });

  // ── Load categories ─────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/admin/blog-categories`, { headers });
        const data = await res.json();
        if (data.success) setCategories(data.data);
      } catch { /* silently fail */ }
    };
    load();
  }, [getAuthHeaders]);

  // ── Load existing blog when editing ────────────────────────────────────────
  useEffect(() => {
    if (!isEdit) return;
    const load = async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/admin/blogs/${id}`, { headers });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);

        const b = data.data;
        const loaded: BlogData = {
          title: b.title,
          slug: b.slug,
          content: b.content,
          excerpt: b.excerpt,
          coverImage: b.coverImage,
          categories: b.categories.map((c: Category) => c._id),
          tags: b.tags,
          products: b.products || [],
          seo_title: b.seo_title,
          seo_description: b.seo_description,
          seo_keywords: typeof b.seo_keywords === 'string'
            ? { primary: b.seo_keywords.split(',').map((s: string) => s.trim()).filter(Boolean), secondary: [] }
            : { primary: [], secondary: [], ...b.seo_keywords },
          status: b.status,
        };
        setForm(loaded);
        setInitialForm(loaded);
        setCoverPreview(b.coverImage);
        setProductDetails(b.productDetails || []);
        setSlugManuallyEdited(true); // Don't auto-update slug when editing
        editor?.commands.setContent(b.content);
      } catch (err: any) {
        toast.error(err.message || 'Failed to load post');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, isEdit, getAuthHeaders, editor]);

  // ── Auto-sync slug from title (until user manually edits slug) ─────────────
  const handleTitleChange = (title: string) => {
    setForm(f => ({
      ...f,
      title,
      ...(!slugManuallyEdited ? { slug: toSlug(title) } : {}),
    }));
  };

  const handleSlugChange = (slug: string) => {
    setSlugManuallyEdited(true);
    setForm(f => ({ ...f, slug: toSlug(slug) }));
  };

  // ── Cover image upload ──────────────────────────────────────────────────────
  const handleCoverFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validation
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only JPG, PNG, and WEBP images are allowed');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5 MB');
      return;
    }

    // Local preview
    const reader = new FileReader();
    reader.onload = ev => setCoverPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    // Upload to server
    setCoverUploading(true);
    try {
      const headers = await getAuthHeaders();
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/admin/blogs/upload-image`, {
        method: 'POST',
        headers: { Authorization: (headers as any).Authorization },
        body: fd,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setForm(f => ({ ...f, coverImage: data.path }));
      toast.success('Cover image uploaded');
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
      setCoverPreview(form.coverImage);
    } finally {
      setCoverUploading(false);
    }
  };

  // ── Tags ────────────────────────────────────────────────────────────────────
  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (!tag || form.tags.includes(tag)) { setTagInput(''); return; }
    setForm(f => ({ ...f, tags: [...f.tags, tag] }));
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setForm(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }));
  };

  // ── Category multi-select ───────────────────────────────────────────────────
  const toggleCategory = (id: string) => {
    setForm(f => ({
      ...f,
      categories: f.categories.includes(id)
        ? f.categories.filter(c => c !== id)
        : [...f.categories, id],
    }));
  };

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = async (statusOverride?: 'draft' | 'published') => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }

    setSaving(true);
    try {
      const headers = await getAuthHeaders();
      const payload = { ...form, status: statusOverride ?? form.status };

      const url    = isEdit
        ? `${import.meta.env.VITE_API_URL}/api/v1/admin/blogs/${id}`
        : `${import.meta.env.VITE_API_URL}/api/v1/admin/blogs`;
      const method = isEdit ? 'PUT' : 'POST';

      const res  = await fetch(url, {
        method,
        headers: { ...(headers as any), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      toast.success(isEdit ? 'Post updated!' : 'Post created!');
      setInitialForm(payload);
      setIsDirty(false);

      if (!isEdit) navigate(`/admin/blogs/${data.data._id}`);
    } catch (err: any) {
      toast.error(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={32} className="animate-spin text-[#8B2E2E]" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{isEdit ? 'Edit Post' : 'New Post'}</h1>
          {isDirty && (
            <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
              <AlertTriangle size={12} /> Unsaved changes
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {form.status === 'published' && form.slug && (
            <a
              href={`/blogs/${form.slug}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#8B2E2E] border border-gray-200 rounded-lg px-3 py-2 transition-colors"
            >
              <Eye size={14} /> Preview
            </a>
          )}
          <button
            type="button"
            onClick={() => handleSave('draft')}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save Draft
          </button>
          <button
            type="button"
            id="publish-blog-btn"
            onClick={() => handleSave('published')}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-[#8B2E2E] text-white rounded-lg text-sm font-semibold hover:bg-[#7a2828] disabled:opacity-60 transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            {form.status === 'published' ? 'Update' : 'Publish'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Main area ──────────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">
          {/* Title */}
          <input
            id="blog-title"
            type="text"
            placeholder="Post title…"
            value={form.title}
            onChange={e => handleTitleChange(e.target.value)}
            className="w-full text-2xl font-bold border-0 border-b-2 border-gray-200 focus:border-[#8B2E2E] focus:outline-none pb-2 bg-transparent placeholder-gray-300 transition-colors"
          />

          {/* Slug */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-400 flex-shrink-0">/blog/</span>
            <input
              id="blog-slug"
              type="text"
              value={form.slug}
              onChange={e => handleSlugChange(e.target.value)}
              className="flex-1 font-mono text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#8B2E2E]/30 text-sm"
            />
          </div>

          {/* Cover image */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Cover Image</label>
            {coverPreview ? (
              <div className="relative rounded-xl overflow-hidden aspect-[2/1] bg-gray-100">
                <img src={coverPreview} alt="Cover" className="w-full h-full object-cover" />
                {coverUploading && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Loader2 size={24} className="animate-spin text-white" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => { setCoverPreview(''); setForm(f => ({ ...f, coverImage: '' })); }}
                  className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full hover:bg-black/80 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-200 rounded-xl p-8 flex flex-col items-center gap-2 text-gray-400 hover:border-[#8B2E2E]/40 hover:text-[#8B2E2E] transition-colors"
              >
                <Upload size={24} />
                <span className="text-sm">Click to upload cover image</span>
                <span className="text-xs text-gray-300">JPG, PNG, WEBP · max 5 MB</span>
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleCoverFile} />
          </div>

          {/* Rich text editor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Content</label>
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-0.5 p-2 border-b border-gray-100 bg-gray-50">
                <ToolbarBtn onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive('bold')} title="Bold"><Bold size={14} /></ToolbarBtn>
                <ToolbarBtn onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive('italic')} title="Italic"><Italic size={14} /></ToolbarBtn>
                <ToolbarBtn onClick={() => editor?.chain().focus().toggleUnderline().run()} active={editor?.isActive('underline')} title="Underline"><UnderlineIcon size={14} /></ToolbarBtn>
                <div className="w-px h-5 bg-gray-200 mx-1" />
                <ToolbarBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} active={editor?.isActive('heading', { level: 2 })} title="Heading 2"><Heading2 size={14} /></ToolbarBtn>
                <ToolbarBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} active={editor?.isActive('heading', { level: 3 })} title="Heading 3"><Heading3 size={14} /></ToolbarBtn>
                <div className="w-px h-5 bg-gray-200 mx-1" />
                <ToolbarBtn onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive('bulletList')} title="Bullet list"><List size={14} /></ToolbarBtn>
                <ToolbarBtn onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive('orderedList')} title="Numbered list"><ListOrdered size={14} /></ToolbarBtn>
                <ToolbarBtn onClick={() => editor?.chain().focus().toggleBlockquote().run()} active={editor?.isActive('blockquote')} title="Blockquote"><Quote size={14} /></ToolbarBtn>
                <div className="w-px h-5 bg-gray-200 mx-1" />
                <ToolbarBtn onClick={() => { const url = window.prompt('URL:'); if (url) editor?.chain().focus().setLink({ href: url }).run(); }} active={editor?.isActive('link')} title="Add link"><Link2 size={14} /></ToolbarBtn>
                <ToolbarBtn onClick={() => { const url = window.prompt('Image URL:'); if (url) editor?.chain().focus().setImage({ src: url }).run(); }} title="Insert image"><ImagePlus size={14} /></ToolbarBtn>
                <div className="flex-1" />
                <ToolbarBtn onClick={() => editor?.chain().focus().undo().run()} title="Undo"><Undo size={14} /></ToolbarBtn>
                <ToolbarBtn onClick={() => editor?.chain().focus().redo().run()} title="Redo"><Redo size={14} /></ToolbarBtn>
              </div>
              <EditorContent
                editor={editor}
                id="blog-content"
                className="prose prose-sm max-w-none p-4 min-h-[300px] focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror-focused]:outline-none"
              />
            </div>
          </div>
        </div>

        {/* ── Sidebar ────────────────────────────────────────────────────────── */}
        <div className="space-y-5">
          {/* Excerpt */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Excerpt</h3>
            <textarea
              id="blog-excerpt"
              rows={3}
              placeholder="Short summary shown in listing pages…"
              value={form.excerpt}
              onChange={e => setForm(f => ({ ...f, excerpt: e.target.value }))}
              maxLength={500}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#8B2E2E]/30 resize-none"
            />
            <p className="text-right text-xs text-gray-300 mt-1">{form.excerpt.length}/500</p>
          </div>

          {/* Categories */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Categories</h3>
            {categories.length === 0 ? (
              <p className="text-xs text-gray-400">No categories yet. <a href="/admin/blogs?tab=categories" target="_blank" rel="noreferrer" className="text-[#8B2E2E] underline hover:text-[#7a2828] transition-colors">Create one →</a></p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {categories.map(cat => (
                  <button
                    key={cat._id}
                    type="button"
                    onClick={() => toggleCategory(cat._id)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      form.categories.includes(cat._id)
                        ? 'bg-[#8B2E2E] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Tags</h3>
            <div className="flex gap-2 mb-2">
              <input
                id="blog-tag-input"
                type="text"
                placeholder="Add a tag…"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#8B2E2E]/30"
              />
              <button type="button" onClick={addTag} className="px-3 py-1.5 bg-gray-100 text-sm rounded-lg hover:bg-gray-200 transition-colors font-medium">Add</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {form.tags.map(tag => (
                <span key={tag} className="flex items-center gap-1 px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                  {tag}
                  <button type="button" onClick={() => removeTag(tag)} className="hover:text-blue-900 ml-0.5"><X size={11} /></button>
                </span>
              ))}
            </div>
          </div>

          {/* Products mentioned */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-1">Products Mentioned</h3>
            <p className="text-xs text-gray-400 mb-3">Shown on the post as "Products mentioned in this guide". Overrides auto-matching.</p>
            <BlogProductPicker
              selected={form.products}
              onChange={products => setForm(f => ({ ...f, products }))}
              initialDetails={productDetails}
            />
          </div>

          {/* SEO */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">SEO</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">SEO Title</label>
                <input
                  id="blog-seo-title"
                  type="text"
                  value={form.seo_title}
                  onChange={e => setForm(f => ({ ...f, seo_title: e.target.value }))}
                  placeholder="Defaults to post title"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#8B2E2E]/30"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Meta Description</label>
                <textarea
                  id="blog-seo-description"
                  rows={2}
                  value={form.seo_description}
                  onChange={e => setForm(f => ({ ...f, seo_description: e.target.value }))}
                  placeholder="Defaults to excerpt"
                  maxLength={500}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#8B2E2E]/30 resize-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 mb-2 block">Custom SEO Keywords</label>
                <p className="text-xs text-gray-500 mb-4">Categorize keywords for maximum SEO impact.</p>
                <div className="pl-4 border-l-2 border-[#8B2E2E]/20 space-y-4">
                  <ArrayField 
                    label="Primary Keywords" 
                    value={(form.seo_keywords as any).primary} 
                    onChange={v => setForm(f => ({ ...f, seo_keywords: { ...(f.seo_keywords as any), primary: v } }))} 
                  />
                  <ArrayField 
                    label="Secondary Keywords" 
                    value={(form.seo_keywords as any).secondary} 
                    onChange={v => setForm(f => ({ ...f, seo_keywords: { ...(f.seo_keywords as any), secondary: v } }))} 
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default BlogForm;
