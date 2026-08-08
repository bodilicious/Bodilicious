import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import toast from 'react-hot-toast';
import Select from '../components/Select';
import {
  buildProductTitle,
  buildProductDescription,
  buildProductH1,
  buildProductH2s,
  buildProductOgAlt,
} from '../utils/seo';

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
        className="form-input w-full md:w-1/2 p-2 border rounded-xl bg-gray-50 focus:ring-2 focus:ring-dark-red/20 outline-none"
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

/**
 * The Google product taxonomy nodes this catalogue uses, verbatim from
 * https://www.google.com/basepages/producttype/taxonomy-with-ids.en-US.txt
 * (numeric IDs in the labels for cross-checking in Merchant Center).
 *
 * Kept in sync with the `G` map in backend/scripts/fix_product_taxonomy.js.
 * Add a node here only by copying it from the file above — Merchant Center
 * drops the attribute and auto-classifies the item on any inexact string.
 */
const GOOGLE_PRODUCT_CATEGORY_OPTIONS = [
  { value: '', label: 'Auto (fall back to Category default)' },
  { value: 'Health & Beauty > Personal Care > Cosmetics > Skin Care', label: '567 · Skin Care (generic — serums)' },
  { value: 'Health & Beauty > Personal Care > Cosmetics > Skin Care > Acne Treatments & Kits', label: '481 · Skin Care > Acne Treatments & Kits' },
  { value: 'Health & Beauty > Personal Care > Cosmetics > Skin Care > Lotion & Moisturizer', label: '2592 · Skin Care > Lotion & Moisturizer' },
  { value: 'Health & Beauty > Personal Care > Cosmetics > Skin Care > Sunscreen', label: '2844 · Skin Care > Sunscreen' },
  { value: 'Health & Beauty > Personal Care > Cosmetics > Skin Care > Facial Cleansers', label: '2526 · Skin Care > Facial Cleansers' },
  { value: 'Health & Beauty > Personal Care > Cosmetics > Skin Care > Lip Balms & Treatments > Lip Balms', label: '543573 · Skin Care > Lip Balms' },
  { value: 'Health & Beauty > Personal Care > Cosmetics > Bath & Body > Bar Soap', label: '2503 · Bath & Body > Bar Soap' },
  { value: 'Health & Beauty > Personal Care > Cosmetics > Bath & Body > Body Wash', label: '2747 · Bath & Body > Body Wash' },
  { value: 'Health & Beauty > Personal Care > Cosmetics > Makeup > Face Makeup > Foundations & Concealers', label: '2765 · Makeup > Foundations & Concealers' },
  { value: 'Health & Beauty > Personal Care > Cosmetics > Makeup > Lip Makeup > Lipstick', label: '3021 · Makeup > Lipstick' },
  { value: 'Health & Beauty > Personal Care > Hair Care', label: '486 · Hair Care (generic — oils, scalp)' },
  { value: 'Health & Beauty > Personal Care > Hair Care > Shampoo & Conditioner > Shampoo', label: '543615 · Hair Care > Shampoo' },
  { value: 'Health & Beauty > Personal Care > Hair Care > Shampoo & Conditioner > Conditioners', label: '543616 · Hair Care > Conditioners' },
  { value: 'Health & Beauty > Personal Care > Hair Care > Hair Styling Products', label: '1901 · Hair Care > Hair Styling Products' },
];

const defaultFormData = {
  pid: '', name: '', slug: '', brand: 'Bodilicious',
  description: '', category: '', sub_category: '',
  product_type: '', item_form: '', texture: '',
  google_product_category: '',
  images: [] as string[],
  benefits: [] as string[],
  concerns_targeted: [] as string[],
  how_to_use: [] as string[],
  tips: [] as string[],
  warnings: [] as string[],
  skin_type_suitable: [] as string[],
  skin_type_not_suitable: [] as string[],
  hair_type_suitable: [] as string[],
  ingredients: { key_actives: [] as string[], botanical_extracts: [] as string[], others: [] as string[] },
  seo_keywords: { primary: [] as string[], secondary: [] as string[] },
  seo_title: '', seo_description: '', seo_h1: '', seo_image_alt: '',
  seo_h2: [] as string[],
  faqs: [] as { question: string; answer: string }[],
  usage: { time: '', frequency: '', routine_step: '' },
  price: 0, price_inr: 0, stock: 0, lowStockThreshold: 5,
  product_weight_ml: 0, product_weight_g: 0,
  availability: 'In Stock',
  is_active_based: false, isActive: true,
  supplier: '',
};

const ProductForm: React.FC = () => {
  const { pid } = useParams();
  const navigate = useNavigate();
  const { getAuthHeaders } = useApp();
  const isEditMode = Boolean(pid);

  const [formData, setFormData] = useState(defaultFormData);
  const [loading, setLoading] = useState(isEditMode);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const API_URL = import.meta.env.VITE_API_URL || '';

  useEffect(() => {
    if (!isEditMode) return;
    const fetchProduct = async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/products/${pid}`);
        const data = await res.json();
        if (data.success) {
          // Merge with defaultFormData to ensure nested objects exist
          setFormData(prev => ({ 
            ...prev, 
            ...data.data, 
            ingredients: { ...prev.ingredients, ...data.data.ingredients },
            seo_keywords: typeof data.data.seo_keywords === 'string'
              ? { ...prev.seo_keywords, primary: data.data.seo_keywords.split(',').map((s: string) => s.trim()).filter(Boolean) }
              : { ...prev.seo_keywords, ...data.data.seo_keywords },
            // Products created before these fields existed come back without them
            // (.lean() skips schema defaults), and ArrayField/CountedField would
            // then receive undefined. Coerce to the empty forms here.
            seo_h2: Array.isArray(data.data.seo_h2) ? data.data.seo_h2 : [],
            faqs: Array.isArray(data.data.faqs) ? data.data.faqs : [],
            seo_title: data.data.seo_title ?? '',
            seo_description: data.data.seo_description ?? '',
            seo_h1: data.data.seo_h1 ?? '',
            seo_image_alt: data.data.seo_image_alt ?? '',
            usage: { ...prev.usage, ...data.data.usage }
          }));
        } else {
          toast.error("Failed to load product");
        }
      } catch (err) {
        toast.error("Error loading product");
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [pid, isEditMode, API_URL]);

  const generateSlug = (name: string) =>
    name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const handleNameBlur = () => {
    if (!isEditMode && formData.name && !formData.slug) {
      setFormData(prev => ({ ...prev, slug: generateSlug(prev.name) }));
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('sourceIndex', index.toString());
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceIndex = parseInt(e.dataTransfer.getData('sourceIndex'), 10);
    if (sourceIndex === targetIndex) return;

    const newImages = [...formData.images];
    const [moved] = newImages.splice(sourceIndex, 1);
    newImages.splice(targetIndex, 0, moved);
    setFormData(prev => ({ ...prev, images: newImages }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const files = Array.from(e.target.files);
    
    // Instead of doing actual upload here, let's keep it simple for the moment or implement the POST if requested.
    // The prompt specified we need a POST /api/admin/upload endpoint.
    const uploadToast = toast.loading('Uploading image(s)...');
    try {
      const headers = await getAuthHeaders();
      // Remove Content-Type so browser sets it with boundary for FormData
      delete (headers as any)['Content-Type']; 
      
      const newImagePaths: string[] = [];
      for (const file of files) {
        const payload = new FormData();
        payload.append('image', file);
        
        const res = await fetch(`${API_URL}/api/v1/admin/upload`, {
          method: 'POST',
          headers,
          body: payload
        });
        const data = await res.json();
        if (data.success) {
          newImagePaths.push(data.path);
        } else {
          toast.error(`Upload failed for ${file.name}`);
        }
      }
      
      if (newImagePaths.length > 0) {
        setFormData(prev => ({ ...prev, images: [...prev.images, ...newImagePaths] }));
        toast.success(`Uploaded ${newImagePaths.length} image(s)`, { id: uploadToast });
      } else {
        toast.dismiss(uploadToast);
      }
    } catch (err) {
      console.error(err);
      toast.error('Error uploading images', { id: uploadToast });
    }
  };

  const validate = () => {
    const errs: string[] = [];
    if (!formData.pid.trim()) errs.push('PID is required');
    if (!formData.name.trim()) errs.push('Name is required');
    if (formData.images.length === 0) errs.push('At least one image is required');
    if (!formData.description.trim()) errs.push('Description is required');
    if (!formData.category) errs.push('Category is required');
    if (formData.price < 0) errs.push('Price must be 0 or more');
    return errs;
  };



  const handleSubmit = async () => {
    const errs = validate();
    if (errs.length > 0) {
      setErrors(errs);
      window.scrollTo(0, 0);
      return;
    }
    setErrors([]);
    setIsSaving(true);
    
    const payload = { ...formData } as any;
    
    // Parse number fields so decimals and empty inputs work during typing
    const numberFields = ['price', 'price_inr', 'stock', 'lowStockThreshold', 'product_weight_ml', 'product_weight_g'];
    for (const f of numberFields) {
      if (payload[f] !== undefined && payload[f] !== '') {
        payload[f] = Number(payload[f]);
      } else if (payload[f] === '') {
        payload[f] = 0;
      }
    }

    // Drop half-filled FAQ rows before sending. The Mongoose subdocument marks
    // both fields required and the update runs with runValidators, so an empty
    // row added and left blank would fail the entire save with a confusing
    // ValidationError rather than just being ignored.
    if (Array.isArray(payload.faqs)) {
      payload.faqs = payload.faqs
        .map((f: any) => ({ question: (f.question || '').trim(), answer: (f.answer || '').trim() }))
        .filter((f: any) => f.question && f.answer);
    }
    if (!payload.supplier) {
      delete payload.supplier;
    }
    if (!payload.slug) {
      delete payload.slug;
    }

    // Strip read-only, immutable, and computed fields
    delete payload._id;
    delete payload.createdAt;
    delete payload.updatedAt;
    delete payload.__v;
    delete payload.reviews;
    delete payload.rating;
    delete payload.ratingCount;

    try {
      const headers = await getAuthHeaders();
      const url = isEditMode ? `${API_URL}/api/v1/admin/products/${(formData as any)._id}` : `${API_URL}/api/v1/admin/products`;
      const method = isEditMode ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(isEditMode ? 'Product updated' : 'Product created');
        navigate('/admin/products');
      } else {
        const err = await res.json();
        setErrors([err.message ?? 'Save failed']);
        window.scrollTo(0, 0);
      }
    } catch (err) {
      setErrors(['Network error occurred']);
      window.scrollTo(0, 0);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="w-8 h-8 border-2 border-dark-red border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // What will actually be emitted, using the same builders the storefront and
  // the Cloudflare bot renderer use — so this preview cannot drift from reality.
  const seoPreview = {
    title: buildProductTitle(formData as any),
    description: buildProductDescription(formData as any),
    h1: buildProductH1(formData as any),
    imageAlt: buildProductOgAlt(formData as any) || '',
    h2Count: buildProductH2s(formData as any).length,
  };

  /** Text field with a live character counter that turns amber past the limit. */
  const CountedField = ({ label, field, limit, hint, placeholder, multiline = false }: any) => {
    const value = ((formData as any)[field] ?? '') as string;
    const over = value.length > limit;
    const shared = {
      className: `w-full p-3 bg-gray-50 border-none rounded-xl outline-none focus:ring-2 transition-all ${
        over ? 'ring-2 ring-amber-400' : 'ring-dark-red/20'
      }`,
      value,
      placeholder,
      onChange: (e: any) => setFormData(prev => ({ ...prev, [field]: e.target.value })),
    };
    return (
      <div className="mb-4">
        <div className="flex items-baseline justify-between mb-2">
          <label className="block text-sm font-bold text-gray-700">{label}</label>
          <span className={`text-xs tabular-nums ${over ? 'text-amber-600 font-semibold' : 'text-gray-400'}`}>
            {value.length}/{limit}
          </span>
        </div>
        {multiline
          ? <textarea {...shared} className={`${shared.className} min-h-[80px]`} />
          : <input type="text" {...shared} />}
        {hint && <p className="text-xs text-gray-500 mt-1.5">{hint}</p>}
        {over && (
          <p className="text-xs text-amber-600 mt-1">
            Over {limit} characters — Google will truncate this.
          </p>
        )}
      </div>
    );
  };

  const InputField = ({ label, field, type = "text", required = false, readOnly = false, min }: any) => (
    <div className="mb-4">
      <label className="block text-sm font-bold text-gray-700 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        min={min}
        className={`w-full p-3 bg-gray-50 border-none rounded-xl outline-none focus:ring-2 ring-dark-red/20 transition-all ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
        value={(formData as any)[field]}
        readOnly={readOnly}
        onChange={e => setFormData(prev => ({ ...prev, [field]: e.target.value }))}
        onBlur={field === 'name' ? handleNameBlur : undefined}
      />
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="sticky top-0 z-20 flex items-center justify-between bg-white/90 backdrop-blur-md border-b border-gray-100 px-6 py-4 mb-6 -mx-6">
        <button 
          onClick={() => navigate('/admin/products')}
          className="text-gray-500 hover:text-gray-800 font-medium px-4 py-2 hover:bg-gray-50 rounded-lg transition-colors"
        >
          ← Back
        </button>
        <h1 className="text-base sm:text-xl font-bold text-gray-800 flex-1 text-center truncate mx-2">
          {isEditMode ? `Edit: ${formData.name}` : 'Add New Product'}
        </h1>
        <button 
          onClick={handleSubmit} 
          disabled={isSaving}
          className="bg-dark-red text-white px-6 py-2.5 rounded-xl font-bold hover:bg-ruby-red disabled:opacity-50 transition-colors shadow-lg shadow-red-100"
        >
          {isSaving ? 'Saving…' : 'Save Product'}
        </button>
      </div>

      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-6">
          <p className="font-bold mb-2">Please fix the following errors:</p>
          <ul className="list-disc pl-5 text-sm space-y-1">
            {errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      <div className="space-y-6">
        {/* Section 1: Identity */}
        <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">1. Identity</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField label="Product ID (PID)" field="pid" required readOnly={isEditMode} />
            <InputField label="Name" field="name" required />
            <InputField label="URL Slug" field="slug" />
            <InputField label="Brand" field="brand" />
            <div className="mb-4">
              <label className="block text-sm font-bold text-gray-700 mb-2">Category *</label>
              <Select
                value={formData.category}
                onChange={val => setFormData(prev => ({ ...prev, category: val as string }))}
                options={[
                  { value: '', label: 'Select Category' },
                  { value: 'skin', label: 'Skin' },
                  { value: 'hair', label: 'Hair' },
                  { value: 'body', label: 'Body' },
                  { value: 'makeup', label: 'Makeup' },
                  { value: 'lip', label: 'Lip' },
                  { value: 'other', label: 'Other' }
                ]}
              />
            </div>
            <InputField label="Sub Category" field="sub_category" />
            <InputField label="Product Type" field="product_type" />
            <InputField label="Item Form" field="item_form" />
            <div className="mb-4 md:col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-2">Google Product Category</label>
              <Select
                value={formData.google_product_category}
                onChange={val => setFormData(prev => ({ ...prev, google_product_category: val as string }))}
                options={GOOGLE_PRODUCT_CATEGORY_OPTIONS}
              />
              <p className="text-xs text-gray-500 mt-1">
                Sent to Google Merchant Center as <code>google_product_category</code>. A dropdown, not
                free text, because Merchant Center silently ignores any value that isn&apos;t an exact
                node in Google&apos;s taxonomy. Leave on &quot;Auto&quot; and the feed falls back to a
                coarse default for the chosen Category.
              </p>
            </div>
          </div>
        </section>

        {/* Section 2: Images */}
        <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">2. Images</h2>
          <div className="mb-4">
            <label className="flex items-center justify-center w-full p-6 border-2 border-dashed border-gray-300 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors">
              <div className="text-center">
                <span className="text-dark-red font-bold block mb-1">Click to Upload</span>
                <span className="text-sm text-gray-500">JPG, PNG, WEBP</span>
              </div>
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
            </label>
          </div>
          {formData.images.length > 0 && (
            <div className="flex flex-wrap gap-4 mt-4">
              {formData.images.map((img, i) => (
                <div 
                  key={img + i} 
                  draggable 
                  onDragStart={(e) => handleDragStart(e, i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(e, i)}
                  className="relative group w-24 h-24 rounded-xl border overflow-hidden cursor-move bg-gray-50"
                >
                  <img src={img?.startsWith('assets/') ? `/${img}` : img} alt={`Product ${i}`} className="w-full h-full object-cover" />
                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => setFormData(prev => ({ ...prev, images: prev.images.filter((_, j) => j !== i) }))}
                      className="bg-white text-red-500 rounded-full w-6 h-6 flex items-center justify-center shadow-md font-bold"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] text-center font-medium bg-opacity-70">
                    {i === 0 ? 'Primary' : i + 1}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section 3: Content */}
        <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">3. Content</h2>
          <div className="mb-4">
            <label className="block text-sm font-bold text-gray-700 mb-2">Description *</label>
            <textarea
              className="w-full p-3 bg-gray-50 border-none rounded-xl outline-none focus:ring-2 ring-dark-red/20 min-h-[120px]"
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe the product in an engaging way. Press Enter to create new paragraphs. Example: 'Lightweight serum formulated with... This serum doubles as... With consistent use over...'"
            />
            <p className="text-xs text-gray-500 mt-2">
              💡 Tip: Press <strong>Enter</strong> to separate paragraphs instead of bullet points.
              Customers read descriptions better when broken into shorter, readable sections.
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {formData.description.length} characters
            </p>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-bold text-gray-700 mb-2">Custom SEO Keywords</label>
            <p className="text-xs text-gray-500 mb-4">
              We try each keyword in order and use the first one that fits and isn't already in the
              product name — a Primary keyword can appear in the title, a Secondary keyword in the
              image alt text. List your best keyword first in each. Every keyword you add also goes
              into the page's meta keywords tag, which search engines no longer use for ranking.
            </p>
            <div className="pl-4 border-l-2 border-dark-red/20 space-y-4">
              <ArrayField
                label="Primary Keywords"
                value={(formData as any).seo_keywords.primary}
                onChange={v => setFormData(prev => ({ ...prev, seo_keywords: { ...(prev as any).seo_keywords, primary: v } }))}
              />
              <ArrayField
                label="Secondary Keywords"
                value={(formData as any).seo_keywords.secondary}
                onChange={v => setFormData(prev => ({ ...prev, seo_keywords: { ...(prev as any).seo_keywords, secondary: v } }))}
              />
            </div>
          </div>

          {/* ── Page SEO ─────────────────────────────────────────────────────
              Every field here is optional. Left blank, the shared builders in
              utils/seo.ts generate a value — and the preview below always shows
              what will actually ship, generated or overridden. */}
          <div className="mb-4 mt-8 pt-6 border-t border-gray-200">
            <label className="block text-sm font-bold text-gray-700 mb-1">Page SEO</label>
            <p className="text-xs text-gray-500 mb-4">
              All optional. Leave blank to auto-generate from the product name, keywords and description.
            </p>

            <div className="pl-4 border-l-2 border-dark-red/20 space-y-4">
              <CountedField
                label="Meta Title"
                field="seo_title"
                limit={60}
                placeholder={seoPreview.title}
                hint="Shown as the clickable headline in Google. Google cuts it off past ~60 characters."
              />

              <CountedField
                label="Meta Description"
                field="seo_description"
                limit={155}
                multiline
                placeholder={seoPreview.description}
                hint="The grey summary under the headline. Not a ranking factor, but it decides whether people click."
              />

              <CountedField
                label="H1 — main page heading"
                field="seo_h1"
                limit={70}
                placeholder={seoPreview.h1}
                hint="The single biggest on-page heading. Defaults to the product name — override when the catalogue name isn't what people search for."
              />

              <div>
                <ArrayField
                  label="H2 — section subheadings"
                  value={(formData as any).seo_h2}
                  onChange={v => setFormData(prev => ({ ...prev, seo_h2: v }))}
                />
                <p className="text-xs text-gray-500 -mt-2 mb-4">
                  These rename the page's existing sections <em>in order</em> — 1st replaces the
                  Benefits heading, 2nd the Ingredients heading, 3rd the How to Use heading.
                  Leave empty to auto-generate. Working a keyword into a subheading beats
                  repeating it in the title.
                </p>
              </div>

              <CountedField
                label="Main Image Alt Text"
                field="seo_image_alt"
                limit={125}
                placeholder={seoPreview.imageAlt}
                hint="Describes the image for screen readers and Google Images."
              />
            </div>

            {/* ── FAQs ────────────────────────────────────────────────────
                Rendered as visible page content and as FAQPage structured data.
                Note: Google restricted FAQ *rich results* in 2023 to
                government and health sites, so these will rarely show as
                dropdowns in search. The value is the on-page content itself —
                it adds real words to a thin page and can win featured
                snippets for question queries. */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Frequently Asked Questions
              </label>
              <p className="text-xs text-gray-500 mb-4">
                Shown on the product page and emitted as FAQPage structured data.
                An entry is only used if <strong>both</strong> the question and answer are filled —
                a half-filled entry invalidates the whole block, so incomplete rows are dropped.
              </p>

              <div className="space-y-3">
                {((formData as any).faqs as any[]).map((faq, i) => {
                  const incomplete = !faq.question?.trim() || !faq.answer?.trim();
                  return (
                    <div
                      key={i}
                      className={`p-3 rounded-xl bg-gray-50 ${incomplete ? 'ring-1 ring-amber-300' : ''}`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1 space-y-2">
                          <input
                            type="text"
                            className="w-full p-2.5 bg-white border-none rounded-lg outline-none focus:ring-2 ring-dark-red/20 text-sm"
                            placeholder="Question — e.g. Can I use this with retinol?"
                            value={faq.question || ''}
                            onChange={e => setFormData(prev => {
                              const next = [...(prev as any).faqs];
                              next[i] = { ...next[i], question: e.target.value };
                              return { ...prev, faqs: next };
                            })}
                          />
                          <textarea
                            className="w-full p-2.5 bg-white border-none rounded-lg outline-none focus:ring-2 ring-dark-red/20 text-sm min-h-[64px]"
                            placeholder="Answer — write a real, specific answer. This is indexable content."
                            value={faq.answer || ''}
                            onChange={e => setFormData(prev => {
                              const next = [...(prev as any).faqs];
                              next[i] = { ...next[i], answer: e.target.value };
                              return { ...prev, faqs: next };
                            })}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({
                            ...prev,
                            faqs: ((prev as any).faqs as any[]).filter((_, j) => j !== i),
                          }))}
                          className="text-gray-400 hover:text-red-500 hover:bg-gray-200 rounded-full w-7 h-7 flex items-center justify-center transition-colors shrink-0"
                          aria-label="Remove FAQ"
                        >
                          ✕
                        </button>
                      </div>
                      {incomplete && (
                        <p className="text-xs text-amber-600 mt-2">
                          Needs both a question and an answer, or it will be skipped.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setFormData(prev => ({
                  ...prev,
                  faqs: [...((prev as any).faqs as any[]), { question: '', answer: '' }],
                }))}
                className="mt-3 px-4 py-2 text-sm font-medium bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                + Add question
              </button>
            </div>

            {/* Live search-result preview */}
            <div className="mt-6 p-4 bg-gray-50 rounded-xl">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-3">
                Google preview
              </p>
              <div className="font-sans">
                <div className="text-[#202124] text-xs mb-0.5">
                  bodilicious.in › product › {(formData as any).pid || 'pid'}
                </div>
                <div className="text-[#1a0dab] text-lg leading-snug truncate">
                  {seoPreview.title}
                </div>
                <div className="text-[#4d5156] text-sm leading-snug">
                  {seoPreview.description}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-gray-500">
                <span>title {seoPreview.title.length}/60</span>
                <span>description {seoPreview.description.length}/155</span>
                <span>H1: {seoPreview.h1}</span>
                <span>H2 ×{seoPreview.h2Count}</span>
              </div>
            </div>
          </div>
          <InputField label="Texture" field="texture" />
          <ArrayField label="Benefits" value={formData.benefits} onChange={v => setFormData(prev => ({ ...prev, benefits: v }))} />
          <ArrayField label="Concerns Targeted" value={formData.concerns_targeted} onChange={v => setFormData(prev => ({ ...prev, concerns_targeted: v }))} />
          <ArrayField label="Tips" value={formData.tips} onChange={v => setFormData(prev => ({ ...prev, tips: v }))} />
          <ArrayField label="Warnings" value={formData.warnings} onChange={v => setFormData(prev => ({ ...prev, warnings: v }))} />
        </section>

        {/* Section 4: Ingredients */}
        <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">4. Ingredients</h2>
          <ArrayField label="Key Actives" value={formData.ingredients.key_actives} onChange={v => setFormData(prev => ({ ...prev, ingredients: { ...prev.ingredients, key_actives: v } }))} />
          <ArrayField label="Botanical Extracts" value={formData.ingredients.botanical_extracts} onChange={v => setFormData(prev => ({ ...prev, ingredients: { ...prev.ingredients, botanical_extracts: v } }))} />
          <ArrayField label="Others" value={formData.ingredients.others} onChange={v => setFormData(prev => ({ ...prev, ingredients: { ...prev.ingredients, others: v } }))} />
        </section>

        {/* Section 5: Usage & How to use */}
        <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">5. Usage</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Time</label>
              <input type="text" className="w-full p-3 bg-gray-50 border-none rounded-xl outline-none focus:ring-2 ring-dark-red/20" value={formData.usage.time} onChange={e => setFormData(prev => ({ ...prev, usage: { ...prev.usage, time: e.target.value } }))} placeholder="AM / PM" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Frequency</label>
              <input type="text" className="w-full p-3 bg-gray-50 border-none rounded-xl outline-none focus:ring-2 ring-dark-red/20" value={formData.usage.frequency} onChange={e => setFormData(prev => ({ ...prev, usage: { ...prev.usage, frequency: e.target.value } }))} placeholder="Daily" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Routine Step</label>
              <input type="text" className="w-full p-3 bg-gray-50 border-none rounded-xl outline-none focus:ring-2 ring-dark-red/20" value={formData.usage.routine_step} onChange={e => setFormData(prev => ({ ...prev, usage: { ...prev.usage, routine_step: e.target.value } }))} placeholder="Step 1" />
            </div>
          </div>
          <ArrayField label="How To Use" value={formData.how_to_use} onChange={v => setFormData(prev => ({ ...prev, how_to_use: v }))} />
        </section>

        {/* Section 6: Skin & Hair Fit */}
        <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">6. Skin & Hair Fit</h2>
          <ArrayField label="Skin Type Suitable" value={formData.skin_type_suitable} onChange={v => setFormData(prev => ({ ...prev, skin_type_suitable: v }))} />
          <ArrayField label="Skin Type NOT Suitable" value={formData.skin_type_not_suitable} onChange={v => setFormData(prev => ({ ...prev, skin_type_not_suitable: v }))} />
          <ArrayField label="Hair Type Suitable" value={formData.hair_type_suitable} onChange={v => setFormData(prev => ({ ...prev, hair_type_suitable: v }))} />
        </section>

        {/* Section 7: Pricing & Stock */}
        <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">7. Pricing & Stock</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <InputField label="Price *" field="price" type="number" min="0" required />
            <InputField label="Price (INR)" field="price_inr" type="number" min="0" />
            <div>
              <InputField label="Stock" field="stock" type="number" min="0" />

            </div>
            <InputField label="Low Stock Threshold" field="lowStockThreshold" type="number" min="0" />
            <div className="mb-4">
              <label className="block text-sm font-bold text-gray-700 mb-2">Availability</label>
              <Select
                value={formData.availability}
                onChange={val => setFormData(prev => ({ ...prev, availability: val as string }))}
                options={[
                  { value: 'In Stock', label: 'In Stock' },
                  { value: 'Out of Stock', label: 'Out of Stock' },
                  { value: 'Preorder', label: 'Preorder' },
                  { value: 'Discontinued', label: 'Discontinued' }
                ]}
              />
            </div>
          </div>
        </section>

        {/* Section 8: Physical Details */}
        <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">8. Physical Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField label="Weight (ml)" field="product_weight_ml" type="number" min="0" />
            <InputField label="Weight (g)" field="product_weight_g" type="number" min="0" />
            <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer">
              <input 
                type="checkbox" 
                className="w-5 h-5 text-dark-red rounded focus:ring-dark-red"
                checked={formData.is_active_based}
                onChange={e => setFormData(prev => ({ ...prev, is_active_based: e.target.checked }))}
              />
              <span className="font-bold text-sm text-gray-700">Is Active Based?</span>
            </label>
          </div>
        </section>

        {/* Section 9: Visibility */}
        <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">9. Visibility & Meta</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer">
              <input 
                type="checkbox" 
                className="w-5 h-5 text-dark-red rounded focus:ring-dark-red"
                checked={formData.isActive}
                onChange={e => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
              />
              <span className="font-bold text-sm text-gray-700">Visible to Customers?</span>
            </label>
            <InputField label="Supplier (ID)" field="supplier" />
          </div>
          
          {isEditMode && (
            <div className="mt-6 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-4 opacity-70">
              <div>
                <span className="block text-xs uppercase text-gray-500 font-bold">Rating</span>
                <span className="font-medium">{(formData as any).rating || 0} / 5</span>
              </div>
              <div>
                <span className="block text-xs uppercase text-gray-500 font-bold">Reviews</span>
                <span className="font-medium">{(formData as any).ratingCount || 0}</span>
              </div>
              <div>
                <span className="block text-xs uppercase text-gray-500 font-bold">Created</span>
                <span className="font-medium text-sm">{new Date((formData as any).createdAt).toLocaleDateString()}</span>
              </div>
              <div>
                <span className="block text-xs uppercase text-gray-500 font-bold">Updated</span>
                <span className="font-medium text-sm">{new Date((formData as any).updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default ProductForm;
