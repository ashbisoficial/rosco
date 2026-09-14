// Alfabeto completo A-Z (26 letras, sin Ñ), para roscos en formato "gamer".
export const ROSCO_LETTERS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N',
  'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
];

// Plantilla de preguntas por defecto: el host las edita antes de crear la partida.
export function buildDefaultLetters() {
  return ROSCO_LETTERS.map((id) => ({
    id,
    type: 'starts', // 'starts' = "Empieza por..." | 'contains' = "Contiene la..."
    clue: '',
    answer: '',
    status: 'pending', // 'pending' | 'correct' | 'wrong' | 'pass'
  }));
}

export const DEFAULT_DURATION_SECONDS = 240;

export function clueTypeLabel(type) {
  return type === 'contains' ? 'Contiene la' : 'Empieza por';
}
