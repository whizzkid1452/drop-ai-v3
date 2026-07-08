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

export const secondaryButton = style({
  minWidth: 120,
  border: `1px solid ${vars.color.borderStrong}`,
  borderRadius: vars.radius.control,
  padding: `${vars.space.md} ${vars.space.lg}`,
  background: vars.color.panelRaised,
  color: vars.color.text,
  cursor: 'pointer',
  fontWeight: 700,
  transition:
    'background 120ms ease, border-color 120ms ease, transform 120ms ease',
  selectors: {
    '&:hover:not(:disabled)': {
      borderColor: vars.color.accent,
      background: vars.color.surfaceHighlight,
      transform: 'translateY(-1px)',
    },
    '&:focus-visible': {
      outline: `2px solid ${vars.color.accentStrong}`,
      outlineOffset: 3,
    },
    '&:disabled': {
      cursor: 'not-allowed',
      opacity: 0.5,
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

export const sidePanelStack = style({
  display: 'grid',
  gap: vars.space.lg,
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

export const transportPanel = style([
  panel,
  {
    display: 'grid',
    gap: vars.space.md,
  },
]);

export const transportHeader = style({
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: vars.space.md,
});

export const transportTime = style({
  margin: 0,
  color: vars.color.textMuted,
  fontFamily: vars.font.mono,
  fontSize: 13,
  whiteSpace: 'nowrap',
});

export const transportButtonRow = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 44px)',
  gap: vars.space.sm,
});

export const transportIconButton = style({
  display: 'grid',
  width: 44,
  height: 40,
  placeItems: 'center',
  border: `1px solid ${vars.color.borderStrong}`,
  borderRadius: vars.radius.control,
  background: vars.color.panelRaised,
  color: vars.color.text,
  cursor: 'pointer',
  transition:
    'background 120ms ease, border-color 120ms ease, transform 120ms ease',
  selectors: {
    '&:hover:not(:disabled)': {
      borderColor: vars.color.accent,
      background: vars.color.surfaceHighlight,
      transform: 'translateY(-1px)',
    },
    '&:focus-visible': {
      outline: `2px solid ${vars.color.accentStrong}`,
      outlineOffset: 3,
    },
    '&:disabled': {
      cursor: 'not-allowed',
      opacity: 0.5,
    },
    '&[aria-pressed="true"]': {
      borderColor: vars.color.accent,
      background: vars.color.surfaceHighlight,
    },
  },
});

export const playIcon = style({
  width: 0,
  height: 0,
  marginLeft: 3,
  borderTop: '8px solid transparent',
  borderBottom: '8px solid transparent',
  borderLeft: `12px solid ${vars.color.text}`,
});

export const pauseIcon = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 5px)',
  gap: 4,
});

export const pauseBar = style({
  width: 5,
  height: 16,
  background: vars.color.text,
  borderRadius: 1,
});

export const stopIcon = style({
  width: 15,
  height: 15,
  borderRadius: 2,
  background: vars.color.text,
});

export const seekControl = style({
  display: 'grid',
  gap: vars.space.sm,
});

export const seekSlider = style({
  width: '100%',
  accentColor: vars.color.accent,
});

export const seekNumberControl = style({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 96px',
  alignItems: 'center',
  gap: vars.space.md,
});

export const seekNumberInput = style({
  width: '100%',
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.control,
  padding: `${vars.space.sm} ${vars.space.md}`,
  background: vars.color.panelRaised,
  color: vars.color.text,
  fontFamily: vars.font.mono,
  fontSize: 13,
});

export const transportError = style({
  margin: 0,
  color: vars.color.accentStrong,
  fontFamily: vars.font.mono,
  fontSize: 13,
});

export const loading = style({
  margin: 0,
  color: vars.color.textMuted,
  fontFamily: vars.font.mono,
  fontSize: 13,
});

export const agentPanel = style([
  panel,
  {
    display: 'grid',
    gap: vars.space.lg,
  },
]);

export const agentHeader = style({
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: vars.space.md,
});

export const agentStatus = style({
  margin: 0,
  color: vars.color.textMuted,
  fontFamily: vars.font.mono,
  fontSize: 12,
  whiteSpace: 'nowrap',
});

export const agentForm = style({
  display: 'grid',
  gap: vars.space.md,
});

export const agentInputLabel = style({
  display: 'grid',
  gap: vars.space.sm,
});

export const agentTextarea = style({
  width: '100%',
  minHeight: 92,
  resize: 'vertical',
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.control,
  padding: vars.space.md,
  background: vars.color.panelRaised,
  color: vars.color.text,
  font: 'inherit',
  lineHeight: 1.5,
  selectors: {
    '&:focus-visible': {
      outline: `2px solid ${vars.color.accentStrong}`,
      outlineOffset: 3,
    },
  },
});

export const agentStepList = style({
  display: 'grid',
  gap: vars.space.sm,
  margin: 0,
  padding: 0,
  listStyle: 'none',
});

export const agentStep = style({
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.control,
  padding: vars.space.md,
  background: vars.color.panelRaised,
});

export const agentStepHeader = style({
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: vars.space.md,
});

export const agentStepCommand = style({
  overflow: 'hidden',
  fontFamily: vars.font.mono,
  fontSize: 13,
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const agentReason = style({
  margin: `${vars.space.sm} 0 0`,
  color: vars.color.textMuted,
  fontSize: 13,
  lineHeight: 1.5,
});

export const agentPayload = style({
  overflow: 'auto',
  margin: `${vars.space.md} 0 0`,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.control,
  padding: vars.space.sm,
  background: '#101214',
  color: vars.color.text,
  fontFamily: vars.font.mono,
  fontSize: 12,
});

export const agentActionRow = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: vars.space.sm,
});
