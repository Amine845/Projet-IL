// control/server.js
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const { Pool } = require('pg'); 
const path = require('path');
const bcrypt = require("bcrypt"); 

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
app.use('/templates', express.static(path.join(__dirname, '../templates')));

const cheminRacine = path.join(__dirname, '../');
const cheminVues = path.join(__dirname, '../templates/front/');

app.get('/', (req, res) => res.sendFile(path.join(cheminVues, 'index.html')));
app.get('/room', (req, res) => res.sendFile(path.join(cheminVues, 'room.html')));
app.get('/login', (req, res) => res.sendFile(path.join(cheminVues, 'login.html')));
app.get('/signup', (req, res) => res.sendFile(path.join(cheminVues, 'signup.html')));
app.get('/testDB.html', (req, res) => res.sendFile(path.join(cheminRacine, 'testDB.html')));

let rooms = {};

function generateRoomCode() {
    let code;
    do {
        code = Math.floor(100000 + Math.random() * 900000).toString();
    } while (rooms[code]);
    return code;
}

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
        const query = 'SELECT user_id, username, email, role FROM "user" ORDER BY user_id ASC';
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send("Erreur BDD");
    }
});

// --- API VISUALISATION MARQUEURS ---
app.get('/api/all-markers', async (req, res) => {
    try {
        const query = `
            SELECT m.marker_id, m.room_id, m.timestamp_seconds, m.comment, m.category, u.username
            FROM marker m
            LEFT JOIN "user" u ON m.user_id = u.user_id
            ORDER BY m.room_id ASC, m.timestamp_seconds ASC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send("Erreur BDD Marqueurs");
    }
});

io.on('connection', (socket) => {

    socket.on('request_create_room', async () => {
        const code = generateRoomCode();
        rooms[code] = { users:[], controller: null };
        socket.emit('room_created', code);
    });

    socket.on('join_room', async (data) => {
        const { roomCode, username } = data;
        const roomIdInt = parseInt(roomCode);

        if (!rooms[roomCode]) {
            rooms[roomCode] = { users:[], controller: null };
        }
        const alreadyInRoom = rooms[roomCode].users.find(u => u.username === username);
        if (!alreadyInRoom) {
            rooms[roomCode].users.push({ id: socket.id, username: username });
        }
        socket.join(roomCode);

        try {
            let userId;
            const checkUser = await pool.query('SELECT user_id FROM "user" WHERE username = $1', [username]);

            if (checkUser.rowCount > 0) {
                userId = checkUser.rows[0].user_id;
                await pool.query('UPDATE "user" SET current_room_id = $1 WHERE user_id = $2',[roomIdInt, userId]);
            } else {
                const fakeEmail = `${username}_${Date.now()}@guest.com`;
                const insertUser = `
                    INSERT INTO "user" (username, email, password, role, current_room_id) 
                    VALUES ($1, $2, 'guestPass', 'guest', $3)
                    RETURNING user_id;
                `;
                const userRes = await pool.query(insertUser, [username, fakeEmail, roomIdInt]);
                userId = userRes.rows[0].user_id;
            }

            const checkRoom = await pool.query('SELECT * FROM room WHERE room_id = $1', [roomIdInt]);
            if (checkRoom.rowCount === 0) {
                const insertRoom = `INSERT INTO room (room_id, name, host_id) VALUES ($1, $2, $3)`;
                await pool.query(insertRoom,[roomIdInt, 'Salon ' + roomCode, userId]);
            }

        } catch (err) {
            console.error("Erreur SQL lors du join:", err);
        }

        io.to(roomCode).emit('update_users', rooms[roomCode].users);
        if (rooms[roomCode].controller) socket.emit('update_controller', rooms[roomCode].controller);
        socket.to(roomCode).emit('receive_message', { username: 'Système', text: `${username} a rejoint.`, isSystem: true });
    });

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

    socket.on('disconnect', async () => {
        for (const code in rooms) {
            const userIndex = rooms[code].users.findIndex(user => user.id === socket.id);
            if (userIndex !== -1) {
                const username = rooms[code].users[userIndex].username;

                rooms[code].users.splice(userIndex, 1);

                if (rooms[code].controller === username) {
                    rooms[code].controller = null;
                    io.to(code).emit('update_controller', 'Personne');
                }

                io.to(code).emit('update_users', rooms[code].users);

                try {
                    const userCheck = await pool.query('SELECT role FROM "user" WHERE username = $1',[username]);
                    if (userCheck.rowCount > 0) {
                        const role = userCheck.rows[0].role;
                        if (role === 'guest') {
                            await pool.query('DELETE FROM "user" WHERE username = $1', [username]);
                        } else {
                            await pool.query('UPDATE "user" SET current_room_id = NULL WHERE username = $1', [username]);
                        }
                    }

                    // On supprime la salle si elle est vide
                    if (rooms[code].users.length === 0) {
                        const roomIdInt = parseInt(code);
                        await pool.query('DELETE FROM room WHERE room_id = $1', [roomIdInt]);
                        delete rooms[code];
                    }
                } catch (err) {
                    console.error("Erreur SQL lors de la déconnexion:", err);
                }
                break;
            }
        }
    });

    // --- GESTION DES MARQUEURS ---
    socket.on('add_marker', async (data) => {
        const { roomCode, username, timestamp, comment, category } = data;
        const roomIdInt = parseInt(roomCode);

        try {
            const userRes = await pool.query('SELECT user_id FROM "user" WHERE username = $1',[username]);
            let userId = null;
            if (userRes.rowCount > 0) userId = userRes.rows[0].user_id;

            // CORRECTIF : La ligne manquante est ici !
            const insertQuery = `
                INSERT INTO marker (room_id, user_id, timestamp_seconds, comment, category)
                VALUES ($1, $2, $3, $4, $5)
            `;
            await pool.query(insertQuery, [roomIdInt, userId, timestamp, comment, category]);

            const allMarkers = await pool.query(`
                SELECT m.timestamp_seconds, m.comment, m.category, u.username 
                FROM marker m LEFT JOIN "user" u ON m.user_id = u.user_id 
                WHERE m.room_id = $1 ORDER BY m.timestamp_seconds ASC`, [roomIdInt]);

            io.to(roomCode).emit('update_markers', allMarkers.rows);

        } catch (err) {
            console.error("Erreur ajout marqueur:", err);
        }
    });

    socket.on('request_markers', async (roomCode) => {
        const roomIdInt = parseInt(roomCode);
        try {
            const query = `
                SELECT m.timestamp_seconds, m.comment, m.category, u.username
                FROM marker m
                LEFT JOIN "user" u ON m.user_id = u.user_id
                WHERE m.room_id = $1
                ORDER BY m.timestamp_seconds ASC
            `;
            const res = await pool.query(query, [roomIdInt]);
            socket.emit('update_markers', res.rows);
        } catch (err) {
            console.error("Erreur chargement marqueurs:", err);
        }
    });
});

async function cleanDatabaseOnStart() {
    try {
        console.log("Nettoyage de la base de données...");
        await pool.query('TRUNCATE TABLE video, playlist, room, "user" RESTART IDENTITY CASCADE');
        console.log("Base de données nettoyée !");
    } catch (err) {
        console.error("Erreur nettoyage :", err);
    }
}

app.post('/api/login', async (req, res) => {
    const { email, username, password } = req.body;
    if ((!email && !username) || !password) {
        return res.status(400).json({ success: false, message: "Champs manquants" });
    }

    try {
        let result;
        if (email) {
            result = await pool.query('SELECT * FROM "user" WHERE email = $1', [email]);
        } else {
            result = await pool.query('SELECT * FROM "user" WHERE username = $1', [username]);
        }

        if (result.rowCount === 0) return res.json({ success: false, message: "Utilisateur introuvable" });

        const user = result.rows[0];
        const ok = await bcrypt.compare(password, user.password);

        if (!ok) return res.json({ success: false, message: "Mot de passe incorrect" });

        res.json({ success: true, username: user.username });
    } catch (e) {
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
});

app.post('/api/signup', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ success: false, message: "Tous les champs sont obligatoires." });

    try {
        const checkEmail = await pool.query('SELECT user_id FROM "user" WHERE email = $1', [email]);
        if (checkEmail.rowCount > 0) return res.json({ success: false, message: "Email déjà utilisé." });

        const checkUsername = await pool.query('SELECT * FROM "user" WHERE username = $1', [username]);
        if (checkUsername.rowCount > 0) return res.json({ success: false, message: "Nom d'utilisateur déjà pris." });

        const hash = await bcrypt.hash(password, 10);
        await pool.query(
            'INSERT INTO "user" (username, email, password) VALUES ($1, $2, $3)', 
            [username, email, hash]
        );
        res.json({ success: true, message: "Compte créé avec succès" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Erreur serveur" });
    }
});

const PORT = 3000;
cleanDatabaseOnStart().then(() => {
    server.listen(PORT, () => {
       console.log(`Serveur lancé sur http://localhost:${PORT}`);
    });
});