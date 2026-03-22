import { useState, useEffect } from 'react';
import * as jobsRepository from '../repositories/jobsRepository.ts';
import type { JobApplication } from '../types/index.ts';

const VALID_STATUSES = [
  'bookmarked', 'applied', 'in_review', 'interview', 'offer', 'rejected', 'withdrawn', 'closed',
];

const STATUS_LABELS: Record<string, string> = {
  bookmarked: 'Bookmarked',
  applied: 'Applied',
  in_review: 'In Review',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  closed: 'Closed',
};

interface JobApplicationFormModalProps {
  isOpen: boolean;
  mode: 'add' | 'edit';
  application?: JobApplication;
  onClose: () => void;
  onSuccess: () => void;
}

const JobApplicationFormModal: React.FC<JobApplicationFormModalProps> = ({
  isOpen,
  mode,
  application,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState({
    company_name: '',
    position: '',
    status: 'bookmarked',
    job_url: '',
    date_applied: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && application) {
        setFormData({
          company_name: application.company_name,
          position: application.position,
          status: application.status,
          job_url: application.job_url || '',
          date_applied: application.date_applied || '',
          notes: application.notes || '',
        });
      } else {
        setFormData({
          company_name: '',
          position: '',
          status: 'bookmarked',
          job_url: '',
          date_applied: '',
          notes: '',
        });
      }
      setErrors({});
    }
  }, [isOpen, mode, application]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
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

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.company_name.trim()) {
      newErrors.company_name = 'Company name is required';
    }
    if (!formData.position.trim()) {
      newErrors.position = 'Position is required';
    }
    const urlPattern = /^https?:\/\/.+/;
    if (formData.job_url && !urlPattern.test(formData.job_url)) {
      newErrors.job_url = 'Please enter a valid URL (starting with http:// or https://)';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      const data = {
        company_name: formData.company_name.trim(),
        position: formData.position.trim(),
        status: formData.status,
        job_url: formData.job_url.trim() || undefined,
        date_applied: formData.date_applied || undefined,
        notes: formData.notes.trim() || undefined,
      };
      let response;
      if (mode === 'edit' && application) {
        response = await jobsRepository.updateApplication(application.id, data);
      } else {
        response = await jobsRepository.createApplication(data);
      }
      if (response.success) {
        onSuccess();
      } else {
        setErrors({ submit: response.error || 'Failed to save application' });
      }
    } catch (error: any) {
      setErrors({ submit: error.response?.data?.error || 'Failed to save application' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-lg"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-[#252525] rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {mode === 'add' ? 'Add Application' : 'Edit Application'}
          </h2>
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

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="company_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Company Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="company_name"
              name="company_name"
              value={formData.company_name}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ${
                errors.company_name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="Acme Corp"
            />
            {errors.company_name && <p className="mt-1 text-sm text-red-600">{errors.company_name}</p>}
          </div>

          <div>
            <label htmlFor="position" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Position <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="position"
              name="position"
              value={formData.position}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ${
                errors.position ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="Software Engineer"
            />
            {errors.position && <p className="mt-1 text-sm text-red-600">{errors.position}</p>}
          </div>

          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status <span className="text-red-500">*</span>
            </label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              {VALID_STATUSES.map(s => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="job_url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Job Posting URL
            </label>
            <input
              type="text"
              id="job_url"
              name="job_url"
              value={formData.job_url}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ${
                errors.job_url ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="https://jobs.acme.com/..."
            />
            {errors.job_url && <p className="mt-1 text-sm text-red-600">{errors.job_url}</p>}
          </div>

          <div>
            <label htmlFor="date_applied" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Date Applied
            </label>
            <input
              type="date"
              id="date_applied"
              name="date_applied"
              value={formData.date_applied}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder="Any notes about this application..."
            />
          </div>

          {errors.submit && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{errors.submit}</p>
            </div>
          )}

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
              style={{ background: 'var(--accent)' }}
              onMouseEnter={e => !e.currentTarget.disabled && (e.currentTarget.style.background = 'var(--accent-hover)')}
              onMouseLeave={e => !e.currentTarget.disabled && (e.currentTarget.style.background = 'var(--accent)')}
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                mode === 'add' ? 'Add Application' : 'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default JobApplicationFormModal;
