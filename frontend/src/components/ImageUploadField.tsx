import React, { useState, Suspense, lazy } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { useApp } from '../context/AppContext';
import { Upload, X, Link as LinkIcon, Image as ImageIcon, Library } from 'lucide-react';

const MediaLibrary = lazy(() => import('./MediaLibrary'));

interface ImageUploadFieldProps {
  isEditing: boolean;
  imageUrl: string;
  imageAlt: string;
  onImageChange: (url: string) => void;
  onAltChange: (alt: string) => void;
  className?: string;
  containerClassName?: string;
  aspectRatio?: string;
}

export default function ImageUploadField({
  isEditing,
  imageUrl,
  imageAlt,
  onImageChange,
  onAltChange,
  className = '',
  containerClassName = '',
  aspectRatio = 'auto'
}: ImageUploadFieldProps) {
  const { getAuthHeaders } = useApp();
  const [isUploading, setIsUploading] = useState(false);
  const [mode, setMode] = useState<'upload' | 'url' | 'library'>('upload');

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB.');
      return;
    }

    const uploadToast = toast.loading('Uploading image...');
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const headers = await getAuthHeaders(false);
      const res = await fetch(`${API_URL}/api/v1/admin/upload`, {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Upload failed');
      }

      onImageChange(data.path);
      toast.success('Image uploaded successfully', { id: uploadToast });
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload image', { id: uploadToast });
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const displayUrl = imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('/')
    ? `/${imageUrl}`
    : imageUrl;

  if (!isEditing) {
    if (!imageUrl) return null;
    return (
      <img src={displayUrl} alt={imageAlt} className={className} style={{ aspectRatio }} loading="lazy" decoding="async" />
    );
  }

  const positionClass = containerClassName?.includes('absolute') ? '' : 'relative';

  return (
    <div className={`${positionClass} group border-2 border-dashed rounded-sm ${imageUrl ? 'border-transparent hover:border-slate-300' : 'border-slate-300 bg-slate-50'} ${containerClassName}`}>
      {imageUrl ? (
        <img src={displayUrl} alt={imageAlt} className={className} style={{ aspectRatio }} loading="lazy" decoding="async" />
      ) : (
        <div className="flex flex-col items-center justify-center p-6 text-slate-400" style={{ aspectRatio }}>
          <ImageIcon size={32} className="mb-2" />
          <span className="text-xs uppercase tracking-wider">No Image</span>
        </div>
      )}

      {/* Edit Overlay */}
      <div className="absolute inset-0 z-20 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-end justify-center p-8 md:pr-16 gap-3">
        <div className="flex bg-white rounded-md overflow-hidden text-xs font-sans shadow-sm">
          <button 
            type="button"
            className={`px-3 py-1.5 flex items-center gap-1 ${mode === 'upload' ? 'bg-slate-100 text-slate-900 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}
            onClick={(e) => { e.stopPropagation(); setMode('upload'); }}
          >
            <Upload size={14} /> Upload
          </button>
          <button 
            type="button"
            className={`px-3 py-1.5 flex items-center gap-1 ${mode === 'url' ? 'bg-slate-100 text-slate-900 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}
            onClick={(e) => { e.stopPropagation(); setMode('url'); }}
          >
            <LinkIcon size={14} /> URL
          </button>
          <button 
            type="button"
            className={`px-3 py-1.5 flex items-center gap-1 ${mode === 'library' ? 'bg-slate-100 text-slate-900 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}
            onClick={(e) => { e.stopPropagation(); setMode('library'); }}
          >
            <Library size={14} /> Library
          </button>
        </div>

        {mode === 'library' && createPortal(
          <Suspense fallback={<div className="fixed inset-0 z-[110] flex items-center justify-center text-white text-xs">Loading library...</div>}>
            <div className="fixed inset-4 sm:inset-10 z-[100] bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col border border-gray-200" onClick={e => e.stopPropagation()}>
              <MediaLibrary 
                mode="picker" 
                onSelect={(url) => { onImageChange(url); setMode('upload'); }} 
                onClose={() => setMode('upload')} 
              />
            </div>
            <div className="fixed inset-0 bg-black/60 z-[90]" onClick={(e) => { e.stopPropagation(); setMode('upload'); }} />
          </Suspense>,
          document.body
        )}

        {mode === 'upload' ? (
          <label className="bg-white text-slate-900 px-4 py-2 rounded-sm text-xs font-sans tracking-widest uppercase cursor-pointer hover:bg-slate-100 transition-colors flex items-center gap-2">
            {isUploading ? <span className="animate-pulse">Uploading...</span> : <><Upload size={14} /> Select File</>}
            <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={isUploading} />
          </label>
        ) : (
          <div className="w-full max-w-xs flex items-center gap-2">
            <input 
              type="text" 
              placeholder="https://..." 
              value={imageUrl} 
              onChange={(e) => onImageChange(e.target.value.trim())}
              className="flex-1 text-xs px-2 py-1.5 rounded-sm border-none focus:ring-2 focus:ring-dark-red text-slate-900 font-sans"
            />
            {imageUrl && (
              <button type="button" onClick={() => onImageChange('')} className="bg-white p-1.5 rounded-sm text-slate-500 hover:text-dark-red">
                <X size={14} />
              </button>
            )}
          </div>
        )}

        <div className="w-full max-w-xs mt-2">
          <label className="text-[10px] uppercase tracking-widest text-white/80 mb-1 block">Alt Text (Required)</label>
          <input 
            type="text" 
            placeholder="Describe image for screen readers" 
            value={imageAlt} 
            onChange={(e) => onAltChange(e.target.value)}
            className="w-full text-xs px-2 py-1.5 rounded-sm border-none focus:ring-2 focus:ring-dark-red text-slate-900 font-sans bg-white"
          />
        </div>
      </div>
    </div>
  );
}
