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
    private static $pdo = null;

    public static function connexion() {
        // On vérifie si la connexion n'existe pas déjà pour éviter d'en créer une nouvelle à chaque fois
        if (self::$pdo === null) {
            try {
                // Utilisation de self::$ au lieu de $this->
                self::$pdo = new \PDO(
                    "pgsql:host=" . SERVERNAME . ";port=" . PORT . ";dbname=" . DBNAME,
                    USERNAME,
                    PASSWORD
                );

            } catch (\PDOException $e) {
                // En production, il vaut mieux logger l'erreur que de l'afficher
                echo "Erreur de connexion : " . $e->getMessage();
                return null;
            }
        }
        return self::$pdo;
    }

    public function deconnexion(){
        $this->pdo = null; // Ferme la connexion en supprimant l'objet PDO
    }
}