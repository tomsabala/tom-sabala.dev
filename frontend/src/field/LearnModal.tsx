/**
 * "Learn about this field" modal. Ported from the `learnOpen` block of
 * `Portfolio Home.dc.html`, rendering `LEARN[algo]`.
 *
 * The prototype's `relHref` pointed at `Project%20Detail.dc.html?p=<slug>`;
 * here it is the real `/work/<slug>` route.
 */

import { useEffect } from 'react';
import { Link, useInRouterContext } from 'react-router-dom';

import { LEARN } from './config';
import { useField } from './useField';

export default function LearnModal() {
  const { algo, learnOpen, closeLearn } = useField();
  const inRouter = useInRouterContext();

  useEffect(() => {
    if (!learnOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLearn();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [learnOpen, closeLearn]);

  if (!learnOpen) return null;
  const learn = LEARN[algo];

  const relStyle = {
    font: "500 12px/1.4 'DM Mono', ui-monospace, monospace",
    letterSpacing: '0.04em',
    color: 'var(--acct)',
  } as const;

  return (
    <div
      onClick={closeLearn}
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'color-mix(in oklab, var(--bg) 65%, transparent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        data-panel="1"
        role="dialog"
        aria-modal="true"
        aria-label="Learn about this field"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 580,
          maxHeight: 'calc(100svh - 40px)',
          overflow: 'auto',
          background: 'var(--bg)',
          border: '1px solid var(--ln2)',
          boxShadow: '0 30px 60px -30px rgba(0,0,0,0.5)',
          padding: 'clamp(20px, 4vw, 32px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          color: 'var(--ink)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span
            style={{
              font: "500 11px/1 'DM Mono', ui-monospace, monospace",
              color: 'var(--acct)',
              letterSpacing: '0.12em',
            }}
          >
            LEARN ABOUT THIS FIELD
          </span>
          <button
            type="button"
            onClick={closeLearn}
            aria-label="Close"
            style={{
              background: 'none',
              border: 0,
              color: 'var(--mut)',
              font: "400 20px/1 'DM Mono', ui-monospace, monospace",
              cursor: 'pointer',
              padding: 4,
            }}
          >
            ×
          </button>
        </div>

        <h3
          style={{
            margin: 0,
            fontFamily: "'Archivo', system-ui, sans-serif",
            fontStretch: '115%',
            fontWeight: 700,
            fontSize: 'clamp(26px, 4vw, 34px)',
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
          }}
        >
          {learn.title}
        </h3>

        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: 'var(--ink2)', textWrap: 'pretty' }}>
          {learn.lede}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span
            style={{
              font: "500 10px/1 'DM Mono', ui-monospace, monospace",
              color: 'var(--mut)',
              letterSpacing: '0.12em',
            }}
          >
            HOW TO READ IT
          </span>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: 'var(--ink2)', textWrap: 'pretty' }}>
            {learn.read}
          </p>
        </div>

        <pre
          style={{
            margin: 0,
            padding: '14px 16px',
            background: 'var(--s1)',
            border: '1px solid var(--ln)',
            font: "400 12.5px/1.7 'DM Mono', ui-monospace, monospace",
            color: 'var(--ink)',
            whiteSpace: 'pre',
            overflow: 'auto',
          }}
        >
          {learn.code}
        </pre>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          {inRouter && learn.relHref.startsWith('/work/') ? (
            <Link to={learn.relHref} onClick={closeLearn} style={relStyle}>
              {learn.rel}
            </Link>
          ) : (
            <a href={learn.relHref} onClick={closeLearn} style={relStyle}>
              {learn.rel}
            </a>
          )}
          <button
            type="button"
            onClick={closeLearn}
            style={{
              background: 'var(--acc)',
              color: 'var(--onacc)',
              border: 0,
              font: "500 12px/1 'DM Mono', ui-monospace, monospace",
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '13px 16px',
              cursor: 'pointer',
            }}
          >
            Back to the field
          </button>
        </div>
      </div>
    </div>
  );
}
