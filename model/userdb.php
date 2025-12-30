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

require_once __DIR__ . '/GestionDB.php';
require_once __DIR__ . '/../class/user.php';

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

    public static function create($username, $email, $password) {
        $db = GestionDB::connexion();
        // On hache le mot de passe pour la sécurité
        $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

        $stmt = $db->prepare("INSERT INTO users (username, email, password) VALUES (?, ?, ?)");
        return $stmt->execute([$username, $email, $hashedPassword]);
    }

    public static function getByEmail($email) {
        $db = GestionDB::connexion();
        $stmt = $db->prepare("SELECT * FROM users WHERE email = ?");
        $stmt->execute([$email]);
        $row = $stmt->fetch();

        if ($row) {
            return new user($row['id'], $row['username'], $row['email'], $row['password']);
        }
        return null;
    }

    public function findUser($username) {
        $sql = "SELECT * FROM users WHERE username = :username";
        $stmt = $this->db->pdo->prepare($sql);
        $stmt->execute(['username' => $username]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

}