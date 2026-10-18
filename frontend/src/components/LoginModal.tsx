/**
 * LoginModal - Hidden login modal with Google OAuth
 * Activated by clicking header 7 times within 2 seconds
 */
import React from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../contexts/AuthContext.tsx';
import Modal from './Modal.tsx';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { googleLogin } = useAuth();
  const [error, setError] = React.useState<string>('');
  const [isLoading, setIsLoading] = React.useState(false);

  // Handle Google OAuth success
  const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
    if (!credentialResponse.credential) {
      setError('No credential received from Google');
      return;
    }

    setIsLoading(true);
    setError('');

    const result = await googleLogin(credentialResponse.credential);

    if (result.success) {
      onClose();
    } else {
      setError(result.error || 'Login failed');
      setIsLoading(false);
    }
  };

  // Handle Google OAuth error
  const handleGoogleError = () => {
    setError('Google login failed. Please try again.');
    setIsLoading(false);
  };

  // Reset states when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      setIsLoading(false);
      setError('');
    }
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} titleId="login-modal-title" maxWidth="max-w-md" dismissOnBackdrop={false}>
      <div className="p-7 flex flex-col gap-5">
        <div className="flex justify-between items-center gap-3">
          <span
            id="login-modal-title"
            className="font-mono text-[11px] leading-none font-medium text-acct tracking-[0.12em] uppercase"
          >
            Operator access
          </span>
          <button
            onClick={onClose}
            type="button"
            className="bg-transparent border-0 text-mut font-mono text-[18px] leading-none cursor-pointer p-1 hover:text-ink"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        {isLoading ? (
          <div className="py-8 text-center" role="status" aria-label="Signing in">
            <span className="font-mono text-[12px] tracking-[0.12em] uppercase text-mut">
              ● authenticating…
            </span>
          </div>
        ) : (
          <>
            <p className="m-0 text-[15px] leading-[1.55] text-ink2">
              Sign in with the authorised Google account to open the console.
            </p>

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

            {error && (
              <p role="alert" className="m-0 border border-ln2 p-3 font-mono text-[12px] leading-[1.5] text-ink">
                {error}
              </p>
            )}

            <p className="m-0 font-mono text-[11px] leading-none text-mut tracking-[0.06em] uppercase">
              Allow-listed emails only.
            </p>
          </>
        )}
      </div>
    </Modal>
  );
};

export default LoginModal;
