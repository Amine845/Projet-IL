<?php
/**
 * Fichier : logout.php
 *
 * Permet d'effectuer la déconnexion de l'utilisateur
 *
 * @author : EL GANDOUZ Amine
 *
 * @param : username correspondant au cookie
 *
 * @return : Vers la page de connexion
 */


if (isset($_COOKIE['cookies_accepted']) && $_COOKIE['cookies_accepted'] === 'true') {
    session_start();

    $_SESSION = [];

    session_destroy();

}

setcookie('username', '', time() - 3600, '/');

header("Location: /~uapv2401716/test_site/login");
exit();
