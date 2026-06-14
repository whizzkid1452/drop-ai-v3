import { style } from '@vanilla-extract/css';
import { vars } from '../theme.css';

export const terminalHost = style({
  height: 280,
  minHeight: 220,
  overflow: 'hidden',
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.control,
  padding: vars.space.sm,
  background: '#101214',
});
