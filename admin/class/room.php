<?php
/**
 * Fichier : room.php
 *
 * Représente la salle pour visionner une video synchronisée avec les autres utilisateurs
 *
 * @author: EL GANDOUZ Amine
 *
 * @property int $room_id
 * @property string $name
 * @property string $password
 * @property int $host_id
 */


namespace classe;

class room{
    private $room_id;
    public $name;
    private $password;
    private $host_id;

    public function __construct($room_id = '', $name = '',$password = '', $host_id = ''){
        $this->room_id = $room_id;
        $this->name = $name;
        $this->password = $password;
        $this->host_id = $host_id;
    }

    public function getRoomId(){
        return $this->room_id;
    }

    public function getHostId(){
        return $this->host_id;
    }

    public function setId($val){
        $this->room_id = $val;
    }

}



