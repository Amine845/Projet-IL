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

require_once __DIR__ . '/../model/userdb.php';

$response = ["success" => false, "message" => ""];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = $_POST['email'] ?? '';
    $password = $_POST['password'] ?? '';

    if (!empty($email) && !empty($password)) {
        $user = UserDB::getByEmail($email);

        if ($user && password_verify($password, $user['password'])) {
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['username'] = $user['username'];
            
            $response["success"] = true;
            $response["username"] = $user['username'];
            $response["message"] = "Connexion réussie";
        } else {
            $response["message"] = "Email ou mot de passe incorrect.";
        }
    } else {
        $response["message"] = "Veuillez remplir tous les champs.";
    }
}

echo json_encode($response);
exit();