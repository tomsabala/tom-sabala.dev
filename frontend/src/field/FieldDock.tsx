/**
 * The field control dock. Ported from the fixed `data-panel` block at the
 * bottom of `Portfolio Home.dc.html` plus its `renderVals()` bindings
 * (`algos`, `tools`, `settings`, `toggles`, `fieldState`, `pauseLabel`).
 *
 * Desktop: a floating panel, bottom right. Below `md`: a bottom sheet pinned
 * to the bottom edge, collapsed to a 44px bar by default so it never covers
 * the hero CTAs.
 */

import type { CSSProperties } from 'react';

import { ALGOS, HINTS, NAMES, SETTINGS, TOGGLES, TOOL_ORDER, TOOLS, TOUCH_HINTS } from './config';
import { COARSE_QUERY, MOBILE_QUERY, useField, useMediaQuery } from './useField';

const mono = (size: number, weight = 500): CSSProperties => ({
  font: `${weight} ${size}px/1 'DM Mono', ui-monospace, monospace`,
});

const BTN: CSSProperties = {
  border: 0,
  cursor: 'pointer',
  borderRadius: 0,
  appearance: 'none',
};

export default function FieldDock() {
  const {
    algo,
    setAlgo,
    cfg,
    setCfg,
    tool,
    setTool,
    armed,
    armTool,
    paused,
    togglePause,
    openLearn,
    dockOpen,
    toggleDock,
    reset,
    hudRef,
  } = useField();

  const mobile = useMediaQuery(MOBILE_QUERY);
  const coarse = useMediaQuery(COARSE_QUERY);

  const shell: CSSProperties = mobile
    ? {
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 40,
        background: 'color-mix(in oklab, var(--bg) 94%, transparent)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderTop: '1px solid var(--ln2)',
        boxShadow: '0 14px 34px -16px rgba(0,0,0,0.35)',
        color: 'var(--ink)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }
    : {
        position: 'fixed',
        right: 16,
        bottom: 16,
        zIndex: 40,
        width: 'min(340px, calc(100vw - 32px))',
        background: 'color-mix(in oklab, var(--bg) 94%, transparent)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '1px solid var(--ln2)',
        boxShadow: '0 14px 34px -16px rgba(0,0,0,0.35)',
        color: 'var(--ink)',
      };

  return (
    <div data-panel="1" style={shell}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: mobile ? '0 12px' : '12px 14px',
          minHeight: mobile ? 44 : undefined,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <span style={{ ...mono(10), color: 'var(--acct)', letterSpacing: '0.12em' }}>
            ● FIELD · {paused ? 'PAUSED' : 'LIVE'}
          </span>
          <span style={{ ...mono(13), letterSpacing: '0.04em' }}>{NAMES[algo]}</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={openLearn}
            style={{
              ...BTN,
              ...mono(11),
              background: 'var(--acc)',
              color: 'var(--onacc)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '9px 10px',
            }}
          >
            ? Learn
          </button>
          <button
            type="button"
            onClick={toggleDock}
            aria-label="Toggle field controls"
            aria-expanded={dockOpen}
            style={{
              ...BTN,
              ...mono(13),
              background: 'transparent',
              color: 'var(--ink)',
              border: '1px solid var(--ln2)',
              width: 32,
            }}
          >
            {dockOpen ? '–' : '+'}
          </button>
        </div>
      </div>

      {dockOpen && (
        <div
          style={{
            borderTop: '1px solid var(--ln)',
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            maxHeight: mobile ? 'min(60svh, 560px)' : 'min(62vh, 540px)',
            overflow: 'auto',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              border: '1px solid var(--ln2)',
            }}
          >
            {ALGOS.map(([k, label]) => (
              <button
                key={k}
                type="button"
                aria-pressed={k === algo}
                onClick={(e) => {
                  e.stopPropagation();
                  setAlgo(k);
                }}
                style={{
                  ...BTN,
                  ...mono(10.5),
                  background: k === algo ? 'var(--acc)' : 'transparent',
                  color: k === algo ? 'var(--onacc)' : 'var(--ink)',
                  padding: '10px 4px',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ ...mono(10), color: 'var(--mut)', letterSpacing: '0.12em' }}>
              CLICK TOOL · empty space
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {TOOLS[algo].map((label, i) => {
                const k = TOOL_ORDER[i];
                const on = coarse ? armed && tool === k : tool === k;
                return (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={on}
                    onClick={() => (coarse ? armTool(k) : setTool(k))}
                    style={{
                      ...BTN,
                      font: "500 11px/1.2 'DM Mono', ui-monospace, monospace",
                      background: on ? (coarse ? 'var(--acc)' : 'var(--ink)') : 'transparent',
                      color: on ? (coarse ? 'var(--onacc)' : 'var(--bg)') : 'var(--ink)',
                      border: '1px solid var(--ink)',
                      padding: '9px 6px',
                    }}
                  >
                    {label}
                    {coarse && on ? ' · armed' : ''}
                  </button>
                );
              })}
            </div>
            <span
              style={{
                font: "400 10.5px/1.5 'DM Mono', ui-monospace, monospace",
                color: 'var(--mut)',
              }}
            >
              {coarse ? TOUCH_HINTS[algo] : HINTS[algo]}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span style={{ ...mono(10), color: 'var(--mut)', letterSpacing: '0.12em' }}>
              PARAMETERS
            </span>
            {SETTINGS[algo].map((st) => {
              const value = typeof cfg[st.k] === 'number' ? (cfg[st.k] as number) : st.min;
              const dec = (String(st.step).split('.')[1] || '').length;
              return (
                <label
                  key={st.k}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    font: "400 12px/1 'DM Mono', ui-monospace, monospace",
                  }}
                >
                  <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span>{st.label}</span>
                    <span style={{ color: 'var(--acct)' }}>
                      {value.toFixed(dec)}
                      {st.unit}
                    </span>
                  </span>
                  <input
                    type="range"
                    min={st.min}
                    max={st.max}
                    step={st.step}
                    value={value}
                    onChange={(e) => setCfg(st.k, +e.target.value, st.regen)}
                    style={{ width: '100%', margin: 0, accentColor: 'var(--acc)' }}
                  />
                </label>
              );
            })}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {TOGGLES[algo].map((tg) => {
                const on = cfg[tg.k] === true;
                return (
                  <button
                    key={tg.k}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setCfg(tg.k, !on)}
                    style={{
                      ...BTN,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      background: 'transparent',
                      padding: '4px 0',
                      color: 'var(--ink)',
                      font: "400 12px/1.2 'DM Mono', ui-monospace, monospace",
                      textAlign: 'left',
                    }}
                  >
                    <span
                      style={{
                        flex: '0 0 14px',
                        height: 14,
                        border: '1px solid var(--ink)',
                        background: on ? 'var(--acc)' : 'transparent',
                        color: 'var(--onacc)',
                        font: "600 10px/14px 'DM Mono', ui-monospace, monospace",
                        textAlign: 'center',
                      }}
                    >
                      {on ? '✓' : ''}
                    </span>
                    {tg.label}
                  </button>
                );
              })}
            </div>
          </div>

          <pre
            ref={hudRef}
            style={{
              margin: 0,
              padding: '10px 12px',
              background: 'var(--s1)',
              border: '1px solid var(--ln)',
              font: "400 11.5px/1.7 'DM Mono', ui-monospace, monospace",
              color: 'var(--ink2)',
              whiteSpace: 'pre',
            }}
          >
            booting…
          </pre>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <button
              type="button"
              onClick={reset}
              style={{
                ...BTN,
                ...mono(11),
                background: 'transparent',
                color: 'var(--ink)',
                border: '1px solid var(--ln2)',
                padding: 10,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              ↺ Reset
            </button>
            <button
              type="button"
              onClick={togglePause}
              style={{
                ...BTN,
                ...mono(11),
                background: 'transparent',
                color: 'var(--ink)',
                border: '1px solid var(--ln2)',
                padding: 10,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              {paused ? '▶ Resume' : '❚❚ Pause'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
