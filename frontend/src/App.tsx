import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3';
import { Analytics } from '@vercel/analytics/react';
import { ThemeProvider } from './contexts/ThemeContext.tsx';
import { TocProvider } from './contexts/TocContext.tsx';
import { TabConfigProvider } from './contexts/TabConfigContext.tsx';
import Layout from './components/Layout.tsx';
import Home from './pages/Home.tsx';
import Portfolio from './pages/Portfolio.tsx';
import CV from './pages/CV.tsx';
import Contact from './pages/Contact.tsx';
import ProjectDetail from './pages/ProjectDetail.tsx';
import GitHubStatsPage from './pages/GitHubStatsPage.tsx';
import Jobs from './pages/Jobs.tsx';
import Settings from './pages/Settings.tsx';
import ProtectedRoute from './components/ProtectedRoute.tsx';
import VisibleTabRoute from './components/VisibleTabRoute.tsx';

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_V3_SITE_KEY || '';

function App() {
  return (
    <TocProvider>
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
            <Route path="/" element={<Layout />}>
              <Route index element={<VisibleTabRoute tabKey="home"><Home /></VisibleTabRoute>} />
              <Route path="portfolio" element={<VisibleTabRoute tabKey="portfolio"><Portfolio /></VisibleTabRoute>} />
              <Route path="portfolio/:id" element={<VisibleTabRoute tabKey="portfolio"><ProjectDetail /></VisibleTabRoute>} />
              <Route path="cv" element={<VisibleTabRoute tabKey="cv"><CV /></VisibleTabRoute>} />
              <Route path="contact" element={<VisibleTabRoute tabKey="contact"><Contact /></VisibleTabRoute>} />
              <Route path="github-stats" element={<VisibleTabRoute tabKey="github"><GitHubStatsPage /></VisibleTabRoute>} />
              <Route path="jobs" element={<ProtectedRoute><Jobs /></ProtectedRoute>} />
              <Route path="settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            </Route>
          </Routes>
        </Router>
        <Analytics />
      </GoogleReCaptchaProvider>
    </TabConfigProvider>
    </ThemeProvider>
    </TocProvider>
  );
}

export default App;
