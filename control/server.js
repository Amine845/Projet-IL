// control/server.js
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const { Pool } = require('pg'); // Module Postgres
const path = require('path');
const bcrypt = require("bcrypt"); // N'oublie pas l'import ici pour le login/signup

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
// On sert UNIQUEMENT le dossier templates en public
app.use('/templates', express.static(path.join(__dirname, '../templates')));

const cheminRacine = path.join(__dirname, '../');
const cheminVues = path.join(__dirname, '../templates/front/');

// Routes HTML
app.get('/', (req, res) => res.sendFile(path.join(cheminVues, 'index.html')));
app.get('/room', (req, res) => res.sendFile(path.join(cheminVues, 'room.html')));
app.get('/login', (req, res) => res.sendFile(path.join(cheminVues, 'login.html')));
app.get('/signup', (req, res) => res.sendFile(path.join(cheminVues, 'signup.html')));
app.get('/testDB.html', (req, res) => res.sendFile(path.join(cheminRacine, 'testDB.html')));

// --- VARIABLES MEMOIRE ---
let rooms = {};

function generateRoomCode() {
    let code;
    do {
        code = Math.floor(100000 + Math.random() * 900000).toString();
    } while (rooms[code]);
    return code;
}

// --- API VISUALISATION BDD ---
app.get('/api/rooms-users', async (req, res) => {
    try {
        const query = `
            SELECT r.room_id, u.username, u.email 
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

app.get('/api/all-users', async (req, res) => {
    try {
        // On récupère tout sauf le mot de passe
        const query = 'SELECT user_id, username, email, role FROM "user" ORDER BY user_id ASC';
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send("Erreur BDD");
    }
});

// --- SOCKET.IO ---
io.on('connection', (socket) => {

    // --- CRÉATION ---
    socket.on('request_create_room', async () => {
        const code = generateRoomCode();
        rooms[code] = { users: [], controller: null };
        socket.emit('room_created', code);
    });

    // --- REJOINDRE ---
    socket.on('join_room', async (data) => {
        const { roomCode, username } = data;
        const roomIdInt = parseInt(roomCode);

        // GESTION MEMOIRE (Socket.io)
        if (!rooms[roomCode]) {
            rooms[roomCode] = { users: [], controller: null };
        }
        // Eviter les doublons visuels dans la liste socket
        const alreadyInRoom = rooms[roomCode].users.find(u => u.username === username);
        if (!alreadyInRoom) {
            rooms[roomCode].users.push({ id: socket.id, username: username });
        }
        socket.join(roomCode);

        // GESTION BASE DE DONNÉES
        try {
            let userId;

            // 1. On vérifie si l'utilisateur existe déjà (par son pseudo)
            const checkUser = await pool.query('SELECT user_id FROM "user" WHERE username = $1', [username]);

            if (checkUser.rowCount > 0) {
                // CAS A : L'utilisateur existe -> On met à jour sa salle
                userId = checkUser.rows[0].user_id;
                await pool.query('UPDATE "user" SET current_room_id = $1 WHERE user_id = $2', [roomIdInt, userId]);
            } else {
                // CAS B : C'est un nouvel invité -> On le crée
                // On génère un email bidon unique pour ne pas bloquer la BDD (car email est UNIQUE)
                const fakeEmail = `${username}_${Date.now()}@guest.com`;

                const insertUser = `
                    INSERT INTO "user" (username, email, password, role, current_room_id) 
                    VALUES ($1, $2, 'guestPass', 'guest', $3)
                    RETURNING user_id;
                `;
                const userRes = await pool.query(insertUser, [username, fakeEmail, roomIdInt]);
                userId = userRes.rows[0].user_id;
            }

            // 2. Vérifier si la Room existe en BDD, sinon la créer
            const checkRoom = await pool.query('SELECT * FROM room WHERE room_id = $1', [roomIdInt]);

            if (checkRoom.rowCount === 0) {
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

        // On n'envoie le message "a rejoint" que si ce n'est pas un refresh de page (socket id différent mais même user)
        socket.to(roomCode).emit('receive_message', { username: 'Système', text: `${username} a rejoint.`, isSystem: true });
    });

    // --- AUTRES EVENTS ---
    socket.on('check_room_existence', (code) => {
        const exists = !!rooms[code];
        socket.emit('room_existence_result', { exists });
    });

    socket.on('change_video', (data) => {
        if (rooms[data.roomCode]) io.to(data.roomCode).emit('load_video', data.videoId);
    });

    socket.on('send_message', (data) => io.to(data.roomCode).emit('receive_message', data));
    socket.on('typing', (data) => socket.to(data.roomCode).emit('user_typing', data.username));

    socket.on('claim_control', (data) => {
        if (rooms[data.roomCode]) {
            rooms[data.roomCode].controller = data.username;
            io.to(data.roomCode).emit('update_controller', data.username);
        }
    });

    socket.on('video_action', (data) => socket.to(data.roomCode).emit('sync_video', data));

    // --- DÉCONNEXION (C'EST ICI QUE ÇA CHANGE) ---
    socket.on('disconnect', async () => {
        // On doit trouver dans quelle salle était ce socket
        for (const code in rooms) {
            const userIndex = rooms[code].users.findIndex(user => user.id === socket.id);

            if (userIndex !== -1) {
                const username = rooms[code].users[userIndex].username;

                // 1. Mise à jour MEMOIRE
                rooms[code].users.splice(userIndex, 1);

                // Reset contrôleur si c'était lui
                if (rooms[code].controller === username) {
                    rooms[code].controller = null;
                    io.to(code).emit('update_controller', 'Personne');
                }

                io.to(code).emit('update_users', rooms[code].users);

                // 2. Mise à jour BASE DE DONNÉES
                try {
                    // A. On vérifie le rôle de l'utilisateur
                    const userCheck = await pool.query('SELECT role FROM "user" WHERE username = $1', [username]);

                    if (userCheck.rowCount > 0) {
                        const role = userCheck.rows[0].role;

                        if (role === 'guest') {
                            // C'est un invité -> ON LE SUPPRIME DÉFINITIVEMENT
                            await pool.query('DELETE FROM "user" WHERE username = $1', [username]);
                            console.log(`[BDD] Invité ${username} supprimé.`);
                        } else {
                            // C'est un membre inscrit -> ON LE GARDE (Juste room = NULL)
                            await pool.query('UPDATE "user" SET current_room_id = NULL WHERE username = $1', [username]);
                            console.log(`[BDD] Membre ${username} sorti de la salle.`);
                        }
                    }

                    // B. Si la salle est vide, on la supprime
                    if (rooms[code].users.length === 0) {
                        const roomIdInt = parseInt(code);
                        await pool.query('DELETE FROM room WHERE room_id = $1', [roomIdInt]);
                        delete rooms[code];
                        console.log(`[BDD] Salon ${code} supprimé car vide.`);
                    }

                } catch (err) {
                    console.error("Erreur SQL lors de la déconnexion:", err);
                }

                // On arrête la boucle car on a trouvé l'user
                break;
            }
        }
    });

    // GESTION DES MARQUEURS (timestamp)

    // 1. Ajouter un marqueur
    socket.on('add_marker', async (data) => {
        // data = { roomCode, username, timestamp, comment }
        const { roomCode, username, timestamp, comment } = data;
        const roomIdInt = parseInt(roomCode);

        try {
            // On récupère l'ID de l'utilisateur
            const userRes = await pool.query('SELECT user_id FROM "user" WHERE username = $1', [username]);
            
            let userId = null;
            if (userRes.rowCount > 0) userId = userRes.rows[0].user_id;

            // Insertion en BDD
            const insertQuery = `
                INSERT INTO marker (room_id, user_id, timestamp_seconds, comment)
                VALUES ($1, $2, $3, $4)
                RETURNING marker_id, created_at
            `;
            const res = await pool.query(insertQuery, [roomIdInt, userId, timestamp, comment]);
            
            // On renvoie le marqueur complet à tout le monde
            const newMarker = {
                marker_id: res.rows[0].marker_id,
                username: username,
                timestamp_seconds: timestamp,
                comment: comment
            };
            
            io.to(roomCode).emit('new_marker', newMarker);

        } catch (err) {
            console.error("Erreur ajout marqueur:", err);
        }
    });

    // 2. Récupérer les marqueurs (Appelé au chargement de la page)
    socket.on('request_markers', async (roomCode) => {
        const roomIdInt = parseInt(roomCode);
        try {
            const query = `
                SELECT m.marker_id, m.timestamp_seconds, m.comment, u.username
                FROM marker m
                LEFT JOIN "user" u ON m.user_id = u.user_id
                WHERE m.room_id = $1
                ORDER BY m.timestamp_seconds ASC
            `;
            const res = await pool.query(query, [roomIdInt]);
            // On renvoie seulement à celui qui a demandé
            socket.emit('load_markers', res.rows);
        } catch (err) {
            console.error("Erreur chargement marqueurs:", err);
        }
    });

});


// --- NETTOYAGE AU DEMARRAGE ---
async function cleanDatabaseOnStart() {
    try {
        console.log("Nettoyage de la base de données...");
        await pool.query('TRUNCATE TABLE video, playlist, room, "user" RESTART IDENTITY CASCADE');
        console.log("Base de données nettoyée !");
    } catch (err) {
        console.error("Erreur nettoyage :", err);
    }
}

// --- API LOGIN / SIGNUP ---
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: "Champs manquants" });

    try {
        const result = await pool.query('SELECT * FROM "user" WHERE email = $1', [email]);
        if (result.rowCount === 0) return res.json({ success: false, message: "Utilisateur introuvable" });

        const user = result.rows[0];
        const ok = await bcrypt.compare(password, user.password);

        if (!ok) return res.json({ success: false, message: "Mot de passe incorrect" });

        res.json({ success: true, username: user.username });
    } catch (e) {
        console.log(e);
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
});

app.post('/api/signup', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ success: false, message: "Champs obligatoires." });

    try {
        const check = await pool.query('SELECT user_id FROM "user" WHERE email = $1', [email]);
        if (check.rowCount > 0) return res.json({ success: false, message: "Email déjà utilisé." });

        const hash = await bcrypt.hash(password, 10);
        await pool.query('INSERT INTO "user" (username, email, password) VALUES ($1, $2, $3)', [username, email, hash]);

        res.json({ success: true, message: "Compte créé" });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
});


const PORT = 3000;

// LANCEMENT AVEC NETTOYAGE
//cleanDatabaseOnStart().then(() => {
//    server.listen(PORT, () => {
//       console.log(`Serveur lancé sur http://localhost:${PORT}`);
//    });
//});

// LANCEMENT SANS NETTOYAGE
server.listen(PORT, () => {
    console.log(`Serveur lancé sur http://localhost:${PORT}`);
});