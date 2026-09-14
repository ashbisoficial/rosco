import { buildDefaultLetters, DEFAULT_DURATION_SECONDS, clueTypeLabel } from './rosco-data.js?v=4';
import {
  createGame,
  updateGame,
  watchGame,
  generateRoomCode,
  computeRemainingSeconds,
  formatTime,
  computeScore,
} from './state.js?v=4';

const LOCAL_STORAGE_KEY = 'rosco_last_questions';

const setupScreen = document.getElementById('setupScreen');
const gameScreen = document.getElementById('gameScreen');
const setupTableBody = document.getElementById('setupTableBody');
const lettersList = document.getElementById('lettersList');
const roomBadge = document.getElementById('roomBadge');
const roomCodeLabel = document.getElementById('roomCodeLabel');

let letters = buildDefaultLetters();
let roomId = null;
let activeIndex = -1;
let unsubscribe = null;
let tickTimer = null;
let isEditingLive = false;

// ---------- Pantalla de configuración ----------

function renderSetupTable() {
  setupTableBody.innerHTML = '';
  letters.forEach((letter, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${letter.id}</td>
      <td>
        <select data-field="type" data-index="${index}">
          <option value="starts" ${letter.type === 'starts' ? 'selected' : ''}>Empieza por</option>
          <option value="contains" ${letter.type === 'contains' ? 'selected' : ''}>Contiene la</option>
        </select>
      </td>
      <td><input type="text" data-field="clue" data-index="${index}" value="${escapeAttr(letter.clue)}" placeholder="Escribí la pregunta..." /></td>
      <td><input type="text" data-field="answer" data-index="${index}" value="${escapeAttr(letter.answer)}" placeholder="Respuesta" /></td>
    `;
    setupTableBody.appendChild(tr);
  });
}

function escapeAttr(value) {
  return (value || '').replace(/"/g, '&quot;');
}

setupTableBody.addEventListener('input', (e) => {
  const field = e.target.dataset.field;
  const index = Number(e.target.dataset.index);
  if (field === undefined || Number.isNaN(index)) return;
  letters[index][field] = e.target.value;
});

document.getElementById('loadSavedBtn').addEventListener('click', () => {
  const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!saved) {
    alert('No hay preguntas guardadas todavía.');
    return;
  }
  letters = JSON.parse(saved).map((l) => ({ ...l, status: 'pending' }));
  renderSetupTable();
});

document.getElementById('exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(letters, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'rosco-preguntas.json';
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('importBtn').addEventListener('click', () => {
  document.getElementById('importFile').click();
});

document.getElementById('importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  try {
    const parsed = JSON.parse(text);
    letters = parsed.map((l) => ({ ...l, status: 'pending' }));
    renderSetupTable();
  } catch (err) {
    alert('El archivo no es un JSON válido.');
  }
  e.target.value = '';
});

document.getElementById('editQuestionsBtn').addEventListener('click', () => {
  isEditingLive = true;
  renderSetupTable();
  document.getElementById('roomInputLabel').hidden = true;
  document.getElementById('startGameBtn').textContent = '💾 Guardar cambios y volver';
  gameScreen.hidden = true;
  setupScreen.hidden = false;
});

document.getElementById('startGameBtn').addEventListener('click', async () => {
  if (isEditingLive) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(letters));

    const updates = { letters };
    if (!localTimer.running) {
      const minutes = Number(document.getElementById('durationInput').value) || localTimer.durationSeconds / 60;
      const duration = Math.round(minutes * 60);
      localTimer = { ...localTimer, durationSeconds: duration, remainingSeconds: duration };
      updates.timer = localTimer;
    }

    await updateGame(roomId, updates);

    isEditingLive = false;
    document.getElementById('roomInputLabel').hidden = false;
    document.getElementById('startGameBtn').textContent = 'Crear partida y empezar a jugar';
    setupScreen.hidden = true;
    gameScreen.hidden = false;
    renderGameList();
    renderScore();
    return;
  }

  const minutes = Number(document.getElementById('durationInput').value) || DEFAULT_DURATION_SECONDS / 60;
  const duration = Math.round(minutes * 60);
  roomId = (document.getElementById('roomInput').value || '').trim().toUpperCase() || generateRoomCode();

  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(letters));

  const initialState = {
    letters: letters.map((l) => ({ ...l, status: 'pending' })),
    activeLetterId: null,
    timer: {
      durationSeconds: duration,
      remainingSeconds: duration,
      running: false,
      startedAt: null,
    },
    finished: false,
  };

  await createGame(roomId, initialState);
  letters = initialState.letters;

  roomCodeLabel.textContent = roomId;
  roomBadge.hidden = false;
  setupScreen.hidden = true;
  gameScreen.hidden = false;

  renderGameList();
  startWatching();
  startTicker();
});

// ---------- Pantalla de juego ----------

function renderGameList() {
  lettersList.innerHTML = '';
  letters.forEach((letter, index) => {
    const li = document.createElement('li');
    li.className = `letter-row status-${letter.status}${index === activeIndex ? ' active' : ''}`;
    li.dataset.index = index;
    li.innerHTML = `
      <span class="badge">${letter.id}</span>
      <span class="clue-text">${clueTypeLabel(letter.type)} ${letter.id}: ${letter.clue || '(sin pregunta)'}</span>
      <span class="row-actions">
        <button type="button" data-action="correct" title="Correcto (C)">✅</button>
        <button type="button" data-action="wrong" title="Incorrecto (X)">❌</button>
        <button type="button" data-action="pass" title="Pasapalabra (P)">⏭️</button>
        <button type="button" data-action="pending" title="Reiniciar letra">⬜</button>
      </span>
    `;
    lettersList.appendChild(li);
  });
}

lettersList.addEventListener('click', (e) => {
  const row = e.target.closest('.letter-row');
  if (!row) return;
  const index = Number(row.dataset.index);
  const action = e.target.dataset.action;
  if (action) {
    resolveLetter(index, action);
  } else {
    setActiveLetter(index);
  }
});

function setActiveLetter(index) {
  activeIndex = index;
  updateGame(roomId, { activeLetterId: letters[index].id });
  renderGameList();
}

function findNextPendingIndex(fromIndex) {
  for (let step = 1; step <= letters.length; step++) {
    const idx = (fromIndex + step) % letters.length;
    if (letters[idx].status === 'pending') return idx;
  }
  return -1;
}

function resolveLetter(index, status) {
  letters[index].status = status;
  const finished = letters.every((l) => l.status !== 'pending');
  const nextIndex = findNextPendingIndex(index);
  activeIndex = nextIndex;

  const updates = {
    letters,
    activeLetterId: nextIndex >= 0 ? letters[nextIndex].id : null,
    finished,
  };

  if (finished && localTimer.running) {
    localTimer = { ...localTimer, running: false, remainingSeconds: computeRemainingSeconds(localTimer), startedAt: null };
    updates.timer = localTimer;
  }

  updateGame(roomId, updates);
  renderGameList();
  renderScore();
}

function renderScore() {
  const score = computeScore(letters);
  document.getElementById('scoreCorrect').textContent = score.correct;
  document.getElementById('scoreWrong').textContent = score.wrong;
  document.getElementById('scorePass').textContent = score.pass;
  document.getElementById('scorePending').textContent = score.pending;
}

document.addEventListener('keydown', (e) => {
  if (gameScreen.hidden) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    setActiveLetter((activeIndex + 1 + letters.length) % letters.length);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    setActiveLetter((activeIndex - 1 + letters.length) % letters.length);
  } else if (activeIndex >= 0 && ['c', 'C'].includes(e.key)) {
    resolveLetter(activeIndex, 'correct');
  } else if (activeIndex >= 0 && ['x', 'X'].includes(e.key)) {
    resolveLetter(activeIndex, 'wrong');
  } else if (activeIndex >= 0 && ['p', 'P'].includes(e.key)) {
    resolveLetter(activeIndex, 'pass');
  } else if (e.code === 'Space') {
    e.preventDefault();
    toggleTimer();
  }
});

// ---------- Timer ----------

let localTimer = { durationSeconds: DEFAULT_DURATION_SECONDS, remainingSeconds: DEFAULT_DURATION_SECONDS, running: false, startedAt: null };

function toggleTimer() {
  if (localTimer.running) {
    pauseTimer();
  } else {
    startTimer();
  }
}

function startTimer() {
  localTimer = { ...localTimer, running: true, startedAt: Date.now() };
  updateGame(roomId, { timer: localTimer });
}

function pauseTimer() {
  const remaining = computeRemainingSeconds(localTimer);
  localTimer = { ...localTimer, running: false, remainingSeconds: remaining, startedAt: null };
  updateGame(roomId, { timer: localTimer });
}

document.getElementById('timerStartBtn').addEventListener('click', startTimer);
document.getElementById('timerPauseBtn').addEventListener('click', pauseTimer);
document.getElementById('timerResetBtn').addEventListener('click', () => {
  localTimer = { ...localTimer, running: false, remainingSeconds: localTimer.durationSeconds, startedAt: null };
  updateGame(roomId, { timer: localTimer });
});

function startTicker() {
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = setInterval(() => {
    const remaining = computeRemainingSeconds(localTimer);
    document.getElementById('timerLabel').textContent = formatTime(remaining);
    if (localTimer.running && remaining <= 0) {
      localTimer = { ...localTimer, running: false, remainingSeconds: 0, startedAt: null };
      updateGame(roomId, { timer: localTimer, finished: true });
    }
  }, 250);
}

// ---------- Sincronización con Firestore ----------

function startWatching() {
  if (unsubscribe) unsubscribe();
  unsubscribe = watchGame(roomId, (state) => {
    if (!state) return;
    letters = state.letters;
    localTimer = state.timer;
    activeIndex = letters.findIndex((l) => l.id === state.activeLetterId);
    renderGameList();
    renderScore();
  });
}

document.getElementById('restartGameBtn').addEventListener('click', () => {
  if (!confirm('¿Reiniciar el rosco? Se borran los aciertos, fallos y pasapalabras, pero se mantienen las mismas preguntas y la misma sala.')) return;

  letters = letters.map((l) => ({ ...l, status: 'pending' }));
  activeIndex = -1;
  localTimer = { ...localTimer, running: false, remainingSeconds: localTimer.durationSeconds, startedAt: null };

  updateGame(roomId, {
    letters,
    activeLetterId: null,
    finished: false,
    timer: localTimer,
  });

  renderGameList();
  renderScore();
});

document.getElementById('newGameBtn').addEventListener('click', () => {
  if (!confirm('¿Terminar esta partida y volver a la configuración?')) return;
  if (unsubscribe) unsubscribe();
  if (tickTimer) clearInterval(tickTimer);
  roomId = null;
  activeIndex = -1;
  roomBadge.hidden = true;
  gameScreen.hidden = true;
  setupScreen.hidden = false;
});

document.getElementById('copyOverlayLink').addEventListener('click', async () => {
  const url = new URL('overlay.html', window.location.href);
  url.searchParams.set('room', roomId);
  await navigator.clipboard.writeText(url.toString());
  alert('Enlace del overlay copiado. Pegalo como Browser Source en OBS.');
});

// ---------- Init ----------

renderSetupTable();
