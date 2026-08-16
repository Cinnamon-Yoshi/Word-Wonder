const socket = io();

const loginScreen = document.getElementById('login-screen');
const gameScreen = document.getElementById('game-screen');
const joinBtn = document.getElementById('join-btn');
const startBtn = document.getElementById('start-btn');
const playerNameInput = document.getElementById('player-name-input');
const lobbyList = document.getElementById('lobby-list');
const turnIndicator = document.getElementById('turn-indicator');
const myIdentity = document.getElementById('my-identity');
const cardHandDiv = document.getElementById('card-hand');
const moveBtn = document.getElementById('move-btn');
const endTurnBtn = document.getElementById('end-turn-btn');

let selectedRoom = null;
let myId = null;
let isMyTurn = false;

joinBtn.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    if (name) {
        socket.emit('join-game', name);
        joinBtn.style.display = 'none';
        playerNameInput.style.display = 'none';
    }
});

startBtn.addEventListener('click', () => {
    socket.emit('start-game');
});

document.querySelectorAll('.room').forEach(roomEl => {
    roomEl.addEventListener('click', () => {
        if (!isMyTurn) return;
        document.querySelectorAll('.room').forEach(r => r.classList.remove('selected'));
        roomEl.classList.add('selected');
        selectedRoom = roomEl.getAttribute('data-room');
        moveBtn.disabled = false;
    });
});

moveBtn.addEventListener('click', () => {
    if (selectedRoom && isMyTurn) {
        socket.emit('move-player', selectedRoom);
        moveBtn.disabled = true;
    }
});

endTurnBtn.addEventListener('click', () => {
    if (isMyTurn) {
        socket.emit('end-turn');
        isMyTurn = false;
        endTurnBtn.disabled = true;
        moveBtn.disabled = true;
    }
});

socket.on('update-lobby', (players) => {
    lobbyList.innerHTML = '';
    players.forEach(p => {
        const li = document.createElement('li');
        li.textContent = `${p.name} (${p.character})`;
        lobbyList.appendChild(li);
    });

    if (players.length >= 2 && socket.id === players[0].id) {
        startBtn.style.display = 'block';
    }
});

socket.on('game-started', (data) => {
    loginScreen.style.display = 'none';
    gameScreen.style.display = 'block';
    myId = socket.id;

    cardHandDiv.innerHTML = '';
    data.hand.forEach(card => {
        const cardEl = document.createElement('div');
        cardEl.className = 'card';
        cardEl.textContent = card;
        cardHandDiv.appendChild(cardEl);
    });

    const me = data.players.find(p => p.id === myId);
    myIdentity.textContent = `You: ${me.name} as ${me.character}`;

    updateBoard(data.players);
    updateTurn(data.turn);
});

socket.on('board-updated', (players) => {
    updateBoard(players);
});

socket.on('turn-changed', (activePlayerId) => {
    updateTurn(activePlayerId);
});

socket.on('error-msg', (msg) => {
    alert(msg);
});

function updateBoard(players) {
    document.querySelectorAll('.player-token').forEach(el => el.remove());

    players.forEach(p => {
        const roomEl = document.querySelector(`[data-room="${p.location}"]`);
        if (roomEl) {
            const token = document.createElement('div');
            token.className = 'player-token';
            token.textContent = `${p.name} (${p.character[0]})`;
            roomEl.appendChild(token);
        }
    });
}

function updateTurn(activePlayerId) {
    isMyTurn = (activePlayerId === socket.id);
    if (isMyTurn) {
        turnIndicator.textContent = "Your Turn! Select a room to move.";
        turnIndicator.style.color = "#03dac6";
        endTurnBtn.disabled = false;
    } else {
        turnIndicator.textContent = "Waiting for other player's turn...";
        turnIndicator.style.color = "#e0e0e0";
        endTurnBtn.disabled = true;
        moveBtn.disabled = true;
    }
}