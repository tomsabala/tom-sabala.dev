import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext.tsx';
import * as aboutRepository from '../repositories/aboutRepository.ts';
import AboutFormModal from '../components/AboutFormModal.tsx';
import type { AboutData } from '../types/index.ts';

const Home = () => {
  const { isAuthenticated } = useAuth();
  const [aboutData, setAboutData] = useState<AboutData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchAboutData();
  }, []);

  const fetchAboutData = async () => {
    try {
      setLoading(true);
      const response = await aboutRepository.getAbout();
      if (response.success) {
        setAboutData(response.data);
      }
    } catch (err: any) {
      setError('Failed to load about content');
      console.error('Failed to fetch about:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditSuccess = () => {
    setIsModalOpen(false);
    fetchAboutData();
  };

  return (
    <div className="max-w-2xl mx-auto px-8 py-10">
      <div className="bg-white dark:bg-[#252525] rounded-lg shadow-md border border-transparent dark:border-gray-700 p-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-1">Tom Sabała</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">Software Engineer</p>

        {loading ? (
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
          </div>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : (
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-line">
            {aboutData?.content || 'No content yet.'}
          </p>
        )}

        {isAuthenticated && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-8 inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            type="button"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Edit
          </button>
        )}
      </div>

      <AboutFormModal
        isOpen={isModalOpen}
        currentData={aboutData}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
};

export default Home;
