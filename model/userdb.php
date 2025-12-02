<?php
/**
 * Fichier : userDB.php
 *
 * Gère les opérations liées à la base de données pour les utilisateurs (ajout, récupération).
 *
 * @author: EL GANDOUZ Amine
 *
 * @method userExists($username) vérifie si l'utilisateur exite dans le BDD
 * @method createUser($username, $hashedPassword) création d'un utilisateur au moment du register
 * @method findUser($username) cherche si l'utilisateur est présent dans la BDD
 * ||
 * Erreur : Retourne null ou false en cas d’échec.
 */

namespace bd;

use classe\user;
use \PDO;

require('../class/user.php');

require('GestionDB.php');
use bd\GestionDB;

class userdb{

    private $db;

    public function __construct() {
        // Initialisation de la connexion à la base de données
        $this->db = new GestionDB();
        $this->db->connexion();
    }

    public function userExists($username) {
        $sql = "SELECT * FROM users WHERE username = :username";
        $stmt = $this->db->pdo->prepare($sql);
        $stmt->execute(['username' => $username]);
        return $stmt->fetch();
    }

    public function createUser($username, $hashedPassword) {
        $sql = "INSERT INTO users (username, password) VALUES (:username, :password)";
        $stmt = $this->db->pdo->prepare($sql);
        return $stmt->execute([
            'username' => $username,
            'password' => $hashedPassword
        ]);
    }

    public function findUser($username) {
        $sql = "SELECT * FROM users WHERE username = :username";
        $stmt = $this->db->pdo->prepare($sql);
        $stmt->execute(['username' => $username]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

}