/**
 * The behaviour behind the two image fields in the console — the project image and the
 * About portrait. Both validate the same way, preview with the same `FileReader` and upload
 * on an explicit click; only the endpoint and the frame around the preview differ, so that
 * is all the caller supplies.
 */
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, RefObject } from 'react';
import { API_ORIGIN } from '../repositories/apiClient.ts';
import { apiErrorMessage } from '../repositories/apiError.ts';

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Stored file URLs come back root-relative (`/api/about/profile-photo/…`) while the API
 * lives on its own origin, so a bare `src` would 404 against the site's origin.
 */
function previewSrc(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith('/api/') ? `${API_ORIGIN}${url}` : url;
}

/** What the endpoint said: the stored URL, or the message to show the admin. */
interface UploadOutcome {
  url?: string;
  error?: string;
}

interface ImageUpload {
  previewUrl: string | null;
  selectedFile: File | null;
  uploading: boolean;
  dragActive: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  dragHandlers: {
    onDragEnter: (event: DragEvent) => void;
    onDragLeave: (event: DragEvent) => void;
    onDragOver: (event: DragEvent) => void;
    onDrop: (event: DragEvent) => void;
  };
  onInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  upload: () => Promise<void>;
  remove: () => void;
}

export function useImageUpload({
  currentUrl,
  upload,
  onUploaded,
  onError,
}: {
  currentUrl?: string | null;
  upload: (file: File) => Promise<UploadOutcome>;
  /** Called with the stored URL after a successful upload, and with '' on remove. */
  onUploaded: (url: string) => void;
  onError?: (message: string) => void;
}): ImageUpload {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(previewSrc(currentUrl));
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // The dialogs hosting these fields fill their form state in an effect, so `currentUrl`
  // arrives a render after the field mounts; without this the preview would stay empty
  // for an entity that already has an image.
  useEffect(() => {
    if (!selectedFile) setPreviewUrl(previewSrc(currentUrl));
  }, [currentUrl, selectedFile]);

  const accept = (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      onError?.('Please select a valid image file (JPG, PNG, WEBP, or GIF)');
      return;
    }
    if (file.size > MAX_BYTES) {
      onError?.('File too large. Maximum size is 5MB');
      return;
    }
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPreviewUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrag = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(event.type === 'dragenter' || event.type === 'dragover');
  };

  return {
    previewUrl,
    selectedFile,
    uploading,
    dragActive,
    inputRef,
    dragHandlers: {
      onDragEnter: handleDrag,
      onDragLeave: handleDrag,
      onDragOver: handleDrag,
      onDrop: event => {
        event.preventDefault();
        event.stopPropagation();
        setDragActive(false);
        const [file] = event.dataTransfer.files;
        if (file) accept(file);
      },
    },
    onInputChange: event => {
      const file = event.target.files?.[0];
      if (file) accept(file);
    },
    upload: async () => {
      if (!selectedFile) return;
      setUploading(true);
      try {
        const outcome = await upload(selectedFile);
        if (outcome.url) {
          onUploaded(outcome.url);
          setSelectedFile(null);
        } else {
          onError?.(outcome.error || 'Upload failed');
        }
      } catch (error) {
        onError?.(apiErrorMessage(error, 'Upload failed'));
      } finally {
        setUploading(false);
      }
    },
    remove: () => {
      setSelectedFile(null);
      setPreviewUrl(null);
      if (inputRef.current) inputRef.current.value = '';
      onUploaded('');
    },
  };
}
