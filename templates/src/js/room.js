function init_room(){


    const socket = io();

    // 1. Récupérer les infos depuis l'URL (ex: ?room=123456&user=Adam)
    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get('room');
    const username = params.get('user');

    // Si pas d'infos, retour à l'accueil
    if (!roomCode || !username) {
        window.location.href = '/';
    }

    document.getElementById('display-code').textContent = roomCode;

    // 2. Se connecter au salon
    socket.emit('join_room', { roomCode, username });

    // --- GESTION CHAT & USERS (Même logique qu'avant) ---
    const chatBox = document.getElementById('chat-box');
    const usersList = document.getElementById('users-list');
    const msgInput = document.getElementById('msg-input');

    socket.on('update_users', (users) => {
        usersList.innerHTML = users.map(u => `<li>🟢 ${u.username}</li>`).join('');
    });

    socket.on('receive_message', (data) => {
        const div = document.createElement('div');
        div.innerHTML = `<strong>${data.username}:</strong> ${data.text}`;
        chatBox.appendChild(div);
        chatBox.scrollTop = chatBox.scrollHeight;
    });

    function sendMessage() {
        if (msgInput.value.trim()) {
            socket.emit('send_message', { roomCode, username, message: msgInput.value });
            msgInput.value = '';
        }
    }

    document.getElementById('btn-send').addEventListener('click', sendMessage);
    msgInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') sendMessage(); });


    // javascript QUI GERE LA BARRE DE RECHERCHE 
    const apiKey = "AIzaSyBw4LHeP6A8wnFZmvnHy01umvhWJieDlPU"; 
    const API_URL = "https://www.googleapis.com/youtube/v3/search";

    const form = document.getElementById('search-form');
    const input = document.getElementById('search-input');
    const resultsContainer = document.getElementById('results-container');
    const statusMessage = document.getElementById('status-message');
    const searchButton = document.getElementById('recherche');

    function hideStatus() {
        if (statusMessage) statusMessage.classList.add('d-none'); // Utilise d-none pour Bootstrap
    }

    function showStatus(msg) {
        if (statusMessage) {
            statusMessage.textContent = msg;
            statusMessage.classList.remove('d-none');
            statusMessage.classList.add('alert', 'alert-info'); // Classes Bootstrap
        }
    }


    function videoRecherchee(video) {
        const videoId = video.id.videoId;
        const title = video.snippet.title;
        const thumbnailUrl = video.snippet.thumbnails.high.url;
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

        // HTML adapté pour une Card Bootstrap (plus propre dans votre room.html)
        return `
            <div class="col-md-4 mb-3">
                <div class="card h-100 bg-dark border-secondary text-white">
                    <a href="${videoUrl}" target="_blank" class="text-decoration-none text-white">
                        <img src="${thumbnailUrl}" class="card-img-top" alt="${title}" style="height: 140px; object-fit: cover;">
                        <div class="card-body p-2">
                            <p class="card-text small text-truncate">${title}</p>
                        </div>
                    </a>
                </div>
            </div>
        `;
    }

    function renderResults(items) {
        if (!items || items.length === 0) {
            showStatus("Aucun résultat trouvé.");
            return;
        }
        
        const htmlContent = items.map(videoRecherchee).join('');
        resultsContainer.innerHTML = htmlContent;
        hideStatus();
    }

    async function rechercheYoutubeVideos(recherche) {
        if (!recherche) return;

        showStatus("Recherche en cours...");
        if (resultsContainer) resultsContainer.innerHTML = '';
        
        // Correction : Utilisation de l'argument 'recherche' passé à la fonction
        const params = new URLSearchParams({
            part: 'snippet',
            q: recherche, 
            key: apiKey,
            type: 'video',
            maxResults: 12
        });

        try {
            // await pour attendre la réponse réseau
            const response = await fetch(`${API_URL}?${params.toString()}`);
            
            if (!response.ok) {
                throw new Error(`Erreur API: ${response.status}`);
            }

            // await pour le parsing JSON
            const data = await response.json();
            renderResults(data.items);

        } catch (error) {
            console.error("Erreur:", error);
            showStatus("Erreur lors de la recherche.");
        }
    }

    // --- ÉCOUTEUR D'ÉVÉNEMENT ---
    if (form) {
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            const searchTerm = input.value.trim();
            // Correction : Appel de la bonne fonction renommée
            rechercheYoutubeVideos(searchTerm);
        });
    }


}