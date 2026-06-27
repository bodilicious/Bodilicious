import { useEffect, useState } from 'react';
import HomePage from '../pages/HomePage';

export default function HomepagePreviewFrame() {
  const [content, setContent] = useState<any>(null);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === 'content-update') setContent(e.data.payload);
    };
    window.addEventListener('message', handleMessage);
    window.parent.postMessage({ type: 'preview-ready' }, window.location.origin);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleContentChange = (newContent: any) => {
    setContent(newContent);
    window.parent.postMessage({ type: 'content-change', payload: newContent }, window.location.origin);
  };

  if (content === null) return null;

  return (
    <HomePage isEditing contentData={content} onContentChange={handleContentChange} />
  );
}
