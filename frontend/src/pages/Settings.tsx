import { useState, useEffect } from 'react';
import { getTabConfigs, updateTabConfigs } from '../repositories/settingsRepository.ts';
import type { TabConfigs } from '../types/index.ts';
import { useToc } from '../contexts/TocContext.tsx';

const TAB_META: Array<{ key: string; label: string; path: string; description: string; icon: React.ReactNode }> = [
  {
    key: 'home',
    label: 'Home',
    path: '/',
    description: 'Personal overview and intro',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    key: 'portfolio',
    label: 'Portfolio',
    path: '/portfolio',
    description: 'Projects and work samples',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
  },
  {
    key: 'cv',
    label: 'CV',
    path: '/cv',
    description: 'Resume and experience',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
  },
  {
    key: 'contact',
    label: 'Contact',
    path: '/contact',
    description: 'Contact form',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
        <polyline points="22,6 12,13 2,6"/>
      </svg>
    ),
  },
  {
    key: 'github',
    label: 'GitHub',
    path: '/github-stats',
    description: 'GitHub contribution stats',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="4" height="18" rx="1"/>
        <rect x="9" y="8" width="4" height="13" rx="1"/>
        <rect x="16" y="13" width="4" height="8" rx="1"/>
      </svg>
    ),
  },
];

function Settings() {
  const { setToc, setTocTitle } = useToc();
  const [saved, setSaved] = useState<TabConfigs>({});
  const [draft, setDraft] = useState<TabConfigs>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewAs, setPreviewAs] = useState<'visitor' | 'admin'>('visitor');

  useEffect(() => {
    setToc([]);
    setTocTitle('');
  }, [setToc, setTocTitle]);

  useEffect(() => {
    getTabConfigs()
      .then(configs => {
        setSaved(configs);
        setDraft(configs);
      })
      .catch(() => {
        setSaved({});
        setDraft({});
      })
      .finally(() => setLoading(false));
  }, []);

  const isDirty = JSON.stringify(draft) !== JSON.stringify(saved);

  const isVisible = (key: string) => draft[key] !== false;

  const toggleTab = (key: string) => {
    setDraft(prev => ({ ...prev, [key]: !isVisible(key) }));
  };

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg(null);
    try {
      const res = await updateTabConfigs(draft);
      if (res.success) {
        setSaved(draft);
        setSuccessMsg('Settings saved. Changes will apply to visitors on their next page load.');
        setTimeout(() => setSuccessMsg(null), 5000);
      } else {
        setErrorMsg(res.error || 'Failed to save settings');
      }
    } catch {
      setErrorMsg('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const previewItems = previewAs === 'admin'
    ? TAB_META
    : TAB_META.filter(tab => isVisible(tab.key));

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-4rem)]">
        <div className="text-xl text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="py-6 sm:py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-[#252525] rounded-lg shadow-md border border-transparent dark:border-gray-700 p-4 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Settings
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Manage what sections are visible to public visitors.
          </p>

          {successMsg && (
            <div role="status" className="mb-6 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-300 text-sm">
              {successMsg}
            </div>
          )}
          {errorMsg && (
            <div role="alert" className="mb-6 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
              {errorMsg}
            </div>
          )}

          {/* Admin note */}
          <div className="mb-6 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg text-blue-700 dark:text-blue-300 text-sm flex items-start gap-2">
            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            You (admin) always see all tabs regardless of these settings.
          </div>

          <div className="flex flex-col lg:flex-row gap-8">
            {/* LEFT: checkbox list */}
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-4">
                Visibility Settings
              </h2>
              <div className="space-y-2">
                {TAB_META.map(tab => {
                  const visible = isVisible(tab.key);
                  const isHomeHidden = tab.key === 'home' && !visible;
                  return (
                    <div key={tab.key}>
                      <label
                        className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        htmlFor={`tab-toggle-${tab.key}`}
                      >
                        <input
                          id={`tab-toggle-${tab.key}`}
                          type="checkbox"
                          checked={visible}
                          onChange={() => toggleTab(tab.key)}
                          className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 cursor-pointer"
                          style={{ accentColor: 'var(--accent)' }}
                        />
                        <span className="text-gray-500 dark:text-gray-400 flex-shrink-0">
                          {tab.icon}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                            {tab.label}
                          </span>
                          <span className="block text-xs text-gray-500 dark:text-gray-400">
                            {tab.description}
                          </span>
                        </span>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                            visible
                              ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                          }`}
                        >
                          {visible ? 'Visible' : 'Hidden'}
                        </span>
                      </label>
                      {isHomeHidden && (
                        <p className="mt-1 ml-3 text-xs text-amber-600 dark:text-amber-400">
                          Visitors who navigate to / directly will still reach this page.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 flex items-center gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving || !isDirty}
                  className="px-5 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-sm font-medium"
                  style={{ background: 'var(--accent)' }}
                  onMouseEnter={e => !e.currentTarget.disabled && (e.currentTarget.style.background = 'var(--accent-hover)')}
                  onMouseLeave={e => !e.currentTarget.disabled && (e.currentTarget.style.background = 'var(--accent)')}
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
                {isDirty && !saving && (
                  <button
                    onClick={() => setDraft(saved)}
                    className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                  >
                    Discard
                  </button>
                )}
                {isDirty && (
                  <span className="text-xs text-amber-600 dark:text-amber-400">Unsaved changes</span>
                )}
              </div>
            </div>

            {/* RIGHT: live preview */}
            <div className="lg:w-64 flex-shrink-0">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Preview
                </h2>
                {/* Visitor / Admin toggle */}
                <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-xs">
                  {(['visitor', 'admin'] as const).map(role => (
                    <button
                      key={role}
                      onClick={() => setPreviewAs(role)}
                      className={`px-2.5 py-1 transition-colors capitalize ${
                        previewAs === role
                          ? 'text-white'
                          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                      style={previewAs === role ? { background: 'var(--accent)' } : undefined}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mini sidebar preview */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-[#1a1a1a]">
                {/* Mini logo row */}
                <div className="flex items-center gap-2 px-3 h-10 border-b border-gray-100 dark:border-gray-700">
                  <div className="w-5 h-5 rounded bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 truncate">Tom Sabała</span>
                </div>

                {/* Mini nav items */}
                <div className="py-2">
                  {previewItems.length === 0 ? (
                    <p className="px-3 py-4 text-xs text-gray-400 dark:text-gray-500 text-center">
                      No tabs visible to visitors
                    </p>
                  ) : (
                    previewItems.map((tab, i) => {
                      const hiddenForPublic = !isVisible(tab.key);
                      return (
                        <div
                          key={tab.key}
                          className={`flex items-center gap-2 px-3 py-1.5 mx-1 rounded-md transition-colors ${
                            i === 0
                              ? 'bg-blue-50 dark:bg-blue-950'
                              : ''
                          } ${hiddenForPublic ? 'opacity-40' : ''}`}
                          style={i === 0 ? { color: 'var(--accent)' } : { color: '#9ca3af' }}
                        >
                          {tab.icon}
                          <span className="text-xs font-medium">{tab.label}</span>
                          {hiddenForPublic && previewAs === 'admin' && (
                            <span className="ml-auto text-[10px] bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1 rounded">
                              ADMIN
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                {previewAs === 'visitor'
                  ? 'What public visitors see in the nav'
                  : 'What you (admin) always see'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;
