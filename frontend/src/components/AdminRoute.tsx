import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useApp } from '../context/AppContext';

const AdminRoute: React.FC = () => {
  const { user, authStatus, authLoading, cartLoading } = useApp();

  if (authLoading || authStatus === 'loading' || cartLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-10 h-10 border-4 border-dark-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Check if user is logged in AND is an admin (any tier)
  const isAdmin = user?.role === 'admin' || user?.role === 'primary_admin';

  if (!user || !isAdmin) {
    console.warn('Access denied: Admin privileges required.');
    console.log('Current Auth Status:', authStatus);
    console.log('Current User:', user?.email, '| Role:', user?.role);
    return <Navigate to="/signin" replace />;
  }

  if (user.isBlocked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-bold mb-4">Account Blocked</h1>
        <p className="text-gray-600 mb-6">Your administrative access has been suspended.</p>
        <button 
          onClick={() => window.location.href = '/'}
          className="bg-dark-red text-white px-6 py-2 rounded-full"
        >
          Return Home
        </button>
      </div>
    );
  }

  return <Outlet />;
};

export default AdminRoute;
