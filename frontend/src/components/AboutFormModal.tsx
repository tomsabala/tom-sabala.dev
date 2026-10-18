import { useState, useEffect } from 'react';
import * as aboutRepository from '../repositories/aboutRepository.ts';
import { apiErrorMessage } from '../repositories/apiError.ts';
import Modal from './Modal.tsx';
import {
  BTN_MUTED,
  BTN_PRIMARY,
  DIALOG_TITLE,
  ERROR_BOX,
  FIELD,
  HINT,
  LABEL,
} from './formStyles.ts';
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
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to save about content'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} titleId="about-form-title">
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-start gap-4 mb-6">
          <h2 id="about-form-title" className={DIALOG_TITLE}>
            Edit about
          </h2>
          <button
            onClick={onClose}
            type="button"
            className="bg-transparent border border-ln2 text-mut font-mono text-[12px] leading-none px-2.5 py-2 cursor-pointer hover:text-ink hover:border-ink"
            aria-label="Close dialog"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* About Content */}
          <div>
            <label htmlFor="about-content" className={LABEL}>
              About text
            </label>
            <textarea
              id="about-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              className={FIELD}
              placeholder="Write about yourself..."
            />
            <p className={HINT}>Plain text only — no formatting or markdown supported.</p>
          </div>

          {/* Error */}
          {error && (
            <div role="alert" className={ERROR_BOX}>
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} disabled={submitting} className={BTN_MUTED}>
              Cancel
            </button>
            <button type="submit" disabled={submitting} className={BTN_PRIMARY}>
              {submitting ? (
                <span role="status" aria-label="Saving about content">
                  ● Saving
                </span>
              ) : (
                'Save changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default AboutFormModal;
