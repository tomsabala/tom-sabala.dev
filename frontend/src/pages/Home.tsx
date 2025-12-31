import { Link } from 'react-router-dom';

const Home = () => {
  return (
    <div className="min-h-[calc(100vh-12rem)]">
      {/* Hero Section */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-8">
          <div className="flex items-center gap-16">
            {/* Profile Photo - Placeholder */}
            <div className="flex-shrink-0">
              <div className="w-80 h-80 rounded-full bg-gray-300 overflow-hidden flex items-center justify-center">
                <svg className="w-32 h-32 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1">
              <h1 className="text-6xl font-bold text-gray-900 mb-6">Hello</h1>

              <h2 className="text-2xl font-semibold text-gray-900 mb-4">A Bit About Me</h2>

              <p className="text-gray-600 mb-8 max-w-md leading-relaxed">
                I'm a paragraph. Click here to add your own text and edit me. I'm a great place
                for you to tell a story and let your users know a little more about you.
              </p>

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
    </div>
  );
};

export default Home;
