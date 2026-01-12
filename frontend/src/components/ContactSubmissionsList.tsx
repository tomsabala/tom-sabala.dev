import { useState, useEffect } from 'react';
import * as contactRepository from '../repositories/contactRepository';
import type { ContactSubmission } from '../types';

interface ContactSubmissionsListProps {
  onSubmissionChange?: () => void;
}

const ContactSubmissionsList: React.FC<ContactSubmissionsListProps> = ({ onSubmissionChange }) => {
  const [submissions, setSubmissions] = useState<ContactSubmission[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Filters
  const [readFilter, setReadFilter] = useState<'all' | 'read' | 'unread'>('all');
  const [includeArchived, setIncludeArchived] = useState(false);

  // Pagination
  const [page, setPage] = useState(0);
  const limit = 20;

  const loadSubmissions = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await contactRepository.getSubmissions(
        limit,
        page * limit,
        readFilter,
        includeArchived
      );
      if (response.success) {
        setSubmissions(response.data.submissions || []);
        setTotal(response.data.total || 0);
      } else {
        setError(response.error || 'Failed to load submissions');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubmissions();
  }, [page, readFilter, includeArchived]);

  const handleToggleRead = async (submissionId: number) => {
    setOpenMenuId(null);
    setActionLoading(submissionId);
    try {
      const response = await contactRepository.toggleReadStatus(submissionId);
      if (response.success) {
        await loadSubmissions();
        onSubmissionChange?.();
      } else {
        alert(response.error || 'Failed to update status');
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleArchive = async (submissionId: number) => {
    setOpenMenuId(null);

    if (!confirm('Are you sure you want to archive this submission? It can be restored by enabling "Show Archived".')) {
      return;
    }

    setActionLoading(submissionId);
    try {
      const response = await contactRepository.archiveSubmission(submissionId);
      if (response.success) {
        await loadSubmissions();
        onSubmissionChange?.();
      } else {
        alert(response.error || 'Failed to archive submission');
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to archive submission');
    } finally {
      setActionLoading(null);
    }
  };

  const toggleExpand = (submissionId: number) => {
    setExpandedId(expandedId === submissionId ? null : submissionId);
  };

  const toggleMenu = (submissionId: number) => {
    setOpenMenuId(openMenuId === submissionId ? null : submissionId);
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

  const totalPages = Math.ceil(total / limit);

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

  return (
    <div>
      {/* Filter Controls */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        {/* Read Status Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            value={readFilter}
            onChange={(e) => {
              setReadFilter(e.target.value as 'all' | 'read' | 'unread');
              setPage(0);
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          >
            <option value="all">All</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
          </select>
        </div>

        {/* Show Archived Checkbox */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="includeArchived"
            checked={includeArchived}
            onChange={(e) => {
              setIncludeArchived(e.target.checked);
              setPage(0);
            }}
            className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
          />
          <label htmlFor="includeArchived" className="ml-2 text-sm text-gray-700">
            Show Archived
          </label>
        </div>

        {/* Total Count */}
        <div className="ml-auto text-sm text-gray-600">
          {total} {total === 1 ? 'submission' : 'submissions'}
        </div>
      </div>

      {/* Submissions List */}
      {submissions.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No submissions found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {submissions.map((submission) => {
            const isExpanded = expandedId === submission.id;
            const isArchived = !!submission.archivedAt;

            return (
              <div
                key={submission.id}
                className={`border rounded-lg p-4 ${
                  isArchived
                    ? 'border-gray-300 bg-gray-50'
                    : submission.read
                    ? 'border-gray-300'
                    : 'border-orange-300 bg-orange-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  {/* Submission Info */}
                  <div className="flex-1 cursor-pointer" onClick={() => toggleExpand(submission.id)}>
                    <div className="flex items-center gap-2">
                      {/* Unread Indicator */}
                      {!submission.read && !isArchived && (
                        <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                      )}

                      <h4 className="font-medium text-gray-900">
                        {submission.name}
                      </h4>

                      {isArchived && (
                        <span className="px-2 py-1 text-xs font-medium bg-gray-500 text-white rounded">
                          Archived
                        </span>
                      )}
                    </div>

                    <div className="mt-1 text-sm text-gray-600">
                      <span className="font-medium">{submission.email}</span>
                    </div>

                    <div className="mt-2 text-sm text-gray-500">
                      {formatDate(submission.submittedAt)}
                    </div>

                    {/* Message Preview/Full */}
                    <div className="mt-3">
                      {isExpanded ? (
                        <div className="text-sm text-gray-900 whitespace-pre-wrap max-h-96 overflow-y-auto">
                          {submission.message}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-700 line-clamp-2">
                          {submission.message}
                        </div>
                      )}
                    </div>

                    {submission.message.length > 100 && (
                      <button
                        className="mt-2 text-sm text-orange-600 hover:text-orange-700 font-medium"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(submission.id);
                        }}
                      >
                        {isExpanded ? 'Show less' : 'Read more'}
                      </button>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="relative ml-4">
                    <button
                      onClick={() => toggleMenu(submission.id)}
                      disabled={actionLoading === submission.id}
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
                    {openMenuId === submission.id && (
                      <>
                        {/* Backdrop to close menu */}
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setOpenMenuId(null)}
                        />

                        <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                          <button
                            onClick={() => handleToggleRead(submission.id)}
                            className="w-full px-4 py-2 text-left text-sm text-orange-600 hover:bg-orange-50 rounded-t-lg transition-colors"
                          >
                            {submission.read ? 'Mark as Unread' : 'Mark as Read'}
                          </button>
                          {!isArchived && (
                            <button
                              onClick={() => handleArchive(submission.id)}
                              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 rounded-b-lg transition-colors"
                            >
                              Archive
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
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing {page * limit + 1}-{Math.min((page + 1) * limit, total)} of {total}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 0}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages - 1}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContactSubmissionsList;
