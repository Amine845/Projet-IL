<?php
/**
 * Fichier : login.php
 *
 * Classe représentant un utilisateur pour la connexion (non utilisée actuellement).
 *
 * @author: EL GANDOUZ Amine
 *
 * @usage futur : pourrait servir pour encapsuler la logique de connexion utilisateur.
 */


namespace classe;

class login{
    private $nom;
    public $prenom;

    public function __construct($nom = '', $prenom = ''){
        $this->prenom = $prenom;
        $this->nom = $nom;
    }

    public function getNom(){
        return $this->nom;
    }

    public function setNom($val)
    {
        $this->nom = $val;
    }

}