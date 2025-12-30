<?php
/**
 * Fichier : userDB.php
 *
 * Gère les opérations liées à la base de données pour les utilisateurs (ajout, récupération).
 *
 * @author: EL GANDOUZ Amine
 *
 * @method userExists($username) vérifie si l'utilisateur exite dans le BDD
 * @method create($username, $mail, $hashedPassword) création d'un utilisateur au moment du register
 * @method findUser($username) cherche si l'utilisateur est présent dans la BDD
 * ||
 * Erreur : Renvoie null ou false en cas d’échec.
 */

namespace bd;

use classe\user;
use \PDO;

require('../class/user.php');
require('GestionDB.php');


class UserDB {
    public static function create($username, $email, $password) {
        $db = GestionDB::connexion();
        $hash = password_hash($password, PASSWORD_DEFAULT);
        
        try {
            $stmt = $db->prepare("INSERT INTO users (username, email, password) VALUES (?, ?, ?)");
            return $stmt->execute([$username, $email, $hash]);
        } catch (\PDOException $e) {
            return false;
        }
    }

    public static function getByEmail($email) {
        $db = GestionDB::connexion();
        $stmt = $db->prepare("SELECT * FROM users WHERE email = ?");
        $stmt->execute([$email]);
        $row = $stmt->fetch();

        if ($row) {
            return $row; // On retourne le tableau associatif contenant le hash
        }
        return null;
    }
}