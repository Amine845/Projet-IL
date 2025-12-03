// control/server.js
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- CHEMINS ---
const cheminRacine = path.join(__dirname, '../');
app.use(express.static(cheminRacine));

app.get('/', (req, res) => res.sendFile(path.join(cheminRacine, 'index.html')));
app.get('/room', (req, res) => res.sendFile(path.join(cheminRacine, 'room.html')));

// --- VARIABLES ---
let rooms = {}; 

function generateRoomCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

io.on('connection', (socket) => {
    
    socket.on('request_create_room', () => {
        const code = generateRoomCode();
        socket.emit('room_created', code);
    });

    socket.on('change_video', (data) => {
        // data = { roomCode, videoId }
        io.to(data.roomCode).emit('load_video', data.videoId);
    });

    socket.on('join_room', (data) => {
        const { roomCode, username } = data;

        if (!rooms[roomCode]) {
            // Ajout du champ 'controller' pour savoir qui dirige la vidéo
            rooms[roomCode] = { users: [], controller: null };
        }

        rooms[roomCode].users.push({ id: socket.id, username: username });
        socket.join(roomCode);

        // Mise à jour liste users
        io.to(roomCode).emit('update_users', rooms[roomCode].users);
        
        // Dire au nouveau qui est le contrôleur actuel
        if (rooms[roomCode].controller) {
            socket.emit('update_controller', rooms[roomCode].controller);
        }
        
        // Message système
        socket.to(roomCode).emit('receive_message', {
            username: 'Système',
            text: `${username} a rejoint le salon.`,
            isSystem: true
        });
    });

    socket.on('send_message', (data) => {
        io.to(data.roomCode).emit('receive_message', data);
    });

    socket.on('typing', (data) => {
        socket.to(data.roomCode).emit('user_typing', data.username);
    });

    // --- NOUVEAU : GESTION VIDÉO SYNCHRO ---

    // 1. Un utilisateur demande à prendre le contrôle
    socket.on('claim_control', (data) => {
        const { roomCode, username } = data;
        if (rooms[roomCode]) {
            rooms[roomCode].controller = username;
            // On prévient tout le monde
            io.to(roomCode).emit('update_controller', username);
            
            io.to(roomCode).emit('receive_message', {
                username: 'Système',
                text: `${username} a pris le contrôle de la vidéo.`,
                isSystem: true
            });
        }
    });

    // 2. Actions vidéo (Lecture, Pause, Seek)
    socket.on('video_action', (data) => {
        // data = { roomCode, type: 'play'|'pause'|'seek', currentTime }
        // On renvoie l'action à TOUS les autres sauf l'émetteur
        socket.to(data.roomCode).emit('sync_video', data);
    });

    // --- DÉCONNEXION ---
    socket.on('disconnect', () => {
        for (const code in rooms) {
            const userIndex = rooms[code].users.findIndex(user => user.id === socket.id);
            
            if (userIndex !== -1) {
                const username = rooms[code].users[userIndex].username;
                
                // Si c'était le contrôleur, on réinitialise
                if (rooms[code].controller === username) {
                    rooms[code].controller = null;
                    io.to(code).emit('update_controller', 'Personne');
                }

                rooms[code].users.splice(userIndex, 1);
                io.to(code).emit('update_users', rooms[code].users);
                io.to(code).emit('receive_message', {
                    username: 'Système',
                    text: `${username} a quitté le salon.`,
                    isSystem: true
                });
            }
        }
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Serveur lancé sur http://localhost:${PORT}`);
});