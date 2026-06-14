import { style } from '@vanilla-extract/css';
import { vars } from '../theme.css';

export const uploadShell = style({
  display: 'grid',
  minHeight: 'calc(100vh - 64px)',
  placeItems: 'center',
});

export const uploadPanel = style({
  width: 'min(720px, 100%)',
});

export const dropzone = style({
  display: 'grid',
  gap: vars.space.lg,
  border: `1px dashed ${vars.color.borderStrong}`,
  borderRadius: vars.radius.panel,
  padding: vars.space.xxl,
  background: vars.color.panel,
  color: vars.color.text,
  cursor: 'pointer',
  textAlign: 'left',
  transition: 'border-color 120ms ease, background 120ms ease',
  selectors: {
    '&:hover': {
      borderColor: vars.color.accent,
      background: vars.color.surfaceHighlight,
    },
    '&:focus-within': {
      borderColor: vars.color.accent,
    },
  },
});

export const dropzoneDisabled = style({
  cursor: 'wait',
  opacity: 0.74,
});

export const title = style({
  margin: 0,
  fontSize: 28,
  lineHeight: 1.15,
});

export const description = style({
  margin: 0,
  color: vars.color.textMuted,
  lineHeight: 1.6,
});

export const fileInput = style({
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
});

export const actionText = style({
  width: 'fit-content',
  border: `1px solid ${vars.color.accent}`,
  borderRadius: vars.radius.control,
  padding: `${vars.space.md} ${vars.space.lg}`,
  background: vars.color.accent,
  color: '#07100d',
  fontWeight: 700,
});

export const message = style({
  minHeight: 20,
  margin: `${vars.space.md} 0 0`,
  color: vars.color.accentStrong,
  fontFamily: vars.font.mono,
  fontSize: 13,
});
