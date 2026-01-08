import { useState, useEffect } from 'react';
import * as portfolioRepository from '../repositories/portfolioRepository';
import ImageUploadField from './ImageUploadField';
import type { PortfolioItem, ProjectFormData } from '../types';

interface ProjectFormModalProps {
  isOpen: boolean;
  mode: 'add' | 'edit';
  project?: PortfolioItem;
  onClose: () => void;
  onSuccess: () => void;
}

const ProjectFormModal: React.FC<ProjectFormModalProps> = ({
  isOpen,
  mode,
  project,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    technologies: '',
    github_url: '',
    live_url: '',
    image_url: '',
  });

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
        });
      } else {
        // Reset form for add mode
        setFormData({
          title: '',
          description: '',
          technologies: '',
          github_url: '',
          live_url: '',
          image_url: '',
        });
      }
      setErrors({});
      setUploadError('');
    }
  }, [isOpen, mode, project]);

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

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Title validation (3-200 chars)
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.trim().length < 3) {
      newErrors.title = 'Title must be at least 3 characters';
    } else if (formData.title.trim().length > 200) {
      newErrors.title = 'Title must be less than 200 characters';
    }

    // Description validation (10-2000 chars)
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.trim().length < 10) {
      newErrors.description = 'Description must be at least 10 characters';
    } else if (formData.description.trim().length > 2000) {
      newErrors.description = 'Description must be less than 2000 characters';
    }

    // Technologies validation (required)
    if (!formData.technologies.trim()) {
      newErrors.technologies = 'Technologies are required';
    }

    // Optional URL validation
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
      // Parse technologies from comma-separated string to array
      const technologiesArray = formData.technologies
        .split(',')
        .map(tech => tech.trim())
        .filter(tech => tech.length > 0);

      const projectData: ProjectFormData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        technologies: technologiesArray,
        github_url: formData.github_url.trim() || undefined,
        live_url: formData.live_url.trim() || undefined,
        image_url: formData.image_url.trim() || undefined,
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
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Failed to save project';
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
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleImageUploaded = (imageUrl: string) => {
    setFormData(prev => ({ ...prev, image_url: imageUrl }));
    setUploadError('');
  };

  const handleUploadError = (error: string) => {
    setUploadError(error);
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
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-gray-900">
            {mode === 'add' ? 'Add New Project' : 'Edit Project'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title Field */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                errors.title ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Project title"
            />
            {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
          </div>

          {/* Description Field */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={4}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                errors.description ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Project description"
            />
            {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description}</p>}
          </div>

          {/* Technologies Field */}
          <div>
            <label htmlFor="technologies" className="block text-sm font-medium text-gray-700 mb-1">
              Technologies <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="technologies"
              name="technologies"
              value={formData.technologies}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                errors.technologies ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="React, TypeScript, Node.js (comma-separated)"
            />
            {errors.technologies && <p className="mt-1 text-sm text-red-600">{errors.technologies}</p>}
          </div>

          {/* Image Upload Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Project Image
            </label>
            <ImageUploadField
              currentImageUrl={formData.image_url}
              onImageUploaded={handleImageUploaded}
              onUploadError={handleUploadError}
            />
            {uploadError && <p className="mt-1 text-sm text-red-600">{uploadError}</p>}
          </div>

          {/* GitHub URL Field */}
          <div>
            <label htmlFor="github_url" className="block text-sm font-medium text-gray-700 mb-1">
              GitHub URL
            </label>
            <input
              type="url"
              id="github_url"
              name="github_url"
              value={formData.github_url}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                errors.github_url ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="https://github.com/username/repo"
            />
            {errors.github_url && <p className="mt-1 text-sm text-red-600">{errors.github_url}</p>}
          </div>

          {/* Live URL Field */}
          <div>
            <label htmlFor="live_url" className="block text-sm font-medium text-gray-700 mb-1">
              Live URL
            </label>
            <input
              type="url"
              id="live_url"
              name="live_url"
              value={formData.live_url}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                errors.live_url ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="https://example.com"
            />
            {errors.live_url && <p className="mt-1 text-sm text-red-600">{errors.live_url}</p>}
          </div>

          {/* Submit Error */}
          {errors.submit && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{errors.submit}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                mode === 'add' ? 'Add Project' : 'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProjectFormModal;
