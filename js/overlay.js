import { ROSCO_LETTERS, clueTypeLabel } from './rosco-data.js';
import { watchGame, computeRemainingSeconds, formatTime, computeScore } from './state.js';

const connectForm = document.getElementById('connectForm');
const roscoStage = document.getElementById('roscoStage');
const roscoCircle = document.getElementById('roscoCircle');
const centerTimer = document.getElementById('centerTimer');
const centerClue = document.getElementById('centerClue');
const centerScore = document.getElementById('centerScore');
const finalBanner = document.getElementById('finalBanner');
const finalStats = document.getElementById('finalStats');

let currentTimer = null;
let letterNodes = new Map();

function buildCircle() {
  roscoCircle.innerHTML = '';
  letterNodes.clear();
  const total = ROSCO_LETTERS.length;
  const radius = 44; // % del contenedor

  ROSCO_LETTERS.forEach((id, index) => {
    const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
    const x = 50 + radius * Math.cos(angle);
    const y = 50 + radius * Math.sin(angle);

    const el = document.createElement('div');
    el.className = 'rosco-letter status-pending';
    el.style.left = `${x}%`;
    el.style.top = `${y}%`;
    el.textContent = id;
    roscoCircle.appendChild(el);
    letterNodes.set(id, el);
  });
}

function renderState(state) {
  if (!state) return;

  state.letters.forEach((letter) => {
    const node = letterNodes.get(letter.id);
    if (!node) return;
    node.className = `rosco-letter status-${letter.status}`;
    if (letter.id === state.activeLetterId) {
      node.classList.add('active');
    }
  });

  const activeLetter = state.letters.find((l) => l.id === state.activeLetterId);
  centerClue.textContent = activeLetter && activeLetter.clue
    ? `${clueTypeLabel(activeLetter.type)} ${activeLetter.id}: ${activeLetter.clue}`
    : '';

  const score = computeScore(state.letters);
  centerScore.textContent = `✅ ${score.correct}   ❌ ${score.wrong}   ⏭️ ${score.pass}`;

  currentTimer = state.timer;

  if (state.finished) {
    finalBanner.hidden = false;
    finalStats.textContent = `Aciertos: ${score.correct} · Fallos: ${score.wrong} · Pasapalabras: ${score.pass}`;
  } else {
    finalBanner.hidden = true;
  }
}

function tickTimer() {
  if (currentTimer) {
    centerTimer.textContent = formatTime(computeRemainingSeconds(currentTimer));
  }
  requestAnimationFrame(tickTimer);
}

function connect(roomId) {
  connectForm.hidden = true;
  roscoStage.hidden = false;
  buildCircle();
  watchGame(roomId, renderState, (err) => {
    console.error('Error de sincronización con Firestore:', err);
  });
  requestAnimationFrame(tickTimer);
}

// ---------- Init ----------

const params = new URLSearchParams(window.location.search);
const roomFromUrl = params.get('room');

if (roomFromUrl) {
  connect(roomFromUrl.trim().toUpperCase());
} else {
  document.getElementById('connectBtn').addEventListener('click', () => {
    const value = document.getElementById('roomInputOverlay').value.trim().toUpperCase();
    if (value) connect(value);
  });
}
