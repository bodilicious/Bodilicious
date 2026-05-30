import React, { useEffect, useState } from 'react';
import { Settings, Save, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function StoreSettings() {
  const { getAuthHeaders } = useApp();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    storeName: 'Bodilicious',
    supportEmail: 'support@bodilicious.in',
    shippingThreshold: 999,
    shippingCost: 99,
    announcementBar: {
      text: '',
      isActive: false,
      link: ''
    }
  });

  useEffect(() => {
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchSettings = async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/v1/settings/admin`, { headers });
      const data = await res.json();
      if (data.success && data.data) {
        setForm(data.data);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/v1/settings/admin`, {
        method: 'POST',
        headers,
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Settings updated successfully!');
      } else {
        toast.error(data.message || 'Failed to save settings');
      }
    } catch (err) {
      console.error(err);
      toast.error('An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <span className="text-gray-500 font-sans tracking-wider uppercase text-sm">Loading Settings...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-3 mb-8">
        <Settings className="text-dark-red" size={28} />
        <h2 className="text-2xl font-serif font-bold text-dark-red">Store Settings</h2>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        
        {/* General Store Details */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-silk-light shadow-sm">
          <h3 className="font-bold text-lg text-dark-red mb-6 border-b border-silk-light pb-4">General Settings</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-grey-beige uppercase tracking-wider mb-2">Store Name</label>
              <input 
                type="text" 
                className="w-full p-3 bg-gray-50 border border-silk-light rounded-xl outline-none focus:border-dark-red/50 transition-colors"
                value={form.storeName}
                onChange={e => setForm({ ...form, storeName: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-grey-beige uppercase tracking-wider mb-2">Support Email</label>
              <input 
                type="email" 
                className="w-full p-3 bg-gray-50 border border-silk-light rounded-xl outline-none focus:border-dark-red/50 transition-colors"
                value={form.supportEmail}
                onChange={e => setForm({ ...form, supportEmail: e.target.value })}
                required
              />
            </div>
          </div>
        </div>

        {/* Shipping Configuration */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-silk-light shadow-sm">
          <h3 className="font-bold text-lg text-dark-red mb-6 border-b border-silk-light pb-4">Shipping Configuration</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
            <div>
              <label className="block text-xs font-bold text-grey-beige uppercase tracking-wider mb-2">Free Shipping Threshold (₹)</label>
              <input 
                type="number" 
                min="0"
                className="w-full p-3 bg-gray-50 border border-silk-light rounded-xl outline-none focus:border-dark-red/50 transition-colors"
                value={form.shippingThreshold}
                onChange={e => setForm({ ...form, shippingThreshold: Number(e.target.value) })}
                required
              />
              <p className="text-xs text-gray-500 mt-2">Orders above this amount will get free shipping.</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-grey-beige uppercase tracking-wider mb-2">Standard Shipping Cost (₹)</label>
              <input 
                type="number" 
                min="0"
                className="w-full p-3 bg-gray-50 border border-silk-light rounded-xl outline-none focus:border-dark-red/50 transition-colors"
                value={form.shippingCost}
                onChange={e => setForm({ ...form, shippingCost: Number(e.target.value) })}
                required
              />
              <p className="text-xs text-gray-500 mt-2">Applied to orders below the free shipping threshold.</p>
            </div>
          </div>
          
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl flex items-start gap-3">
            <AlertCircle size={20} className="shrink-0 mt-0.5 text-amber-600" />
            <p className="text-sm">Changing these values will immediately affect new orders. Existing orders or abandoned checkouts will remain untouched.</p>
          </div>
        </div>

        {/* Announcement Bar */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-silk-light shadow-sm">
          <div className="flex justify-between items-center mb-6 border-b border-silk-light pb-4">
            <h3 className="font-bold text-lg text-dark-red">Announcement Bar</h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-sm font-bold text-gray-600">Active</span>
              <div className="relative">
                <input 
                  type="checkbox" 
                  className="sr-only"
                  checked={form.announcementBar.isActive}
                  onChange={e => setForm({ ...form, announcementBar: { ...form.announcementBar, isActive: e.target.checked } })}
                />
                <div className={`block w-10 h-6 rounded-full transition-colors ${form.announcementBar.isActive ? 'bg-dark-red' : 'bg-gray-300'}`}></div>
                <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${form.announcementBar.isActive ? 'translate-x-4' : ''}`}></div>
              </div>
            </label>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-grey-beige uppercase tracking-wider mb-2">Announcement Text</label>
              <input 
                type="text" 
                placeholder="e.g. Free shipping on orders over ₹999!"
                className="w-full p-3 bg-gray-50 border border-silk-light rounded-xl outline-none focus:border-dark-red/50 transition-colors"
                value={form.announcementBar.text}
                onChange={e => setForm({ ...form, announcementBar: { ...form.announcementBar, text: e.target.value } })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-grey-beige uppercase tracking-wider mb-2">Announcement Link (Optional)</label>
              <input 
                type="text" 
                placeholder="e.g. /shop"
                className="w-full p-3 bg-gray-50 border border-silk-light rounded-xl outline-none focus:border-dark-red/50 transition-colors"
                value={form.announcementBar.link}
                onChange={e => setForm({ ...form, announcementBar: { ...form.announcementBar, link: e.target.value } })}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button 
            type="submit" 
            disabled={saving}
            className="flex items-center gap-2 bg-dark-red text-white px-8 py-3 rounded-xl font-bold hover:bg-ruby-red transition-all shadow-sm hover:shadow disabled:opacity-50"
          >
            {saving ? 'Saving...' : <><Save size={18} /> Save Settings</>}
          </button>
        </div>
      </form>
    </div>
  );
}
