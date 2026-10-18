import { useState, useEffect } from 'react';
import * as portfolioRepository from '../repositories/portfolioRepository.ts';
import { apiErrorMessage } from '../repositories/apiError.ts';
import ImageUploadField from './ImageUploadField.tsx';
import Modal from './Modal.tsx';
import {
  DialogHeader,
  ERROR_BOX,
  ERROR_TEXT,
  FIELD,
  FIELD_ERROR,
  FIELD_MONO,
  HINT,
  LABEL,
  MonoButton,
} from './console.tsx';
import type {
  PortfolioItem,
  ProjectFact,
  ProjectFormData,
  ProjectStep,
} from '../types/index.ts';

interface ProjectFormModalProps {
  isOpen: boolean;
  mode: 'add' | 'edit';
  project?: PortfolioItem;
  onClose: () => void;
  onSuccess: () => void;
}

/** Everything the dialog edits, flattened to the shapes the inputs bind to. */
interface FormState {
  title: string;
  description: string;
  technologies: string;
  github_url: string;
  live_url: string;
  image_url: string;
  content: string;
  docs_slug: string;
  is_in_progress: boolean;
  slug: string;
  field: string;
  lede: string;
  facts: ProjectFact[];
  aboutParagraphs: string[];
  steps: ProjectStep[];
  rulesTitle: string;
  rules: string[];
  runCode: string;
  specimen: string;
  accessLabel: string;
}

const EMPTY_FORM: FormState = {
  title: '',
  description: '',
  technologies: '',
  github_url: '',
  live_url: '',
  image_url: '',
  content: '',
  docs_slug: '',
  is_in_progress: false,
  slug: '',
  field: '',
  lede: '',
  facts: [],
  aboutParagraphs: [],
  steps: [],
  rulesTitle: '',
  rules: [],
  runCode: '',
  specimen: '',
  accessLabel: '',
};

/** Painter keys the detail page knows how to draw; the empty option means "no specimen". */
const SPECIMENS = ['chain', 'hull', 'equity', 'graph', 'board'];

const SECTION_RULE = 'border-t border-ln2 pt-5 mt-1';
const SECTION_LABEL =
  'font-mono text-[11px] leading-none uppercase tracking-[0.18em] text-acct';
const ADD_BUTTON =
  'self-start bg-transparent border border-ln2 text-ink2 font-mono text-[11px] leading-none ' +
  'uppercase tracking-[0.1em] px-2.5 py-2 cursor-pointer hover:text-ink hover:border-ink';
const ROW_REMOVE =
  'shrink-0 self-stretch bg-transparent border border-ln2 text-mut font-mono text-[13px] ' +
  'leading-none px-3 cursor-pointer hover:text-ink hover:border-ink';
const ROW_INDEX = 'shrink-0 w-6 pt-3 font-mono text-[11px] leading-none text-mut tabular-nums';

function removeAt<T>(list: T[], index: number): T[] {
  return list.filter((_, i) => i !== index);
}

function patchAt<T>(list: T[], index: number, patch: Partial<T>): T[] {
  return list.map((item, i) => (i === index ? { ...item, ...patch } : item));
}

function replaceAt(list: string[], index: number, value: string): string[] {
  return list.map((item, i) => (i === index ? value : item));
}

const ProjectFormModal: React.FC<ProjectFormModalProps> = ({
  isOpen,
  mode,
  project,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string>('');

  // Initialize form data when modal opens or project changes
  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && project) {
        setFormData({
          title: project.title,
          description: project.description,
          technologies: project.technologies.join(', '),
          github_url: project.github_url || '',
          live_url: project.live_url || '',
          image_url: project.image_url || '',
          content: project.content || '',
          docs_slug: project.docsSlug || '',
          is_in_progress: project.is_in_progress ?? false,
          slug: project.slug || '',
          field: project.field || '',
          lede: project.lede || '',
          facts: project.facts ?? [],
          aboutParagraphs: project.aboutParagraphs ?? [],
          steps: project.steps ?? [],
          rulesTitle: project.rulesTitle || '',
          rules: project.rules ?? [],
          runCode: project.runCode || '',
          specimen: project.specimen || '',
          accessLabel: project.accessLabel || '',
        });
      } else {
        setFormData(EMPTY_FORM);
      }
      setErrors({});
      setUploadError('');
    }
  }, [isOpen, mode, project]);

  const update = (patch: Partial<FormState>) => {
    setFormData(prev => ({ ...prev, ...patch }));
  };

  const clearError = (key: string) => {
    setErrors(prev => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.trim().length < 3) {
      newErrors.title = 'Title must be at least 3 characters';
    } else if (formData.title.trim().length > 200) {
      newErrors.title = 'Title must be less than 200 characters';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.trim().length < 10) {
      newErrors.description = 'Description must be at least 10 characters';
    } else if (formData.description.trim().length > 2000) {
      newErrors.description = 'Description must be less than 2000 characters';
    }

    if (!formData.technologies.trim()) {
      newErrors.technologies = 'Technologies are required';
    }

    const urlPattern = /^https?:\/\/.+/;
    if (formData.github_url && !urlPattern.test(formData.github_url)) {
      newErrors.github_url = 'Please enter a valid URL (starting with http:// or https://)';
    }
    if (formData.live_url && !urlPattern.test(formData.live_url)) {
      newErrors.live_url = 'Please enter a valid URL (starting with http:// or https://)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    try {
      const technologiesArray = formData.technologies
        .split(',')
        .map(tech => tech.trim())
        .filter(tech => tech.length > 0);

      // Half-filled repeatable rows are dropped; a list the admin emptied is sent as `[]`
      // so the blanket `setattr` on the backend actually clears the column.
      const facts = formData.facts
        .map(fact => ({ k: fact.k.trim(), v: fact.v.trim() }))
        .filter(fact => fact.k || fact.v);
      const steps = formData.steps
        .map(step => ({ t: step.t.trim(), d: step.d.trim() }))
        .filter(step => step.t || step.d);
      const aboutParagraphs = formData.aboutParagraphs
        .map(paragraph => paragraph.trim())
        .filter(paragraph => paragraph.length > 0);
      const rules = formData.rules.map(rule => rule.trim()).filter(rule => rule.length > 0);

      const projectData: ProjectFormData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        technologies: technologiesArray,
        github_url: formData.github_url.trim() || undefined,
        live_url: formData.live_url.trim() || undefined,
        image_url: formData.image_url.trim() || undefined,
        content: formData.is_in_progress ? undefined : (formData.content.trim() || undefined),
        docsSlug: formData.is_in_progress ? undefined : (formData.docs_slug.trim() || undefined),
        is_in_progress: formData.is_in_progress,
        // Detail-page content. `null` rather than `undefined` so clearing a field clears the
        // column instead of silently keeping the old value.
        slug: formData.slug.trim() || null,
        field: formData.field.trim() || null,
        lede: formData.lede.trim() || null,
        facts,
        aboutParagraphs,
        steps,
        rulesTitle: formData.rulesTitle.trim() || null,
        rules,
        runCode: formData.runCode.trim() || null,
        specimen: formData.specimen || null,
        accessLabel: formData.accessLabel.trim() || null,
      };

      let response;
      if (mode === 'edit' && project) {
        response = await portfolioRepository.updateProject(project.id, projectData);
      } else {
        response = await portfolioRepository.createProject(projectData);
      }

      if (response.success) {
        onSuccess();
      } else {
        setErrors({ submit: response.error || 'Failed to save project' });
      }
    } catch (error) {
      setErrors({ submit: apiErrorMessage(error, 'Failed to save project') });
    } finally {
      setSubmitting(false);
    }
  };

  const submitLabel = mode === 'add' ? 'Add project' : 'Save changes';

  return (
    <Modal isOpen={isOpen} onClose={onClose} titleId="project-form-title">
      <div className="p-6">
        <DialogHeader
          id="project-form-title"
          title={mode === 'add' ? 'Add project' : 'Edit project'}
          onClose={onClose}
        />

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Title Field */}
          <div>
            <label htmlFor="title" className={LABEL}>
              Title <span className="text-acct" aria-hidden="true">*</span>
              <span className="sr-only">(required)</span>
            </label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={e => {
                update({ title: e.target.value });
                clearError('title');
              }}
              aria-required="true"
              aria-describedby={errors.title ? 'title-error' : undefined}
              className={`${FIELD} ${errors.title ? FIELD_ERROR : ''}`}
              placeholder="Project title"
            />
            {errors.title && (
              <p id="title-error" role="alert" className={ERROR_TEXT}>{errors.title}</p>
            )}
          </div>

          {/* Description Field */}
          <div>
            <label htmlFor="description" className={LABEL}>
              Description <span className="text-acct" aria-hidden="true">*</span>
              <span className="sr-only">(required)</span>
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={e => {
                update({ description: e.target.value });
                clearError('description');
              }}
              rows={4}
              aria-required="true"
              aria-describedby={errors.description ? 'description-error' : undefined}
              className={`${FIELD} ${errors.description ? FIELD_ERROR : ''}`}
              placeholder="Project description"
            />
            {errors.description && (
              <p id="description-error" role="alert" className={ERROR_TEXT}>{errors.description}</p>
            )}
          </div>

          {/* Technologies Field */}
          <div>
            <label htmlFor="technologies" className={LABEL}>
              Technologies <span className="text-acct" aria-hidden="true">*</span>
              <span className="sr-only">(required)</span>
            </label>
            <input
              type="text"
              id="technologies"
              value={formData.technologies}
              onChange={e => {
                update({ technologies: e.target.value });
                clearError('technologies');
              }}
              aria-required="true"
              aria-describedby={errors.technologies ? 'technologies-error' : undefined}
              className={`${FIELD_MONO} ${errors.technologies ? FIELD_ERROR : ''}`}
              placeholder="React, TypeScript, Node.js (comma-separated)"
            />
            {errors.technologies && (
              <p id="technologies-error" role="alert" className={ERROR_TEXT}>
                {errors.technologies}
              </p>
            )}
          </div>

          {/* Image Upload Field */}
          <div>
            <span className={LABEL}>Project image</span>
            <ImageUploadField
              currentImageUrl={formData.image_url}
              onImageUploaded={imageUrl => {
                update({ image_url: imageUrl });
                setUploadError('');
              }}
              onUploadError={setUploadError}
            />
            {uploadError && <p role="alert" className={ERROR_TEXT}>{uploadError}</p>}
          </div>

          {/* GitHub URL Field */}
          <div>
            <label htmlFor="github_url" className={LABEL}>
              GitHub URL
            </label>
            <input
              type="url"
              id="github_url"
              value={formData.github_url}
              onChange={e => {
                update({ github_url: e.target.value });
                clearError('github_url');
              }}
              aria-describedby={errors.github_url ? 'github_url-error' : undefined}
              className={`${FIELD_MONO} ${errors.github_url ? FIELD_ERROR : ''}`}
              placeholder="https://github.com/username/repo"
            />
            {errors.github_url && (
              <p id="github_url-error" role="alert" className={ERROR_TEXT}>{errors.github_url}</p>
            )}
          </div>

          {/* Live URL Field */}
          <div>
            <label htmlFor="live_url" className={LABEL}>
              Live URL
            </label>
            <input
              type="url"
              id="live_url"
              value={formData.live_url}
              onChange={e => {
                update({ live_url: e.target.value });
                clearError('live_url');
              }}
              aria-describedby={errors.live_url ? 'live_url-error' : undefined}
              className={`${FIELD_MONO} ${errors.live_url ? FIELD_ERROR : ''}`}
              placeholder="https://example.com"
            />
            {errors.live_url && (
              <p id="live_url-error" role="alert" className={ERROR_TEXT}>{errors.live_url}</p>
            )}
          </div>

          {/* In Progress Toggle */}
          <label
            htmlFor="is_in_progress"
            className="flex items-start gap-3 border border-ln2 bg-s1 p-3.5 cursor-pointer select-none"
          >
            <input
              type="checkbox"
              id="is_in_progress"
              checked={formData.is_in_progress}
              onChange={e => update({ is_in_progress: e.target.checked })}
              className="mt-0.5 w-4 h-4 accent-acc cursor-pointer"
            />
            <span className="font-mono text-[11px] leading-[1.5] uppercase tracking-[0.08em] text-ink2">
              In progress — hides the detail page; card click shows an info message instead
            </span>
          </label>

          {/* Article Content Field (hidden when in-progress) */}
          {!formData.is_in_progress && (
            <div>
              <label htmlFor="content" className={LABEL}>
                Article content (markdown)
              </label>
              <textarea
                id="content"
                value={formData.content}
                onChange={e => update({ content: e.target.value })}
                rows={12}
                className={FIELD_MONO}
                placeholder="Write a detailed article about this project..."
              />
              <p className={HINT}>
                Supports Markdown: **bold**, `code`, ## headings, - lists, etc.
              </p>
            </div>
          )}

          {/* Docs Slug Field (hidden when in-progress) */}
          {!formData.is_in_progress && (
            <div>
              <label htmlFor="docs_slug" className={LABEL}>
                Docs slug
              </label>
              <input
                type="text"
                id="docs_slug"
                value={formData.docs_slug}
                onChange={e => update({ docs_slug: e.target.value })}
                className={FIELD_MONO}
                placeholder="e.g. cgeo"
              />
              <p className={HINT}>
                Links to a docs repo in backend/docs/&lt;slug&gt;/. Deep-dive markdown will be
                served from there.
              </p>
            </div>
          )}

          {/* ── Detail page ─────────────────────────────────────────────────── */}
          <div className={SECTION_RULE}>
            <p className={`${SECTION_LABEL} m-0`}>Detail page</p>
            <p className={HINT}>
              Everything below renders on /work/&lt;slug&gt;. Leave a field empty to drop its
              section from the page.
            </p>
          </div>

          {/* Slug */}
          <div>
            <label htmlFor="slug" className={LABEL}>
              Slug
            </label>
            <input
              type="text"
              id="slug"
              value={formData.slug}
              onChange={e => update({ slug: e.target.value })}
              className={FIELD_MONO}
              placeholder="auto-generated from the title when empty"
            />
            <p className={HINT}>URL segment — must be unique across projects.</p>
          </div>

          {/* Field + access label */}
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="field" className={LABEL}>
                Field
              </label>
              <input
                type="text"
                id="field"
                value={formData.field}
                onChange={e => update({ field: e.target.value })}
                className={FIELD}
                placeholder="e.g. Geospatial systems"
              />
            </div>
            <div>
              <label htmlFor="accessLabel" className={LABEL}>
                Access label
              </label>
              <input
                type="text"
                id="accessLabel"
                value={formData.accessLabel}
                onChange={e => update({ accessLabel: e.target.value })}
                className={FIELD}
                placeholder="e.g. Open source"
              />
            </div>
          </div>

          {/* Lede */}
          <div>
            <label htmlFor="lede" className={LABEL}>
              Lede
            </label>
            <textarea
              id="lede"
              value={formData.lede}
              onChange={e => update({ lede: e.target.value })}
              rows={3}
              className={FIELD}
              placeholder="One or two sentences under the title"
            />
          </div>

          {/* Specimen */}
          <div>
            <label htmlFor="specimen" className={LABEL}>
              Specimen
            </label>
            <div className="relative">
              <select
                id="specimen"
                value={formData.specimen}
                onChange={e => update({ specimen: e.target.value })}
                className={`${FIELD_MONO} appearance-none pr-9 cursor-pointer`}
              >
                <option value="">none</option>
                {SPECIMENS.map(key => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </select>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[11px] leading-none text-mut"
              >
                ▾
              </span>
            </div>
            <p className={HINT}>Painter drawn in the hero panel.</p>
          </div>

          {/* Facts */}
          <div className="flex flex-col gap-2">
            <span className={LABEL}>Facts</span>
            {formData.facts.map((fact, index) => (
              <div key={index} className="flex gap-2 items-stretch">
                <input
                  type="text"
                  value={fact.k}
                  onChange={e => update({ facts: patchAt(formData.facts, index, { k: e.target.value }) })}
                  className={`${FIELD_MONO} flex-1 min-w-0`}
                  placeholder="Key"
                  aria-label={`Fact ${index + 1} key`}
                />
                <input
                  type="text"
                  value={fact.v}
                  onChange={e => update({ facts: patchAt(formData.facts, index, { v: e.target.value }) })}
                  className={`${FIELD} flex-1 min-w-0`}
                  placeholder="Value"
                  aria-label={`Fact ${index + 1} value`}
                />
                <button
                  type="button"
                  onClick={() => update({ facts: removeAt(formData.facts, index) })}
                  className={ROW_REMOVE}
                  aria-label={`Remove fact ${index + 1}`}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => update({ facts: [...formData.facts, { k: '', v: '' }] })}
              className={ADD_BUTTON}
            >
              + Add fact
            </button>
          </div>

          {/* About paragraphs */}
          <div className="flex flex-col gap-2">
            <span className={LABEL}>About paragraphs</span>
            {formData.aboutParagraphs.map((paragraph, index) => (
              <div key={index} className="flex gap-2 items-stretch">
                <span className={ROW_INDEX} aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <textarea
                  value={paragraph}
                  onChange={e =>
                    update({ aboutParagraphs: replaceAt(formData.aboutParagraphs, index, e.target.value) })
                  }
                  rows={3}
                  className={`${FIELD} flex-1 min-w-0`}
                  placeholder="Paragraph text"
                  aria-label={`About paragraph ${index + 1}`}
                />
                <button
                  type="button"
                  onClick={() => update({ aboutParagraphs: removeAt(formData.aboutParagraphs, index) })}
                  className={ROW_REMOVE}
                  aria-label={`Remove about paragraph ${index + 1}`}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => update({ aboutParagraphs: [...formData.aboutParagraphs, ''] })}
              className={ADD_BUTTON}
            >
              + Add paragraph
            </button>
          </div>

          {/* Steps */}
          <div className="flex flex-col gap-2">
            <span className={LABEL}>Steps</span>
            {formData.steps.map((step, index) => (
              <div key={index} className="flex gap-2 items-stretch">
                <span className={ROW_INDEX} aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="flex-1 min-w-0 flex flex-col gap-2">
                  <input
                    type="text"
                    value={step.t}
                    onChange={e => update({ steps: patchAt(formData.steps, index, { t: e.target.value }) })}
                    className={FIELD}
                    placeholder="Step title"
                    aria-label={`Step ${index + 1} title`}
                  />
                  <textarea
                    value={step.d}
                    onChange={e => update({ steps: patchAt(formData.steps, index, { d: e.target.value }) })}
                    rows={2}
                    className={FIELD}
                    placeholder="What happens in this step"
                    aria-label={`Step ${index + 1} detail`}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => update({ steps: removeAt(formData.steps, index) })}
                  className={ROW_REMOVE}
                  aria-label={`Remove step ${index + 1}`}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => update({ steps: [...formData.steps, { t: '', d: '' }] })}
              className={ADD_BUTTON}
            >
              + Add step
            </button>
          </div>

          {/* Rules */}
          <div>
            <label htmlFor="rulesTitle" className={LABEL}>
              Rules title
            </label>
            <input
              type="text"
              id="rulesTitle"
              value={formData.rulesTitle}
              onChange={e => update({ rulesTitle: e.target.value })}
              className={FIELD}
              placeholder="e.g. Ground rules"
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className={LABEL}>Rules</span>
            {formData.rules.map((rule, index) => (
              <div key={index} className="flex gap-2 items-stretch">
                <span className={ROW_INDEX} aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <input
                  type="text"
                  value={rule}
                  onChange={e => update({ rules: replaceAt(formData.rules, index, e.target.value) })}
                  className={`${FIELD} flex-1 min-w-0`}
                  placeholder="Rule text"
                  aria-label={`Rule ${index + 1}`}
                />
                <button
                  type="button"
                  onClick={() => update({ rules: removeAt(formData.rules, index) })}
                  className={ROW_REMOVE}
                  aria-label={`Remove rule ${index + 1}`}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => update({ rules: [...formData.rules, ''] })}
              className={ADD_BUTTON}
            >
              + Add rule
            </button>
          </div>

          {/* Run code */}
          <div>
            <label htmlFor="runCode" className={LABEL}>
              Run code
            </label>
            <textarea
              id="runCode"
              value={formData.runCode}
              onChange={e => update({ runCode: e.target.value })}
              rows={4}
              className={FIELD_MONO}
              placeholder="git clone ..."
            />
            <p className={HINT}>Shown verbatim in the "run it" block.</p>
          </div>

          {/* Submit Error */}
          {errors.submit && (
            <div role="alert" className={ERROR_BOX}>
              {errors.submit}
            </div>
          )}

          <div className="flex gap-3 justify-end pt-1">
            <MonoButton onClick={onClose} tone="muted" size="md" disabled={submitting}>
              Cancel
            </MonoButton>
            <MonoButton
              type="submit"
              tone="accent"
              size="md"
              disabled={submitting}
              ariaLabel={submitting ? 'Saving project' : submitLabel}
            >
              {submitting ? (
                <span role="status" aria-label="Saving">
                  ● Saving
                </span>
              ) : (
                submitLabel
              )}
            </MonoButton>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default ProjectFormModal;
