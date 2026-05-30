import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import toast from 'react-hot-toast';

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
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && input.trim()) {
            onChange([...value, input.trim()]);
            setInput('');
            e.preventDefault();
          }
        }}
        placeholder={`Add ${label.toLowerCase()} and press Enter`}
      />
    </div>
  );
}

const defaultFormData = {
  pid: '', name: '', slug: '', brand: 'Bodilicious',
  description: '', category: '', sub_category: '',
  product_type: '', item_form: '', texture: '',
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
          setFormData(prev => ({ ...prev, ...data.data, ingredients: { ...prev.ingredients, ...data.data.ingredients }, usage: { ...prev.usage, ...data.data.usage }}));
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
        onChange={e => setFormData(prev => ({ ...prev, [field]: type === 'number' ? Number(e.target.value) : e.target.value }))}
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
              <select 
                className="w-full p-3 bg-gray-50 border-none rounded-xl outline-none focus:ring-2 ring-dark-red/20"
                value={formData.category}
                onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))}
              >
                <option value="">Select Category</option>
                <option value="skin">Skin</option>
                <option value="hair">Hair</option>
                <option value="body">Body</option>
                <option value="makeup">Makeup</option>
                <option value="lip">Lip</option>
                <option value="other">Other</option>
              </select>
            </div>
            <InputField label="Sub Category" field="sub_category" />
            <InputField label="Product Type" field="product_type" />
            <InputField label="Item Form" field="item_form" />
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
                  <img src={img} alt={`Product ${i}`} className="w-full h-full object-cover" />
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
            />
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
              <select 
                className="w-full p-3 bg-gray-50 border-none rounded-xl outline-none focus:ring-2 ring-dark-red/20"
                value={formData.availability}
                onChange={e => setFormData(prev => ({ ...prev, availability: e.target.value }))}
              >
                <option value="In Stock">In Stock</option>
                <option value="Out of Stock">Out of Stock</option>
                <option value="Preorder">Preorder</option>
                <option value="Discontinued">Discontinued</option>
              </select>
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
