import { useState, useEffect, type FormEvent } from 'react';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import { submitContact } from '../repositories/contactRepository';
import { fetchCsrfToken } from '../repositories/csrfTokenRepository';
import type { ContactFormData } from '../types/index';
import { useAuth } from '../contexts/AuthContext';
import ContactSubmissionsList from '../components/ContactSubmissionsList';

const Contact = () => {
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<'form' | 'inbox'>('form');

  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    email: '',
    message: '',
    email2: '',       // Honeypot (hidden)
    phoneNumber: '',  // Honeypot (hidden)
  });

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSucceeded, setSubmitSucceeded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Security state
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [csrfTokenError, setCsrfTokenError] = useState<string | null>(null);

  // reCAPTCHA hook
  const { executeRecaptcha } = useGoogleReCaptcha();

  /**
   * Fetch CSRF token on component mount.
   * Token is required before form submission.
   */
  useEffect(() => {
    const initializeCsrfToken = async () => {
      try {
        const token = await fetchCsrfToken();
        setCsrfToken(token);
      } catch (error) {
        console.error('Failed to fetch CSRF token:', error);
        setCsrfTokenError('Failed to initialize form security. Please refresh the page.');
      }
    };

    initializeCsrfToken();
  }, []);

  /**
   * Handle form submission with security checks.
   */
  const handleFormSubmit = async (event: FormEvent) => {
    event.preventDefault();

    setIsSubmitting(true);
    setErrorMessage(null);
    setSubmitSucceeded(false);

    try {
      if (!csrfToken) {
        setErrorMessage('Security token not ready. Please refresh the page and try again.');
        return;
      }

      if (!executeRecaptcha) {
        setErrorMessage('Security verification not ready. Please wait a moment and try again.');
        return;
      }

      const recaptchaToken = await executeRecaptcha('contact_form');

      const submissionData: ContactFormData = {
        ...formData,
        recaptchaToken,
      };

      await submitContact(submissionData, csrfToken);

      setSubmitSucceeded(true);
      setFormData({
        name: '',
        email: '',
        message: '',
        email2: '',
        phoneNumber: '',
      });

    } catch (error: any) {
      const errorText = error.response?.data?.error
        || 'Failed to send message. Please make sure the backend is running or try again later.';
      setErrorMessage(errorText);
      console.error('Contact form submission error:', error);

    } finally {
      setIsSubmitting(false);
    }
  };

  const accentStyle = { background: 'hsl(210, 65%, 60%)' };

  return (
    <div className="py-6">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Admin Tab Navigation */}
        {isAuthenticated && (
          <div className="flex justify-end mb-6">
            <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 p-1 bg-white dark:bg-[#1e1e1e]">
              <button
                onClick={() => setActiveTab('form')}
                className="px-4 py-2 rounded-md text-sm font-medium transition-colors text-gray-700 dark:text-gray-300"
                style={activeTab === 'form' ? { ...accentStyle, color: '#fff' } : {}}
              >
                Contact Form
              </button>
              <button
                onClick={() => setActiveTab('inbox')}
                className="px-4 py-2 rounded-md text-sm font-medium transition-colors text-gray-700 dark:text-gray-300"
                style={activeTab === 'inbox' ? { ...accentStyle, color: '#fff' } : {}}
              >
                Submissions Inbox
              </button>
            </div>
          </div>
        )}

        {/* Contact Form Tab */}
        {activeTab === 'form' && (
          <div className="bg-white dark:bg-[#1e1e1e] rounded-lg shadow-lg p-8 mb-8">
            {/* CSRF Token Loading Error */}
            {csrfTokenError && (
              <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-yellow-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <p className="text-yellow-700 font-medium">{csrfTokenError}</p>
                </div>
              </div>
            )}

            {/* Success Message */}
            {submitSucceeded && (
              <div className="mb-6 bg-green-50 border-l-4 border-green-500 p-4 rounded">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <p className="text-green-700 font-medium">
                    Message sent successfully! I'll be in touch soon.
                  </p>
                </div>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <p className="text-red-700 font-medium">{errorMessage}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-6">
              {/* Name Field */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Your Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  disabled={isSubmitting || !csrfToken}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:border-transparent transition-colors disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  style={{ '--tw-ring-color': 'hsl(210, 65%, 60%)' } as React.CSSProperties}
                  placeholder="John Doe"
                />
              </div>

              {/* Honeypot Field 1: email2 (hidden via CSS) */}
              <div className="honeypot-field" aria-hidden="true">
                <label htmlFor="email2">Secondary Email</label>
                <input
                  type="text"
                  id="email2"
                  name="email2"
                  value={formData.email2}
                  onChange={(e) => setFormData({ ...formData, email2: e.target.value })}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  disabled={isSubmitting || !csrfToken}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:border-transparent transition-colors disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  placeholder="john@example.com"
                />
              </div>

              {/* Honeypot Field 2: phoneNumber (hidden via CSS) */}
              <div className="honeypot-field" aria-hidden="true">
                <label htmlFor="phoneNumber">Phone Number</label>
                <input
                  type="tel"
                  id="phoneNumber"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              {/* Message Field */}
              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  required
                  disabled={isSubmitting || !csrfToken}
                  rows={6}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:border-transparent transition-colors resize-none disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  placeholder="Tell me about your project or how I can help..."
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !csrfToken || !!csrfTokenError}
                className="w-full text-white font-medium py-3 px-6 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={accentStyle}
                onMouseEnter={e => !e.currentTarget.disabled && (e.currentTarget.style.background = 'hsl(210, 55%, 52%)')}
                onMouseLeave={e => !e.currentTarget.disabled && (e.currentTarget.style.background = 'hsl(210, 65%, 60%)')}
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Sending...
                  </>
                ) : !csrfToken ? (
                  'Loading...'
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Send Message
                  </>
                )}
              </button>

              {/* reCAPTCHA Disclosure (required by Google) */}
              <p className="text-xs text-gray-500 text-center">
                This site is protected by reCAPTCHA and the Google{' '}
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'hsl(210, 65%, 60%)' }}>
                  Privacy Policy
                </a>{' '}
                and{' '}
                <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'hsl(210, 65%, 60%)' }}>
                  Terms of Service
                </a>{' '}
                apply.
              </p>
            </form>
          </div>
        )}

        {/* Admin Inbox Tab */}
        {isAuthenticated && activeTab === 'inbox' && (
          <div className="bg-white dark:bg-[#1e1e1e] rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
              Contact Submissions
            </h2>
            <ContactSubmissionsList />
          </div>
        )}
      </div>
    </div>
  );
};

export default Contact;
