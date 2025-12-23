import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../common/LoadingSpinner';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // After OAuth callback, redirect to dashboard
    // Supabase handles the token exchange automatically
    const timer = setTimeout(() => {
      navigate('/dashboard');
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <LoadingSpinner size="lg" message="Completing sign in..." />
    </div>
  );
}
