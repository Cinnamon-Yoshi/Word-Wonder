const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const ROOMS = ['Kitchen', 'Ballroom', 'Conservatory', 'Billiard Room', 'Library', 'Study', 'Hall', 'Lounge', 'Dining Room'];
const CHARACTERS = ['Col. Mustard', 'Prof. Plum', 'Mr. Green', 'Mrs. Peacock', 'Miss Scarlet', 'Dr. Orchid'];
const WEAPONS = ['Candlestick', 'Dagger', 'Lead Pipe', 'Revolver', 'Rope', 'Wrench'];

let gameState = {
    players: [],
    turnIndex: 0,
    gameStarted: false,
    caseFile: {},
    phase: 'waiting'
};

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    socket.on('join-game', (playerName) => {
        if (gameState.gameStarted) {
            socket.emit('error-msg', 'Game already in progress.');
            return;
        }

        const assignedCharacter = CHARACTERS[gameState.players.length % CHARACTERS.length];
        const newPlayer = {
            id: socket.id,
            name: playerName || `Player ${gameState.players.length + 1}`,
            character: assignedCharacter,
            cards: [],
            location: 'Hall'
        };

        gameState.players.push(newPlayer);
        io.emit('update-lobby', gameState.players);
    });

    socket.on('start-game', () => {
        if (gameState.players.length < 2) {
            socket.emit('error-msg', 'Need at least 2 players to start.');
            return;
        }

        const solutionRoom = ROOMS[Math.floor(Math.random() * ROOMS.length)];
        const solutionWeapon = WEAPONS[Math.floor(Math.random() * WEAPONS.length)];
        const solutionSuspect = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
        
        gameState.caseFile = { room: solutionRoom, weapon: solutionWeapon, suspect: solutionSuspect };

        let deckRooms = ROOMS.filter(r => r !== solutionRoom);
        let deckWeapons = WEAPONS.filter(w => w !== solutionWeapon);
        let deckSuspects = CHARACTERS.filter(s => s !== solutionSuspect);
        let fullDeck = [...deckRooms, ...deckWeapons, ...deckSuspects];
        fullDeck.sort(() => Math.random() - 0.5);

        gameState.players.forEach((player) => {
            player.cards = [];
        });
        
        let cardIndex = 0;
        while (cardIndex < fullDeck.length) {
            for (let i = 0; i < gameState.players.length && cardIndex < fullDeck.length; i++) {
                gameState.players[i].cards.push(fullDeck[cardIndex]);
                cardIndex++;
            }
        }

        gameState.gameStarted = true;
        gameState.phase = 'playing';

        gameState.players.forEach(player => {
            io.to(player.id).emit('game-started', {
                hand: player.cards,
                players: gameState.players,
                turn: gameState.players[gameState.turnIndex].id
            });
        });
    });

    socket.on('move-player', (newLocation) => {
        const player = gameState.players.find(p => p.id === socket.id);
        if (!player || gameState.players[gameState.turnIndex].id !== socket.id) return;

        player.location = newLocation;
        io.emit('board-updated', gameState.players);
    });

    socket.on('end-turn', () => {
        if (gameState.players[gameState.turnIndex].id !== socket.id) return;

        gameState.turnIndex = (gameState.turnIndex + 1) % gameState.players.length;
        io.emit('turn-changed', gameState.players[gameState.turnIndex].id);
    });

    socket.on('disconnect', () => {
        gameState.players = gameState.players.filter(p => p.id !== socket.id);
        if (gameState.players.length === 0) {
            gameState.gameStarted = false;
            gameState.turnIndex = 0;
        }
        io.emit('update-lobby', gameState.players);
        console.log(`Player disconnected: ${socket.id}`);
    });
});

server.listen(process.env.PORT || 3000, () => {
    console.log('Server running');
});