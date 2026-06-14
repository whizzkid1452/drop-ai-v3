import { createTheme } from '@vanilla-extract/css';

export const [appThemeClass, vars] = createTheme({
  color: {
    background: '#111315',
    panel: '#181b1f',
    panelRaised: '#20242a',
    border: '#303640',
    borderStrong: '#46505c',
    text: '#eef1f2',
    textMuted: '#a6adb4',
    accent: '#3dd6a3',
    accentStrong: '#f0c351',
    surfaceHighlight: '#26302f',
  },
  font: {
    body: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
  radius: {
    panel: '8px',
    control: '6px',
  },
  space: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    xxl: '32px',
  },
});
