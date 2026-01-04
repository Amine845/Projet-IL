// control/server.js
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const { Pool } = require('pg'); // Module Postgres
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- CONFIGURATION BDD (LOCALE) ---
const pool = new Pool({
    user: 'uapv2401716',
    host: '127.0.0.1',
    database: 'etd',
    password: 'QjBchY',
    port: 5432,
});

// --- CHEMINS ---
const cheminRacine = path.join(__dirname, '../');
const cheminVues = path.join(__dirname, '../templates/front/');
app.use(express.static(cheminRacine));

// midleware pour lire les formulaires
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/', (req, res) => res.sendFile(path.join(cheminVues, 'index.html')));
app.get('/room', (req, res) => res.sendFile(path.join(cheminVues, 'room.html')));
app.get('/testDB.html', (req, res) => res.sendFile(path.join(cheminRacine, 'testDB.html')));
app.get('/login', (req, res) => res.sendFile(path.join(cheminVues, 'login.html')));
app.get('/signup', (req, res) => res.sendFile(path.join(cheminVues, 'signup.html')));

// --- VARIABLES (Pour Socket.io) ---
// On garde ça pour la fluidité du temps réel, la BDD sert de stockage
let rooms = {}; 

function generateRoomCode() {
    let code;
    do {
        code = Math.floor(100000 + Math.random() * 900000).toString();
    } while (rooms[code]); 
    return code;
}

// --- ROUTE API POUR LE TEST ---
// C'est ça que testDB.html va appeler
app.get('/api/rooms-users', async (req, res) => {
    try {
        // Cette requête joint les tables pour avoir : Nom Salle | ID Salle | Pseudo
        const query = `
            SELECT r.room_id, u.username 
            FROM room r
            JOIN "user" u ON u.current_room_id = r.room_id
            ORDER BY r.room_id;
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send("Erreur BDD");
    }
});

io.on('connection', (socket) => {

    // --- CRÉATION (Avec BDD) ---
    socket.on('request_create_room', async () => {
        const code = generateRoomCode();
        
        // Initialisation
        rooms[code] = { users: [], controller: null };
        
        // On renvoie le code au client pour qu'il redirige (la BDD sera gérée au "join")
        // Note: Pour faire propre, on devrait créer la room en BDD ici, mais il nous faut un host_id.
        // Comme on n'a pas encore le pseudo ici (il est dans l'URL après redirection), 
        // on va ruser et créer la room dans la BDD au moment du "join_room" si elle n'existe pas.
        
        socket.emit('room_created', code);
    });

    // --- REJOINDRE (Avec BDD) ---
    socket.on('join_room', async (data) => {
        const { roomCode, username } = data;
        const roomIdInt = parseInt(roomCode); // Convertir en entier pour la BDD

        // GESTION (Socket.io)
        if (!rooms[roomCode]) {
            rooms[roomCode] = { users: [], controller: null };
        }
        rooms[roomCode].users.push({ id: socket.id, username: username });
        socket.join(roomCode);

        // GESTION BASE DE DONNÉES
        try {
            // Créer ou Récupérer l'utilisateur
            // On utilise "ON CONFLICT" pour ne pas planter si le pseudo existe déjà (si configuré unique)
            // Sinon on fait simple : INSERT. Note : user est un mot réservé, donc guillemets "user"
            
            // On insère l'user avec un mdp bidon car la colonne est NOT NULL
            const insertUser = `
                INSERT INTO "user" (username, password, role, current_room_id) 
                VALUES ($1, 'dummyPass', 'membre', $2)
                RETURNING user_id;
            `;
            // Note: Si tu veux gérer les doublons de pseudo proprement, c'est plus complexe.
            // Ici, chaque connexion crée une nouvelle entrée ou on suppose que c'est ok.
            const userRes = await pool.query(insertUser, [username, roomIdInt]);
            const userId = userRes.rows[0].user_id;

            // 2. Vérifier si la Room existe en BDD, sinon la créer
            const checkRoom = await pool.query('SELECT * FROM room WHERE room_id = $1', [roomIdInt]);
            
            if (checkRoom.rowCount === 0) {
                // Elle n'existe pas, on la crée.
                // On met le 1er utilisateur comme Host
                // On force l'ID de la room avec le code généré
                const insertRoom = `
                    INSERT INTO room (room_id, name, host_id) 
                    VALUES ($1, $2, $3)
                `;
                await pool.query(insertRoom, [roomIdInt, 'Salon ' + roomCode, userId]);
                console.log(`[BDD] Salon ${roomIdInt} créé par ${username}`);
            } else {
                console.log(`[BDD] ${username} a rejoint le salon ${roomIdInt}`);
            }

        } catch (err) {
            console.error("Erreur SQL lors du join:", err);
        }

        // C. NOTIFICATIONS SOCKET
        io.to(roomCode).emit('update_users', rooms[roomCode].users);
        if (rooms[roomCode].controller) socket.emit('update_controller', rooms[roomCode].controller);
        socket.to(roomCode).emit('receive_message', { username: 'Système', text: `${username} a rejoint.`, isSystem: true });
    });

    // --- EVENTS (Chat, Vidéo...) ---
    socket.on('check_room_existence', (code) => {
        const exists = !!rooms[code];
        socket.emit('room_existence_result', { exists });
    });

    socket.on('change_video', (data) => {
        if(rooms[data.roomCode]) io.to(data.roomCode).emit('load_video', data.videoId);
    });

    socket.on('send_message', (data) => io.to(data.roomCode).emit('receive_message', data));
    socket.on('typing', (data) => socket.to(data.roomCode).emit('user_typing', data.username));
    
    socket.on('claim_control', (data) => {
        const { roomCode, username } = data;
        if (rooms[roomCode]) {
            rooms[roomCode].controller = username;
            io.to(roomCode).emit('update_controller', username);
        }
    });

    socket.on('video_action', (data) => socket.to(data.roomCode).emit('sync_video', data));

    socket.on('disconnect', () => {
        // Note : Pour l'instant on ne supprime pas de la BDD à la déconnexion pour garder l'historique dans testDB
        // Sinon il faudrait faire un DELETE FROM "user" WHERE ...
        
        for (const code in rooms) {
            const userIndex = rooms[code].users.findIndex(user => user.id === socket.id);
            if (userIndex !== -1) {
                const username = rooms[code].users[userIndex].username;
                rooms[code].users.splice(userIndex, 1);
                io.to(code).emit('update_users', rooms[code].users);
                
                if (rooms[code].users.length === 0) delete rooms[code];
            }
        }
    });
});


// Fonction pour tout nettoyer
async function cleanDatabaseOnStart() {
    try {
        console.log("Nettoyage de la base de données...");
        // TRUNCATE vide les tables. RESTART IDENTITY remet les compteurs (ID) à 1.
        await pool.query('TRUNCATE TABLE video, playlist, room, "user" RESTART IDENTITY CASCADE');
        console.log("Base de données nettoyé !");
    } catch (err) {
        console.error("Erreur lors du nettoyage :", err);
    }
}

const PORT = 3000;

// On nettoie D'ABORD, et ensuite on lance le serveur
cleanDatabaseOnStart().then(() => {
    server.listen(PORT, () => {
        console.log(`Serveur lancé sur http://localhost:${PORT}`);
    });
});

// création de la route login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password)
        return res.status(400).json({ success: false, message: "Champs manquants" });

    try {
        const result = await pool.query(
            `SELECT * FROM users WHERE email = $1`,
            [email]
        );

        if (result.rowCount === 0)
            return res.json({ success: false, message: "Utilisateur introuvable" });

        const user = result.rows[0];

        const bcrypt = require("bcrypt");
        const ok = await bcrypt.compare(password, user.password);

        if (!ok)
            return res.json({ success: false, message: "Mot de passe incorrect" });

        res.json({
            success: true,
            username: user.username
        });

    } catch (e) {
        console.log(e);
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
});

// création de la route signup
const bcrypt = require("bcrypt");

app.post('/api/signup', async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password)
        return res.status(400).json({ success: false, message: "Tous les champs sont obligatoires." });

    try {
        // Vérifier si email déjà utilisé
        const check = await pool.query(
            `SELECT user_id FROM users WHERE email = $1`,
            [email]
        );

        if (check.rowCount > 0)
            return res.json({ success: false, message: "Un compte existe déjà avec cet email." });

        // Hash du mot de passe
        const hash = await bcrypt.hash(password, 10);

        // Insertion
        await pool.query(
            `INSERT INTO users (username, email, password)
             VALUES ($1, $2, $3)`,
            [username, email, hash]
        );

        res.json({
            success: true,
            message: "Compte créé avec succès"
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
});
