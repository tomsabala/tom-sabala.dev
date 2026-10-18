/**
 * Shared form chrome for every dialog in the admin console.
 *
 * House style from the design handoff: zero border-radius, 1px borders, no shadows, mono
 * for every label, number and button. Inputs are 16px so iOS does not zoom the page on
 * focus — the console is used from a phone.
 */

export const DIALOG_TITLE =
  "font-display font-extrabold uppercase text-[26px] leading-none tracking-[-0.02em] m-0 [font-stretch:115%]";

export const LABEL =
  'block font-mono text-[10px] leading-none uppercase tracking-[0.12em] text-mut mb-2';

export const FIELD =
  'w-full bg-bg text-ink border border-ln2 px-3 py-2.5 text-[16px] leading-snug ' +
  'focus:outline-none focus:border-acct placeholder:text-mut';

/** `!` is required: this is appended to `FIELD`, so it must beat `FIELD`'s `border-ln2`. */
export const FIELD_ERROR = '!border-[#b3261e] focus:!border-[#b3261e]';

export const FIELD_MONO = `${FIELD} font-mono text-[14px]`;

export const HINT = 'mt-1.5 font-mono text-[11px] leading-[1.4] text-mut';

export const ERROR_TEXT = 'mt-1.5 font-mono text-[11px] leading-[1.4] text-[#b3261e]';

export const ERROR_BOX =
  'border border-[#b3261e] px-3 py-2.5 font-mono text-[12px] leading-[1.45] text-[#b3261e]';

export const BTN_PRIMARY =
  'bg-acc text-onacc border-0 font-mono text-[12px] leading-none font-medium uppercase ' +
  'tracking-[0.06em] px-4 py-3 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ' +
  'inline-flex items-center justify-center gap-2';

export const BTN_GHOST =
  'bg-transparent text-ink border border-ink font-mono text-[12px] leading-none font-medium ' +
  'uppercase tracking-[0.06em] px-4 py-[11px] cursor-pointer disabled:opacity-50 ' +
  'disabled:cursor-not-allowed inline-flex items-center justify-center gap-2';

export const BTN_MUTED =
  'bg-transparent text-mut border border-ln2 font-mono text-[12px] leading-none font-medium ' +
  'uppercase tracking-[0.06em] px-4 py-[11px] cursor-pointer disabled:opacity-50 ' +
  'disabled:cursor-not-allowed inline-flex items-center justify-center gap-2';

/** Small bordered mono chip used for tags, statuses and inline toggles. */
export const CHIP =
  'font-mono text-[10px] leading-none uppercase tracking-[0.1em] border border-ln2 px-2 py-1.5';
