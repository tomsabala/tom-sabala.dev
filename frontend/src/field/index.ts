/**
 * Public surface of the field engine. Pages import from here only.
 *
 *   <FieldProvider>
 *     <FieldCanvas />
 *     …page…
 *     <FieldDock />
 *     <LearnModal />
 *   </FieldProvider>
 */

export { PAL, A, MONO, grid, cross, type Pal } from './draw';
export { default as FieldCanvas } from './FieldCanvas';
export { default as FieldDock } from './FieldDock';
export { default as LearnModal } from './LearnModal';
export { FieldProvider, useField, useMediaQuery, type FieldContextValue } from './useField';
export { ALGOS, NAMES, HINTS, LEARN, SETTINGS, TOGGLES, TOOLS, CFG0, fieldCaps } from './config';
export type { FieldAlgo, FieldCaps, FieldCfg, FieldKind, FieldPointer, FieldTool, Pt } from './types';
