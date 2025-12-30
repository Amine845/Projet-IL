<?php
/**
 * Fichier : register.php
 *
 * Permet l'inscription d'un nouvel utilisateur sur le site.
 *
 * @author : EL GANDOUZ Amine
 *
 * @param : email, username, password
 *
 * @return : les identifiants du nouvel utilisateur dans la base DB, ainsi que la création de son portefeuille
 * ||
 * Erreur : Tous les champs sont obligatoires, Cet utilisateur existe déjà, Erreur lors de l'inscription
 */

use bd\userdb;
session_start();
require_once __DIR__ . '/../model/userdb.php';

// On vérifie que les données ont été envoyées en POST
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = $_POST['username'];
    $email = $_POST['email'];
    $password = $_POST['password'];

    // Appel au modèle pour insérer en BDD
    if (UserDB::create($username, $email, $password)) {
        // Succès : on redirige vers la connexion
        header('Location: ../templates/front/login.html?msg=success');
        exit();
    } else {
        // Erreur : on revient à l'inscription avec un message
        header('Location: ../index.html?error=failed');
        exit();
    }
}