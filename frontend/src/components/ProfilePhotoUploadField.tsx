import * as aboutRepository from '../repositories/aboutRepository.ts';
import { MonoButton } from './console.tsx';
import { useImageUpload } from './useImageUpload.ts';

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
  const photo = useImageUpload({
    currentUrl: currentPhotoUrl,
    upload: async file => {
      const response = await aboutRepository.uploadProfilePhoto(file);
      return response.success && response.data?.profilePhotoUrl
        ? { url: response.data.profilePhotoUrl }
        : { error: response.error };
    },
    onUploaded: onPhotoUploaded,
    onError: onUploadError,
  });

  return (
    <div className="flex flex-col items-start gap-3">
      {photo.previewUrl ? (
        <div className="relative inline-block">
          <img
            src={photo.previewUrl}
            alt="Profile preview"
            className="w-48 h-48 object-cover border border-ln2 block"
          />
          <button
            onClick={photo.remove}
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
            photo.dragActive ? 'border-acct bg-s1' : 'border-ln2 hover:border-ink'
          }`}
          {...photo.dragHandlers}
          onClick={() => photo.inputRef.current?.click()}
          aria-label="Profile photo upload area. Click to browse or drag and drop a file."
          aria-describedby="profile-photo-constraints"
        >
          <input
            ref={photo.inputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
            onChange={photo.onInputChange}
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

      {photo.selectedFile && !photo.uploading && (
        <MonoButton onClick={photo.upload} size="md">
          Upload photo
        </MonoButton>
      )}

      {photo.uploading && (
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
