import { useIsTabVisible } from '../contexts/TabConfigContext.tsx';

interface VisibleTabRouteProps {
  tabKey: string;
  children: React.ReactNode;
}

/**
 * Route guard for tab-visibility-controlled pages.
 *
 * - Admin: always renders children
 * - Loading: renders children (optimistic — avoids flash of 404)
 * - Loaded + tab hidden: renders a 404-style message
 *
 * Backend enforces the same rule, so even a direct API call returns 404.
 */
function VisibleTabRoute({ tabKey, children }: VisibleTabRouteProps) {
  const isVisible = useIsTabVisible(tabKey);

  if (!isVisible) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-4 gap-4 bg-bg">
        <p
          className="m-0 uppercase text-ln2"
          style={{
            fontFamily: "'Archivo', sans-serif",
            fontStretch: '125%',
            fontWeight: 800,
            fontSize: 'clamp(64px,14vw,160px)',
            lineHeight: 0.86,
            letterSpacing: '-0.035em',
          }}
        >
          404
        </p>
        <p className="m-0 font-mono text-[12px] tracking-[0.12em] uppercase text-mut">
          This page is not available.
        </p>
        <a
          href="/"
          className="bg-acc text-onacc no-underline font-mono text-[12px] leading-none uppercase tracking-[0.06em] px-5 py-3.5"
        >
          ← tom-sabala.dev
        </a>
      </div>
    );
  }

  return <>{children}</>;
}

export default VisibleTabRoute;
