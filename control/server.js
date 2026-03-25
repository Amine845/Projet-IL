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

// --- DB ---
const pool = new Pool({
    user: 'uapv2401716',
    host: '127.0.0.1',
    database: 'etd',
    password: 'QjBchY',
    port: 5432,
});

// --- STATIC ---
app.use('/templates', express.static(path.join(__dirname, '../templates')));
app.use(express.static(path.join(__dirname, '../templates/front')));

// --- FRONT ROUTES ---
const cheminVues = path.join(__dirname, '../templates/front/');

app.get('/', (req, res) => res.sendFile(path.join(cheminVues, 'index.html')));
app.get('/room', (req, res) => res.sendFile(path.join(cheminVues, 'room.html')));
app.get('/login', (req, res) => res.sendFile(path.join(cheminVues, 'login.html')));
app.get('/signup', (req, res) => res.sendFile(path.join(cheminVues, 'signup.html')));

app.get('/testDB.html', (req, res) =>
    res.sendFile(path.join(__dirname, '../testDB.html'))
);

// ================= API =================

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
        console.error(err);
        res.status(500).send("Erreur BDD");
    }
});

app.get('/api/all-users', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT user_id, username, email, role 
            FROM "user"
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send("Erreur BDD");
    }
});

app.get('/api/all-markers', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT m.*, u.username
            FROM marker m
            LEFT JOIN "user" u ON m.user_id = u.user_id
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send("Erreur BDD");
    }
});

app.post('/api/clean-db', async (req, res) => {
    try {
        await pool.query(`
            TRUNCATE TABLE video, playlist, marker, room, "user" RESTART IDENTITY CASCADE
        `);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
});

// ================= SOCKET =================

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

    // ✅ AJOUT : vérification existence room
    socket.on('check_room_existence', (code) => {
        const exists = !!rooms[code];
        socket.emit('room_existence_result', { exists });
    });

    socket.on('join_room', async ({ roomCode, username }) => {

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
                    [parseInt(roomCode), userId]
                );
            } else {
                const email = `${username}_${Date.now()}@guest.com`;

                const insert = await pool.query(`
                    INSERT INTO "user"(username,email,password,role,current_room_id)
                    VALUES ($1,$2,'guest','guest',$3)
                    RETURNING user_id
                `, [username, email, parseInt(roomCode)]);

                userId = insert.rows[0].user_id;
            }

        } catch (err) {
            console.error(err);
        }

        io.to(roomCode).emit('update_users', rooms[roomCode].users);
    });

    socket.on('send_message', async ({ roomCode, username, message_text, currentVideoTime }) => {
        try {
            const userRes = await pool.query(
                'SELECT user_id FROM "user" WHERE username = $1',
                [username]
            );

            const userId = userRes.rowCount ? userRes.rows[0].user_id : null;

            await pool.query(`
                INSERT INTO chat(room_id,user_id,currentVideoTime,message_text)
                VALUES ($1,$2,$3,$4)
            `, [parseInt(roomCode), userId, Math.floor(currentVideoTime || 0), message_text]);

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

    // ✅ VIDEO SYNC
    socket.on('load_video', ({ roomCode, videoId }) => {
        io.to(roomCode).emit('load_video', videoId);
    });

    socket.on('video_action', ({ roomCode, type, currentTime }) => {
        io.to(roomCode).emit('sync_video', { type, currentTime });
    });

});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Serveur lancé sur http://localhost:${PORT}`);
});