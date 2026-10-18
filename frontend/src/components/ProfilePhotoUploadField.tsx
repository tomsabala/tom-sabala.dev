import { useState, useRef } from 'react';
import * as aboutRepository from '../repositories/aboutRepository.ts';
import { apiErrorMessage } from '../repositories/apiError.ts';
import { BTN_GHOST } from './formStyles.ts';

interface ProfilePhotoUploadFieldProps {
  currentPhotoUrl?: string | null;
  onPhotoUploaded: (photoUrl: string) => void;
  onUploadError?: (error: string) => void;
}

const ProfilePhotoUploadField: React.FC<ProfilePhotoUploadFieldProps> = ({
  currentPhotoUrl,
  onPhotoUploaded,
  onUploadError,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentPhotoUrl || null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndSetFile = (file: File) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      onUploadError?.('Please select a valid image file (JPG, PNG, WEBP, or GIF)');
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      onUploadError?.('File too large. Maximum size is 5MB');
      return;
    }

    setSelectedFile(file);

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
      const response = await aboutRepository.uploadProfilePhoto(selectedFile);
      if (response.success && response.data?.profilePhotoUrl) {
        onPhotoUploaded(response.data.profilePhotoUrl);
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
    onPhotoUploaded('');
  };

  return (
    <div className="flex flex-col items-start gap-3">
      {previewUrl ? (
        <div className="relative inline-block">
          <img
            src={previewUrl}
            alt="Profile Preview"
            className="w-48 h-48 object-cover border border-ln2 block"
          />
          <button
            onClick={handleRemove}
            type="button"
            aria-label="Remove profile photo"
            className="absolute top-2 right-2 bg-bg text-ink border border-ln2 font-mono text-[12px] leading-none px-2.5 py-2 cursor-pointer hover:border-ink"
          >
            ×
          </button>
        </div>
      ) : (
        <div
          className={`w-48 h-48 border border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${
            dragActive ? 'border-acct bg-s1' : 'border-ln2 hover:border-ink'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          aria-label="Profile photo upload area. Click to browse or drag and drop a file."
          aria-describedby="profile-photo-constraints"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
            onChange={handleFileChange}
            className="hidden"
          />
          <span className="font-mono text-[22px] leading-none text-mut" aria-hidden="true">
            ＋
          </span>
          <p
            id="profile-photo-constraints"
            className="m-0 px-4 text-center font-mono text-[11px] leading-[1.4] uppercase tracking-[0.1em] text-mut"
          >
            Click or drag to upload
          </p>
        </div>
      )}

      {selectedFile && !uploading && (
        <button onClick={handleUpload} type="button" className={BTN_GHOST}>
          Upload photo
        </button>
      )}

      {uploading && (
        <p
          role="status"
          aria-label="Uploading photo"
          className="m-0 font-mono text-[11px] leading-none uppercase tracking-[0.12em] text-acct"
        >
          ● Uploading
        </p>
      )}
    </div>
  );
};

export default ProfilePhotoUploadField;
