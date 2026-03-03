import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static files from the dist directory after build
app.use(express.static(path.join(__dirname, 'dist')));

let players = {};

// Helper function to get sorted rankings
const getRankings = () => {
    return Object.values(players)
        .map(player => ({ id: player.id, name: player.name, score: player.score }))
        .sort((a, b) => b.score - a.score);
};

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Initialize player with dummy data, will be updated on join
    players[socket.id] = {
        id: socket.id,
        position: { x: 0, y: 2, z: 10 },
        rotation: { y: 0 },
        health: 100,
        score: 0,
        name: "Anonymous",
        isDead: false
    };

    socket.on('join', (data) => {
        if (players[socket.id]) {
            players[socket.id].name = data.name || `Player ${socket.id.substr(0, 4)}`;

            // Send the current player list to the new player
            socket.emit('currentPlayers', players);

            // Broadcast new player to others
            socket.broadcast.emit('newPlayer', players[socket.id]);

            // Initial rankings sync
            io.emit('scoreUpdate', getRankings());
        }
    });

    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].position = movementData.position;
            players[socket.id].rotation = movementData.rotation;
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    socket.on('playerShoot', (shootData) => {
        socket.broadcast.emit('playerFired', {
            id: socket.id,
            origin: shootData.origin,
            direction: shootData.direction,
            range: shootData.range,
            hitId: shootData.hitId
        });
    });

    socket.on('playerHit', (data) => {
        const victimId = data.victimId;
        const damage = data.damage;

        if (players[victimId]) {
            players[victimId].health -= damage;
            if (players[victimId].health <= 0 && !players[victimId].isDead) {
                players[victimId].health = 0;
                players[victimId].isDead = true;

                // Increase attacker score
                if (players[socket.id]) {
                    players[socket.id].score += 1;
                }

                io.emit('playerDeath', { victimId, attackerId: socket.id });
                io.emit('scoreUpdate', getRankings());
            }
            io.emit('healthUpdate', { id: victimId, health: players[victimId].health });
        }
    });

    socket.on('playerRespawn', () => {
        if (players[socket.id]) {
            players[socket.id].health = 100;
            players[socket.id].isDead = false;
            players[socket.id].position = { x: (Math.random() - 0.5) * 40, y: 2, z: (Math.random() - 0.5) * 40 };
            io.emit('playerRespawned', players[socket.id]);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});
