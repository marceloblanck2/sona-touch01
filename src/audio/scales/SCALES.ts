// SØNA Touch 01 — Tonal Scales
// Each note carries interval (semitones), attraction weight, and perceptual role.
// Role defines emotional/functional identity within the field — not just music theory.

export type NoteRole =
  | 'anchor'      // repouso — máxima atração, tônica e quinta
  | 'color'       // identidade emocional — terça, sexta
  | 'motion'      // passagem — atração baixa, fluxo
  | 'shadow'      // escurecimento — tensão fria, b6
  | 'opening'     // expansão — sétima menor, abertura
  | 'tension'     // instabilidade — sensível, b2, tensão alta
  | 'resolution'; // retorno — movimento de volta à tônica

export interface TonalNote {
  interval: number;   // semitones from root
  weight: number;     // base attraction strength (0.0 – 1.0)
  role: NoteRole;
}

export type ScaleDefinition = TonalNote[];

export const SCALES: Record<string, ScaleDefinition | null> = {

  // null = chromatic / no quantization
  chromatic: null,

  // A B C D E F G
  natural_minor: [
    { interval: 0,  weight: 1.0, role: 'anchor' },
    { interval: 2,  weight: 0.4, role: 'motion' },
    { interval: 3,  weight: 0.7, role: 'color' },
    { interval: 5,  weight: 0.4, role: 'motion' },
    { interval: 7,  weight: 0.9, role: 'anchor' },
    { interval: 8,  weight: 0.5, role: 'shadow' },
    { interval: 10, weight: 0.5, role: 'opening' },
  ],

  // C D E F G A B
  major: [
    { interval: 0,  weight: 1.0, role: 'anchor' },
    { interval: 2,  weight: 0.5, role: 'motion' },
    { interval: 4,  weight: 0.8, role: 'color' },
    { interval: 5,  weight: 0.5, role: 'motion' },
    { interval: 7,  weight: 0.9, role: 'anchor' },
    { interval: 9,  weight: 0.6, role: 'opening' },
    { interval: 11, weight: 0.4, role: 'tension' },
  ],

  // D E F G A Bb C# — intervalo exótico C# cria tensão ritual
  harmonic_minor: [
    { interval: 0,  weight: 1.0, role: 'anchor' },
    { interval: 2,  weight: 0.4, role: 'motion' },
    { interval: 3,  weight: 0.6, role: 'color' },
    { interval: 5,  weight: 0.4, role: 'motion' },
    { interval: 7,  weight: 0.8, role: 'anchor' },
    { interval: 8,  weight: 0.3, role: 'shadow' },
    { interval: 11, weight: 0.9, role: 'tension' }, // sensível — máxima tensão
  ],
};
