import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext.tsx';
import * as resumeRepository from '../repositories/resumeRepository.ts';
import PdfViewer from '../components/PdfViewer.tsx';
import PdfUploadForm from '../components/PdfUploadForm.tsx';
import PdfHistoryList from '../components/PdfHistoryList.tsx';
import type { ResumePdfVersion } from '../types/index.ts';

function CV() {
  const { isAuthenticated } = useAuth();
  const [activePdf, setActivePdf] = useState<ResumePdfVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'view' | 'admin'>('view');
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const loadActivePdf = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await resumeRepository.getActivePdf();
      if (response.success && response.data) {
        setActivePdf(response.data);
      } else {
        setActivePdf(null);
      }
    } catch (err: any) {
      if (err.response?.status === 404) {
        setActivePdf(null);
      } else {
        setError(err.response?.data?.error || 'Failed to load PDF');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivePdf();
  }, []);

  const handleUploadSuccess = () => {
    setUploadSuccess('PDF uploaded successfully!');
    setUploadError(null);
    setTimeout(() => setUploadSuccess(null), 5000);
    setActiveTab('view');
    loadActivePdf();
  };

  const handleUploadError = (errorMsg: string) => {
    setUploadError(errorMsg);
    setUploadSuccess(null);
    setTimeout(() => setUploadError(null), 5000);
  };

  const handleDownload = () => {
    const downloadUrl = resumeRepository.getPdfDownloadUrl();
    window.location.href = downloadUrl;
  };

  const accentStyle = { background: 'var(--accent)' };

  return (
    <div className="py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Admin Tab Navigation */}
        {isAuthenticated && (
          <div className="flex justify-end mb-6">
            <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 p-1 bg-white dark:bg-[#252525]">
              <button
                onClick={() => setActiveTab('view')}
                className="px-4 py-2 rounded-md text-sm font-medium transition-colors text-gray-700 dark:text-gray-300"
                style={activeTab === 'view' ? { ...accentStyle, color: '#fff' } : {}}
              >
                Web View
              </button>
              <button
                onClick={() => setActiveTab('admin')}
                className="px-4 py-2 rounded-md text-sm font-medium transition-colors text-gray-700 dark:text-gray-300"
                style={activeTab === 'admin' ? { ...accentStyle, color: '#fff' } : {}}
              >
                Admin Panel
              </button>
            </div>
          </div>
        )}

        {/* Success/Error Messages */}
        {uploadSuccess && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-600 font-medium">{uploadSuccess}</p>
          </div>
        )}
        {uploadError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600 font-medium">{uploadError}</p>
          </div>
        )}

        {/* Admin Panel Tab */}
        {isAuthenticated && activeTab === 'admin' && (
          <div className="bg-white dark:bg-[#252525] rounded-lg shadow-lg border border-transparent dark:border-gray-700 p-6 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
              Admin: Manage Resume PDFs
            </h2>

            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Upload New PDF
              </h3>
              <PdfUploadForm
                onUploadSuccess={handleUploadSuccess}
                onUploadError={handleUploadError}
              />
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Version History
              </h3>
              <PdfHistoryList onVersionChange={loadActivePdf} />
            </div>
          </div>
        )}

        {/* Web View Tab */}
        {activeTab === 'view' && (
          <div className="bg-white dark:bg-[#252525] rounded-lg shadow-lg border border-transparent dark:border-gray-700 p-8">
            {loading && (
              <div className="flex items-center justify-center min-h-[600px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: 'var(--accent)' }} />
              </div>
            )}

            {!loading && error && (
              <div className="flex flex-col items-center justify-center min-h-[600px]">
                <svg
                  className="w-16 h-16 text-red-500 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-red-600 font-medium mb-4">{error}</p>
                <button
                  onClick={loadActivePdf}
                  className="px-4 py-2 text-white rounded-lg transition-colors"
                  style={accentStyle}
                >
                  Retry
                </button>
              </div>
            )}

            {!loading && !error && !activePdf && (
              <div className="flex flex-col items-center justify-center min-h-[600px] border-2 border-dashed border-gray-300 rounded-lg">
                <svg
                  className="w-20 h-20 text-gray-400 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
                <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  No PDF Resume Available
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-center max-w-md mb-4">
                  {isAuthenticated
                    ? 'Upload a PDF in the Admin Panel tab.'
                    : 'The site owner has not uploaded a resume yet.'}
                </p>
                {isAuthenticated && (
                  <button
                    onClick={() => setActiveTab('admin')}
                    className="px-6 py-2 text-white rounded-lg transition-colors"
                    style={accentStyle}
                  >
                    Go to Admin Panel
                  </button>
                )}
              </div>
            )}

            {!loading && !error && activePdf && (
              <div>
                <div className="flex justify-end mb-4">
                  <button
                    onClick={handleDownload}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    Download
                  </button>
                </div>
                <PdfViewer
                  pdfUrl={`${resumeRepository.getPdfFileUrl()}?v=${activePdf.id}`}
                  fileName={activePdf.fileName}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default CV;
