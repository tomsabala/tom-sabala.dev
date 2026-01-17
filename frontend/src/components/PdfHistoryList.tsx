import { useState, useEffect } from 'react';
import * as resumeRepository from '../repositories/resumeRepository.ts';
import type { ResumePdfVersion } from '../types/index.ts';

interface PdfHistoryListProps {
  onVersionChange?: () => void;
}

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
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load history');
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
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to activate version');
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
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete version');
    } finally {
      setActionLoading(null);
    }
  };

  const toggleMenu = (versionId: number) => {
    setOpenMenuId(openMenuId === versionId ? null : versionId);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFileSize = (bytes: number) => {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No PDF versions uploaded yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {versions.map((version) => {
        return (
          <div
            key={version.id}
            className={`border rounded-lg p-4 ${
              version.isActive
                ? 'border-orange-500 bg-orange-50'
                : 'border-gray-300'
            }`}
          >
            <div className="flex items-start justify-between">
              {/* Version Info */}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-gray-900">
                    {version.fileName}
                  </h4>
                  {version.isActive && (
                    <span className="px-2 py-1 text-xs font-medium bg-orange-500 text-white rounded">
                      Active
                    </span>
                  )}
                </div>
                <div className="mt-2 space-y-1 text-sm text-gray-600">
                  <p>
                    <span className="font-medium">Uploaded:</span>{' '}
                    {formatDate(version.createdAt)}
                  </p>
                  <p>
                    <span className="font-medium">Size:</span>{' '}
                    {formatFileSize(version.fileSize)}
                  </p>
                  {version.uploadedBy && (
                    <p>
                      <span className="font-medium">By:</span>{' '}
                      {version.uploadedBy.username}
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="relative ml-4">
                <button
                  onClick={() => toggleMenu(version.id)}
                  disabled={actionLoading === version.id}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Actions"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {openMenuId === version.id && (
                  <>
                    {/* Backdrop to close menu when clicking outside */}
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setOpenMenuId(null)}
                    />

                    <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                      {version.isActive ? (
                        <button
                          onClick={() => handleDelete(version.id)}
                          className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          onClick={() => handleActivate(version.id)}
                          className="w-full px-4 py-2 text-left text-sm text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
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
