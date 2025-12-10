<?php
/**
 * Fichier : register.php
 *
 * Permet l'inscription d'un nouvel utilisateur sur le site ainsi que la création d'un wallet par défaut avec un solde de départ de 1000 €
 *
 * @author : EL GANDOUZ Amine
 *
 * @param : email, username, password
 *
 * @return : les identifiants du nouvel utilisateur dans la base DB, ainsi que la création de son portefeuille
 * ||
 * Erreur : Tous les champs sont obligatoires, Cet utilisateur existe déjà, Erreur lors de l'inscription
 */


session_start();

if (!isset($_SESSION['crsf'])) {
    $_SESSION['crsf'] = bin2hex(random_bytes(32));
}

$racine_path = '../';
include($racine_path . "templates/front/entete.php");

include_once($racine_path."model/userdb.php");
include_once($racine_path."model/wallet.php");

use bd\userdb;
use bd\wallet;

$message = "";

if($_SERVER["REQUEST_METHOD"] === "POST"){
    $email = $_POST['email'] ?? '';
    $username = $_POST['username'] ?? '';
    $password = $_POST['password'] ?? '';

    if (empty($email) || empty($username) || empty($password)){
        $message = "<p class='w3-panel w3-red w3-padding'>Tous les champs sont obligatoires.</p>";
    }

    else{
        $registerModel = new userdb();
        if ($registerModel->userExists($email, $username)) {
            $message = "<p class='w3-panel w3-red w3-padding'>Cet utilisateur existe déjà.</p>";
        }

        else{
            $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

            if($registerModel->createUser($email, $username, $hashedPassword)){
                $walletDB = new Wallet();
                $walletDB->createDefaultWallet($username);

                $message = "<p class='w3-panel w3-green w3-padding'>Inscription réussie ! Votre portefeuille a été créé. Vous pouvez maintenant vous connecter.</p>";
            }
            else{
                $message = "<p class='w3-panel w3-red w3-padding'>Erreur lors de l'inscription.</p>";
            }
        }
    }
}

echo $message;
include($racine_path."templates/front/inscription_body.php");
include($racine_path."templates/front/footer.php");