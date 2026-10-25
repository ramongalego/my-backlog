import type { ComponentPropsWithoutRef } from 'react';

// The app's only raised surface: a slightly lighter block on the page
// background. No border or shadow; the tone change is the elevation.

const PADDING = {
  none: '',
  sm: 'p-4',
  md: 'p-5 sm:p-6',
};

export type PanelPadding = keyof typeof PADDING;

export const PANEL_SURFACE = 'bg-ink-900 rounded-xl';

export function Panel({
  padding = 'md',
  className = '',
  ...props
}: ComponentPropsWithoutRef<'div'> & { padding?: PanelPadding }) {
  return <div className={`${PANEL_SURFACE} ${PADDING[padding]} ${className}`} {...props} />;
}

export function panelPadding(padding: PanelPadding = 'md') {
  return PADDING[padding];
}
