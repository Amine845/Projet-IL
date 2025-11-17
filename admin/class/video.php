<?php
/**
 * Fichier : video.php
 *
 * Représente la vidéo en cours qui est lancée via le lecteur vidéo
 *
 * @author: EL GANDOUZ Amine
 *
 * @property int $video_id
 * @property string $url
 * @property string $titre
 * @property int $playlist_id
 */


namespace classe;

class video{
    public $video_id;
    public $url;
    public $title;
    private $playlist_id;

    public function __construct($video_id = '', $url = '',$title = '', $playlist_id = ''){
        $this->video_id = $video_id;
        $this->url = $url;
        $this->title = $title;
        $this->playlist_id = $playlist_id;
    }

    public function getVideoId(){
        return $this->video_id;
    }

    public function getPlaylistId(){
        return $this->playlist_id;
    }
}



