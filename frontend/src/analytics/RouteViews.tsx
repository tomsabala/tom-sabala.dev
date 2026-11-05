import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackView } from './track.ts';

/**
 * Reports client-side navigation, which is the one thing the server-observed
 * tier genuinely cannot see: moving from `/` to `/work/mlmp` fetches the
 * deep-dive endpoint (so the *event* is recorded server-side), but a route that
 * needs no new data would otherwise leave no trace at all.
 *
 * Must be rendered inside the `<Router>`; it draws nothing.
 */
export default function RouteViews(): null {
  const { pathname } = useLocation();

  useEffect(() => {
    trackView(pathname);
  }, [pathname]);

  return null;
}
