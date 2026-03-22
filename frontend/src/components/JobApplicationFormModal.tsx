import { useState, useEffect } from 'react';
import * as jobsRepository from '../repositories/jobsRepository.ts';
import Modal from './Modal.tsx';
import type { JobApplication, Company } from '../types/index.ts';

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
    company_id: '',
    company_name: '',
    position: '',
    status: 'bookmarked',
    job_url: '',
    date_applied: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoadingCompanies(true);
      jobsRepository.getCompanies().then(response => {
        if (response.success) setCompanies(response.data || []);
      }).finally(() => setLoadingCompanies(false));

      if (mode === 'edit' && application) {
        setFormData({
          company_id: application.company_id != null ? String(application.company_id) : '',
          company_name: application.company_name,
          position: application.position,
          status: application.status,
          job_url: application.job_url || '',
          date_applied: application.date_applied || '',
          notes: application.notes || '',
        });
      } else {
        setFormData({
          company_id: '',
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

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.company_id) {
      newErrors.company_id = 'Please select a company';
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
        company_id: formData.company_id ? Number(formData.company_id) : undefined,
        company_name: formData.company_name,
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
    if (name === 'company_id') {
      const selected = companies.find(c => String(c.id) === value);
      setFormData(prev => ({
        ...prev,
        company_id: value,
        company_name: selected ? selected.name : '',
      }));
      if (errors.company_id) {
        setErrors(prev => { const next = { ...prev }; delete next.company_id; return next; });
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
      if (errors[name]) {
        setErrors(prev => { const next = { ...prev }; delete next[name]; return next; });
      }
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} titleId="job-application-form-title">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 id="job-application-form-title" className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {mode === 'add' ? 'Add Application' : 'Edit Application'}
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

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="company_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Company <span className="text-red-500" aria-hidden="true">*</span>
              <span className="sr-only">(required)</span>
            </label>
            <select
              id="company_id"
              name="company_id"
              value={formData.company_id}
              onChange={handleInputChange}
              aria-required="true"
              aria-describedby={errors.company_id ? 'company-id-error' : undefined}
              disabled={loadingCompanies}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:opacity-50 ${
                errors.company_id ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
            >
              <option value="">
                {loadingCompanies ? 'Loading companies…' : 'Select a company…'}
              </option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {errors.company_id && <p id="company-id-error" role="alert" className="mt-1 text-sm text-red-600">{errors.company_id}</p>}
          </div>

          <div>
            <label htmlFor="position" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Position <span className="text-red-500" aria-hidden="true">*</span>
              <span className="sr-only">(required)</span>
            </label>
            <input
              type="text"
              id="position"
              name="position"
              value={formData.position}
              onChange={handleInputChange}
              aria-required="true"
              aria-describedby={errors.position ? 'position-error' : undefined}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ${
                errors.position ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="Software Engineer"
            />
            {errors.position && <p id="position-error" role="alert" className="mt-1 text-sm text-red-600">{errors.position}</p>}
          </div>

          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status <span className="text-red-500" aria-hidden="true">*</span>
              <span className="sr-only">(required)</span>
            </label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              aria-required="true"
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
              aria-describedby={errors.job_url ? 'job-url-error' : undefined}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ${
                errors.job_url ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="https://jobs.acme.com/..."
            />
            {errors.job_url && <p id="job-url-error" role="alert" className="mt-1 text-sm text-red-600">{errors.job_url}</p>}
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
            <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-md">
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
                  <div role="status" aria-label="Saving" className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                mode === 'add' ? 'Add Application' : 'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default JobApplicationFormModal;
