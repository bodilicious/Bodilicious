import { useState, useEffect, useCallback, useRef } from 'react';

import { useApp } from '../context/AppContext';
import toast from 'react-hot-toast';
import { Loader2, Save, Undo2, Eye, MonitorSmartphone, Layers, ChevronLeft, CheckCircle2 } from 'lucide-react';

type ViewMode = 'desktop' | 'mobile';

export default function VisualHomepageEditor() {
  const { user, getAuthHeaders } = useApp();
  const [draftContent, setDraftContent] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [lastPublishedInfo, setLastPublishedInfo] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('desktop');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [previewReady, setPreviewReady] = useState(false);

  useEffect(() => {
    fetchDraft();
  }, []);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === 'preview-ready') setPreviewReady(true);
      else if (e.data?.type === 'content-change') handleContentChange(e.data.payload);
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    if (previewReady && draftContent && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: 'content-update', payload: draftContent }, window.location.origin);
    }
  }, [previewReady, draftContent]);

  const fetchDraft = async () => {
    setIsLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/v1/settings/homepage/draft`, {
        headers
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDraftContent(data.data || {});
      } else {
        toast.error(data.message || 'Failed to fetch draft');
        setDraftContent({});
      }

      // Fetch published to get last published info
      const pubRes = await fetch(`${API_URL}/api/v1/settings/homepage`);
      const pubData = await pubRes.json();
      if (pubRes.ok && pubData.success && pubData.data) {
        const pub = pubData.data;
        if (pub.publishedAt) {
          setLastPublishedInfo(`Last published ${new Date(pub.publishedAt).toLocaleString()}`);
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Error fetching draft');
      setDraftContent({});
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced auto-save
  const debounceTimeoutRef = useRef<any>(null);
  const debouncedSave = useCallback(
    async (newContent: any) => {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = setTimeout(async () => {
        setIsSaving(true);
        try {
          const headers = await getAuthHeaders();
          const res = await fetch(`${API_URL}/api/v1/settings/homepage/draft`, {
            method: 'PUT',
            headers: {
              ...headers,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(newContent)
          });
          const data = await res.json();
          if (!res.ok || !data.success) {
            toast.error(data.message || 'Autosave failed');
          } else {
            setSavedAt(new Date());
            setHasUnsavedChanges(false);
          }
        } catch (err: any) {
          toast.error('Autosave failed');
        } finally {
          setIsSaving(false);
        }
      }, 1200);
    },
    [user, API_URL]
  );

  const handleContentChange = (newContent: any) => {
    setDraftContent(newContent);
    setHasUnsavedChanges(true);
    debouncedSave(newContent);
  };

  const handlePublish = async () => {
    if (!window.confirm('Are you sure you want to publish these changes to the live storefront?')) return;

    setIsPublishing(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/v1/settings/homepage/publish`, {
        method: 'POST',
        headers
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Homepage published successfully!');
        setHasUnsavedChanges(false);
        if (data.data?.publishedAt) {
          setLastPublishedInfo(`Last published ${new Date(data.data.publishedAt).toLocaleString()}`);
        }
      } else {
        toast.error(data.message || 'Failed to publish');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error publishing');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDiscard = async () => {
    if (!window.confirm('Are you sure you want to discard all unpublished changes? This will revert the editor to the live version.')) return;

    setIsLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/v1/settings/homepage/discard`, {
        method: 'POST',
        headers
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Draft reverted to last published version.');
        setDraftContent(data.data || {});
        setHasUnsavedChanges(false);
      } else {
        toast.error(data.message || 'Failed to discard');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error discarding draft');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <Loader2 className="animate-spin text-dark-red" size={32} />
        <p className="text-slate-500 text-sm font-sans">Loading Live Store Builder...</p>
      </div>
    );
  }

  const getSaveStatus = () => {
    if (isSaving) return { text: 'Saving...', color: 'text-amber-600', icon: <Loader2 size={12} className="animate-spin" /> };
    if (hasUnsavedChanges) return { text: 'Unsaved changes', color: 'text-orange-500', icon: <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" /> };
    if (savedAt) return { text: `Saved ${savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, color: 'text-green-600', icon: <CheckCircle2 size={12} /> };
    return { text: 'Draft', color: 'text-slate-500', icon: <Save size={12} /> };
  };

  const saveStatus = getSaveStatus();

  return (
    <div className="flex flex-col h-screen bg-slate-100 overflow-hidden">
      {/* Fixed Admin Action Bar */}
      <div className="shrink-0 z-50 bg-white border-b border-slate-200 shadow-sm px-4 py-2.5 flex items-center justify-between gap-4">
        {/* Left: Title & Status */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-dark-red shrink-0" />
            <h1 className="font-serif text-lg text-dark-red whitespace-nowrap">Live Store Builder</h1>
          </div>
          <div className={`flex items-center gap-1.5 text-[11px] font-sans ${saveStatus.color}`}>
            {saveStatus.icon}
            <span>{saveStatus.text}</span>
          </div>
          {lastPublishedInfo && (
            <>
              <span className="text-slate-300 hidden md:block">|</span>
              <span className="text-[11px] text-slate-400 font-sans hidden md:block">{lastPublishedInfo}</span>
            </>
          )}
        </div>

        {/* Center: View Mode Toggle */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('desktop')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-sans font-medium transition-all ${
              viewMode === 'desktop' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <MonitorSmartphone size={14} />
            <span className="hidden sm:inline">Desktop</span>
          </button>
          <button
            onClick={() => setViewMode('mobile')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-sans font-medium transition-all ${
              viewMode === 'mobile' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <ChevronLeft size={14} className="rotate-90" />
            <span className="hidden sm:inline">Mobile</span>
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleDiscard}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-sans font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors border border-transparent hover:border-red-200"
          >
            <Undo2 size={13} /> Discard
          </button>

          <a
            href="/?preview=draft"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-sans font-medium text-slate-600 hover:text-dark-red hover:bg-dark-red/5 rounded-md transition-colors border border-slate-200"
          >
            <Eye size={13} /> Preview
          </a>

          <button
            onClick={handlePublish}
            disabled={isPublishing}
            className="flex items-center gap-1.5 px-5 py-1.5 bg-dark-red text-white text-xs font-sans font-medium uppercase tracking-wider rounded-md hover:bg-ruby-red disabled:opacity-70 transition-colors shadow-sm"
          >
            {isPublishing ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {isPublishing ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      </div>

      {/* Editing Tips Banner */}
      <div className="shrink-0 bg-blue-50 border-b border-blue-100 px-4 py-1.5 flex items-center gap-2">
        <span className="text-[10px] font-sans text-blue-600 font-medium uppercase tracking-wider">💡 Editing Tips:</span>
        <span className="text-[11px] font-sans text-blue-500">
          Click any text to edit inline · Hover image to upload or set URL · Drag grip handles to reorder · Click <strong>+</strong> to add items · Click <strong>×</strong> to remove
        </span>
      </div>

      {/* Editor Canvas */}
      <div className="flex-1 overflow-hidden bg-slate-200 p-4 sm:p-6 flex flex-col">
        <div
          className={`flex-1 mx-auto bg-white shadow-2xl rounded-xl overflow-hidden border border-slate-300 transition-all duration-300 flex flex-col ${
            viewMode === 'mobile' ? 'w-[390px] max-h-[844px]' : 'w-full max-w-[1440px]'
          }`}
          style={{ transformOrigin: 'top center' }}
        >
          {draftContent !== null && (
            <iframe
              ref={iframeRef}
              src="/internal/homepage-preview"
              title="Homepage preview"
              style={{ width: '100%', height: '100%', border: 0, background: 'white' }}
              className="flex-1 w-full h-full"
            />
          )}
        </div>
      </div>
    </div>
  );
}
