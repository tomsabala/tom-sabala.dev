import { useState, useEffect } from 'react';
import * as jobsRepository from '../repositories/jobsRepository.ts';
import { apiErrorMessage } from '../repositories/apiError.ts';
import Modal from './Modal.tsx';
import {
  BTN_GHOST,
  BTN_PRIMARY,
  DIALOG_TITLE,
  ERROR_BOX,
  ERROR_TEXT,
  FIELD,
  FIELD_ERROR,
  LABEL,
} from './formStyles.ts';
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
    } catch (error: unknown) {
      setErrors({ submit: apiErrorMessage(error, 'Failed to save application') });
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
        <div className="flex justify-between items-start gap-4 mb-6">
          <h2 id="job-application-form-title" className={DIALOG_TITLE}>
            {mode === 'add' ? 'Add application' : 'Edit application'}
          </h2>
          <button
            onClick={onClose}
            type="button"
            className="bg-transparent border border-ln2 text-mut hover:text-ink font-mono text-[12px] leading-none px-2.5 py-2 cursor-pointer"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label htmlFor="company_id" className={LABEL}>
              Company <span className="text-acct" aria-hidden="true">*</span>
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
              className={`${FIELD} disabled:opacity-50 ${errors.company_id ? FIELD_ERROR : ''}`}
            >
              <option value="">
                {loadingCompanies ? 'Loading companies…' : 'Select a company…'}
              </option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {errors.company_id && (
              <p id="company-id-error" role="alert" className={ERROR_TEXT}>{errors.company_id}</p>
            )}
          </div>

          <div>
            <label htmlFor="position" className={LABEL}>
              Position <span className="text-acct" aria-hidden="true">*</span>
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
              className={`${FIELD} ${errors.position ? FIELD_ERROR : ''}`}
              placeholder="Software Engineer"
            />
            {errors.position && (
              <p id="position-error" role="alert" className={ERROR_TEXT}>{errors.position}</p>
            )}
          </div>

          <div>
            <label htmlFor="status" className={LABEL}>
              Status <span className="text-acct" aria-hidden="true">*</span>
              <span className="sr-only">(required)</span>
            </label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              aria-required="true"
              className={FIELD}
            >
              {VALID_STATUSES.map(s => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="job_url" className={LABEL}>Job posting URL</label>
            <input
              type="text"
              id="job_url"
              name="job_url"
              value={formData.job_url}
              onChange={handleInputChange}
              aria-describedby={errors.job_url ? 'job-url-error' : undefined}
              className={`${FIELD} ${errors.job_url ? FIELD_ERROR : ''}`}
              placeholder="https://jobs.acme.com/..."
            />
            {errors.job_url && (
              <p id="job-url-error" role="alert" className={ERROR_TEXT}>{errors.job_url}</p>
            )}
          </div>

          <div>
            <label htmlFor="date_applied" className={LABEL}>Date applied</label>
            <input
              type="date"
              id="date_applied"
              name="date_applied"
              value={formData.date_applied}
              onChange={handleInputChange}
              className={`${FIELD} font-mono`}
            />
          </div>

          <div>
            <label htmlFor="notes" className={LABEL}>Notes</label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows={4}
              className={FIELD}
              placeholder="Any notes about this application..."
            />
          </div>

          {errors.submit && (
            <div role="alert" className={ERROR_BOX}>{errors.submit}</div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} disabled={submitting} className={BTN_GHOST}>
              Cancel
            </button>
            <button type="submit" disabled={submitting} className={BTN_PRIMARY}>
              {submitting ? 'Saving…' : mode === 'add' ? 'Add application' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default JobApplicationFormModal;
