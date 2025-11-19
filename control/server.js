// server.js
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// On sert les fichiers statiques depuis la racine (pour le CSS/JS plus tard)
app.use(express.static(__dirname));

// On dit explicitement d'envoyer index.html quand on va sur l'accueil '/'
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// --- SIMULATION BASE DE DONNÉES (LOCALE) ---
// On stocke les salons ici. Structure : { "CODE_SALON": { hostId: "socket_id", users: [] } }
let rooms = {}; 

// Fonction utilitaire pour générer un code de salon aléatoire (ex: 123456)
function generateRoomCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

io.on('connection', (socket) => {
    console.log('Un utilisateur est connecté :', socket.id);

    // --- ÉVÉNEMENT : CRÉER UN SALON ---
    socket.on('create_room', (username) => {
        const roomCode = generateRoomCode();
        
        // Création de l'objet salon
        rooms[roomCode] = {
            host: socket.id,
            users: [{ id: socket.id, username: username }] // On ajoute le créateur
        };

        socket.join(roomCode); // Fonction Socket.io pour rejoindre un "canal"
        
        // On renvoie le code au client pour qu'il l'affiche
        socket.emit('room_created', roomCode);
        
        // On met à jour la liste des utilisateurs dans le salon
        io.to(roomCode).emit('update_users', rooms[roomCode].users);
        
        console.log(`Salon créé : ${roomCode} par ${username}`);
    });

    // --- ÉVÉNEMENT : REJOINDRE UN SALON ---
    socket.on('join_room', (data) => {
        const { roomCode, username } = data;

        // Vérifier si le salon existe
        if (rooms[roomCode]) {
            rooms[roomCode].users.push({ id: socket.id, username: username });
            socket.join(roomCode);

            // Dire au client que c'est bon
            socket.emit('room_joined', roomCode);

            // Prévenir tout le monde dans le salon qu'il y a un nouveau venu
            io.to(roomCode).emit('update_users', rooms[roomCode].users);
            
            console.log(`${username} a rejoint le salon ${roomCode}`);
        } else {
            socket.emit('error_message', "Ce code de salon n'existe pas !");
        }
    });

    // --- GESTION DE LA DÉCONNEXION ---
    socket.on('disconnect', () => {
        // Logique simple : on parcourt les salons pour retirer l'utilisateur
        // (Dans une vraie DB ce sera plus propre, ici c'est du bricolage pour le prototype)
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
