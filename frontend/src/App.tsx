import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3';
import { Analytics } from '@vercel/analytics/react';
import { useEffect, useState } from 'react';
import { ThemeProvider } from './contexts/ThemeContext.tsx';
import { TabConfigProvider } from './contexts/TabConfigContext.tsx';
import { useAuth } from './contexts/AuthContext.tsx';
import { getPortfolio } from './repositories/portfolioRepository.ts';
import Landing from './pages/Landing.tsx';
import WorkDetail from './pages/WorkDetail.tsx';
import Admin, { AdminScreenRoute } from './pages/Admin.tsx';
import ProtectedRoute from './components/ProtectedRoute.tsx';
import VisibleTabRoute from './components/VisibleTabRoute.tsx';

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_V3_SITE_KEY || '';

/**
 * Keeps the pre-redesign `/portfolio/<id>` links alive: resolves the id against the project
 * list and replaces with `/work/<slug>`. An id that no longer resolves lands on the work
 * section rather than a 404, because these URLs are in the wild.
 */
function LegacyProjectRedirect() {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated, isLoading } = useAuth();
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    let cancelled = false;
    getPortfolio(isAuthenticated)
      .then(resp => {
        if (cancelled) return;
        const list = Array.isArray(resp?.data) ? resp.data : [];
        const match = list.find((p: { id: number }) => String(p.id) === id);
        setTarget(match?.slug ? `/work/${match.slug}` : '/#work');
      })
      .catch(() => {
        if (!cancelled) setTarget('/#work');
      });
    return () => { cancelled = true; };
  }, [id, isAuthenticated, isLoading]);

  if (!target) return null;
  return <Navigate to={target} replace />;
}

function App() {
  return (
    <ThemeProvider>
    <TabConfigProvider>
      <GoogleReCaptchaProvider
        reCaptchaKey={RECAPTCHA_SITE_KEY}
        scriptProps={{
          async: true,
          defer: true,
          appendTo: 'head',
        }}
      >
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route
              path="/work/:slug"
              element={<VisibleTabRoute tabKey="work"><WorkDetail /></VisibleTabRoute>}
            />

            <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>}>
              <Route index element={<AdminScreenRoute />} />
              <Route path=":screen" element={<AdminScreenRoute />} />
            </Route>

            {/* Pre-redesign URLs, kept resolvable */}
            <Route path="/portfolio" element={<Navigate to="/#work" replace />} />
            <Route path="/portfolio/:id" element={<LegacyProjectRedirect />} />
            <Route path="/cv" element={<Navigate to="/#about" replace />} />
            <Route path="/contact" element={<Navigate to="/#contact" replace />} />
            <Route path="/github-stats" element={<Navigate to="/#about" replace />} />
            <Route path="/jobs" element={<Navigate to="/admin/pipeline" replace />} />
            <Route path="/settings" element={<Navigate to="/admin/visibility" replace />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
        <Analytics />
      </GoogleReCaptchaProvider>
    </TabConfigProvider>
    </ThemeProvider>
  );
}

export default App;
