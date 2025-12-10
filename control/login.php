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

// Gestion du bandeau cookie
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_POST['accept_cookies'])) {
        setcookie('cookies_accepted', 'true', time() + 365 * 24 * 3600, '/');
        $_SESSION['cookies_accepted'] = true;
        header("Location: " . $_SERVER['REQUEST_URI']);
        exit;
    }
    elseif (isset($_POST['decline_cookies'])) {
        // Pas de cookie créé ici
        $_SESSION['cookies_accepted'] = false;
        header("Location: " . $_SERVER['REQUEST_URI']);
        exit;
    }
}

// Vérifie si les cookies sont acceptés (depuis le cookie ou la session)
$cookies_acceptes = false;

if (isset($_COOKIE['cookies_accepted']) && $_COOKIE['cookies_accepted'] === 'true') {
    $cookies_acceptes = true;
} elseif (isset($_SESSION['cookies_accepted']) && $_SESSION['cookies_accepted'] === true) {
    $cookies_acceptes = true;
}

$racine_path = '../';
include($racine_path . "templates/front/entete.php");
include($racine_path . "templates/front/login_body.php");

include_once($racine_path . "model/userdb.php");

use bd\userdb;

$message = "";

if ($_SERVER["REQUEST_METHOD"] === "POST" && isset($_POST['username'], $_POST['password'])) {
    $username = $_POST['username'];
    $password = $_POST['password'];

    if (empty($username) || empty($password)) {
        $message = "<p class='w3-panel w3-red w3-padding'>Tous les champs sont obligatoires.</p>";
    } else {
        $login = new userdb();
        $user = $login->findUser($username);

        if ($user && password_verify($password, $user['password'])) {

            $_SESSION['username'] = $username;

            if ($cookies_acceptes) {
                // On crée le cookie "username" si cookies acceptés
                setcookie('username', $username, time() + 3600, '/');
            }

            header("Location: /~uapv2401716/test_site/wallet");
            exit();
        } else {
            $message = "<p class='w3-panel w3-red w3-padding'>Identifiants incorrects.</p>";
        }
    }
}

echo $message;
include($racine_path . "templates/front/footer.php");
