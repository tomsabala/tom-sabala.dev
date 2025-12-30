import { Link } from 'react-router-dom';

const Home = () => {
  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-5xl font-bold mb-4">Tom Sabala</h1>
            <p className="text-2xl mb-2">Software Engineer</p>
            <p className="text-xl text-blue-100 mb-8">
              Building elegant solutions with modern technologies
            </p>
            <div className="flex justify-center space-x-4">
              <Link to="/portfolio" className="btn-primary bg-white text-blue-600 hover:bg-gray-100">
                View My Work
              </Link>
              <Link to="/contact" className="btn-secondary bg-blue-700 text-white hover:bg-blue-600">
                Get In Touch
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">About Me</h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Passionate software engineer with expertise in full-stack development.
              I love creating beautiful, functional, and user-friendly applications
              that solve real-world problems.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="card text-center">
              <div className="text-4xl mb-4">💻</div>
              <h3 className="text-xl font-semibold mb-2">Full-Stack Development</h3>
              <p className="text-gray-600">
                Building complete web applications from frontend to backend
              </p>
            </div>

            <div className="card text-center">
              <div className="text-4xl mb-4">🚀</div>
              <h3 className="text-xl font-semibold mb-2">Modern Technologies</h3>
              <p className="text-gray-600">
                Working with React, Python, TypeScript, and more
              </p>
            </div>

            <div className="card text-center">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-xl font-semibold mb-2">Problem Solving</h3>
              <p className="text-gray-600">
                Finding elegant solutions to complex challenges
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
