import { useState, useEffect } from 'react';
import * as resumeRepository from '../repositories/resumeRepository.ts';
import { apiErrorMessage } from '../repositories/apiError.ts';
import { CHIP, ERROR_BOX } from './formStyles.ts';
import type { ResumePdfVersion } from '../types/index.ts';

interface PdfHistoryListProps {
  onVersionChange?: () => void;
}

const META_ROW = 'flex gap-2 font-mono text-[11px] leading-[1.5] text-mut';

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

const PdfHistoryList: React.FC<PdfHistoryListProps> = ({ onVersionChange }) => {
  const [versions, setVersions] = useState<ResumePdfVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  const loadHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await resumeRepository.getPdfHistory(true); // Include deleted versions
      if (response.success) {
        setVersions(response.data || []);
      } else {
        setError(response.error || 'Failed to load history');
      }
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to load history'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleActivate = async (versionId: number) => {
    setOpenMenuId(null); // Close menu
    setActionLoading(versionId);
    try {
      const response = await resumeRepository.activatePdfVersion(versionId);
      if (response.success) {
        await loadHistory();
        onVersionChange?.();
      } else {
        alert(response.error || 'Failed to activate version');
      }
    } catch (err) {
      alert(apiErrorMessage(err, 'Failed to activate version'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (versionId: number) => {
    setOpenMenuId(null); // Close menu

    if (!confirm('Are you sure you want to deactivate this version? It will remain in history and can be reactivated later.')) {
      return;
    }

    setActionLoading(versionId);
    try {
      const response = await resumeRepository.deletePdfVersion(versionId);
      if (response.success) {
        await loadHistory();
        onVersionChange?.();
      } else {
        alert(response.error || 'Failed to delete version');
      }
    } catch (err) {
      alert(apiErrorMessage(err, 'Failed to delete version'));
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <p
        role="status"
        aria-label="Loading PDF history"
        className="m-0 font-mono text-[11px] leading-none uppercase tracking-[0.12em] text-acct"
      >
        ● Loading versions
      </p>
    );
  }

  if (error) {
    return (
      <div role="alert" className={ERROR_BOX}>
        {error}
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <p className="m-0 font-mono text-[12px] leading-[1.5] text-mut">No PDF versions uploaded yet.</p>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {versions.map((version) => {
        return (
          <div
            key={version.id}
            className={`border p-3.5 ${version.isActive ? 'border-acct bg-s1' : 'border-ln'}`}
          >
            <div className="flex items-start justify-between gap-3">
              {/* Version Info */}
              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="m-0 font-mono text-[13px] leading-none text-ink break-all">
                    {version.fileName}
                  </h4>
                  {version.isActive && (
                    <span className={`${CHIP} border-acct text-acct whitespace-nowrap`}>Active</span>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <p className={META_ROW}>
                    <span className="text-ink2">Uploaded</span>
                    <span>{new Date(version.createdAt).toLocaleString('en-US', DATE_FORMAT)}</span>
                  </p>
                  <p className={META_ROW}>
                    <span className="text-ink2">Size</span>
                    <span>{(version.fileSize / 1024 / 1024).toFixed(2)} MB</span>
                  </p>
                  {version.uploadedBy && (
                    <p className={META_ROW}>
                      <span className="text-ink2">By</span>
                      <span>{version.uploadedBy.username}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="relative shrink-0">
                <button
                  onClick={() => setOpenMenuId(openMenuId === version.id ? null : version.id)}
                  disabled={actionLoading === version.id}
                  className="bg-transparent border border-ln2 text-mut font-mono text-[13px] leading-none px-2.5 py-2 cursor-pointer hover:text-ink hover:border-ink disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={`Actions for ${version.fileName}`}
                  aria-haspopup="menu"
                  aria-expanded={openMenuId === version.id}
                  aria-controls={`menu-pdf-${version.id}`}
                >
                  <span aria-hidden="true">⋯</span>
                </button>

                {/* Dropdown Menu */}
                {openMenuId === version.id && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setOpenMenuId(null)}
                    />
                    <div
                      role="menu"
                      id={`menu-pdf-${version.id}`}
                      className="absolute right-0 mt-1 w-40 bg-bg border border-ln2 z-20"
                    >
                      {version.isActive ? (
                        <button
                          role="menuitem"
                          onClick={() => handleDelete(version.id)}
                          className="w-full bg-transparent border-0 px-3 py-2.5 text-left font-mono text-[11px] leading-none uppercase tracking-[0.1em] text-[#b3261e] cursor-pointer hover:bg-s1"
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          role="menuitem"
                          onClick={() => handleActivate(version.id)}
                          className="w-full bg-transparent border-0 px-3 py-2.5 text-left font-mono text-[11px] leading-none uppercase tracking-[0.1em] text-acct cursor-pointer hover:bg-s1"
                        >
                          Activate
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PdfHistoryList;
