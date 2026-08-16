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
        gridSize: 4,
        duration: 180,
        allowNonTouching: false,
        theme: 'ocean'
    },
    gameState: 'lobby', // 'lobby', 'countdown', 'playing', 'results'
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
    // If 5x5 or 6x6, pad or generate dice as needed
    while(pool.length < totalDice) {
        pool.push(['A','E','I','O','U','R']);
    }
    pool.sort(() => Math.random() - 0.5);
    const selected = pool.slice(0, totalDice);
    return selected.map(die => die[Math.floor(Math.random() * die.length)]);
}

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    socket.on('join-lobby', (data) => {
        const playerName = data.name || 'Player';
        const newPlayer = {
            id: socket.id,
            name: playerName,
            theme: data.theme || 'ocean',
            isHost: roomState.players.length === 0,
            submittedWords: [],
            finalScore: 0
        };

        if (newPlayer.isHost) {
            roomState.hostId = socket.id;
        }

        roomState.players.push(newPlayer);
        io.emit('update-room', roomState);
    });

    socket.on('claim-host', (pin) => {
        if (pin === '8888') {
            roomState.players.forEach(p => p.isHost = (p.id === socket.id));
            roomState.hostId = socket.id;
            io.emit('update-room', roomState);
            socket.emit('host-success');
        } else {
            socket.emit('host-fail', 'Invalid Host PIN');
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
            roomState.gameState = 'countdown';
            roomState.board = rollBoard(parseInt(roomState.settings.gridSize));
            io.emit('run-countdown');
            
            setTimeout(() => {
                roomState.gameState = 'playing';
                io.emit('start-game-play', {
                    board: roomState.board,
                    settings: roomState.settings
                });
            }, 4000); // 4 steps: THREE, TWO, ONE, GO (1s each)
        }
    });

    socket.on('submit-results', (data) => {
        const p = roomState.players.find(x => x.id === socket.id);
        if (p) {
            p.submittedWords = data.words;
            p.finalScore = data.score;
        }

        // Check if all players submitted
        const allFinished = roomState.players.every(pl => pl.submittedWords.length > 0 || pl.finalScore !== undefined);
        if (allFinished || socket.id === roomState.hostId) {
            roomState.gameState = 'results';
            io.emit('show-leaderboard', roomState.players);
        }
    });

    socket.on('disconnect', () => {
        roomState.players = roomState.players.filter(p => p.id !== socket.id);
        if (roomState.hostId === socket.id && roomState.players.length > 0) {
            roomState.players[0].isHost = true;
            roomState.hostId = roomState.players[0].id;
        }
        io.emit('update-room', roomState);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Word Wonder server running on port ${PORT}`);
});