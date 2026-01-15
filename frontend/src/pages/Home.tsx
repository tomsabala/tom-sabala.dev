import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import * as aboutRepository from '../repositories/aboutRepository';
import AboutFormModal from '../components/AboutFormModal';
import type { AboutData } from '../types';

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

  const getProfilePhotoUrl = () => {
    if (!aboutData?.profilePhotoUrl) return null;

    if (aboutData.profilePhotoUrl.startsWith('/api/')) {
      const baseUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
      return `${baseUrl}${aboutData.profilePhotoUrl}`;
    }

    return aboutData.profilePhotoUrl;
  };

  return (
    <div className="min-h-[calc(100vh-12rem)]">
      {/* Hero Section */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-8">
          <div className="flex items-center gap-16">
            {/* Profile Photo */}
            <div className="flex-shrink-0 relative">
              {getProfilePhotoUrl() ? (
                <img
                  src={getProfilePhotoUrl()!}
                  alt="Profile"
                  className="w-80 h-80 rounded-full object-cover"
                />
              ) : (
                <div className="w-80 h-80 rounded-full bg-gray-300 overflow-hidden flex items-center justify-center">
                  <svg className="w-32 h-32 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                </div>
              )}

              {/* Admin Edit Button */}
              {isAuthenticated && (
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="absolute -bottom-2 -right-2 bg-orange-500 text-white p-3 rounded-full hover:bg-orange-600 transition-colors shadow-lg"
                  title="Edit About Section"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              )}
            </div>

            {/* Content */}
            <div className="flex-1">
              <h1 className="text-6xl font-bold text-gray-900 mb-6">Hello</h1>

              <h2 className="text-2xl font-semibold text-gray-900 mb-4">A Bit About Me</h2>

              {loading ? (
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                </div>
              ) : error ? (
                <p className="text-red-500">{error}</p>
              ) : (
                <p className="text-gray-600 mb-8 max-w-md leading-relaxed whitespace-pre-line">
                  {aboutData?.content || 'No content yet. Click edit to add your about text.'}
                </p>
              )}

              {/* Action Buttons */}
              <div className="flex gap-6">
                <Link
                  to="/cv"
                  className="w-32 h-32 rounded-full bg-[#FFB800] hover:bg-[#E5A500] flex items-center justify-center text-black font-semibold transition-colors shadow-lg"
                >
                  Resume
                </Link>
                <Link
                  to="/portfolio"
                  className="w-32 h-32 rounded-full bg-[#FF5757] hover:bg-[#E54545] flex items-center justify-center text-white font-semibold transition-colors shadow-lg"
                >
                  Projects
                </Link>
                <Link
                  to="/contact"
                  className="w-32 h-32 rounded-full bg-[#6DD4D4] hover:bg-[#5BC2C2] flex items-center justify-center text-black font-semibold transition-colors shadow-lg"
                >
                  Contact
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Form Modal */}
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
