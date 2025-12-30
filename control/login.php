<?php
/**
 * Fichier : login.php
 *
 * Formulaire de connexion au site web
 *
 * @author : EL GANDOUZ Amine
 *
 * @param : username, password
 *
 * @return : Vers le portefeuille de l'utilisateur
 * ||
 * Erreur : Identifiants incorrects ou alors Tous les champs sont obligatoires
 */

session_start();

$racine_path = '../';
include_once($racine_path . "model/userdb.php");
use bd\userdb;

require_once __DIR__ . '/../model/userdb.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = $_POST['email'];
    $password = $_POST['password'];

    $user = UserDB::getByEmail($email);

    if ($user && password_verify($password, $user->password)) {
        $_SESSION['user_id'] = $user->id;
        $_SESSION['username'] = $user->username;
        header('Location: ../room.html'); // Redirection vers le salon
    } else {
        header('Location: ../templates/front/login.html?error=invalid_credentials');
    }
}