const apiKey = "AIzaSyBw4LHeP6A8wnFZmvnHy01umvhWJieDlPU";

const API_URL = "https://www.googleapis.com/youtube/v3/search";
const form = document.getElementById('search-form');
const input = document.getElementById('search-input');
const resultsContainer = document.getElementById('results-container');
const statusMessage = document.getElementById('status-message');
const searchButton = document.getElementById('recherche');

// construit les videos recherchée 
function videoRecherchee(video){
    const videoId = video.id.videoId;
    const title = video.snippet.title;
    const thumbnailUrl = video.snippet.thumbnails.high.url;

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    return'<div class="w3-padding-small"><a href="${videoUrl}" class="w3-container"><img src="${thumbnailUrl}" alt="${title}" class="video-thumbnail w3-round-t-large"></a></div>';
}

// créer les items vidéos en fonction de la recherche
function renderResults(items){
    const htmlContent = items.map(createVideoCard).join('');
    resultsContainer.innerHTML = htmlContent;
    hideStatus();
}

// emet la recherche youtube via la clé API ainsi que la recherche passée en paramètre
// fait la recherche HTTP à l'aide de cette fonction javascript: fetch
// urlsearchparams = paramètres de la recherche 
function rechercheYoutubeVideos(recherche){
    const params = new URLSearchParams({
        part: 'snippet',
        q: searchTerm,
        key: apiKey,
        type: 'video',
        maxResults: 12
    });
    const reponse = fetch(`${API_URL}?${params.toString()}`);
}

form.addEventListener('submit', (event) => {
    event.preventDefault();
    const searchTerm = input.value.trim();
    fetchYouTubeVideos(searchTerm);
});
