/**
 * Shared status/dot palette for the bar's readout widgets.
 *
 * The widgets (CPU/RAM/battery/… and backgroundServices) used to hardcode
 * their own slate-and-traffic-light values (#ef4444, #fde047, #e5e7eb, …),
 * which silently duplicated the theme's slots and left them visually
 * off-system under adwaitadark / darkhighcontrast. Everything here maps to
 * SELECTED_THEME, so a theme switch re-colors every readout at once.
 */
import { SELECTED_THEME, withAlpha } from './theme';

export const STATUS = {
  /** Hot / failing state → the theme's error slot. */
  danger: SELECTED_THEME.error,
  /** Mid / charging state → the theme's warning slot. */
  warn:   SELECTED_THEME.warning,
  /** Good / running state → the theme's success slot. */
  ok:     SELECTED_THEME.success,
  /** Default resting text → the theme's primary text slot. */
  normal: SELECTED_THEME.textPrimary,
  /** Quiet / disabled readouts → the theme's disabled text slot. */
  idle:   SELECTED_THEME.textDisabled,
} as const;

/** Theme slot → translucent rgba() for alpha-variant fills (dims, halos). */
export function statusAlpha(hex: string, a: number): string {
  return withAlpha(hex, a);
}