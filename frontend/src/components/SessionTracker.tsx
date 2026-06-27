import { useEffect, useRef, useContext } from 'react';
import { AppContext } from '../context/AppContext';

export default function SessionTracker() {
  const { authStatus, getAuthHeaders } = useContext(AppContext)!;
  const sessionStartedRef = useRef(false);

  useEffect(() => {
    // Wait until auth is resolved so we know if they are logged in
    if (authStatus === 'loading') return;
    if (sessionStartedRef.current) return;

    sessionStartedRef.current = true;

    // Retrieve or create a session ID scoped to this tab
    let sessionId = sessionStorage.getItem('bodilicious_session_id');
    if (!sessionId) {
      sessionId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
      sessionStorage.setItem('bodilicious_session_id', sessionId);
    }

    const startSession = async () => {
      try {
        const headers: any = await getAuthHeaders();
        headers['Content-Type'] = 'application/json';

        await fetch(`${import.meta.env.VITE_API_URL}/api/v1/user/session/start`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            session_id: sessionId,
            network: {
              user_agent: navigator.userAgent
            }
          })
        });
      } catch (err) {
        console.error('Failed to start session', err);
      }
    };

    startSession();

    // 3-minute heartbeat ping to keep session alive in case of crash
    // Check visibility state to avoid pinging if the user left the tab in the background
    const interval = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      
      fetch(`${import.meta.env.VITE_API_URL}/api/v1/user/session/ping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId })
      }).catch(() => {});
    }, 180000);

    // End session using sendBeacon for reliability on tab close/hidden
    const endSession = () => {
      const url = `${import.meta.env.VITE_API_URL}/api/v1/user/session/end`;
      const data = JSON.stringify({ session_id: sessionId });
      const blob = new Blob([data], { type: 'application/json' });
      navigator.sendBeacon(url, blob);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        endSession();
      }
    };

    window.addEventListener('beforeunload', endSession);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', endSession);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [authStatus, getAuthHeaders]);

  return null;
}
