-- 1. NETTOYAGE COMPLET (On supprime tout pour repartir à zéro)
DROP TABLE IF EXISTS video, playlist, room, "user" CASCADE;

-- 2. CRÉATION DES TABLES

CREATE TABLE "user" (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) UNIQUE, -- J'ai ajouté UNIQUE pour éviter les doublons
    password TEXT NOT NULL,
    role VARCHAR(20) DEFAULT 'membre',
    current_room_id INTEGER -- Sera lié plus tard pour éviter les erreurs cycliques
);

CREATE TABLE room (
    room_id INTEGER PRIMARY KEY, -- On n'utilise pas SERIAL ici car l'ID est généré par le code JS (le code aléatoire)
    name VARCHAR(100),
    host_id INTEGER REFERENCES "user"(user_id) ON DELETE SET NULL, -- Le chef de la salle
    password VARCHAR(50) -- Optionnel
);

CREATE TABLE playlist (
    playlist_id SERIAL PRIMARY KEY,
    room_id INTEGER REFERENCES room(room_id) ON DELETE CASCADE,
    video_count INTEGER DEFAULT 0
);

CREATE TABLE video (
    video_id SERIAL PRIMARY KEY,
    "URL" VARCHAR(255) NOT NULL, -- "URL" en majuscules pour matcher ton code existant si besoin
    title VARCHAR(255),
    playlist_id INTEGER REFERENCES playlist(playlist_id) ON DELETE CASCADE
);

-- 3. INSERTION DES DONNÉES DE TEST (Optionnel mais pratique)
INSERT INTO "user" (username, email, password, role) VALUES ('AdminTest', 'admin@test.com', '12345', 'admin');
-- Note : Comme room a besoin d'un host_id qui vient d'être créé (ID 1), on peut créer la room maintenant.
INSERT INTO room (room_id, name, host_id) VALUES (123456, 'Salon Test', 1);