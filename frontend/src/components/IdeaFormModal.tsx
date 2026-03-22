import { useState, useEffect } from 'react';
import * as ideasRepository from '../repositories/ideasRepository.ts';
import Modal from './Modal.tsx';
import type { IdeaItem, IdeaFormData } from '../types/index.ts';

interface IdeaFormModalProps {
  isOpen: boolean;
  mode: 'add' | 'edit';
  idea?: IdeaItem;
  onClose: () => void;
  onSuccess: () => void;
}

const IdeaFormModal: React.FC<IdeaFormModalProps> = ({
  isOpen,
  mode,
  idea,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState<IdeaFormData>({ title: '', description: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && idea) {
        setFormData({ title: idea.title, description: idea.description });
      } else {
        setFormData({ title: '', description: '' });
      }
      setErrors({});
    }
  }, [isOpen, mode, idea]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.trim().length < 3) {
      newErrors.title = 'Title must be at least 3 characters';
    } else if (formData.title.trim().length > 150) {
      newErrors.title = 'Title must be 150 characters or fewer';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.trim().length < 10) {
      newErrors.description = 'Description must be at least 10 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const payload: IdeaFormData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
      };

      let response;
      if (mode === 'edit' && idea) {
        response = await ideasRepository.updateIdea(idea.id, payload);
      } else {
        response = await ideasRepository.createIdea(payload);
      }

      if (response.success) {
        onSuccess();
      } else {
        setErrors({ submit: response.error || 'Failed to save idea' });
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Failed to save idea';
      setErrors({ submit: errorMsg });
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} titleId="idea-form-title">
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 id="idea-form-title" className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {mode === 'add' ? 'Add New Idea' : 'Edit Idea'}
          </h2>
          <button
            onClick={onClose}
            type="button"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title Field */}
          <div>
            <label htmlFor="idea-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title <span className="text-red-500" aria-hidden="true">*</span>
              <span className="sr-only">(required)</span>
            </label>
            <input
              type="text"
              id="idea-title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              aria-required="true"
              aria-describedby={errors.title ? 'idea-title-error' : undefined}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ${
                errors.title ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="Idea title"
            />
            {errors.title && (
              <p id="idea-title-error" role="alert" className="mt-1 text-sm text-red-600">
                {errors.title}
              </p>
            )}
          </div>

          {/* Description Field */}
          <div>
            <label htmlFor="idea-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description <span className="text-red-500" aria-hidden="true">*</span>
              <span className="sr-only">(required)</span>
            </label>
            <textarea
              id="idea-description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={6}
              aria-required="true"
              aria-describedby={errors.description ? 'idea-description-error' : undefined}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ${
                errors.description ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="Describe the idea..."
            />
            {errors.description && (
              <p id="idea-description-error" role="alert" className="mt-1 text-sm text-red-600">
                {errors.description}
              </p>
            )}
          </div>

          {/* Submit Error */}
          {errors.submit && (
            <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{errors.submit}</p>
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
              aria-label={submitting ? 'Saving idea' : (mode === 'add' ? 'Add Idea' : 'Save Changes')}
              className="px-6 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              style={{ background: 'var(--accent)' }}
              onMouseEnter={e => !e.currentTarget.disabled && (e.currentTarget.style.background = 'var(--accent-hover)')}
              onMouseLeave={e => !e.currentTarget.disabled && (e.currentTarget.style.background = 'var(--accent)')}
            >
              {submitting ? (
                <>
                  <div role="status" aria-label="Saving" className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                mode === 'add' ? 'Add Idea' : 'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default IdeaFormModal;
