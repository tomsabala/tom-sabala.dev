/**
 * Visibility: which sections a public visitor is served.
 *
 * The admin always sees everything, so these toggles only move the public nav and the
 * backend's `require_tab_visible` guard. `home` is listed because it is one of the backend's
 * tab keys, but it is permanently on — `TabConfigDAO.bulkUpsert` refuses to change it, and a
 * toggle that silently does nothing would be worse than a disabled one.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { JSX } from 'react';
import { getAdminTabConfigs, updateTabConfigs } from '../../repositories/settingsRepository.ts';
import { useTabConfig } from '../../contexts/TabConfigContext.tsx';
import { apiErrorMessage } from '../../repositories/apiError.ts';
import type { TabConfigs } from '../../types/index.ts';
import { useAdminChrome, usePrimaryAction } from './chrome.tsx';
import {
  ConsolePanel,
  EmptyState,
  MutedLine,
  PanelHead,
  SquareToggle,
} from '../../components/console.tsx';

interface SectionMeta {
  key: string;
  label: string;
  desc: string;
  /** Nav label a visitor would see; absent for sections with no nav entry. */
  nav?: string;
  locked?: boolean;
}

/** Order and copy from the design handoff, extended with the `github` key the backend has. */
const SECTIONS: SectionMeta[] = [
  { key: 'home', label: 'Hero field', desc: 'The live field and the dock. Always on.', locked: true },
  { key: 'work', label: 'Selected work', desc: 'Section 01 and project detail pages', nav: 'Work' },
  { key: 'hangar', label: 'The hangar', desc: 'Section 02, links to apps.tom-sabala.dev', nav: 'Hangar' },
  { key: 'about', label: 'About + CV', desc: 'Section 03, PDF download and skill polygons', nav: 'About' },
  { key: 'contact', label: 'Contact', desc: 'Section 04 and the contact form', nav: 'Contact' },
  { key: 'terminal', label: 'Terminal link', desc: 'terminal.tom-sabala.dev in nav and footer', nav: '>_ terminal' },
  { key: 'github', label: 'GitHub activity', desc: 'The contribution strip inside About', nav: undefined },
];

export default function AdminVisibility(): JSX.Element {
  const { notify } = useAdminChrome();
  const { refreshTabConfigs } = useTabConfig();
  const [configs, setConfigs] = useState<TabConfigs>({});
  const [saved, setSaved] = useState<TabConfigs>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAdminTabConfigs()
      .then(next => {
        if (cancelled) return;
        setConfigs(next);
        setSaved(next);
      })
      .catch(error => {
        if (!cancelled) notify('err', apiErrorMessage(error, 'Failed to load tab visibility.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
    // notify is stable for the console's lifetime; re-running would re-fetch on every notice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dirty = useMemo(
    () => SECTIONS.some(s => !s.locked && (configs[s.key] ?? true) !== (saved[s.key] ?? true)),
    [configs, saved],
  );

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const payload: TabConfigs = {};
      for (const section of SECTIONS) {
        if (section.locked) continue;
        payload[section.key] = configs[section.key] ?? true;
      }
      const response = await updateTabConfigs(payload);
      const next: TabConfigs = response?.success && response.data ? response.data : payload;
      setConfigs(next);
      setSaved(next);
      refreshTabConfigs();
      notify('ok', 'Visibility saved.');
    } catch (error) {
      notify('err', apiErrorMessage(error, 'Failed to save tab visibility.'));
    } finally {
      setSaving(false);
    }
  }, [configs, notify, refreshTabConfigs]);

  usePrimaryAction(
    {
      label: saving ? 'Saving…' : 'Save changes',
      onClick: save,
      disabled: saving || loading || !dirty,
      title: dirty ? undefined : 'Nothing changed yet',
    },
    [saving, loading, dirty, save],
  );

  const visibleNav = SECTIONS.filter(s => s.nav && (configs[s.key] ?? true)).map(s => s.nav as string);

  return (
    <div className="grid gap-5 items-start grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px]">
      <ConsolePanel>
        <PanelHead label="PUBLIC VISIBILITY · YOU ALWAYS SEE EVERYTHING" />
        {loading ? (
          <EmptyState>Loading…</EmptyState>
        ) : (
          SECTIONS.map(section => {
            const on = section.locked ? true : configs[section.key] ?? true;
            return (
              <div
                key={section.key}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-center px-5 py-3.5 border-b border-ln"
              >
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="font-bold text-[16px]">{section.label}</span>
                  <span className="font-mono text-[11px] leading-[1.3] text-mut">{section.desc}</span>
                </div>
                <SquareToggle
                  on={on}
                  disabled={section.locked}
                  title={section.locked ? 'The hero is always public' : undefined}
                  label={`${section.label} visible to visitors`}
                  onChange={() => setConfigs(prev => ({ ...prev, [section.key]: !on }))}
                />
              </div>
            );
          })
        )}
      </ConsolePanel>

      <ConsolePanel className="p-5 flex flex-col gap-3">
        <span className="font-mono text-[11px] leading-none font-medium text-acct tracking-[0.12em]">
          PREVIEW · VISITOR NAV
        </span>
        <div className="border border-ln p-3 flex flex-wrap gap-3 font-mono text-[12px] leading-none uppercase tracking-[0.06em]">
          {visibleNav.length > 0 ? (
            visibleNav.map(label => <span key={label}>{label}</span>)
          ) : (
            <span className="text-mut">nav empty</span>
          )}
        </div>
        <MutedLine>Changes apply to visitors on their next page load.</MutedLine>
      </ConsolePanel>
    </div>
  );
}
