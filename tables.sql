-- 1. NETTOYAGE COMPLET
DROP TABLE IF EXISTS marker, chat, video, playlist, room, "user" CASCADE;

-- 2. CRÉATION DES TABLES

CREATE TABLE "user" (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role VARCHAR(20) DEFAULT 'membre',
    current_room_id INTEGER
);

CREATE TABLE room (
    room_id INTEGER PRIMARY KEY,
    name VARCHAR(100),
    host_id INTEGER REFERENCES "user"(user_id) ON DELETE SET NULL,
    password VARCHAR(50)
);

CREATE TABLE playlist (
    playlist_id SERIAL PRIMARY KEY,
    room_id INTEGER REFERENCES room(room_id) ON DELETE CASCADE,
    video_count INTEGER DEFAULT 0
);

CREATE TABLE chat (
    chat_id SERIAL PRIMARY KEY,
    room_id INTEGER REFERENCES room(room_id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES "user"(user_id) ON DELETE SET NULL,
    currentVideoTime INTEGER DEFAULT 0,
    message_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE video (
    video_id SERIAL PRIMARY KEY,
    "URL" VARCHAR(255) NOT NULL,
    title VARCHAR(255),
    playlist_id INTEGER REFERENCES playlist(playlist_id) ON DELETE CASCADE
);

CREATE TABLE marker (
    marker_id SERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL REFERENCES room(room_id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES "user"(user_id) ON DELETE SET NULL,
    timestamp_seconds REAL NOT NULL,
    comment TEXT NOT NULL,
    category VARCHAR(20) DEFAULT 'info',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);