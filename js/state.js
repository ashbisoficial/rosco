import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js';
import {
  getFirestore,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const GAMES_COLLECTION = 'rosco_games';

export function gameDocRef(roomId) {
  return doc(db, GAMES_COLLECTION, roomId);
}

export function createGame(roomId, state) {
  return setDoc(gameDocRef(roomId), state);
}

export function updateGame(roomId, partialState) {
  return updateDoc(gameDocRef(roomId), partialState);
}

export function watchGame(roomId, onChange, onError) {
  return onSnapshot(gameDocRef(roomId), (snap) => {
    onChange(snap.exists() ? snap.data() : null);
  }, onError);
}

export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin caracteres ambiguos
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// --- Helpers de tiempo, compartidos entre control y overlay ---

export function computeRemainingSeconds(timer) {
  if (!timer) return 0;
  if (!timer.running) return Math.max(0, timer.remainingSeconds);
  const elapsed = (Date.now() - timer.startedAt) / 1000;
  return Math.max(0, timer.remainingSeconds - elapsed);
}

export function formatTime(totalSeconds) {
  const s = Math.ceil(totalSeconds);
  const mm = Math.floor(s / 60).toString().padStart(2, '0');
  const ss = (s % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

export function computeScore(letters) {
  return letters.reduce(
    (acc, l) => {
      if (l.status === 'correct') acc.correct++;
      else if (l.status === 'wrong') acc.wrong++;
      else if (l.status === 'pass') acc.pass++;
      else acc.pending++;
      return acc;
    },
    { correct: 0, wrong: 0, pass: 0, pending: 0 },
  );
}
