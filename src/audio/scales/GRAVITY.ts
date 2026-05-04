// SØNA Touch 01 — Tonal Gravity
// Gravidade deforma o caminho, não substitui a nota mais próxima.
// Uma tônica distante pode atrair mais que uma nota de passagem próxima.
// Y axis (0 = bottom/rest, 1 = top/tension) modulates role weights.

import { NoteRole } from './SCALES';
import { ScaleNote } from './TUNING';

// How each role responds to Y position (tension axis)
function getRoleWeight(role: NoteRole, y: number): number {
  switch (role) {
    case 'tension':
      return 0.3 + y * 0.7;
    case 'opening':
      return 0.6 + y * 0.4;
    case 'anchor':
      return 1.0 - y * 0.2;
    case 'resolution':
      return 0.9 - y * 0.4;
    case 'shadow':
      return 0.5 - Math.abs(y - 0.5) * 0.3;
    case 'color':
    case 'motion':
    default:
      return 1.0;
  }
}

/**
 * Compute gravitational attraction of rawFreq toward a scale note.
 * Distance squared — gravity falls off rapidly, each note dominates only its
 * immediate neighborhood. Prevents anchors from consuming multiple pad regions.
 */
function computeAttraction(
  rawFreq: number,
  note: ScaleNote,
  y: number
): number {
  const distance = Math.abs(rawFreq - note.freq);
  const roleWeight = getRoleWeight(note.role, y);
  const epsilon = note.freq * 0.05;
  return (note.weight * roleWeight) / (distance * distance + epsilon * epsilon);
}

/**
 * Winner-takes-all: returns the full ScaleNote with highest gravitational pull.
 * Returns null if no scale notes provided (chromatic mode).
 */
export function resolveNote(
  rawFreq: number,
  scaleNotes: ScaleNote[],
  y: number
): ScaleNote | null {
  if (scaleNotes.length === 0) return null;

  let bestNote: ScaleNote = scaleNotes[0];
  let bestPull = 0;

  for (const note of scaleNotes) {
    const pull = computeAttraction(rawFreq, note, y);
    if (pull > bestPull) {
      bestPull = pull;
      bestNote = note;
    }
  }

  return bestNote;
}

/**
 * Backward-compat wrapper: returns just the frequency.
 */
export function resolveFrequency(
  rawFreq: number,
  scaleNotes: ScaleNote[],
  y: number
): number {
  const note = resolveNote(rawFreq, scaleNotes, y);
  return note ? note.freq : rawFreq;
}

/**
 * Blend rawFreq toward resolvedFreq based on gesture velocity.
 * Slow gesture → strong snap to scale.
 * Fast gesture → more continuous / glissando.
 *
 * @param velocity normalized 0-1 (0 = still, 1 = fast)
 */
export function applyVelocityModulation(
  rawFreq: number,
  resolvedFreq: number,
  velocity: number
): number {
  const snap = 1 - Math.min(velocity, 1);
  return rawFreq + (resolvedFreq - rawFreq) * snap;
}
