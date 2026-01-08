import { useState, useEffect } from 'react';
import * as resumeRepository from '../repositories/resumeRepository';
import type { ResumePdfVersion } from '../types';

interface PdfHistoryListProps {
  onVersionChange?: () => void;
}

const PdfHistoryList: React.FC<PdfHistoryListProps> = ({ onVersionChange }) => {
  const [versions, setVersions] = useState<ResumePdfVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

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
        const isDeleted = version.deletedAt !== null;

        return (
          <div
            key={version.id}
            className={`border rounded-lg p-4 ${
              version.isActive
                ? 'border-orange-500 bg-orange-50'
                : isDeleted
                  ? 'border-gray-200 bg-gray-50 opacity-75'
                  : 'border-gray-300'
            }`}
          >
            <div className="flex items-start justify-between">
              {/* Version Info */}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className={`font-medium ${isDeleted ? 'text-gray-500' : 'text-gray-900'}`}>
                    {version.fileName}
                  </h4>
                  {version.isActive && (
                    <span className="px-2 py-1 text-xs font-medium bg-orange-500 text-white rounded">
                      Active
                    </span>
                  )}
                  {isDeleted && (
                    <span className="px-2 py-1 text-xs font-medium bg-gray-400 text-white rounded">
                      Deleted
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
                  {isDeleted && (
                    <p>
                      <span className="font-medium">Deleted:</span>{' '}
                      {formatDate(version.deletedAt!)}
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 ml-4">
                {!version.isActive && (
                  <button
                    onClick={() => handleActivate(version.id)}
                    disabled={actionLoading === version.id}
                    className={`px-3 py-1 text-sm rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                      isDeleted
                        ? 'bg-green-500 text-white hover:bg-green-600'
                        : 'bg-orange-500 text-white hover:bg-orange-600'
                    }`}
                  >
                    {actionLoading === version.id
                      ? (isDeleted ? 'Restoring...' : 'Activating...')
                      : (isDeleted ? 'Restore' : 'Activate')
                    }
                  </button>
                )}
                {!isDeleted && (
                  <button
                    onClick={() => handleDelete(version.id)}
                    disabled={actionLoading === version.id}
                    className="px-3 py-1 text-sm border border-red-300 text-red-600 rounded hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {actionLoading === version.id ? 'Deleting...' : 'Delete'}
                  </button>
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
