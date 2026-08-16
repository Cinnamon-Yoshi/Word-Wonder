const socket = io();

const THEMES = {
  ocean: { bg: '#082f49', cardBg: '#0c4a6e', dieBg: '#0369a1', accent: '#38bdf8' },
  purple: { bg: '#2e1065', cardBg: '#3b0764', dieBg: '#6b21a8', accent: '#c084fc' },
  slate: { bg: '#0f172a', cardBg: '#1e293b', dieBg: '#334155', accent: '#38bdf8' },
  forest: { bg: '#022c22', cardBg: '#064e3b', dieBg: '#047857', accent: '#34d399' },
  crimson: { bg: '#450a0a', cardBg: '#7f1d1d', dieBg: '#991b1b', accent: '#fca5a5' },
  amber: { bg: '#451a03', cardBg: '#78350f', dieBg: '#b45309', accent: '#fde047' }
};

let playerName = 'Player';
let currentTheme = 'ocean';
let board = [];
let gridRows = 4;
let timeLeft = 180;
let timerInterval = null;
let selectedDieIndices = [];
let mySubmittedWords = [];
let wordToDelete = null;
let allowNonTouching = false;
let isHost = false;
let finalLeaderboardData = [];

const screens = {
  landing: document.getElementById('screen-landing'),
  soloOptions: document.getElementById('screen-solo-options'),
  multiLobby: document.getElementById('screen-multi-lobby'),
  countdown: document.getElementById('screen-countdown'),
  game: document.getElementById('screen-game'),
  results: document.getElementById('screen-results')
};

function applyTheme(themeName) {
  const theme = THEMES[themeName] || THEMES.ocean;
  document.documentElement.style.setProperty('--bg', theme.bg);
  document.documentElement.style.setProperty('--card-bg', theme.cardBg);
  document.documentElement.style.setProperty('--die-bg', theme.dieBg);
  document.documentElement.style.setProperty('--accent', theme.accent);
  document.getElementById('sticky-header').style.backgroundColor = theme.bg;
}

function showScreen(name) {
  Object.keys(screens).forEach(k => screens[k].classList.add('hidden'));
  screens[name].classList.remove('hidden');
  const timerEl = document.getElementById('header-timer');
  if (name === 'game') {
    timerEl.classList.remove('hidden');
  } else {
    timerEl.classList.add('hidden');
  }
}

document.getElementById('select-theme').onchange = (e) => {
  currentTheme = e.target.value;
  applyTheme(currentTheme);
  socket.emit('update-theme', currentTheme);
};

document.getElementById('btn-solo-play').onclick = () => {
  playerName = document.getElementById('input-name').value.trim() || 'Player';
  showScreen('soloOptions');
};

document.getElementById('btn-back-landing').onclick = () => {
  showScreen('landing');
};

document.getElementById('btn-multi-play').onclick = () => {
  playerName = document.getElementById('input-name').value.trim() || 'Player';
  currentTheme = document.getElementById('select-theme').value;
  socket.emit('join-lobby', { name: playerName, theme: currentTheme });
  showScreen('multiLobby');
};

document.getElementById('btn-launch-solo').onclick = () => {
  gridRows = parseInt(document.getElementById('solo-grid-size').value);
  timeLeft = parseInt(document.getElementById('solo-timer-duration').value);
  allowNonTouching = document.getElementById('solo-chk-non-touching').checked;

  applyTheme(currentTheme);
  board = rollBoardLocal(gridRows);
  mySubmittedWords = [];

  showScreen('game');
  renderBoard(board, gridRows);
  renderMyGuessesTable();
  updateScorePreview();
  startTimer();
};

function rollBoardLocal(rows) {
  const BOGGLE_DICE_4x4 = [
    ['A', 'A', 'C', 'I', 'O', 'T'], ['A', 'B', 'J', 'O', 'B', 'O'],
    ['A', 'C', 'H', 'O', 'P', 'S'], ['D', 'E', 'E', 'N', 'H', 'W'],
    ['D', 'E', 'L', 'R', 'V', 'Y'], ['A', 'I', 'S', 'O', 'F', 'R'],
    ['E', 'H', 'E', 'G', 'K', 'N'], ['E', 'I', 'I', 'T', 'T', 'S'],
    ['E', 'M', 'O', 'T', 'T', 'T'], ['E', 'N', 'S', 'S', 'I', 'U'],
    ['F', 'I', 'P', 'R', 'S', 'Y'], ['G', 'O', 'R', 'R', 'W', 'V'],
    ['I', 'P', 'S', 'S', 'E', 'F'], ['L', 'I', 'N', 'R', 'T', 'U'],
    ['W', 'O', 'B', 'O', 'J', 'A'], ['N', 'M', 'T', 'O', 'I', 'C']
  ];
  let pool = [...BOGGLE_DICE_4x4].sort(() => Math.random() - 0.5);
  return pool.slice(0, rows * rows).map(die => die[Math.floor(Math.random() * die.length)]);
}

// Host PIN Modal
document.getElementById('btn-host-pin').onclick = () => {
  document.getElementById('pin-modal').classList.remove('hidden');
};
document.getElementById('btn-pin-cancel').onclick = () => {
  document.getElementById('pin-modal').classList.add('hidden');
};
document.getElementById('btn-pin-submit').onclick = () => {
  const pin = document.getElementById('input-pin-code').value.trim();
  socket.emit('claim-host', pin);
};

socket.on('host-success', () => {
  document.getElementById('pin-modal').classList.add('hidden');
  isHost = true;
  document.getElementById('host-controls').classList.remove('hidden');
  document.getElementById('btn-end-early').classList.remove('hidden');
  alert('Host access granted!');
});

socket.on('host-fail', (msg) => {
  alert(msg);
});

// Host settings sync
['host-grid-size', 'host-timer-duration', 'host-chk-non-touching'].forEach(id => {
  document.getElementById(id).onchange = () => {
    if (!isHost) return;
    socket.emit('update-settings', {
      gridSize: document.getElementById('host-grid-size').value,
      duration: document.getElementById('host-timer-duration').value,
      allowNonTouching: document.getElementById('host-chk-non-touching').checked,
      theme: currentTheme
    });
  };
});

socket.on('update-room', (state) => {
  const list = document.getElementById('multi-player-list');
  list.innerHTML = '';
  state.players.forEach(p => {
    const li = document.createElement('li');
    li.textContent = `${p.name} ${p.isHost ? '(Host)' : ''} - [Theme: ${p.theme}]`;
    list.appendChild(li);
  });
});

document.getElementById('btn-start-multi-game').onclick = () => {
  if (isHost) {
    socket.emit('start-countdown');
  }
};

socket.on('run-countdown', () => {
  showScreen('countdown');
  const steps = ['THREE', 'TWO', 'ONE', 'GO'];
  let idx = 0;
  const tile = document.getElementById('countdown-tile');
  tile.innerText = steps[idx];
  
  const cdInterval = setInterval(() => {
    idx++;
    if (idx < steps.length) {
      tile.innerText = steps[idx];
    } else {
      clearInterval(cdInterval);
    }
  }, 1000);
});

socket.on('start-game-play', (data) => {
  board = data.board;
  gridRows = parseInt(data.settings.gridSize);
  timeLeft = parseInt(data.settings.duration);
  allowNonTouching = data.settings.allowNonTouching;
  mySubmittedWords = [];

  showScreen('game');
  renderBoard(board, gridRows);
  renderMyGuessesTable();
  updateScorePreview();
  startTimer();
});

function getWordScore(len, isTouching) {
  if (len < 1) return 0;
  let base = len <= 3 ? len : len <= 8 ? (len === 4 ? 6 : len === 5 ? 8 : len === 6 ? 10 : len === 7 ? 12 : 14) : 20;
  return isTouching ? base : Math.floor(base / 2);
}

function updateScorePreview() {
  const val = document.getElementById('input-word').value.trim();
  const existing = mySubmittedWords.find(item => item.word === val.toUpperCase());
  const isTouching = existing ? existing.isTouching : isValidWordPath(val, board, gridRows);
  const pts = getWordScore(val.length, isTouching);
  document.getElementById('score-preview').innerText = `Score Preview: ${pts} pts (${val.length} letters)${!isTouching ? ' [Non-touching]' : ''}`;
}

function isValidWordPath(word, board, rows) {
  word = word.toUpperCase();
  if (word.length < 1) return false;
  const grid = [];
  for (let i = 0; i < rows; i++) grid.push(board.slice(i * rows, i * rows + rows));

  function search(r, c, wordIdx, visited) {
    if (wordIdx === word.length) return true;
    if (r < 0 || r >= rows || c < 0 || c >= rows || visited.has(`${r},${c}`)) return false;

    const cellVal = grid[r][c];
    let consumed = (cellVal === 'QU' && word.substr(wordIdx, 2) === 'QU') ? 2 : (word[wordIdx] === cellVal ? 1 : 0);
    if (consumed === 0) return false;

    visited.add(`${r},${c}`);
    const neighbors = [[-1,-1], [-1,0], [-1,1], [0,-1], [0,1], [1,-1], [1,0], [1,1]];
    for (let [dr, dc] of neighbors) {
      if (search(r + dr, c + dc, wordIdx + consumed, visited)) return true;
    }
    visited.delete(`${r},${c}`);
    return false;
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < rows; c++) {
      if (search(r, c, 0, new Set())) return true;
    }
  }
  return false;
}

function triggerNonTouchingFlash() {
  const overlay = document.getElementById('flash-overlay');
  overlay.classList.add('active');
  setTimeout(() => { overlay.classList.remove('active'); }, 600);
}

function submitWord(isFromTileTap) {
  const input = document.getElementById('input-word');
  const word = input.value.trim().toUpperCase();
  if (!word) return;

  const trulyTouching = isValidWordPath(word, board, gridRows);

  if (!trulyTouching && !allowNonTouching) {
    triggerNonTouchingFlash();
    input.value = '';
    updateScorePreview();
    document.querySelectorAll('.die.selected').forEach(d => d.classList.remove('selected'));
    selectedDieIndices = [];
    return;
  }

  const finalTouching = isFromTileTap ? trulyTouching : false;
  mySubmittedWords.unshift({ word, isTouching: finalTouching });
  renderMyGuessesTable();

  input.value = '';
  updateScorePreview();
  document.querySelectorAll('.die.selected').forEach(d => d.classList.remove('selected'));
  selectedDieIndices = [];
}

document.getElementById('btn-submit').onclick = () => {
  submitWord(selectedDieIndices.length > 0);
};

document.getElementById('input-word').onkeydown = (e) => {
  if (e.key === 'Enter') submitWord(selectedDieIndices.length > 0);
};

function renderBoard(board, rows) {
  const grid = document.getElementById('boggle-board');
  grid.className = `boggle-grid grid-${rows}`;
  grid.innerHTML = '';
  selectedDieIndices = [];

  board.forEach((letter, index) => {
    const die = document.createElement('div');
    die.className = 'die';
    die.innerText = letter;
    die.onclick = () => {
      const idx = selectedDieIndices.indexOf(index);
      if (idx !== -1) {
        if (idx === selectedDieIndices.length - 1) {
          die.classList.remove('selected');
          selectedDieIndices.pop();
          const input = document.getElementById('input-word');
          input.value = input.value.slice(0, -letter.length);
          updateScorePreview();
        }
        return;
      }
      die.classList.add('selected');
      selectedDieIndices.push(index);
      document.getElementById('input-word').value += letter;
      updateScorePreview();
    };
    grid.appendChild(die);
  });
}

function renderMyGuessesTable() {
  const tbody = document.getElementById('my-guesses-body');
  tbody.innerHTML = '';
  mySubmittedWords.forEach(item => {
    const tr = document.createElement('tr');
    let pts = getWordScore(item.word.length, item.isTouching);
    tr.innerHTML = `
      <td>${item.word}</td>
      <td style="text-align:center; color:${item.isTouching ? 'var(--success)' : 'var(--danger)'}; font-weight:bold;">${item.isTouching ? '✓' : '✗'}</td>
      <td style="text-align:center;">${pts}</td>
      <td class="delete-x">✕</td>
    `;
    tr.querySelector('.delete-x').onclick = () => {
      mySubmittedWords = mySubmittedWords.filter(w => w.word !== item.word);
      renderMyGuessesTable();
    };
    tbody.appendChild(tr);
  });
}

function startTimer() {
  clearInterval(timerInterval);
  let rem = timeLeft;
  updateTimerDisplay(rem);
  timerInterval = setInterval(() => {
    rem--;
    updateTimerDisplay(rem);
    if (rem <= 0) {
      clearInterval(timerInterval);
      endGame();
    }
  }, 1000);
}

function updateTimerDisplay(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  const timerEl = document.getElementById('header-timer');
  timerEl.innerText = `${m}:${s}`;
  timerEl.classList.remove('timer-yellow', 'timer-red');
  if (sec <= 15) timerEl.classList.add('timer-red');
  else if (sec <= 60) timerEl.classList.add('timer-yellow');
}

document.getElementById('btn-end-early').onclick = () => {
  clearInterval(timerInterval);
  endGame();
};

async function endGame() {
  const loadingOverlay = document.getElementById('loading-overlay');
  loadingOverlay.classList.remove('hidden');

  let totalScore = 0;
  let validatedWords = [];

  for (const item of mySubmittedWords) {
    let pts = getWordScore(item.word.length, item.isTouching);
    totalScore += pts;
    validatedWords.push({ word: item.word, pts, isTouching: item.isTouching });
  }

  loadingOverlay.classList.add('hidden');

  socket.emit('submit-results', { words: validatedWords, score: totalScore });
  
  // If solo, show leaderboard directly
  renderLeaderboard([{ name: playerName, finalScore: totalScore, submittedWords: validatedWords }]);
}

socket.on('show-leaderboard', (players) => {
  renderLeaderboard(players);
});

function renderLeaderboard(players) {
  finalLeaderboardData = players;
  showScreen('results');
  const container = document.getElementById('leaderboard-container');
  container.innerHTML = '';

  // Sort players lowest score to highest score for animation
  let sorted = [...players].sort((a, b) => a.finalScore - b.finalScore);

  sorted.forEach((p, idx) => {
    setTimeout(() => {
      const div = document.createElement('div');
      const isWinner = (idx === sorted.length - 1);
      div.style.cssText = "background:#082f49; padding:12px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; font-weight:bold; border: 1px solid #0369a1; animation: fadeIn 0.5s;";
      div.innerHTML = `<span>${p.name} ${isWinner ? '🏆' : ''}</span><span>${p.finalScore} pts</span>`;
      container.prepend(div); // Prepend so highest score ends up at top
    }, idx * 600);
  });
}

document.getElementById('btn-toggle-word-details').onclick = () => {
  const container = document.getElementById('leaderboard-container');
  container.innerHTML = `<h3 style="color:var(--accent); font-size:1rem; margin-bottom:6px;">Player Word Breakdown</h3>`;
  
  // Identify duplicate words across players for highlighting
  const wordCounts = {};
  finalLeaderboardData.forEach(p => {
    p.submittedWords.forEach(w => {
      wordCounts[w.word] = (wordCounts[w.word] || 0) + 1;
    });
  });

  finalLeaderboardData.forEach(p => {
    const block = document.createElement('div');
    block.style.cssText = "background:#082f49; padding:10px; border-radius:6px; margin-bottom:8px; font-size:0.85rem;";
    let wordsHtml = p.submittedWords.map(w => {
      const isDup = wordCounts[w.word] > 1;
      return `<span onclick="showDefinition('${w.word}')" class="${isDup ? 'duplicate-highlight' : ''}" style="display:inline-block; background:#0c4a6e; border:1px solid #0369a1; padding:3px 6px; border-radius:4px; margin:2px; cursor:pointer;">${w.word} (${w.pts})</span>`;
    }).join(' ');
    block.innerHTML = `<strong>${p.name}:</strong><div style="margin-top:4px; display:flex; flex-wrap:wrap; gap:4px;">${wordsHtml || 'None'}</div>`;
    container.appendChild(block);
  });
};

async function showDefinition(word) {
  document.getElementById('def-word').innerText = word;
  document.getElementById('def-content').innerText = 'Loading definition...';
  document.getElementById('definition-modal').classList.remove('hidden');

  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`);
    if (!res.ok) {
      document.getElementById('def-content').innerText = 'No definition found.';
      return;
    }
    const data = await res.json();
    let html = '';
    data.forEach(entry => {
      if (entry.meanings) {
        entry.meanings.forEach(m => {
          html += `<div style="border-bottom: 1px solid #0369a1; padding-bottom: 4px; margin-bottom: 4px;"><strong>${m.partOfSpeech}:</strong>`;
          m.definitions.slice(0, 2).forEach((d, i) => {
            html += `<div style="margin-top:2px;">${i+1}. ${d.definition}</div>`;
          });
          html += `</div>`;
        });
      }
    });
    document.getElementById('definition-modal').classList.add('active');
    document.getElementById('def-content').innerHTML = html || 'No definition available.';
  } catch (e) {
    document.getElementById('def-content').innerText = 'Could not fetch definition.';
  }
}

document.getElementById('def-close-x').onclick = () => {
  document.getElementById('definition-modal').classList.add('hidden');
};

document.getElementById('btn-restart').onclick = () => {
  showScreen('landing');
};