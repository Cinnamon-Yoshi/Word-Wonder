const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let roomState = {
    players: [],
    hostId: null,
    settings: {
        gridSize: null,
        duration: null,
        allowNonTouching: null,
        theme: 'ocean'
    },
    gameState: 'lobby',
    board: []
};

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

function rollBoard(size) {
    const totalDice = size * size;
    let pool = [...BOGGLE_DICE_4x4];
    while(pool.length < totalDice) {
        pool.push(['A','E','I','O','U','R']);
    }
    pool.sort(() => Math.random() - 0.5);
    return pool.slice(0, totalDice).map(die => die[Math.floor(Math.random() * die.length)]);
}

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    socket.on('join-lobby', (data) => {
        const playerName = (data.name || '').trim();
        if (!playerName) {
            socket.emit('error-msg', 'Name cannot be empty.');
            return;
        }

        const nameExists = roomState.players.some(p => p.name.toLowerCase() === playerName.toLowerCase() && p.id !== socket.id);
        if (nameExists) {
            socket.emit('name-taken', 'That name is already taken in the lobby. Please choose another.');
            return;
        }

        roomState.players = roomState.players.filter(p => p.id !== socket.id);

        const newPlayer = {
            id: socket.id,
            name: playerName,
            theme: data.theme || 'ocean',
            isHost: false,
            submittedWords: [],
            finalScore: 0
        };

        roomState.players.push(newPlayer);
        socket.emit('join-success');
        io.emit('update-room', roomState);
    });

    socket.on('claim-host', (pin) => {
        if (pin === '8888') {
            roomState.players.forEach(p => p.isHost = (p.id === socket.id));
            roomState.hostId = socket.id;
            io.emit('update-room', roomState);
            socket.emit('host-success');
        } else {
            socket.emit('host-fail');
        }
    });

    socket.on('release-host', () => {
        if (roomState.hostId === socket.id) {
            const p = roomState.players.find(x => x.id === socket.id);
            if (p) p.isHost = false;
            roomState.hostId = null;
            io.emit('update-room', roomState);
            socket.emit('host-released');
        }
    });

    socket.on('remove-player', (targetId) => {
        if (socket.id === roomState.hostId && targetId !== roomState.hostId) {
            roomState.players = roomState.players.filter(p => p.id !== targetId);
            io.to(targetId).emit('kicked-from-lobby');
            io.emit('update-room', roomState);
        }
    });

    socket.on('update-settings', (settings) => {
        if (socket.id === roomState.hostId) {
            roomState.settings = settings;
            io.emit('room-settings-updated', roomState.settings);
        }
    });

    socket.on('update-theme', (theme) => {
        const p = roomState.players.find(x => x.id === socket.id);
        if (p) {
            p.theme = theme;
            io.emit('update-room', roomState);
        }
    });

    socket.on('start-countdown', () => {
        if (socket.id === roomState.hostId) {
            if (!roomState.settings.gridSize || !roomState.settings.duration || roomState.settings.allowNonTouching === null) {
                return;
            }
            roomState.gameState = 'countdown';
            roomState.board = rollBoard(parseInt(roomState.settings.gridSize));
            io.emit('run-countdown', roomState.settings);
            
            setTimeout(() => {
                roomState.gameState = 'playing';
                io.emit('start-game-play', {
                    board: roomState.board,
                    settings: roomState.settings
                });
            }, 5000);
        }
    });

    socket.on('submit-results', (data) => {
        const p = roomState.players.find(x => x.id === socket.id);
        if (p) {
            p.submittedWords = data.words;
            p.finalScore = data.score;
        }

        const uniqueMap = new Map();
        roomState.players.forEach(pl => uniqueMap.set(pl.name, pl));
        const uniqueList = Array.from(uniqueMap.values());

        const allFinished = uniqueList.every(pl => pl.submittedWords.length > 0 || pl.finalScore !== undefined);
        if (allFinished || socket.id === roomState.hostId) {
            roomState.gameState = 'results';
            io.emit('show-leaderboard', uniqueList);
        }
    });

    socket.on('disconnect', () => {
        roomState.players = roomState.players.filter(p => p.id !== socket.id);
        if (roomState.hostId === socket.id && roomState.players.length > 0) {
            roomState.players[0].isHost = true;
            roomState.hostId = roomState.players[0].id;
        } else if (roomState.players.length === 0) {
            roomState.hostId = null;
        }
        io.emit('update-room', roomState);
        console.log(`Player disconnected: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Word Wonder server running on port ${PORT}`);
});