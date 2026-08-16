const socket = io();

const THEMES = {
  ocean: { bg: '#082f49', cardBg: '#0c4a6e', dieBg: '#0369a1', accent: '#38bdf8' },
  purple: { bg: '#2e1065', cardBg: '#3b0764', dieBg: '#6b21a8', accent: '#c084fc' },
  slate: { bg: '#0f172a', cardBg: '#1e293b', dieBg: '#334155', accent: '#38bdf8' },
  forest: { bg: '#022c22', cardBg: '#064e3b', dieBg: '#047857', accent: '#34d399' },
  crimson: { bg: '#450a0a', cardBg: '#7f1d1d', dieBg: '#991b1b', accent: '#fca5a5' },
  amber: { bg: '#451a03', cardBg: '#78350f', dieBg: '#b45309', accent: '#fde047' }
};

let playerName = '';
let currentTheme = 'ocean';
let board = [];
let gridRows = 4;
let timeLeft = 180;
let timerInterval = null;
let selectedDieIndices = [];
let mySubmittedWords = [];
let allowNonTouching = false;
let isHost = false;
let isSoloGame = false;
let finalLeaderboardData = [];
let targetKickId = null;
let showingWordDetails = false;

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
  document.body.style.backgroundColor = theme.bg;
  const header = document.getElementById('sticky-header');
  if (header) header.style.backgroundColor = theme.bg;
  document.querySelectorAll('.card').forEach(card => {
    card.style.backgroundColor = theme.cardBg;
  });
}

function showScreen(name) {
  Object.keys(screens).forEach(k => {
    if (screens[k]) screens[k].classList.add('hidden');
  });
  if (screens[name]) {
    screens[name].classList.remove('hidden');
  }
  const timerEl = document.getElementById('header-timer');
  if (timerEl) {
    if (name === 'game') {
      timerEl.classList.remove('hidden');
    } else {
      timerEl.classList.add('hidden');
    }
  }
}

// Initialize theme on load
window.addEventListener('DOMContentLoaded', () => {
  const themeSelect = document.getElementById('select-theme');
  if (themeSelect) {
    currentTheme = themeSelect.value;
    applyTheme(currentTheme);
    themeSelect.onchange = (e) => {
      currentTheme = e.target.value;
      applyTheme(currentTheme);
    };
  }

  const lobbyThemeSelect = document.getElementById('select-lobby-theme');
  if (lobbyThemeSelect) {
    lobbyThemeSelect.onchange = (e) => {
      currentTheme = e.target.value;
      applyTheme(currentTheme);
      socket.emit('update-theme', currentTheme);
    };
  }

  // Button bindings with safeguards
  const btnSolo = document.getElementById('btn-solo-play');
  if (btnSolo) {
    btnSolo.onclick = () => {
      const nameInput = document.getElementById('input-name');
      playerName = nameInput ? nameInput.value.trim() : '';
      if (!playerName) {
        alert('Please enter your name before starting.');
        return;
      }
      isSoloGame = true;
      showScreen('soloOptions');
    };
  }

  const btnMulti = document.getElementById('btn-multi-play');
  if (btnMulti) {
    btnMulti.onclick = () => {
      const nameInput = document.getElementById('input-name');
      playerName = nameInput ? nameInput.value.trim() : '';
      if (!playerName) {
        alert('Please enter your name before joining the multiplayer lobby.');
        return;
      }
      isSoloGame = false;
      const themeSelectEl = document.getElementById('select-theme');
      currentTheme = themeSelectEl ? themeSelectEl.value : 'ocean';
      const lobbyThemeEl = document.getElementById('select-lobby-theme');
      if (lobbyThemeEl) lobbyThemeEl.value = currentTheme;
      socket.emit('join-lobby', { name: playerName, theme: currentTheme });
    };
  }

  const btnBackLanding = document.getElementById('btn-back-landing');
  if (btnBackLanding) btnBackLanding.onclick = () => showScreen('landing');

  const btnLeaveLobby = document.getElementById('btn-leave-lobby');
  if (btnLeaveLobby) btnLeaveLobby.onclick = () => showScreen('landing');

  const btnLaunchSolo = document.getElementById('btn-launch-solo');
  if (btnLaunchSolo) {
    btnLaunchSolo.onclick = () => {
      const gSize = document.getElementById('solo-grid-size').value;
      const tDur = document.getElementById('solo-timer-duration').value;
      const wRule = document.getElementById('solo-word-rule').value;

      if (!gSize || !tDur || wRule === "") {
        alert('Please select all game options from the dropdown menus before starting.');
        return;
      }

      gridRows = parseInt(gSize);
      timeLeft = parseInt(tDur);
      allowNonTouching = (wRule === 'true');

      applyTheme(currentTheme);
      board = rollBoardLocal(gridRows);
      mySubmittedWords = [];

      showScreen('game');
      renderBoard(board, gridRows);
      renderMyGuessesTable();
      updateScorePreview();
      startTimer();
    };
  }
});

socket.on('join-success', () => {
  showScreen('multiLobby');
});

socket.on('name-taken', (msg) => {
  alert(msg);
});

function rollBoardLocal(rows) {
  const DICE_4 = [
    ['A', 'A', 'C', 'I', 'O', 'T'], ['A', 'B', 'J', 'O', 'B', 'O'],
    ['A', 'C', 'H', 'O', 'P', 'S'], ['D', 'E', 'E', 'N', 'H', 'W'],
    ['D', 'E', 'L', 'R', 'V', 'Y'], ['A', 'I', 'S', 'O', 'F', 'R'],
    ['E', 'H', 'E', 'G', 'K', 'N'], ['E', 'I', 'I', 'T', 'T', 'S'],
    ['E', 'M', 'O', 'T', 'T', 'T'], ['E', 'N', 'S', 'S', 'I', 'U'],
    ['F', 'I', 'P', 'R', 'S', 'Y'], ['G', 'O', 'R', 'R', 'W', 'V'],
    ['I', 'P', 'S', 'S', 'E', 'F'], ['L', 'I', 'N', 'R', 'T', 'U'],
    ['W', 'O', 'B', 'O', 'J', 'A'], ['N', 'M', 'T', 'O', 'I', 'C']
  ];
  const DICE_5 = [
    ...DICE_4,
    ['E', 'T', 'U', 'V', 'W', 'Y'], ['B', 'E', 'K', 'O', 'QU', 'Z'],
    ['C', 'I', 'M', 'P', 'S', 'U'], ['E', 'H', 'R', 'V', 'W', 'Y'],
    ['A', 'C', 'E', 'E', 'M', 'N'], ['D', 'I', 'F', 'R', 'Y', 'Z'],
    ['G', 'K', 'L', 'U', 'Y', 'E'], ['A', 'B', 'I', 'L', 'T', 'Y'],
    ['J', 'K', 'QU', 'W', 'X', 'Z']
  ];
  const DICE_6 = [
    ...DICE_5,
    ['C', 'D', 'E', 'E', 'H', 'M'], ['P', 'H', 'L', 'N', 'O', 'D'],
    ['R', 'S', 'T', 'I', 'E', 'L'], ['B', 'M', 'A', 'O', 'T', 'E'],
    ['C', 'K', 'L', 'N', 'E', 'W'], ['S', 'T', 'P', 'I', 'O', 'R'],
    ['F', 'G', 'H', 'L', 'N', 'Y'], ['A', 'E', 'D', 'I', 'O', 'U'],
    ['V', 'W', 'R', 'S', 'T', 'L'], ['M', 'N', 'P', 'K', 'T', 'S']
  ];

  let selectedPool = DICE_4;
  if (rows === 5) selectedPool = DICE_5;
  if (rows === 6) selectedPool = DICE_6;

  let pool = [...selectedPool].sort(() => Math.random() - 0.5);
  const totalNeeded = rows * rows;
  return pool.slice(0, totalNeeded).map(die => die[Math.floor(Math.random() * die.length)]);
}

const hostActionBtn = document.getElementById('btn-host-action');
if (hostActionBtn) {
  hostActionBtn.onclick = () => {
    if (isHost) {
      socket.emit('release-host');
    } else {
      const pinModal = document.getElementById('pin-modal');
      if (pinModal) pinModal.classList.remove('hidden');
    }
  };
}

const btnPinCancel = document.getElementById('btn-pin-cancel');
if (btnPinCancel) {
  btnPinCancel.onclick = () => {
    const pinModal = document.getElementById('pin-modal');
    if (pinModal) pinModal.classList.add('hidden');
  };
}

const btnPinSubmit = document.getElementById('btn-pin-submit');
if (btnPinSubmit) {
  btnPinSubmit.onclick = () => {
    const pinInput = document.getElementById('input-pin-code');
    const pin = pinInput ? pinInput.value.trim() : '';
    socket.emit('claim-host', pin);
  };
}

socket.on('host-success', () => {
  const pinModal = document.getElementById('pin-modal');
  if (pinModal) pinModal.classList.add('hidden');
  isHost = true;
  if (hostActionBtn) {
    hostActionBtn.innerText = 'Release Host';
    hostActionBtn.style.background = '#991b1b';
  }
  const hostControls = document.getElementById('host-controls');
  if (hostControls) hostControls.classList.remove('hidden');
});

socket.on('host-released', () => {
  isHost = false;
  if (hostActionBtn) {
    hostActionBtn.innerText = '🔒 Host Access';
    hostActionBtn.style.background = 'var(--die-bg)';
  }
  const hostControls = document.getElementById('host-controls');
  if (hostControls) hostControls.classList.add('hidden');
});

socket.on('host-fail', () => {
  alert('Invalid Host PIN');
});

['host-grid-size', 'host-timer-duration', 'host-word-rule'].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.onchange = () => {
      if (!isHost) return;
      socket.emit('update-settings', {
        gridSize: document.getElementById('host-grid-size').value,
        duration: document.getElementById('host-timer-duration').value,
        allowNonTouching: document.getElementById('host-word-rule').value,
        theme: currentTheme
      });
    };
  }
});

socket.on('update-room', (state) => {
  const list = document.getElementById('multi-player-list');
  if (!list) return;
  list.innerHTML = '';
  const uniqueMap = new Map();
  state.players.forEach(p => uniqueMap.set(p.id, p));

  uniqueMap.forEach(p => {
    const li = document.createElement('li');
    li.textContent = `${p.name} ${p.isHost ? '(Host)' : ''} - [Theme: ${p.theme}]`;
    li.style.cursor = isHost && !p.isHost ? 'pointer' : 'default';
    if (isHost && !p.isHost) {
      li.onclick = () => {
        targetKickId = p.id;
        const kickName = document.getElementById('kick-player-name');
        if (kickName) kickName.innerText = p.name;
        const kickModal = document.getElementById('kick-modal');
        if (kickModal) kickModal.classList.remove('hidden');
      };
    }
    list.appendChild(li);
  });
});

const btnKickCancel = document.getElementById('btn-kick-cancel');
if (btnKickCancel) {
  btnKickCancel.onclick = () => {
    const kickModal = document.getElementById('kick-modal');
    if (kickModal) kickModal.classList.add('hidden');
    targetKickId = null;
  };
}

const btnKickConfirm = document.getElementById('btn-kick-confirm');
if (btnKickConfirm) {
  btnKickConfirm.onclick = () => {
    if (targetKickId) {
      socket.emit('remove-player', targetKickId);
    }
    const kickModal = document.getElementById('kick-modal');
    if (kickModal) kickModal.classList.add('hidden');
    targetKickId = null;
  };
}

socket.on('kicked-from-lobby', () => {
  alert('You have been removed from the lobby by the host.');
  showScreen('landing');
});

const btnStartMultiGame = document.getElementById('btn-start-multi-game');
if (btnStartMultiGame) {
  btnStartMultiGame.onclick = () => {
    if (isHost) {
      const gSize = document.getElementById('host-grid-size').value;
      const tDur = document.getElementById('host-timer-duration').value;
      const wRule = document.getElementById('host-word-rule').value;

      if (!gSize || !tDur || wRule === "") {
        alert('Please select all game options from the dropdown menus before launching.');
        return;
      }
      socket.emit('start-countdown');
    }
  };
}

socket.on('run-countdown', (settings) => {
  showScreen('countdown');
  const rulesBox = document.getElementById('countdown-rules-display');
  if (rulesBox) {
    const sizeLabel = settings.gridSize === '4' ? '4x4 Standard' : settings.gridSize === '5' ? '5x5 Large' : '6x6 Jumbo';
    const durLabel = `${parseInt(settings.duration) / 60} Minute(s)`;
    const ruleLabel = settings.allowNonTouching === 'true' ? 'Allow Non-Touching Words' : 'Adjacent Tiles Only';
    rulesBox.innerHTML = `<strong>Game Rules:</strong> Grid: ${sizeLabel} | Time: ${durLabel} | Rule: ${ruleLabel}`;
  }

  const words = ['THREE', 'TWO', 'ONE', 'GO'];
  let idx = 0;
  const boardEl = document.getElementById('countdown-board');
  if (boardEl) boardEl.innerHTML = '';
  
  function renderCumulativeStep() {
    if (idx < words.length && boardEl) {
      const currentWord = words[idx];
      const rowDiv = document.createElement('div');
      rowDiv.style.cssText = "display: flex; gap: 8px; justify-content: center;";
      for (let char of currentWord) {
        const tile = document.createElement('div');
        tile.className = 'die';
        tile.style.width = '45px';
        tile.style.height = '45px';
        tile.style.fontSize = '1.6rem';
        tile.innerText = char;
        rowDiv.appendChild(tile);
      }
      boardEl.appendChild(rowDiv);
      idx++;
      setTimeout(renderCumulativeStep, 1000);
    }
  }
  renderCumulativeStep();
});

socket.on('start-game-play', (data) => {
  board = data.board;
  gridRows = parseInt(data.settings.gridSize);
  timeLeft = parseInt(data.settings.duration);
  allowNonTouching = (data.settings.allowNonTouching === 'true' || data.settings.allowNonTouching === true);
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
  const inputWord = document.getElementById('input-word');
  const val = inputWord ? inputWord.value.trim() : '';
  const existing = mySubmittedWords.find(item => item.word === val.toUpperCase());
  const isTouching = existing ? existing.isTouching : isValidWordPath(val, board, gridRows);
  const pts = getWordScore(val.length, isTouching);
  const scorePreview = document.getElementById('score-preview');
  if (scorePreview) {
    scorePreview.innerText = `Score Preview: ${pts} pts (${val.length} letters)${!isTouching ? ' [Non-touching]' : ''}`;
  }
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
  if (overlay) {
    overlay.classList.add('active');
    setTimeout(() => { overlay.classList.remove('active'); }, 600);
  }
}

function submitWord(isFromTileTap) {
  const input = document.getElementById('input-word');
  if (!input) return;
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

  mySubmittedWords.unshift({ word, isTouching: trulyTouching });
  renderMyGuessesTable();

  input.value = '';
  updateScorePreview();
  document.querySelectorAll('.die.selected').forEach(d => d.classList.remove('selected'));
  selectedDieIndices = [];
}

const btnSubmit = document.getElementById('btn-submit');
if (btnSubmit) btnSubmit.onclick = () => submitWord(selectedDieIndices.length > 0);

const inputWordEl = document.getElementById('input-word');
if (inputWordEl) {
  inputWordEl.onkeydown = (e) => {
    if (e.key === 'Enter') submitWord(selectedDieIndices.length > 0);
  };
  inputWordEl.oninput = () => updateScorePreview();
}

function renderBoard(board, rows) {
  const grid = document.getElementById('boggle-board');
  if (!grid) return;
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
          if (input) input.value = input.value.slice(0, -letter.length);
          updateScorePreview();
        }
        return;
      }
      die.classList.add('selected');
      selectedDieIndices.push(index);
      const input = document.getElementById('input-word');
      if (input) input.value += letter;
      updateScorePreview();
    };
    grid.appendChild(die);
  });
}

function renderMyGuessesTable() {
  const tbody = document.getElementById('my-guesses-body');
  if (!tbody) return;
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
  if (timerEl) {
    timerEl.innerText = `${m}:${s}`;
    timerEl.classList.remove('timer-yellow', 'timer-red');
    if (sec <= 15) timerEl.classList.add('timer-red');
    else if (sec <= 60) timerEl.classList.add('timer-yellow');
  }
}

const btnEndEarly = document.getElementById('btn-end-early');
if (btnEndEarly) {
  btnEndEarly.onclick = () => {
    clearInterval(timerInterval);
    endGame();
  };
}

async function endGame() {
  const loadingOverlay = document.getElementById('loading-overlay');
  if (loadingOverlay) loadingOverlay.classList.remove('hidden');

  let totalScore = 0;
  let validatedWords = [];

  for (const item of mySubmittedWords) {
    let pts = getWordScore(item.word.length, item.isTouching);
    totalScore += pts;
    validatedWords.push({ word: item.word, pts, isTouching: item.isTouching });
  }

  if (loadingOverlay) loadingOverlay.classList.add('hidden');

  if (isSoloGame) {
    renderSoloResults({ name: playerName, finalScore: totalScore, submittedWords: validatedWords });
  } else {
    socket.emit('submit-results', { words: validatedWords, score: totalScore });
  }
}

socket.on('show-leaderboard', (players) => {
  renderLeaderboard(players);
});

function renderSoloResults(player) {
  showScreen('results');
  const resultsTitle = document.getElementById('results-title');
  if (resultsTitle) resultsTitle.innerText = 'Word Breakdown';
  const toggleDetails = document.getElementById('btn-toggle-word-details');
  if (toggleDetails) toggleDetails.classList.add('hidden');
  
  let sortedWords = [...player.submittedWords].sort((a, b) => a.word.localeCompare(b.word));

  const container = document.getElementById('results-container');
  if (container) {
    container.innerHTML = `
      <div style="background:#082f49; padding:16px; border-radius:8px; display:flex; flex-direction:column; gap:12px; border: 1px solid #0369a1;">
        <div style="display:flex; justify-content:space-between; font-weight:bold; color:var(--accent); font-size:1.1rem;">
          <span>${player.name}: ${player.finalScore} pts</span>
        </div>
        <div>
          <div style="display:flex; flex-wrap:wrap; gap:4px;">
            ${sortedWords.length > 0 ? sortedWords.map(w => `<span onclick="showDefinition('${w.word}')" style="display:inline-block; background:#0c4a6e; border:1px solid #0369a1; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.85rem;">${w.word} (${w.pts})</span>`).join('') : '<span style="color:var(--text-muted)">No words submitted</span>'}
          </div>
        </div>
      </div>
    `;
  }
}

function renderLeaderboard(players) {
  isSoloGame = false;
  showingWordDetails = false;
  const resultsTitle = document.getElementById('results-title');
  if (resultsTitle) resultsTitle.innerText = 'Leaderboard';
  const toggleDetails = document.getElementById('btn-toggle-word-details');
  if (toggleDetails) {
    toggleDetails.classList.remove('hidden');
    toggleDetails.innerText = 'View Detailed Word Breakdown';
  }

  const uniquePlayersMap = new Map();
  players.forEach(p => uniquePlayersMap.set(p.name, p));
  finalLeaderboardData = Array.from(uniquePlayersMap.values());

  showScreen('results');
  renderLeaderboardView();
}

function renderLeaderboardView() {
  const container = document.getElementById('results-container');
  if (!container) return;
  container.innerHTML = '';

  let sorted = [...finalLeaderboardData].sort((a, b) => b.finalScore - a.finalScore);
  const highestScore = sorted.length > 0 ? sorted[0].finalScore : 0;

  sorted.forEach((p) => {
    const div = document.createElement('div');
    const isWinner = (p.finalScore > 0 && p.finalScore === highestScore);
    div.style.cssText = "background:#082f49; padding:12px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; font-weight:bold; border: 1px solid #0369a1;";
    div.innerHTML = `<span>${p.name} ${isWinner ? '🏆' : ''}</span><span>${p.finalScore} pts</span>`;
    container.appendChild(div);
  });
}

const btnToggleDetails = document.getElementById('btn-toggle-word-details');
if (btnToggleDetails) {
  btnToggleDetails.onclick = () => {
    const container = document.getElementById('results-container');
    const toggleBtn = document.getElementById('btn-toggle-word-details');
    const resultsTitle = document.getElementById('results-title');

    if (!showingWordDetails) {
      showingWordDetails = true;
      if (toggleBtn) toggleBtn.innerText = 'Back to Leaderboard';
      if (resultsTitle) resultsTitle.innerText = 'Word Breakdown';
      if (container) container.innerHTML = '';
      
      const wordCounts = {};
      finalLeaderboardData.forEach(p => {
        p.submittedWords.forEach(w => {
          wordCounts[w.word] = (wordCounts[w.word] || 0) + 1;
        });
      });

      finalLeaderboardData.forEach(p => {
        const block = document.createElement('div');
        block.style.cssText = "background:#082f49; padding:10px; border-radius:6px; margin-bottom:8px; font-size:0.85rem;";
        
        let sortedWords = [...p.submittedWords].sort((a, b) => a.word.localeCompare(b.word));
        let wordsHtml = sortedWords.map(w => {
          const isDup = wordCounts[w.word] > 1;
          return `<span onclick="showDefinition('${w.word}')" class="${isDup ? 'duplicate-highlight' : ''}" style="display:inline-block; background:#0c4a6e; border:1px solid #0369a1; padding:3px 6px; border-radius:4px; margin:2px; cursor:pointer;">${w.word} (${w.pts})</span>`;
        }).join(' ');

        block.innerHTML = `<strong>${p.name}: ${p.finalScore}</strong><div style="margin-top:4px; display:flex; flex-wrap:wrap; gap:4px;">${wordsHtml || 'None'}</div>`;
        if (container) container.appendChild(block);
      });
    } else {
      showingWordDetails = false;
      if (toggleBtn) toggleBtn.innerText = 'View Detailed Word Breakdown';
      if (resultsTitle) resultsTitle.innerText = 'Leaderboard';
      renderLeaderboardView();
    }
  };
}

async function showDefinition(word) {
  const wordTilesContainer = document.getElementById('def-word-tiles');
  if (wordTilesContainer) {
    wordTilesContainer.innerHTML = '';
    word.toUpperCase().split('').forEach(char => {
      const tile = document.createElement('div');
      tile.className = 'small-die';
      tile.innerText = char;
      wordTilesContainer.appendChild(tile);
    });
  }

  const defContent = document.getElementById('def-content');
  if (defContent) defContent.innerText = 'Loading definition...';
  const defModal = document.getElementById('definition-modal');
  if (defModal) defModal.classList.remove('hidden');

  const cleanWord = word.toLowerCase().trim();
  const endpoints = [
    `https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord}`,
    `https://dictionary.yabt.com/api/v1/english/${cleanWord}`
  ];

  let success = false;
  for (let url of endpoints) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        let html = '';
        if (Array.isArray(data)) {
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
        }
        if (html && defContent) {
          defContent.innerHTML = html;
          success = true;
          break;
        }
      }
    } catch (e) {
      // try next endpoint
    }
  }

  if (!success && defContent) {
    defContent.innerHTML = `
      <div>No definition found.</div>
      <a href="https://www.google.com/search?q=define+${encodeURIComponent(cleanWord)}" target="_blank" style="color:var(--accent); display:inline-block; margin-top:8px;">Search Google for "${cleanWord}" &rarr;</a>
    `;
  }
}

const defCloseX = document.getElementById('def-close-x');
if (defCloseX) {
  defCloseX.onclick = () => {
    const defModal = document.getElementById('definition-modal');
    if (defModal) defModal.classList.add('hidden');
  };
}

const btnRestart = document.getElementById('btn-restart');
if (btnRestart) {
  btnRestart.onclick = () => showScreen('landing');
};