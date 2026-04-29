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
      // Y alto amplifica tensão
      return 0.3 + y * 0.7;
    case 'opening':
      // Y alto abre levemente
      return 0.6 + y * 0.4;
    case 'anchor':
      // Sempre forte, Y baixo reforça levemente
      return 1.0 - y * 0.2;
    case 'resolution':
      // Y baixo reforça resolução
      return 0.9 - y * 0.4;
    case 'shadow':
      // Centro do Y — nem repouso nem tensão
      return 0.5 - Math.abs(y - 0.5) * 0.3;
    case 'color':
    case 'motion':
    default:
      return 1.0; // neutro
  }
}

/**
 * Compute gravitational attraction of rawFreq toward a scale note.
 * Higher weight + lower distance = stronger pull.
 * epsilon prevents singularity at exact match.
 */
function computeAttraction(
  rawFreq: number,
  note: ScaleNote,
  y: number
): number {
  const distance = Math.abs(rawFreq - note.freq);
  const roleWeight = getRoleWeight(note.role, y);
  // Epsilon proportional to note frequency (5%) — prevents glitching in high octaves
  // where a fixed 8 Hz epsilon becomes negligible relative to semitone distances
  const epsilon = note.freq * 0.05;
  return (note.weight * roleWeight) / (distance + epsilon);
}

/**
 * Winner-takes-all: returns the frequency with highest gravitational pull.
 * The note that wins is not necessarily the closest — it is the most
 * influential given its weight, role, and the current Y position.
 */
export function resolveFrequency(
  rawFreq: number,
  scaleNotes: ScaleNote[],
  y: number
): number {
  let bestFreq = rawFreq;
  let bestPull = 0;

  for (const note of scaleNotes) {
    const pull = computeAttraction(rawFreq, note, y);
    if (pull > bestPull) {
      bestPull = pull;
      bestFreq = note.freq;
    }
  }

  return bestFreq;
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
