<?php
/**
 * Fichier : user.php
 *
 * Représente un utilisateur avec ses attributs (user_id, username, mot de passe, rôle).
 *
 * @author: EL GANDOUZ Amine
 *
 * @property int $user_id
 * @property string $username
 * @property string $password
 * @property string $role
 */


namespace classe;

class user {
    public $username;
    public $password;
    public $user_id;

    public function __construct($username = '', $password = '') {
        $this->username = $username;
        $this->password = $password;
    }

    public function getUsername() {
        return $this->username;
    }

    public function getId() {
        return $this->user_id;
    }

    public function setPassword($val) {
        $this->password = $val;
    }


}



