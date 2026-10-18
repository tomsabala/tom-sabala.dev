import { useState, useEffect } from 'react';
import * as aboutRepository from '../repositories/aboutRepository.ts';
import { apiErrorMessage } from '../repositories/apiError.ts';
import Modal from './Modal.tsx';
import ProfilePhotoUploadField from './ProfilePhotoUploadField.tsx';
import {
  DialogHeader,
  ERROR_BOX,
  ERROR_TEXT,
  FIELD,
  HINT,
  LABEL,
  MonoButton,
} from './console.tsx';
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
  // The upload endpoint only stores the file; the row is written when this form is saved.
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setContent(currentData?.content ?? '');
    setPhotoUrl(currentData?.profilePhotoUrl ?? '');
    setPhotoError('');
    setError('');
  }, [isOpen, currentData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      // An empty string clears the portrait — the backend only skips the column on `null`.
      const response = await aboutRepository.updateAbout({
        content: content.trim(),
        profilePhotoUrl: photoUrl,
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
        <DialogHeader id="about-form-title" title="Edit about" onClose={onClose} />

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label htmlFor="about-content" className={LABEL}>
              About text
            </label>
            <textarea
              id="about-content"
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={8}
              className={FIELD}
              placeholder="Write about yourself..."
            />
            <p className={HINT}>Plain text only — no formatting or markdown supported.</p>
          </div>

          <div>
            <span className={LABEL}>Portrait</span>
            <ProfilePhotoUploadField
              currentPhotoUrl={photoUrl}
              onPhotoUploaded={url => {
                setPhotoUrl(url);
                setPhotoError('');
              }}
              onUploadError={setPhotoError}
            />
            {photoError ? (
              <p role="alert" className={ERROR_TEXT}>
                {photoError}
              </p>
            ) : (
              <p className={HINT}>
                Shown beside the About section. Removing it takes effect when you save.
              </p>
            )}
          </div>

          {error && (
            <div role="alert" className={ERROR_BOX}>
              {error}
            </div>
          )}

          <div className="flex gap-3 justify-end pt-1">
            <MonoButton onClick={onClose} tone="muted" size="md" disabled={submitting}>
              Cancel
            </MonoButton>
            <MonoButton type="submit" tone="accent" size="md" disabled={submitting}>
              {submitting ? (
                <span role="status" aria-label="Saving about content">
                  ● Saving
                </span>
              ) : (
                'Save changes'
              )}
            </MonoButton>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default AboutFormModal;
