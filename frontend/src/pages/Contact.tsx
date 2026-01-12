import { useState, useEffect, FormEvent } from 'react';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import { submitContact } from '../repositories/contactRepository';
import { fetchCsrfToken } from '../repositories/csrfTokenRepository';
import type { ContactFormData } from '../types/index';

const Contact = () => {
  // Form data state
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
  const [csrfTokenLoaded, setCsrfTokenLoaded] = useState(false);
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
        await fetchCsrfToken();
        setCsrfTokenLoaded(true);
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

    // Reset states
    setIsSubmitting(true);
    setErrorMessage(null);
    setSubmitSucceeded(false);

    try {
      // Check reCAPTCHA is ready
      if (!executeRecaptcha) {
        setErrorMessage('Security verification not ready. Please wait a moment and try again.');
        return;
      }

      // Execute reCAPTCHA with action identifier
      const recaptchaToken = await executeRecaptcha('contact_form');

      // Submit form with all security fields
      const submissionData: ContactFormData = {
        ...formData,
        recaptchaToken,
      };

      await submitContact(submissionData);

      // Success: Reset form and show success message
      setSubmitSucceeded(true);
      setFormData({
        name: '',
        email: '',
        message: '',
        email2: '',
        phoneNumber: '',
      });

    } catch (error: any) {
      // Extract error message from response
      const errorText = error.response?.data?.error
        || 'Failed to send message. Please make sure the backend is running or try again later.';
      setErrorMessage(errorText);
      console.error('Contact form submission error:', error);

    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="py-6">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Let's Connect
          </h1>
          <p className="text-lg text-gray-600 max-w-xl mx-auto">
            Have a project in mind or just want to chat? Drop me a message and I'll get back to you as soon as possible.
          </p>
        </div>

        {/* Contact Form */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
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
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Your Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                disabled={isSubmitting || !csrfTokenLoaded}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
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
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                disabled={isSubmitting || !csrfTokenLoaded}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
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
              <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                Message
              </label>
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                required
                disabled={isSubmitting || !csrfTokenLoaded}
                rows={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="Tell me about your project or how I can help..."
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !csrfTokenLoaded || !!csrfTokenError}
              className="w-full bg-orange-500 text-white font-medium py-3 px-6 rounded-lg hover:bg-orange-600 focus:ring-4 focus:ring-orange-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Sending...
                </>
              ) : !csrfTokenLoaded ? (
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
              <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline">
                Privacy Policy
              </a>{' '}
              and{' '}
              <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline">
                Terms of Service
              </a>{' '}
              apply.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Contact;
