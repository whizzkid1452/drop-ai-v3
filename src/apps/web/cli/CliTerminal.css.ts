import { style } from '@vanilla-extract/css';
import { vars } from '../theme.css';

export const cliSurface = style({
  display: 'grid',
  gap: vars.space.lg,
});

export const commandButtonPanel = style({
  display: 'grid',
  gap: vars.space.lg,
});

export const commandGroup = style({
  display: 'grid',
  gap: vars.space.sm,
});

export const commandGroupTitle = style({
  margin: 0,
  color: vars.color.textMuted,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 0,
  textTransform: 'uppercase',
});

export const commandButtonGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: vars.space.sm,
});

export const commandButton = style({
  minHeight: 42,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.control,
  padding: `${vars.space.sm} ${vars.space.md}`,
  overflowWrap: 'anywhere',
  background: vars.color.panelRaised,
  color: vars.color.text,
  cursor: 'pointer',
  fontFamily: vars.font.mono,
  fontSize: 12,
  lineHeight: 1.35,
  textAlign: 'left',
  transition:
    'background 120ms ease, border-color 120ms ease, color 120ms ease',
  selectors: {
    '&:hover': {
      borderColor: vars.color.accent,
      background: vars.color.surfaceHighlight,
      color: vars.color.accentStrong,
    },
    '&:focus-visible': {
      outline: `2px solid ${vars.color.accent}`,
      outlineOffset: 2,
    },
  },
});

export const terminalHost = style({
  height: 280,
  minHeight: 220,
  overflow: 'hidden',
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.control,
  padding: vars.space.sm,
  background: '#101214',
});
