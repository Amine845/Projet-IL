// control/serveur.js
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- GESTION DES CHEMINS ---
// __dirname est le dossier "control". 
// On veut servir les fichiers statiques (css/js/html) qui sont dans "Dossier_General" (un cran au-dessus)
const cheminRacine = path.join(__dirname, '../');
app.use(express.static(cheminRacine));

// Route pour la page d'accueil (index.html)
app.get('/', (req, res) => {
    res.sendFile(path.join(cheminRacine, 'index.html'));
});

// Route pour la page de salon (room.html)
app.get('/room', (req, res) => {
    res.sendFile(path.join(cheminRacine, 'room.html'));
});

// --- BASE DE DONNÉES LOCALE ---
let rooms = {}; 

// Générateur de code
function generateRoomCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

io.on('connection', (socket) => {
    
    // Événement spécial : demande de création de code (depuis index.html)
    socket.on('request_create_room', () => {
        const code = generateRoomCode();
        // On renvoie juste le code, la redirection se fera côté client
        socket.emit('room_created', code);
    });

    // Événement : Rejoindre le salon (depuis room.html)
    socket.on('join_room', (data) => {
        const { roomCode, username } = data;

        // Si le salon n'existe pas encore (première connexion), on le crée à la volée
        if (!rooms[roomCode]) {
            rooms[roomCode] = { users: [] };
            console.log(`Salon ${roomCode} initialisé.`);
        }

        // Ajout de l'utilisateur
        rooms[roomCode].users.push({ id: socket.id, username: username });
        socket.join(roomCode);

        // Notifier tout le monde
        io.to(roomCode).emit('update_users', rooms[roomCode].users);
        
        // Message système
        socket.to(roomCode).emit('receive_message', {
            username: 'Système',
            text: `${username} a rejoint le salon.`
        });
    });

    // Chat
    socket.on('send_message', (data) => {
        io.to(data.roomCode).emit('receive_message', data);
    });

    // Déconnexion
    socket.on('disconnect', () => {
        for (const code in rooms) {
            rooms[code].users = rooms[code].users.filter(user => user.id !== socket.id);
            io.to(code).emit('update_users', rooms[code].users);
        }
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Serveur lancé sur http://localhost:${PORT}`);
});