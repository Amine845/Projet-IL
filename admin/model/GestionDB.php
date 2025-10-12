<?php
/**
 * Fichier : gestionDB.php
 *
 * Classe de base pour gérer la connexion et l'accès à la base de données via PDO.
 *
 * @author: EL GANDOUZ Amine
 *
 * @method connexion() : Retourne une instance PDO
 * @method deconnexion() : (à implémenter) Gère la fermeture de la connexion si besoin
 * ||
 * Erreur : Affiche un message si la connexion échoue.
 */


namespace bd;
use PDOException;

include('config.php');

class GestionDB{
    public $pdo;

    public function connexion(){
        try{
            $this->pdo = new \PDO("pgsql:host=".SERVERNAME.";port=".PORT.";dbname=".DBNAME, USERNAME, PASSWORD);
        }catch(PDOException $e){
            echo $e->getMessage();
        }
    }

    public function deconnexion(){
        $this->pdo = null; // Ferme la connexion en supprimant l'objet PDO
    }
}