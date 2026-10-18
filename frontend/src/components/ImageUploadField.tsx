import { useState, useRef } from 'react';
import * as portfolioRepository from '../repositories/portfolioRepository.ts';
import { apiErrorMessage } from '../repositories/apiError.ts';
import { BTN_GHOST, HINT } from './formStyles.ts';

interface ImageUploadFieldProps {
  currentImageUrl?: string;
  onImageUploaded: (imageUrl: string) => void;
  onUploadError?: (error: string) => void;
}

const ImageUploadField: React.FC<ImageUploadFieldProps> = ({
  currentImageUrl,
  onImageUploaded,
  onUploadError,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndSetFile = (file: File) => {
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      onUploadError?.('Please select a valid image file (JPG, PNG, WEBP, or GIF)');
      return;
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      onUploadError?.('File too large. Maximum size is 5MB');
      return;
    }

    setSelectedFile(file);

    // Create preview URL
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      validateAndSetFile(files[0]);
    }
  };

  const handleDrag = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.type === 'dragenter' || event.type === 'dragover') {
      setDragActive(true);
    } else if (event.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);

    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      validateAndSetFile(event.dataTransfer.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      const response = await portfolioRepository.uploadProjectImage(selectedFile);
      if (response.success && response.data?.imageUrl) {
        onImageUploaded(response.data.imageUrl);
        setSelectedFile(null);
      } else {
        onUploadError?.(response.error || 'Upload failed');
      }
    } catch (error) {
      onUploadError?.(apiErrorMessage(error, 'Upload failed'));
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onImageUploaded('');
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Preview or Upload Area */}
      {previewUrl ? (
        <div className="relative">
          <img
            src={previewUrl}
            alt="Preview"
            className="w-full h-48 object-cover border border-ln2 block"
          />
          <button
            onClick={handleRemove}
            type="button"
            aria-label="Remove project image"
            className="absolute top-2 right-2 bg-bg text-ink border border-ln2 font-mono text-[12px] leading-none px-2.5 py-2 cursor-pointer hover:border-ink"
          >
            ×
          </button>
        </div>
      ) : (
        <div
          className={`border border-dashed p-6 text-center transition-colors ${
            dragActive ? 'border-acct bg-s1' : 'border-ln2 hover:border-ink'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          aria-label="Image upload area. Click to browse or drag and drop a file."
          aria-describedby="image-upload-constraints"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
            onChange={handleFileChange}
            className="hidden"
            id="image-upload"
          />
          <p className="m-0 font-mono text-[12px] leading-none uppercase tracking-[0.1em] text-ink2">
            <label htmlFor="image-upload" className="text-acct cursor-pointer">
              Click to upload
            </label>{' '}
            or drag and drop
          </p>
          <p id="image-upload-constraints" className={HINT}>
            JPG, PNG, WEBP, or GIF (max 5MB)
          </p>
        </div>
      )}

      {/* Upload Button */}
      {selectedFile && !uploading && (
        <button onClick={handleUpload} type="button" className={`${BTN_GHOST} w-full`}>
          Upload image
        </button>
      )}

      {uploading && (
        <p
          role="status"
          aria-label="Uploading image"
          className="m-0 font-mono text-[11px] leading-none uppercase tracking-[0.12em] text-acct"
        >
          ● Uploading
        </p>
      )}
    </div>
  );
};

export default ImageUploadField;
