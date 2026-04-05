import { useState, useEffect } from 'react';
import * as jobsRepository from '../repositories/jobsRepository.ts';
import Modal from './Modal.tsx';
import type { Company } from '../types/index.ts';

interface CompanyFormModalProps {
  isOpen: boolean;
  mode: 'add' | 'edit';
  company?: Company;
  onClose: () => void;
  onSuccess: () => void;
}

const CompanyFormModal: React.FC<CompanyFormModalProps> = ({
  isOpen,
  mode,
  company,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const [categories, setCategories] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [aiWarning, setAiWarning] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && company) {
        setFormData({
          name: company.name,
          url: company.url || '',
          notes: company.notes || '',
        });
        setCategories(company.categories || []);
      } else {
        setFormData({ name: '', url: '', notes: '' });
        setCategories([]);
      }
      setErrors({});
      setTagInput('');
      setAiSuggestions([]);
      setAiWarning(null);
    }
  }, [isOpen, mode, company]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Company name is required';
    }
    const urlPattern = /^https?:\/\/.+/;
    if (formData.url && !urlPattern.test(formData.url)) {
      newErrors.url = 'Please enter a valid URL (starting with http:// or https://)';
    }
    if (categories.length === 0) {
      newErrors.categories = 'At least one category is required';
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
        name: formData.name.trim(),
        url: formData.url.trim() || undefined,
        notes: formData.notes.trim() || undefined,
        categories,
      };
      let response;
      if (mode === 'edit' && company) {
        response = await jobsRepository.updateCompany(company.id, data);
      } else {
        response = await jobsRepository.createCompany(data);
      }
      if (response.success) {
        onSuccess();
      } else {
        setErrors({ submit: response.error || 'Failed to save company' });
      }
    } catch (error: any) {
      setErrors({ submit: error.response?.data?.error || 'Failed to save company' });
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
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const normalizeTag = (raw: string): string =>
    raw.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '');

  const addTag = (raw: string) => {
    const tag = normalizeTag(raw);
    if (tag && !categories.includes(tag) && categories.length < 10) {
      setCategories(prev => [...prev, tag]);
      setAiSuggestions(prev => prev.filter(s => s !== tag));
      if (errors.categories) {
        setErrors(prev => { const next = { ...prev }; delete next.categories; return next; });
      }
    }
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagInput);
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setCategories(prev => prev.filter(t => t !== tag));
  };

  const handleSuggest = async () => {
    if (!formData.name.trim()) return;
    setSuggestLoading(true);
    setAiWarning(null);
    try {
      const res = await jobsRepository.suggestCategories({
        name: formData.name,
        url: formData.url || undefined,
        notes: formData.notes || undefined,
      });
      if (res.success) {
        const fresh = (res.categories as string[]).filter(c => !categories.includes(c));
        setAiSuggestions(fresh);
        if (res.warning) setAiWarning(res.warning);
      }
    } catch {
      setAiWarning('AI suggestions unavailable. Add tags manually.');
    } finally {
      setSuggestLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} titleId="company-form-title">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 id="company-form-title" className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {mode === 'add' ? 'Add Company' : 'Edit Company'}
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
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Company Name <span className="text-red-500" aria-hidden="true">*</span>
              <span className="sr-only">(required)</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              aria-required="true"
              aria-describedby={errors.name ? 'company-name-error' : undefined}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ${
                errors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="Acme Corp"
            />
            {errors.name && <p id="company-name-error" role="alert" className="mt-1 text-sm text-red-600">{errors.name}</p>}
          </div>

          <div>
            <label htmlFor="url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Website URL
            </label>
            <input
              type="text"
              id="url"
              name="url"
              value={formData.url}
              onChange={handleInputChange}
              aria-describedby={errors.url ? 'company-url-error' : undefined}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ${
                errors.url ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="https://acme.com"
            />
            {errors.url && <p id="company-url-error" role="alert" className="mt-1 text-sm text-red-600">{errors.url}</p>}
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
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder="Any notes about this company..."
            />
          </div>

          {/* Categories */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Categories <span className="text-red-500" aria-hidden="true">*</span>
                <span className="sr-only">(required)</span>
              </label>
              <span className="text-xs text-gray-400 dark:text-gray-500">{categories.length}/10</span>
            </div>

            {/* Accepted tag chips */}
            <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
              {categories.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="text-blue-400 hover:text-blue-600 dark:hover:text-blue-200 transition-colors"
                    aria-label={`Remove tag ${tag}`}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>

            {/* Manual input */}
            <input
              type="text"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              disabled={categories.length >= 10}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder={categories.length >= 10 ? 'Max 10 tags reached' : 'Type a tag and press Enter or comma'}
            />

            {/* AI Suggest button */}
            <button
              type="button"
              onClick={handleSuggest}
              disabled={suggestLoading || !formData.name.trim()}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {suggestLoading ? (
                <>
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-current" />
                  Suggesting...
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                  Suggest with AI
                </>
              )}
            </button>

            {/* Validation error */}
            {errors.categories && (
              <p role="alert" className="mt-1.5 text-xs text-red-600 dark:text-red-400">{errors.categories}</p>
            )}

            {/* AI warning */}
            {aiWarning && (
              <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">{aiWarning}</p>
            )}

            {/* AI suggestions row */}
            {aiSuggestions.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">AI suggestions — click to add:</p>
                <div className="flex flex-wrap gap-1.5">
                  {aiSuggestions.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => addTag(tag)}
                      disabled={categories.length >= 10}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-950 hover:text-blue-700 dark:hover:text-blue-300 border border-gray-200 dark:border-gray-600 hover:border-blue-200 dark:hover:border-blue-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label={`Add tag ${tag}`}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
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
                mode === 'add' ? 'Add Company' : 'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default CompanyFormModal;
