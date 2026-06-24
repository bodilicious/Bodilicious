import React, { useState, useEffect, useCallback } from 'react';
import { X, Trash2, CheckSquare, Square, Loader2, Image as ImageIcon } from 'lucide-react';
import { useApp } from '../context/AppContext';
import toast from 'react-hot-toast';

interface MediaImage {
  publicId: string;
  url: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
  createdAt: string;
}

interface MediaLibraryProps {
  mode?: 'picker' | 'manage';
  onSelect?: (url: string) => void;
  onClose?: () => void;
}

export default function MediaLibrary({ mode = 'manage', onSelect, onClose }: MediaLibraryProps) {
  const { getAuthHeaders } = useApp();
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  const [images, setImages] = useState<MediaImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);


  const fetchImages = useCallback(async (cursor?: string) => {
    try {
      const headers = await getAuthHeaders();
      let url = `${API_URL}/api/v1/admin/images?maxResults=30`;
      if (cursor) url += `&nextCursor=${cursor}`;

      const res = await fetch(url, { headers });
      const data = await res.json();
      
      if (data.success) {
        if (cursor) {
          setImages(prev => [...prev, ...data.images]);
        } else {
          setImages(data.images);
        }
        setNextCursor(data.nextCursor);
      } else {
        toast.error(data.message || 'Failed to fetch images');
      }
    } catch (err) {
      toast.error('Network error fetching images');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [getAuthHeaders, API_URL]);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  const handleLoadMore = () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    fetchImages(nextCursor);
  };

  const toggleSelect = (publicId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(selectedIds);
    if (newSet.has(publicId)) {
      newSet.delete(publicId);
    } else {
      newSet.add(publicId);
    }
    setSelectedIds(newSet);
  };

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;
    
    // Usage check for the first selected item to warn users (basic implementation)
    if (selectedIds.size === 1) {
      try {
        const id = Array.from(selectedIds)[0];
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_URL}/api/v1/admin/images/usage?publicId=${encodeURIComponent(id)}`, { headers });
        const data = await res.json();
        if (data.success && data.usage.length > 0) {
          const proceed = window.confirm(`This image is currently used in ${data.usage.length} place(s) (e.g. ${data.usage[0].name}). Are you sure you want to delete it permanently?`);
          if (!proceed) return;
        } else if (!window.confirm('Are you sure you want to delete this image permanently?')) {
          return;
        }
      } catch (e) {
        if (!window.confirm('Are you sure you want to delete this image permanently?')) return;
      }
    } else {
      if (!window.confirm(`Are you sure you want to permanently delete ${selectedIds.size} images?`)) return;
    }

    setIsDeleting(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/v1/admin/images/delete`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicIds: Array.from(selectedIds) })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Deleted ${selectedIds.size} images`);
        setImages(images.filter(img => !selectedIds.has(img.publicId)));
        setSelectedIds(new Set());
      } else {
        toast.error(data.message || 'Failed to delete images');
      }
    } catch (err) {
      toast.error('Error deleting images');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 h-64">
        <Loader2 className="w-8 h-8 animate-spin text-dark-red" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 className="text-lg font-serif text-dark-red flex items-center gap-2">
          <ImageIcon size={20} /> Media Library
        </h2>
        
        <div className="flex items-center gap-3">
          {mode === 'manage' && selectedIds.size > 0 && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-md text-sm font-medium hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              Delete ({selectedIds.size})
            </button>
          )}
          {onClose && (
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4 bg-slate-50 min-h-[400px]">
        {images.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
            <ImageIcon size={48} className="opacity-50" />
            <p>No images found in your library.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {images.map(img => {
              const isSelected = selectedIds.has(img.publicId);
              return (
                <div 
                  key={img.publicId}
                  onClick={() => mode === 'picker' && onSelect ? onSelect(img.url) : undefined}
                  className={`relative group bg-white rounded-lg border overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer
                    ${isSelected ? 'border-dark-red ring-1 ring-dark-red' : 'border-gray-200'}
                  `}
                >
                  <div className="aspect-square bg-gray-100 relative">
                    <img src={img.url} alt="Media" className="w-full h-full object-cover" loading="lazy" />
                    
                    {/* Checkbox for manage mode */}
                    {mode === 'manage' && (
                      <button
                        onClick={(e) => toggleSelect(img.publicId, e)}
                        className={`absolute top-2 left-2 p-1 rounded-md shadow-sm transition-opacity ${isSelected ? 'opacity-100 bg-white text-dark-red' : 'opacity-0 group-hover:opacity-100 bg-white/80 text-gray-500 hover:text-gray-800'}`}
                      >
                        {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                      </button>
                    )}
                  </div>
                  
                  <div className="p-2 text-[10px] sm:text-xs text-gray-500 flex flex-col gap-0.5 bg-white border-t border-gray-100">
                    <div className="flex justify-between items-center font-medium text-gray-700 truncate" title={img.publicId.split('/').pop()}>
                      <span className="truncate">{img.publicId.split('/').pop()}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px]">
                      <span>{img.width}x{img.height}</span>
                      <span>{formatBytes(img.bytes)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[9px] text-gray-400 mt-0.5">
                      <span className="uppercase">{img.format}</span>
                      <span>{new Date(img.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {nextCursor && (
          <div className="flex justify-center mt-6 mb-2">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="px-4 py-2 bg-white border border-gray-300 rounded-full text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
            >
              {loadingMore && <Loader2 size={16} className="animate-spin" />}
              Load More
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
