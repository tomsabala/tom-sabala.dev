/**
 * 04 · Open a channel. The submit path is unchanged from the old contact page: a CSRF token
 * fetched on mount, two honeypot fields, a reCAPTCHA v3 token minted per submission, then
 * `POST /api/contact`. Only the labels and the chrome are new.
 */
import { useState, useEffect, type FormEvent } from 'react';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import { submitContact } from '../../../repositories/contactRepository.ts';
import { fetchCsrfToken } from '../../../repositories/csrfTokenRepository.ts';
import { apiErrorMessage } from '../../../repositories/apiError.ts';
import type { ContactFormData } from '../../../types/index.ts';
import Section from '../Section.tsx';

const EMPTY_FORM: ContactFormData = {
  name: '',
  email: '',
  message: '',
  email2: '',       // Honeypot (hidden)
  phoneNumber: '',  // Honeypot (hidden)
};

/** 16px minimum: anything smaller makes iOS Safari zoom the whole page on focus. */
const FIELD_CLASS =
  'bg-s1 border border-ln text-ink p-3.5 text-[16px] outline-none focus:border-acct w-full';

const LABEL_CLASS =
  'flex flex-col gap-2 font-mono text-[11px] leading-none text-mut tracking-[0.1em] uppercase';

export default function ContactSection() {
  const [formData, setFormData] = useState<ContactFormData>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSucceeded, setSubmitSucceeded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [csrfTokenError, setCsrfTokenError] = useState<string | null>(null);
  const { executeRecaptcha } = useGoogleReCaptcha();

  useEffect(() => {
    fetchCsrfToken()
      .then(setCsrfToken)
      .catch(error => {
        console.error('Failed to fetch CSRF token:', error);
        setCsrfTokenError('Failed to initialize form security. Please refresh the page.');
      });
  }, []);

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
      await submitContact({ ...formData, recaptchaToken }, csrfToken);

      setSubmitSucceeded(true);
      setFormData(EMPTY_FORM);
    } catch (error) {
      setErrorMessage(
        apiErrorMessage(
          error,
          'Failed to send message. Please make sure the backend is running or try again later.',
        ),
      );
      console.error('Contact form submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Section
      id="contact"
      index="04"
      title="Open a channel"
      className="pb-[clamp(64px,22vh,240px)]"
    >
      <div
        className="grid gap-10 lg:gap-14 items-start mt-6"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))' }}
      >
        <div className="flex flex-col gap-7">
          <p className="m-0 max-w-[40ch] text-[18px] leading-[1.55] text-ink2 [text-wrap:pretty]">
            Roles, collaborations, a motion-planning problem that won't converge. All welcome.
          </p>
          <a
            href="mailto:contact@tom-sabala.dev"
            className="text-ink no-underline underline decoration-acc decoration-[3px] underline-offset-8 break-words hover:text-acct"
            style={{
              fontFamily: "'Archivo', sans-serif",
              fontWeight: 600,
              fontSize: 'clamp(24px,3.4vw,46px)',
              letterSpacing: '-0.02em',
            }}
          >
            contact@tom-sabala.dev
          </a>
          <div className="flex gap-7 flex-wrap font-mono text-[13px] leading-none tracking-[0.06em] uppercase">
            <a href="https://github.com/tomsabala" target="_blank" rel="noopener" className="text-mut no-underline hover:text-acct">GitHub ↗</a>
            <a href="https://www.linkedin.com/in/tom-sabala-a9513721a/" target="_blank" rel="noopener" className="text-mut no-underline hover:text-acct">LinkedIn ↗</a>
            <a href="https://terminal.tom-sabala.dev" target="_blank" rel="noopener" className="text-mut no-underline hover:text-acct">Terminal ↗</a>
          </div>
        </div>

        {submitSucceeded ? (
          <div className="border border-acct p-7 flex flex-col gap-2.5" role="status">
            <span className="font-mono text-[11px] leading-none font-medium text-acct tracking-[0.1em]">
              ● ACK 200 · PACKET RECEIVED
            </span>
            <span className="text-[20px] leading-[1.4]">
              Message logged. I'll reply to your return address soon.
            </span>
            <button
              type="button"
              onClick={() => setSubmitSucceeded(false)}
              className="self-start mt-2 bg-transparent border border-ln2 text-ink font-mono text-[12px] leading-none uppercase tracking-[0.06em] px-4 py-3 cursor-pointer hover:border-acct"
            >
              Send another
            </button>
          </div>
        ) : (
          <form onSubmit={handleFormSubmit} className="flex flex-col gap-3.5">
            <div
              className="grid gap-3.5"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))' }}
            >
              <label className={LABEL_CLASS}>
                Callsign
                <input
                  required
                  name="name"
                  autoComplete="name"
                  placeholder="Your name"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className={FIELD_CLASS}
                />
              </label>
              <label className={LABEL_CLASS}>
                Return address
                <input
                  required
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="you@domain.com"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className={FIELD_CLASS}
                />
              </label>
            </div>

            {/* Honeypot Field 1: email2 (hidden via CSS, not display:none) */}
            <div className="honeypot-field" aria-hidden="true">
              <label htmlFor="email2">Secondary Email</label>
              <input
                type="text"
                id="email2"
                name="email2"
                value={formData.email2}
                onChange={e => setFormData({ ...formData, email2: e.target.value })}
                tabIndex={-1}
                autoComplete="nope"
                aria-hidden="true"
              />
            </div>

            <label className={LABEL_CLASS}>
              Payload
              <textarea
                required
                rows={5}
                name="message"
                placeholder="What are we building?"
                value={formData.message}
                onChange={e => setFormData({ ...formData, message: e.target.value })}
                className={`${FIELD_CLASS} leading-[1.5] resize-y`}
              />
            </label>

            {/* Honeypot Field 2: phoneNumber (hidden via CSS, not display:none) */}
            <div className="honeypot-field" aria-hidden="true">
              <label htmlFor="phoneNumber">Phone Number</label>
              <input
                type="text"
                id="phoneNumber"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })}
                tabIndex={-1}
                autoComplete="nope"
                aria-hidden="true"
              />
            </div>

            {(errorMessage || csrfTokenError) && (
              <p role="alert" className="m-0 border border-ln2 p-3 font-mono text-[12px] leading-[1.5] text-ink">
                {errorMessage || csrfTokenError}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="self-start bg-acc text-onacc border-0 font-mono text-[13px] leading-none font-medium tracking-[0.06em] uppercase px-[22px] py-4 cursor-pointer hover:bg-ink hover:text-bg disabled:opacity-50 disabled:cursor-default"
            >
              {isSubmitting ? 'Transmitting…' : 'Transmit →'}
            </button>
          </form>
        )}
      </div>
    </Section>
  );
}
