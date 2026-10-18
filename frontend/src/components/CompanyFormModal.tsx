import { useState, useEffect } from 'react';
import * as jobsRepository from '../repositories/jobsRepository.ts';
import { apiErrorMessage } from '../repositories/apiError.ts';
import Modal from './Modal.tsx';
import {
  CHIP,
  DialogHeader,
  ERROR_BOX,
  ERROR_TEXT,
  FIELD,
  FIELD_ERROR,
  HINT,
  LABEL,
  MonoButton,
} from './console.tsx';
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
    careers_url: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const [categories, setCategories] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [aiWarning, setAiWarning] = useState<string | null>(null);
  const [redetectBoard, setRedetectBoard] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && company) {
        setFormData({
          name: company.name,
          url: company.url || '',
          notes: company.notes || '',
          careers_url: company.careers_url || '',
        });
        setCategories(company.categories || []);
      } else {
        setFormData({ name: '', url: '', notes: '', careers_url: '' });
        setCategories([]);
      }
      setRedetectBoard(false);
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
    if (formData.careers_url && !urlPattern.test(formData.careers_url)) {
      newErrors.careers_url = 'Please enter a valid URL (starting with http:// or https://)';
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
      const data: jobsRepository.CompanyPayload & { name: string } = {
        name: formData.name.trim(),
        url: formData.url.trim() || undefined,
        notes: formData.notes.trim() || undefined,
        careers_url: formData.careers_url.trim() || undefined,
        categories,
      };
      let response;
      if (mode === 'edit' && company) {
        if (redetectBoard) data.redetect_board = true;
        response = await jobsRepository.updateCompany(company.id, data);
      } else {
        response = await jobsRepository.createCompany(data);
      }
      if (response.success) {
        onSuccess();
      } else {
        setErrors({ submit: response.error || 'Failed to save company' });
      }
    } catch (error: unknown) {
      setErrors({ submit: apiErrorMessage(error, 'Failed to save company') });
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
    setAiSuggestions([]);
    try {
      const res = await jobsRepository.suggestCategories({
        name: formData.name,
        url: formData.url || undefined,
        notes: formData.notes || undefined,
      });
      if (!res.success) {
        setAiWarning(res.error || 'AI suggestions unavailable. Add tags manually.');
        return;
      }
      // Normalize before comparing: the model returns spaced phrases ("cloud security")
      // while stored tags are hyphenated, so raw strings would never match.
      const fresh = (res.categories as string[])
        .map(normalizeTag)
        .filter((tag, i, all) => tag && all.indexOf(tag) === i && !categories.includes(tag));
      setAiSuggestions(fresh);
      if (fresh.length === 0) {
        setAiWarning('No new suggestions — every tag it picked is already added.');
      }
    } catch (error: unknown) {
      setAiWarning(apiErrorMessage(error, 'AI suggestions unavailable. Add tags manually.'));
    } finally {
      setSuggestLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} titleId="company-form-title">
      <div className="p-6">
        <DialogHeader
          id="company-form-title"
          title={mode === 'add' ? 'Add company' : 'Edit company'}
          onClose={onClose}
        />

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label htmlFor="name" className={LABEL}>
              Company name <span className="text-acct" aria-hidden="true">*</span>
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
              className={`${FIELD} ${errors.name ? FIELD_ERROR : ''}`}
              placeholder="Acme Corp"
            />
            {errors.name && (
              <p id="company-name-error" role="alert" className={ERROR_TEXT}>{errors.name}</p>
            )}
          </div>

          <div>
            <label htmlFor="url" className={LABEL}>Website URL</label>
            <input
              type="text"
              id="url"
              name="url"
              value={formData.url}
              onChange={handleInputChange}
              aria-describedby={errors.url ? 'company-url-error' : undefined}
              className={`${FIELD} ${errors.url ? FIELD_ERROR : ''}`}
              placeholder="https://acme.com"
            />
            {errors.url && (
              <p id="company-url-error" role="alert" className={ERROR_TEXT}>{errors.url}</p>
            )}
          </div>

          <div>
            <label htmlFor="careers_url" className={LABEL}>Careers page URL</label>
            <input
              type="text"
              id="careers_url"
              name="careers_url"
              value={formData.careers_url}
              onChange={handleInputChange}
              aria-describedby={errors.careers_url ? 'company-careers-url-error' : 'company-careers-url-help'}
              className={`${FIELD} ${errors.careers_url ? FIELD_ERROR : ''}`}
              placeholder="https://acme.com/careers"
            />
            {errors.careers_url ? (
              <p id="company-careers-url-error" role="alert" className={ERROR_TEXT}>{errors.careers_url}</p>
            ) : (
              <p id="company-careers-url-help" className={HINT}>
                Where the job board lives. Leave blank to let the agent find it.
              </p>
            )}
            {mode === 'edit' && company?.ats_provider && (
              <div className="mt-2.5 bg-s1 p-3 flex flex-col gap-2">
                <p className="m-0 font-mono text-[11px] leading-[1.4] text-mut uppercase tracking-[0.08em]">
                  Board <span className="text-ink">{company.ats_provider}</span>
                  {company.ats_token ? <span className="text-ink2"> · {company.ats_token}</span> : null}
                </p>
                {company.sync_error && (
                  <p className="m-0 font-mono text-[11px] leading-[1.4] text-acct">{company.sync_error}</p>
                )}
                <label className="inline-flex items-center gap-2 cursor-pointer font-mono text-[11px] leading-none uppercase tracking-[0.08em] text-ink2">
                  <input
                    type="checkbox"
                    checked={redetectBoard}
                    onChange={e => setRedetectBoard(e.target.checked)}
                    className="appearance-none w-3.5 h-3.5 border border-ln2 bg-bg checked:bg-acc checked:border-acc cursor-pointer"
                  />
                  Re-detect board on next run
                </label>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="notes" className={LABEL}>Notes</label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows={3}
              className={FIELD}
              placeholder="Any notes about this company..."
            />
          </div>

          {/* Categories */}
          <div>
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="company-tag-input" className={LABEL}>
                Categories <span className="text-acct" aria-hidden="true">*</span>
                <span className="sr-only">(required)</span>
              </label>
              <span className="font-mono text-[10px] leading-none tracking-[0.1em] text-mut mb-2">
                {categories.length}/10
              </span>
            </div>

            {/* Accepted tag chips */}
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {categories.map(tag => (
                  <span
                    key={tag}
                    className={`${CHIP} inline-flex items-center gap-2 border-ink text-ink`}
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="bg-transparent border-0 p-0 text-mut hover:text-acct cursor-pointer font-mono text-[10px] leading-none"
                      aria-label={`Remove tag ${tag}`}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Manual input */}
            <input
              type="text"
              id="company-tag-input"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              disabled={categories.length >= 10}
              className={`${FIELD} disabled:opacity-50 disabled:cursor-not-allowed ${
                errors.categories ? FIELD_ERROR : ''
              }`}
              placeholder={categories.length >= 10 ? 'Max 10 tags reached' : 'Type a tag and press Enter or comma'}
            />

            <MonoButton
              onClick={handleSuggest}
              tone="muted"
              size="md"
              disabled={suggestLoading || !formData.name.trim()}
              className="mt-2"
            >
              {suggestLoading ? 'Suggesting…' : '✦ Suggest with AI'}
            </MonoButton>

            {/* Validation error */}
            {errors.categories && (
              <p role="alert" className={ERROR_TEXT}>{errors.categories}</p>
            )}

            {/* AI warning */}
            {aiWarning && (
              <p role="status" className="mt-1.5 font-mono text-[11px] leading-[1.4] text-acct">
                {aiWarning}
              </p>
            )}

            {/* AI suggestions row */}
            {aiSuggestions.length > 0 && (
              <div className="mt-3 flex flex-col gap-2">
                <p className="m-0 font-mono text-[10px] leading-none uppercase tracking-[0.12em] text-acct">
                  AI suggestions — click to add
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {aiSuggestions.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => addTag(tag)}
                      disabled={categories.length >= 10}
                      className={`${CHIP} bg-s1 text-ink2 border-ln2 hover:text-ink hover:border-ink cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed`}
                      aria-label={`Add tag ${tag}`}
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {errors.submit && (
            <div role="alert" className={ERROR_BOX}>{errors.submit}</div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <MonoButton onClick={onClose} size="md" disabled={submitting}>
              Cancel
            </MonoButton>
            <MonoButton type="submit" tone="accent" size="md" disabled={submitting}>
              {submitting ? 'Saving…' : mode === 'add' ? 'Add company' : 'Save changes'}
            </MonoButton>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default CompanyFormModal;
