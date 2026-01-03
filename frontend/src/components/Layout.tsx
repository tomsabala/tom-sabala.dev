import { Link, Outlet } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import LoginModal from './LoginModal';

const Layout = () => {
  const { isAuthenticated, logout } = useAuth();
  const [clickCount, setClickCount] = useState(0);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const clickTimestamps = useRef<number[]>([]);

  // Handle header clicks for hidden login trigger
  const handleHeaderClick = () => {
    const now = Date.now();

    // Add current timestamp
    clickTimestamps.current.push(now);

    // Remove timestamps older than 2 seconds
    clickTimestamps.current = clickTimestamps.current.filter(
      timestamp => now - timestamp <= 2000
    );

    // Update click count
    setClickCount(clickTimestamps.current.length);

    // Open modal if 7 clicks within 2 seconds
    if (clickTimestamps.current.length >= 7) {
      setIsLoginModalOpen(true);
      // Reset counter
      clickTimestamps.current = [];
      setClickCount(0);
    }
  };

  // Reset click count after 2 seconds of no clicks
  useEffect(() => {
    if (clickCount > 0) {
      const timer = setTimeout(() => {
        setClickCount(0);
        clickTimestamps.current = [];
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [clickCount]);

  // Handle logout
  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="h-screen bg-[#f5f5f5] flex flex-col">
      {/* Fixed Header Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-40">
        <div className="max-w-7xl mx-auto px-8 py-4">
          <div className="flex justify-between items-center">
            {/* Logo/Name - Hidden login trigger (only when not authenticated) */}
            <Link
              to="/"
              onClick={!isAuthenticated ? handleHeaderClick : undefined}
              className="flex items-center space-x-2 cursor-pointer select-none hover:opacity-80 transition-opacity"
            >
              <div className="w-8 h-8 bg-orange-400 rounded-full"></div>
              <div>
                <span className="font-semibold text-gray-900">Tom Sabala</span>
                <span className="text-gray-500 text-sm ml-2">Software Engineer</span>
              </div>
            </Link>

            {/* Navigation Links */}
            <div className="flex items-center space-x-1 text-sm text-gray-600">
              <Link to="/cv" className="hover:text-gray-900 transition-colors">
                Resume
              </Link>
              <span className="text-gray-400">|</span>
              <Link to="/portfolio" className="hover:text-gray-900 transition-colors">
                Projects
              </Link>
              <span className="text-gray-400">|</span>
              <Link to="/contact" className="hover:text-gray-900 transition-colors">
                Contact
              </Link>

              {/* Sign Out Button (only shown when authenticated) */}
              {isAuthenticated && (
                <>
                  <span className="text-gray-400">|</span>
                  <button
                    onClick={handleLogout}
                    className="text-orange-500 hover:text-orange-600 transition-colors font-medium"
                  >
                    Sign Out
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Scrollable Main Content */}
      <main className="flex-1 overflow-y-auto pt-[72px] pb-[100px]">
        <Outlet />
      </main>

      {/* Fixed Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex justify-between items-start">
            {/* Phone */}
            <div>
              <h3 className="font-semibold text-gray-900 text-sm mb-1">Phone</h3>
              <p className="text-gray-600 text-sm">+972-54-526-6266</p>
            </div>

            {/* Email */}
            <div>
              <h3 className="font-semibold text-gray-900 text-sm mb-1">Email</h3>
              <p className="text-gray-600 text-sm">sabala144@gmail.com</p>
            </div>

            {/* Social Links */}
            <div>
              <h3 className="font-semibold text-gray-900 text-sm mb-1">Follow Me</h3>
              <div className="flex space-x-3">
                <a
                  href="https://www.linkedin.com/in/tom-sabala-a9513721a/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 hover:text-blue-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                  </svg>
                </a>
                <a
                  href="https://github.com/tomsabala"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                </a>
              </div>
            </div>

            {/* Copyright */}
            <div className="text-gray-500 text-xs self-end">
              <p>© 2025 Tom Sabala. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />
    </div>
  );
};

export default Layout;
