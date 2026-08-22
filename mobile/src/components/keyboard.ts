/**
 * Breathing room between the focused input's bottom edge and the top of the
 * keyboard. Without it an input can sit flush against the keyboard, which reads
 * as "still covered" even though it technically is not.
 *
 * One constant, not one per screen: it was copied into three files and would
 * have drifted the moment anyone tuned it.
 */
export const KEYBOARD_BOTTOM_OFFSET = 24;
