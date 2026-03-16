-- 1. NETTOYAGE COMPLET (On supprime tout pour repartir à zéro)
DROP TABLE IF EXISTS video, playlist, room, "user" CASCADE;

-- 2. CRÉATION DES TABLES

CREATE TABLE "user" (
    -- Clé Primaire : ID de l'utilisateur (auto-incrémenté)
                        user_id SERIAL PRIMARY KEY,

    -- Nom d'utilisateur (requis, unique pour la connexion)
                        username VARCHAR(50) NOT NULL UNIQUE,

    -- Email de l'utilisateur (requis, unique pour la connexion)
                        email VARCHAR(255) UNIQUE NOT NULL,

    -- Mot de passe haché (utiliser TEXT pour stocker le hachage long, ex: bcrypt)
                        password TEXT NOT NULL,

    -- Rôle de l'utilisateur (ex: 'admin', 'membre', 'hôte')
                        role VARCHAR(20) DEFAULT 'membre',

    -- Pour savoir dans quelle salle est l'utilisateur
                        current_room_id INTEGER
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

    -- Définition de la contrainte de clé étrangère
                       CONSTRAINT fk_playlist
                           FOREIGN KEY (playlist_id)
                               REFERENCES playlist(playlist_id)
                               ON DELETE CASCADE -- Si la playlist est supprimée, les vidéos sont supprimées
);

CREATE TABLE marker (
    marker_id SERIAL PRIMARY KEY,
    
    -- Lien avec la salle
    room_id INTEGER NOT NULL,
    
    -- Lien avec l'utilisateur (qui a écrit la note)
    -- ON DELETE SET NULL : si l'user est supprimé, le commentaire reste (anonyme)
    user_id INTEGER REFERENCES "user"(user_id) ON DELETE SET NULL,
    
    -- Le temps exact dans la vidéo
    timestamp_seconds REAL NOT NULL,
    
    -- Le contenu du commentaire
    comment TEXT NOT NULL,

    category VARCHAR(20) DEFAULT "info",
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_room_marker
        FOREIGN KEY (room_id)
        REFERENCES room(room_id)
        ON DELETE CASCADE
);
