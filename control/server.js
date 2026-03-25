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

// --- CONFIGURATION BDD ---
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
let roomCleanupTimers = {};

function generateRoomCode() {
    let code;
    do {
        code = Math.floor(100000 + Math.random() * 900000).toString();
    } while (rooms[code]);
    return code;
}

io.on('connection', (socket) => {

    socket.on('request_create_room', async () => {
        const code = generateRoomCode();
        rooms[code] = { users:[], controller: null };
        socket.emit('room_created', code);
    });

    socket.on('join_room', async ({ roomCode, username }) => {
        const roomIdInt = parseInt(roomCode);

        if (!rooms[roomCode]) {
            rooms[roomCode] = { users:[], controller: null };
        }

        const alreadyInRoom = rooms[roomCode].users.find(u => u.username === username);
        if (!alreadyInRoom) {
            rooms[roomCode].users.push({ id: socket.id, username });
        }

        socket.join(roomCode);

        if (roomCleanupTimers[roomCode]) {
            clearTimeout(roomCleanupTimers[roomCode]);
            delete roomCleanupTimers[roomCode];
        }

        try {
            let userId;

            const checkUser = await pool.query(
                'SELECT user_id FROM "user" WHERE username = $1',
                [username]
            );

            if (checkUser.rowCount > 0) {
                userId = checkUser.rows[0].user_id;
                await pool.query(
                    'UPDATE "user" SET current_room_id = $1 WHERE user_id = $2',
                    [roomIdInt, userId]
                );
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
                await pool.query(
                    `INSERT INTO room (room_id, name, host_id) VALUES ($1, $2, $3)`,
                    [roomIdInt, 'Salon ' + roomCode, userId]
                );
            }

        } catch (err) {
            console.error(err);
        }

        io.to(roomCode).emit('update_users', rooms[roomCode].users);

        if (rooms[roomCode].controller) {
            socket.emit('update_controller', rooms[roomCode].controller);
        }

        const messages = await pool.query(`
            SELECT c.currentVideoTime, c.message_text, u.username
            FROM chat c
            LEFT JOIN "user" u ON c.user_id = u.user_id
            WHERE c.room_id = $1
            ORDER BY c.chat_id ASC
        `, [roomIdInt]);

        socket.emit('chat_history', messages.rows);
    });

    socket.on('send_message', async (data) => {
        const { roomCode, username, message_text, currentVideoTime } = data;
        const roomIdInt = parseInt(roomCode);

        try {
            const userRes = await pool.query(
                'SELECT user_id FROM "user" WHERE username = $1',
                [username]
            );

            const userId = userRes.rowCount > 0 ? userRes.rows[0].user_id : null;

            await pool.query(
                `INSERT INTO chat (room_id, user_id, currentVideoTime, message_text)
                 VALUES ($1, $2, $3, $4)`,
                [roomIdInt, userId, Math.floor(currentVideoTime || 0), message_text]
            );

            // ✅ FORMAT UNIFIÉ envoyé au client
            io.to(roomCode).emit('receive_message', {
                username,
                message_text,
                currentVideoTime: Math.floor(currentVideoTime || 0),
                isSystem: false
            });

        } catch (err) {
            console.error("Erreur sauvegarde chat:", err);
        }
    });

    socket.on('typing', (data) => {
        socket.to(data.roomCode).emit('user_typing', data.username);
    });

    socket.on('claim_control', (data) => {
        if (rooms[data.roomCode]) {
            rooms[data.roomCode].controller = data.username;
            io.to(data.roomCode).emit('update_controller', data.username);
        }
    });

    socket.on('video_action', (data) => {
        socket.to(data.roomCode).emit('sync_video', data);
    });

    socket.on('change_video', (data) => {
        if (rooms[data.roomCode]) {
            io.to(data.roomCode).emit('load_video', data.videoId);
        }
    });

    socket.on('request_markers', async (roomCode) => {
        const roomIdInt = parseInt(roomCode);
        try {
            const res = await pool.query(`
                SELECT m.timestamp_seconds, m.comment, m.category, u.username
                FROM marker m
                LEFT JOIN "user" u ON m.user_id = u.user_id
                WHERE m.room_id = $1
                ORDER BY m.timestamp_seconds ASC
            `, [roomIdInt]);

            socket.emit('update_markers', res.rows);
        } catch (err) {
            console.error(err);
        }
    });

    socket.on('add_marker', async (data) => {
        const { roomCode, username, timestamp, comment, category } = data;
        const roomIdInt = parseInt(roomCode);

        try {
            const userRes = await pool.query(
                'SELECT user_id FROM "user" WHERE username = $1',
                [username]
            );

            let userId = null;
            if (userRes.rowCount > 0) {
                userId = userRes.rows[0].user_id;
            }

            await pool.query(
                `INSERT INTO marker (room_id, user_id, timestamp_seconds, comment, category)
                 VALUES ($1, $2, $3, $4, $5)`,
                [roomIdInt, userId, timestamp, comment, category]
            );

            const allMarkers = await pool.query(`
                SELECT m.timestamp_seconds, m.comment, m.category, u.username 
                FROM marker m 
                LEFT JOIN "user" u ON m.user_id = u.user_id 
                WHERE m.room_id = $1 
                ORDER BY m.timestamp_seconds ASC
            `, [roomIdInt]);

            io.to(roomCode).emit('update_markers', allMarkers.rows);

        } catch (err) {
            console.error(err);
        }
    });

});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Serveur lancé sur http://localhost:${PORT}`);
});