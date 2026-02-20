import { useState, useEffect } from 'react';
import * as aboutRepository from '../repositories/aboutRepository.ts';
import type { AboutData } from '../types/index.ts';

interface AboutFormModalProps {
  isOpen: boolean;
  currentData: AboutData | null;
  onClose: () => void;
  onSuccess: () => void;
}

const AboutFormModal: React.FC<AboutFormModalProps> = ({
  isOpen,
  currentData,
  onClose,
  onSuccess,
}) => {
  const [content, setContent] = useState('');
  const [error, setError] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Initialize form data when modal opens
  useEffect(() => {
    if (isOpen && currentData) {
      setContent(currentData.content || '');
      setError('');
    }
  }, [isOpen, currentData]);

  // Close modal on ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const response = await aboutRepository.updateAbout({
        content: content.trim(),
      });

      if (response.success) {
        onSuccess();
      } else {
        setError(response.error || 'Failed to save about content');
      }
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to save about content');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black bg-opacity-30"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-[#1e1e1e] rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Edit About Section</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* About Content */}
          <div>
            <label htmlFor="content" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              About Text
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder="Write about yourself..."
            />
            <p className="mt-1 text-xs text-gray-500">
              Plain text only - no formatting or markdown supported.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-5 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              style={{ background: 'hsl(210, 65%, 60%)' }}
              onMouseEnter={e => !e.currentTarget.disabled && (e.currentTarget.style.background = 'hsl(210, 55%, 52%)')}
              onMouseLeave={e => !e.currentTarget.disabled && (e.currentTarget.style.background = 'hsl(210, 65%, 60%)')}
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AboutFormModal;
