const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const { Pool } = require('pg'); 
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const server = http.createServer(app);
const io = new Server(server);

// --- CONFIG DB ---
const pool = new Pool({
    user: 'uapv2401716',
    host: '127.0.0.1',
    database: 'etd',
    password: 'QjBchY',
    port: 5432,
});

// --- STATIC ---
app.use('/templates', express.static(path.join(__dirname, '../templates')));

// --- PATH FRONT ---
const cheminVues = path.join(__dirname, '../templates/front/');

// --- ROUTES FRONT ---
app.get('/', (req, res) => res.sendFile(path.join(cheminVues, 'index.html')));
app.get('/room', (req, res) => res.sendFile(path.join(cheminVues, 'room.html')));
app.get('/login', (req, res) => res.sendFile(path.join(cheminVues, 'login.html')));
app.get('/signup', (req, res) => res.sendFile(path.join(cheminVues, 'signup.html')));
app.get('/testDB.html', (req, res) =>
    res.sendFile(path.join(__dirname, '../testDB.html'))
);

// ============================
// ✅ API DEBUG BDD
// ============================

// USERS + ROOMS
app.get('/api/rooms-users', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT r.room_id, u.username, u.email 
            FROM room r
            JOIN "user" u ON u.current_room_id = r.room_id
            ORDER BY r.room_id;
        `);
        res.json(result.rows);
    } catch (err) {
        console.error("rooms-users error:", err);
        res.status(500).send("Erreur BDD");
    }
});

// ALL USERS
app.get('/api/all-users', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT user_id, username, email, role 
            FROM "user" 
            ORDER BY user_id ASC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error("all-users error:", err);
        res.status(500).send("Erreur BDD");
    }
});

// ALL MARKERS
app.get('/api/all-markers', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT m.marker_id, m.room_id, m.timestamp_seconds, m.comment, m.category, u.username
            FROM marker m
            LEFT JOIN "user" u ON m.user_id = u.user_id
            ORDER BY m.room_id ASC, m.timestamp_seconds ASC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error("all-markers error:", err);
        res.status(500).send("Erreur BDD Marqueurs");
    }
});

// CLEAN DB
app.post('/api/clean-db', async (req, res) => {
    try {
        await pool.query(`
            TRUNCATE TABLE video, playlist, marker, room, "user" RESTART IDENTITY CASCADE
        `);

        res.json({ success: true, message: "Base de données nettoyée." });
    } catch (err) {
        console.error("clean-db error:", err);
        res.status(500).json({ success: false });
    }
});

// ============================
// SOCKET.IO
// ============================

let rooms = {};

function generateRoomCode() {
    let code;
    do {
        code = Math.floor(100000 + Math.random() * 900000).toString();
    } while (rooms[code]);
    return code;
}

io.on('connection', (socket) => {

    socket.on('request_create_room', () => {
        const code = generateRoomCode();
        rooms[code] = { users: [], controller: null };
        socket.emit('room_created', code);
    });

    socket.on('join_room', async ({ roomCode, username }) => {
        const roomIdInt = parseInt(roomCode);

        if (!rooms[roomCode]) {
            rooms[roomCode] = { users: [], controller: null };
        }

        if (!rooms[roomCode].users.find(u => u.username === username)) {
            rooms[roomCode].users.push({ id: socket.id, username });
        }

        socket.join(roomCode);

        try {
            const userRes = await pool.query(
                'SELECT user_id FROM "user" WHERE username = $1',
                [username]
            );

            let userId;

            if (userRes.rowCount > 0) {
                userId = userRes.rows[0].user_id;

                await pool.query(
                    'UPDATE "user" SET current_room_id = $1 WHERE user_id = $2',
                    [roomIdInt, userId]
                );
            } else {
                const email = `${username}_${Date.now()}@guest.com`;

                const insert = await pool.query(`
                    INSERT INTO "user"(username,email,password,role,current_room_id)
                    VALUES ($1,$2,'guest','guest',$3)
                    RETURNING user_id
                `, [username, email, roomIdInt]);

                userId = insert.rows[0].user_id;
            }

            const roomExists = await pool.query(
                'SELECT * FROM room WHERE room_id = $1',
                [roomIdInt]
            );

            if (roomExists.rowCount === 0) {
                await pool.query(
                    'INSERT INTO room(room_id,name,host_id) VALUES ($1,$2,$3)',
                    [roomIdInt, 'Room ' + roomCode, userId]
                );
            }

        } catch (err) {
            console.error(err);
        }

        io.to(roomCode).emit('update_users', rooms[roomCode].users);
    });

    socket.on('send_message', async ({ roomCode, username, message_text, currentVideoTime }) => {
        const roomIdInt = parseInt(roomCode);

        try {
            const userRes = await pool.query(
                'SELECT user_id FROM "user" WHERE username = $1',
                [username]
            );

            const userId = userRes.rowCount ? userRes.rows[0].user_id : null;

            await pool.query(`
                INSERT INTO chat(room_id,user_id,currentVideoTime,message_text)
                VALUES ($1,$2,$3,$4)
            `, [roomIdInt, userId, Math.floor(currentVideoTime || 0), message_text]);

            io.to(roomCode).emit('receive_message', {
                username,
                message_text,
                currentVideoTime: Math.floor(currentVideoTime || 0),
                isSystem: false
            });

        } catch (err) {
            console.error(err);
        }
    });

});

// ============================

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Serveur lancé sur http://localhost:${PORT}`);
});