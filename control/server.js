// control/server.js
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- GESTION DES CHEMINS ---
const cheminRacine = path.join(__dirname, '../');
app.use(express.static(cheminRacine));

app.get('/', (req, res) => {
    res.sendFile(path.join(cheminRacine, 'index.html'));
});

app.get('/room', (req, res) => {
    res.sendFile(path.join(cheminRacine, 'room.html'));
});

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

    socket.on('join_room', (data) => {
        const { roomCode, username } = data;

        if (!rooms[roomCode]) {
            rooms[roomCode] = { users: [] };
        }

        rooms[roomCode].users.push({ id: socket.id, username: username });
        socket.join(roomCode);

        // Mise à jour liste users
        io.to(roomCode).emit('update_users', rooms[roomCode].users);
        
        // Message système : Entrée
        socket.to(roomCode).emit('receive_message', {
            username: 'Système',
            text: `${username} a rejoint le salon.`,
            isSystem: true
        });
    });

    socket.on('send_message', (data) => {
        // On renvoie le message à tout le monde dans la salle
        io.to(data.roomCode).emit('receive_message', data);
    });

    // --- NOUVEAU : Gestion du "En train d'écrire..." ---
    socket.on('typing', (data) => {
        // On envoie l'info à tout le monde sauf à celui qui écrit
        socket.to(data.roomCode).emit('user_typing', data.username);
    });

    socket.on('disconnect', () => {
        for (const code in rooms) {
            const userIndex = rooms[code].users.findIndex(user => user.id === socket.id);
            
            if (userIndex !== -1) {
                const username = rooms[code].users[userIndex].username;
                
                // Retirer l'utilisateur
                rooms[code].users.splice(userIndex, 1);
                
                // Mettre à jour la liste
                io.to(code).emit('update_users', rooms[code].users);

                // Message système : Sortie (Requis par le CDC)
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