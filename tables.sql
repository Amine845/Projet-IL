DROP TABLE IF EXISTS video CASCADE;
DROP TABLE IF EXISTS playlist CASCADE;
DROP TABLE IF EXISTS room CASCADE;
DROP TABLE IF EXISTS "user" CASCADE;

-- ________________________________________________________ --

CREATE TABLE "user" (
    -- Clé Primaire : ID de l'utilisateur (auto-incrémenté)
                        user_id SERIAL PRIMARY KEY,

    -- Nom d'utilisateur (requis, unique pour la connexion)
                        username VARCHAR(50) NOT NULL UNIQUE,

    -- Mot de passe haché (utiliser TEXT pour stocker le hachage long, ex: bcrypt)
                        password TEXT NOT NULL,

    -- Rôle de l'utilisateur (ex: 'admin', 'membre', 'hôte')
                        role VARCHAR(20) DEFAULT 'membre',

    -- Pour savoir dans quelle salle est l'utilisateur
                        current_room_id INTEGER
);

CREATE TABLE room (
    -- Clé Primaire : ID de la salle
                      room_id SERIAL PRIMARY KEY,

    -- Nom de la salle
                      name VARCHAR(100) NOT NULL,

    -- Mot de passe optionnel pour les salles privées
                      password VARCHAR(255),

    -- Clé Étrangère : L'ID de l'utilisateur hôte (créateur de la salle)
    -- Récupère user_id de la table "user".
                      host_id INTEGER NOT NULL,

    -- Définition de la contrainte de clé étrangère
                      CONSTRAINT fk_host
                          FOREIGN KEY (host_id)
                              REFERENCES "user"(user_id)
                              ON DELETE CASCADE -- Si l'hôte est supprimé, la salle est supprimée
);

CREATE TABLE playlist (
    -- Clé Primaire : ID de la playlist
                          playlist_id SERIAL PRIMARY KEY,

    -- Clé Étrangère : ID de la salle à laquelle appartient la playlist
    -- room_id clé étrangère
                          room_id INTEGER NOT NULL,

    -- Compteur de vidéos dans la playlist (peut être maintenu par l'application)
                          video_count INTEGER DEFAULT 0,

    -- Définition de la contrainte de clé étrangère
                          CONSTRAINT fk_room
                              FOREIGN KEY (room_id)
                                  REFERENCES room(room_id)
                                  ON DELETE CASCADE -- Si la salle est supprimée, la playlist est supprimée
);

CREATE TABLE video (
    -- Clé Primaire : ID de la vidéo (identifiant interne)
                       video_id SERIAL PRIMARY KEY,

    -- URL de la vidéo (ou l'ID YouTube si vous la stockez séparément)
                       "URL" VARCHAR(255) NOT NULL,

    -- Titre de la vidéo
                       title VARCHAR(255) NOT NULL,

    -- Clé Étrangère : ID de la playlist à laquelle appartient la vidéo
    -- clé étrangère playlist_id
                       playlist_id INTEGER NOT NULL,

    -- Définition de la contrainte de clé étrangère
                       CONSTRAINT fk_playlist
                           FOREIGN KEY (playlist_id)
                               REFERENCES playlist(playlist_id)
                               ON DELETE CASCADE -- Si la playlist est supprimée, les vidéos sont supprimées
);