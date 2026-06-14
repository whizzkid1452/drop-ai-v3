import { globalStyle, style } from '@vanilla-extract/css';
import { appThemeClass, vars } from './theme.css';

globalStyle('*', {
  boxSizing: 'border-box',
});

globalStyle('body', {
  margin: 0,
  background: vars.color.background,
  color: vars.color.text,
  fontFamily: vars.font.body,
});

globalStyle('button', {
  font: 'inherit',
});

export const appShell = style([
  appThemeClass,
  {
    minHeight: '100vh',
    padding: vars.space.xxl,
    background: vars.color.background,
    color: vars.color.text,
  },
]);

export const hero = style({
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  gap: vars.space.xl,
  marginBottom: vars.space.xl,
});

export const eyebrow = style({
  margin: `0 0 ${vars.space.sm}`,
  color: vars.color.accent,
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: 0,
  textTransform: 'uppercase',
});

export const title = style({
  margin: 0,
  fontSize: 36,
  lineHeight: 1.05,
});

export const subtitle = style({
  maxWidth: 620,
  margin: `${vars.space.md} 0 0`,
  color: vars.color.textMuted,
  lineHeight: 1.6,
});

export const primaryButton = style({
  minWidth: 120,
  border: `1px solid ${vars.color.accent}`,
  borderRadius: vars.radius.control,
  padding: `${vars.space.md} ${vars.space.lg}`,
  background: vars.color.accent,
  color: '#07100d',
  cursor: 'pointer',
  fontWeight: 700,
  transition:
    'background 120ms ease, border-color 120ms ease, transform 120ms ease',
  selectors: {
    '&:hover': {
      background: '#6ee7bf',
      borderColor: '#6ee7bf',
      transform: 'translateY(-1px)',
    },
    '&:focus-visible': {
      outline: `2px solid ${vars.color.accentStrong}`,
      outlineOffset: 3,
    },
  },
});

export const layoutGrid = style({
  display: 'grid',
  gridTemplateColumns: 'minmax(260px, 360px) minmax(0, 1fr)',
  gap: vars.space.xl,
  alignItems: 'start',
  '@media': {
    'screen and (max-width: 860px)': {
      gridTemplateColumns: '1fr',
    },
  },
});

export const panel = style({
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.panel,
  padding: vars.space.lg,
  background: vars.color.panel,
});

export const terminalPanel = style([
  panel,
  {
    minWidth: 0,
  },
]);

export const sectionTitle = style({
  margin: `0 0 ${vars.space.lg}`,
  fontSize: 16,
});

export const summaryGrid = style({
  display: 'grid',
  gap: vars.space.md,
});

export const summaryItem = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: vars.space.lg,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.control,
  padding: `${vars.space.md} ${vars.space.lg}`,
  background: vars.color.panelRaised,
});

export const summaryLabel = style({
  color: vars.color.textMuted,
  fontSize: 13,
});

export const summaryValue = style({
  margin: 0,
  overflow: 'hidden',
  fontFamily: vars.font.mono,
  fontSize: 13,
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const commandMessage = style({
  margin: `${vars.space.lg} 0 0`,
  border: `1px solid ${vars.color.borderStrong}`,
  borderRadius: vars.radius.control,
  padding: `${vars.space.md} ${vars.space.lg}`,
  background: vars.color.surfaceHighlight,
  color: vars.color.accentStrong,
  fontFamily: vars.font.mono,
  fontSize: 13,
});

export const trackList = style({
  display: 'grid',
  gap: vars.space.sm,
  margin: `${vars.space.lg} 0 0`,
  padding: 0,
  listStyle: 'none',
});

export const trackRow = style({
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.control,
  padding: `${vars.space.md} ${vars.space.lg}`,
  background: '#15181c',
  color: vars.color.text,
});

export const loading = style({
  margin: 0,
  color: vars.color.textMuted,
  fontFamily: vars.font.mono,
  fontSize: 13,
});
