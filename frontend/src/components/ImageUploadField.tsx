import * as portfolioRepository from '../repositories/portfolioRepository.ts';
import { HINT, MonoButton } from './console.tsx';
import { useImageUpload } from './useImageUpload.ts';

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
  const image = useImageUpload({
    currentUrl: currentImageUrl,
    upload: async file => {
      const response = await portfolioRepository.uploadProjectImage(file);
      return response.success && response.data?.imageUrl
        ? { url: response.data.imageUrl }
        : { error: response.error };
    },
    onUploaded: onImageUploaded,
    onError: onUploadError,
  });

  return (
    <div className="flex flex-col gap-3">
      {image.previewUrl ? (
        <div className="relative">
          <img
            src={image.previewUrl}
            alt="Preview"
            className="w-full h-48 object-cover border border-ln2 block"
          />
          <button
            onClick={image.remove}
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
            image.dragActive ? 'border-acct bg-s1' : 'border-ln2 hover:border-ink'
          }`}
          {...image.dragHandlers}
          aria-label="Image upload area. Click to browse or drag and drop a file."
          aria-describedby="image-upload-constraints"
        >
          <input
            ref={image.inputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
            onChange={image.onInputChange}
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

      {image.selectedFile && !image.uploading && (
        <MonoButton onClick={image.upload} size="md" className="w-full">
          Upload image
        </MonoButton>
      )}

      {image.uploading && (
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
