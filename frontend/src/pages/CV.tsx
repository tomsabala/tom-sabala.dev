import { useEffect, useState } from 'react';
import { getCV } from '../repositories/resumeRepository';
import type { CVData } from '../types/index';

const CV = () => {
  const [cv, setCv] = useState<CVData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCV = async () => {
      try {
        const response = await getCV();
        setCv(response.data);
      } catch (err) {
        setError('Failed to load CV data. Please make sure the backend is running.');
        console.error('Error fetching CV:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCV();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-4rem)]">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  if (error || !cv) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error || 'No CV data available'}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white shadow-lg rounded-lg p-8 mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            {cv.personal_info.name}
          </h1>
          <p className="text-xl text-gray-600 mb-4">{cv.personal_info.title}</p>
          <div className="text-gray-600 space-y-1">
            <p>📧 {cv.personal_info.email}</p>
            <p>📍 {cv.personal_info.location}</p>
          </div>
          <p className="mt-4 text-gray-700">{cv.personal_info.summary}</p>
        </div>

        {/* Experience */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Experience</h2>
          <div className="space-y-6">
            {cv.experience.map((exp, index) => (
              <div key={index} className="card">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">{exp.position}</h3>
                    <p className="text-lg text-gray-700">{exp.company}</p>
                  </div>
                  <span className="text-gray-600">
                    {exp.start_date} - {exp.end_date}
                  </span>
                </div>
                <p className="text-gray-600 mb-3">{exp.description}</p>
                <div className="flex flex-wrap gap-2">
                  {exp.technologies.map((tech, i) => (
                    <span
                      key={i}
                      className="bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Education */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Education</h2>
          <div className="space-y-4">
            {cv.education.map((edu, index) => (
              <div key={index} className="card">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">{edu.degree}</h3>
                    <p className="text-gray-700">{edu.institution}</p>
                  </div>
                  <span className="text-gray-600">
                    {edu.start_date} - {edu.end_date}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Skills */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Skills</h2>
          <div className="card space-y-4">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Languages</h3>
              <div className="flex flex-wrap gap-2">
                {cv.skills.languages.map((lang, i) => (
                  <span
                    key={i}
                    className="bg-green-100 text-green-800 px-3 py-1 rounded-full"
                  >
                    {lang}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Frameworks</h3>
              <div className="flex flex-wrap gap-2">
                {cv.skills.frameworks.map((framework, i) => (
                  <span
                    key={i}
                    className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full"
                  >
                    {framework}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Tools</h3>
              <div className="flex flex-wrap gap-2">
                {cv.skills.tools.map((tool, i) => (
                  <span
                    key={i}
                    className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default CV;
