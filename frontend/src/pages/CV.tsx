import { useState } from 'react';

const CV = () => {
  const [viewMode, setViewMode] = useState<'pdf' | 'web'>('pdf');

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Resume / CV</h1>
          <p className="text-lg text-gray-600 mb-6">
            View my professional experience and qualifications
          </p>

          {/* View Mode Toggle */}
          <div className="inline-flex rounded-lg border border-gray-300 p-1 bg-white">
            <button
              onClick={() => setViewMode('pdf')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'pdf'
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              PDF View
            </button>
            <button
              onClick={() => setViewMode('web')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'web'
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              Web View
            </button>
          </div>
        </div>

        {/* PDF View */}
        {viewMode === 'pdf' && (
          <div className="bg-white rounded-lg shadow-lg p-8">
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
              <h3 className="text-xl font-semibold text-gray-700 mb-2">PDF Resume Viewer</h3>
              <p className="text-gray-500 mb-6 text-center max-w-md">
                Upload your PDF resume in the admin panel to display it here.
                For now, you can download or view the web version.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setViewMode('web')}
                  className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                >
                  View Web Version
                </button>
                <button className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                  Download PDF
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Web View */}
        {viewMode === 'web' && (
          <div className="bg-white rounded-lg shadow-lg p-8">
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
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">Web Resume View</h3>
              <p className="text-gray-500 mb-6 text-center max-w-md">
                Create and edit your resume content in the admin panel.
                The web view will display your experience, education, and skills in a beautiful format.
              </p>
              <button className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors">
                Go to Admin Panel
              </button>
            </div>
          </div>
        )}

        {/* Info Section */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            💡 Tip: Manage your resume content from the{' '}
            <a href="/login" className="text-orange-500 hover:text-orange-600 font-medium">
              Admin Dashboard
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default CV;
