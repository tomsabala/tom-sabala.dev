import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3';
import { Analytics } from '@vercel/analytics/react';
import { ThemeProvider } from './contexts/ThemeContext.tsx';
import Layout from './components/Layout.tsx';
import Home from './pages/Home.tsx';
import Portfolio from './pages/Portfolio.tsx';
import CV from './pages/CV.tsx';
import Contact from './pages/Contact.tsx';
import ProjectDetail from './pages/ProjectDetail.tsx';

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_V3_SITE_KEY || '';

function App() {
  return (
    <ThemeProvider>
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
              <Route index element={<Home />} />
              <Route path="portfolio" element={<Portfolio />} />
              <Route path="portfolio/:id" element={<ProjectDetail />} />
              <Route path="cv" element={<CV />} />
              <Route path="contact" element={<Contact />} />
            </Route>
          </Routes>
        </Router>
        <Analytics />
      </GoogleReCaptchaProvider>
    </ThemeProvider>
  );
}

export default App;
