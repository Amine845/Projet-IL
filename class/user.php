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
    public $id;
    public $username;
    public $email;
    public $password;

    public function __construct($id, $username, $email, $password = null) {
        $this->id = $id;
        $this->username = $username;
        $this->email = $email;
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



