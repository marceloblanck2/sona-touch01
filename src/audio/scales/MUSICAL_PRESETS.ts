// SØNA Touch 01 — Musical Presets
// Preset ≠ escala. Preset = campo perceptual com comportamento próprio.
// A escala é apenas uma camada de coerência tonal.
//
// "O gesto navega um campo. O preset define como esse campo se comporta."

export type FieldVisibility = 'hidden' | 'subtle' | 'debug';

export interface TonalField {
  id: string;
  name: string;
  emotionalCharacter: string;

  // Tonal configuration
  rootMidi: number;       // MIDI note number (A4 = 69 = 432 Hz)
  octaves: number;        // how many octaves span the field
  scaleKey: string;       // key into SCALES (null entry = chromatic/free)
  glideTime: number;      // seconds for pitch transition

  // Color field — hue arc from lowest to highest note
  hueStart: number;  // hue at lowest note (0–360°)
  hueEnd: number;    // hue at highest note (0–360°)

  // Visual field mode
  visualMode: FieldVisibility;
}

export const MUSICAL_PRESETS: TonalField[] = [
  {
    id: 'tonal-free',
    name: 'Livre — Cromático',
    emotionalCharacter: 'exploração livre, sem restrição tonal',
    rootMidi: 57,
    octaves: 4,
    scaleKey: 'chromatic',
    glideTime: 0.03,
    hueStart: 0,    // vermelho
    hueEnd: 260,    // violeta
    visualMode: 'hidden',
  },
  {
    id: 'tonal-a-minor',
    name: 'Lá menor — Melancolia Difusa',
    emotionalCharacter: 'melancolia difusa, introspecção',
    rootMidi: 57,    // A3 = 216 Hz — alinhado ao range do engine (216–864 Hz)
    octaves: 4,
    scaleKey: 'natural_minor',
    glideTime: 0.04,
    hueStart: 260,  // violeta
    hueEnd: 180,    // ciano
    visualMode: 'hidden',
  },
  {
    id: 'tonal-c-major',
    name: 'Dó maior — Clareza Aberta',
    emotionalCharacter: 'clareza, leveza, abertura',
    rootMidi: 60,    // C4 = 257 Hz — alinhado ao range do engine
    octaves: 4,
    scaleKey: 'major',
    glideTime: 0.04,
    hueStart: 30,   // laranja
    hueEnd: 140,    // verde
    visualMode: 'hidden',
  },
  {
    id: 'tonal-d-harmonic',
    name: 'Ré menor harmônica — Tensão Ritual',
    emotionalCharacter: 'tensão ritual, dramaticidade, C# como sensível',
    rootMidi: 62,    // D4 = 288 Hz — alinhado ao range do engine
    octaves: 4,
    scaleKey: 'harmonic_minor',
    glideTime: 0.05, // slightly slower glide — tensão que resolve devagar
    hueStart: 0,    // vermelho
    hueEnd: 300,    // magenta/violeta — tensão dramática
    visualMode: 'hidden',
  },
];
