/**
 * LoginModal - Hidden login modal with Google OAuth
 * Activated by clicking header 7 times within 2 seconds
 */
import React, { useEffect } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../contexts/AuthContext';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { googleLogin } = useAuth();
  const [error, setError] = React.useState<string>('');
  const [isLoading, setIsLoading] = React.useState(false);

  // Handle Google OAuth success
  const handleGoogleSuccess = async (credentialResponse: any) => {
    if (!credentialResponse.credential) {
      setError('No credential received from Google');
      return;
    }

    setIsLoading(true);
    setError('');

    const result = await googleLogin(credentialResponse.credential);

    if (result.success) {
      // Success - close modal and stay on current page
      onClose();
    } else {
      // Show error
      setError(result.error || 'Login failed');
      setIsLoading(false);
    }
  };

  // Handle Google OAuth error
  const handleGoogleError = () => {
    setError('Google login failed. Please try again.');
    setIsLoading(false);
  };

  // Close modal on ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Reset states when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsLoading(false);
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-lg"
    >
      <div
        className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4"
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-gray-900">Admin Login</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col items-center">
          {isLoading ? (
            <div className="py-8">
              <div className="w-12 h-12 border-4 border-orange-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <>
              <p className="text-gray-600 mb-6 text-center">
                Sign in with your authorized Google account to access the admin panel.
              </p>

              {/* Google Sign-In Button */}
              <div className="w-full flex justify-center">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  useOneTap={false}
                  theme="outline"
                  size="large"
                  text="signin_with"
                  shape="rectangular"
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md w-full">
                  <p className="text-sm text-red-600 text-center">{error}</p>
                </div>
              )}

              {/* Info Text */}
              <p className="text-xs text-gray-500 mt-6 text-center">
                Only authorized emails can access this area.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginModal;
