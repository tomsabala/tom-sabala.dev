import { registerCommand } from './registry';
import { ACCENT, DIM } from './output';
import type { CommandResult, TerminalContext } from './types';

registerCommand({
  name: 'field',
  description: 'Control the LiDAR scan pane',
  usage: 'field [on|off|reset]',
  execute: (args: string[], ctx: TerminalContext): CommandResult => {
    switch (args[0]) {
      case 'off':
        ctx.setFieldVisible(false);
        return { output: [{ text: 'field: scan pane hidden.', color: DIM }] };
      case 'on':
        ctx.setFieldVisible(true);
        return { output: [{ text: 'field: scan pane visible.', color: ACCENT }] };
      case 'reset':
        ctx.resetField();
        return { output: [{ text: 'field: world regenerated.', color: ACCENT }] };
      default:
        return {
          output: [
            { text: 'A rover with a 2D LiDAR explores a room it cannot see.', bold: true },
            { text: 'Every return is a cell it has observed; old returns fade.' },
            { text: '' },
            { text: `  field is ${ctx.isFieldVisible() ? 'on' : 'off'}`, color: DIM },
            { text: '  field on | off | reset', color: DIM },
          ],
        };
    }
  },
});
