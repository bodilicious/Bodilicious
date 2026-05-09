import { Navigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Loader2 } from 'lucide-react';
import React from 'react';

export default function RequireAuth({ children }: { children: React.ReactNode }) {
    const { authLoading, isAuthenticated } = useApp();
    const location = useLocation();

    if (authLoading) {
        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-dark-red mb-4" />
                <p className="text-xs uppercase tracking-widest font-sans text-dark-red">Loading secure checkout...</p>
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <Navigate
                to="/signin"
                state={{
                    returnTo: location.pathname + location.search + location.hash,
                    reason: "checkout"
                }}
                replace
            />
        );
    }

    return <>{children}</>;
}
