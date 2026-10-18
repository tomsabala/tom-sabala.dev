import { useState, useRef } from 'react';
import * as resumeRepository from '../repositories/resumeRepository.ts';
import { apiErrorMessage } from '../repositories/apiError.ts';
import { BTN_MUTED, BTN_PRIMARY, HINT } from './formStyles.ts';

interface PdfUploadFormProps {
  onUploadSuccess?: () => void;
  onUploadError?: (error: string) => void;
}

const PdfUploadForm: React.FC<PdfUploadFormProps> = ({
  onUploadSuccess,
  onUploadError,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      validateAndSetFile(files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    // Validate file type
    if (file.type !== 'application/pdf') {
      onUploadError?.('Please select a PDF file');
      return;
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      onUploadError?.('File too large. Maximum size is 10MB');
      return;
    }

    setSelectedFile(file);
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
      const response = await resumeRepository.uploadPdf(selectedFile);
      if (response.success) {
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        onUploadSuccess?.();
      } else {
        onUploadError?.(response.error || 'Upload failed');
      }
    } catch (error) {
      onUploadError?.(apiErrorMessage(error, 'Upload failed'));
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Drag & Drop Area */}
      <div
        className={`relative border border-dashed p-8 text-center transition-colors ${
          dragActive ? 'border-acct bg-s1' : 'border-ln2 hover:border-ink'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        aria-label="PDF upload area. Click to browse or drag and drop a file."
        aria-describedby="pdf-upload-constraints"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          className="hidden"
          id="pdf-upload"
        />

        {!selectedFile ? (
          <div>
            <p className="m-0 font-mono text-[12px] leading-none uppercase tracking-[0.1em] text-ink2">
              <label htmlFor="pdf-upload" className="text-acct cursor-pointer">
                Click to upload
              </label>{' '}
              or drag and drop
            </p>
            <p id="pdf-upload-constraints" className={HINT}>
              PDF file up to 10MB
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <p className="m-0 font-mono text-[12px] leading-none uppercase tracking-[0.06em] text-acct">
              ● {selectedFile.name}
            </p>
            <p className="m-0 font-mono text-[11px] leading-none text-mut">
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB — ready to upload
            </p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {selectedFile && (
        <div className="flex gap-3 justify-end">
          <button onClick={handleCancel} type="button" disabled={uploading} className={BTN_MUTED}>
            Cancel
          </button>
          <button onClick={handleUpload} type="button" disabled={uploading} className={BTN_PRIMARY}>
            {uploading ? (
              <span role="status" aria-label="Uploading PDF">
                ● Uploading
              </span>
            ) : (
              'Upload PDF'
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default PdfUploadForm;
