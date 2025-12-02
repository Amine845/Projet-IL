function init_room(){

    const socket = io();

    // 1. Récupérer les infos depuis l'URL
    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get('room');
    const username = params.get('user');

    if (!roomCode || !username) {
        window.location.href = '/';
    }

    document.getElementById('display-code').textContent = roomCode;

    // 2. Se connecter au salon
    socket.emit('join_room', { roomCode, username });

    // --- VARIABLES DOM ---
    const chatBox = document.getElementById('chat-box');
    const usersList = document.getElementById('users-list'); // Assure-toi que cet ID est dans le HTML
    const msgInput = document.getElementById('msg-input');
    const typingIndicator = document.getElementById('typing-indicator');
    const btnSend = document.getElementById('btn-send');

    // --- GESTION LISTE UTILISATEURS ---
    socket.on('update_users', (users) => {
        if(usersList) {
            usersList.innerHTML = users.map(u => 
                `<li class="list-group-item bg-secondary text-white py-1">🟢 ${u.username}</li>`
            ).join('');
        }
    });

    // --- GESTION RECEPTION MESSAGE ---
    socket.on('receive_message', (data) => {
        const div = document.createElement('div');
        
        if (data.isSystem) {
            // Style différent pour les messages système (Connexion/Déconnexion)
            div.className = 'system-msg';
            div.textContent = data.text;
        } else {
            // Message standard
            div.innerHTML = `<strong>${data.username}:</strong> ${data.text}`;
        }
        
        chatBox.appendChild(div);
        chatBox.scrollTop = chatBox.scrollHeight;
    });

    // --- ENVOI MESSAGE ---
    function sendMessage() {
        if (msgInput.value.trim()) {
            // ...On remplace par 'text' pour que ça corresponde à la lecture
            socket.emit('send_message', { roomCode, username, text: msgInput.value });
            msgInput.value = '';
        }
    }

    btnSend.addEventListener('click', sendMessage);
    msgInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') sendMessage(); });

    // --- GESTION "EN TRAIN D'ÉCRIRE..." (CDC Page 8) ---
    let typingTimer;

    // Quand je tape, je préviens le serveur
    msgInput.addEventListener('input', () => {
        socket.emit('typing', { roomCode, username });
    });

    // Quand le serveur me dit que quelqu'un tape
    socket.on('user_typing', (userTyping) => {
        typingIndicator.textContent = `${userTyping} est en train d'écrire...`;
        
        // On efface le message après 3 secondes sans nouvelle frappe
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
            typingIndicator.textContent = '';
        }, 3000);
    });


    // --- JAVASCRIPT BARRE DE RECHERCHE (Code existant conservé) ---
    const apiKey = "AIzaSyBw4LHeP6A8wnFZmvnHy01umvhWJieDlPU"; 
    const API_URL = "https://www.googleapis.com/youtube/v3/search";

    const form = document.getElementById('search-form');
    const input = document.getElementById('search-input');
    const resultsContainer = document.getElementById('results-container');
    const statusMessage = document.getElementById('status-message');

    function hideStatus() {
        if (statusMessage) statusMessage.classList.add('d-none');
    }

    function showStatus(msg) {
        if (statusMessage) {
            statusMessage.textContent = msg;
            statusMessage.classList.remove('d-none');
            statusMessage.classList.add('alert', 'alert-info');
        }
    }

    function videoRecherchee(video) {
        const videoId = video.id.videoId;
        const title = video.snippet.title;
        const thumbnailUrl = video.snippet.thumbnails.high.url;
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

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
        
        const params = new URLSearchParams({
            part: 'snippet',
            q: recherche, 
            key: apiKey,
            type: 'video',
            maxResults: 12
        });

        try {
            const response = await fetch(`${API_URL}?${params.toString()}`);
            if (!response.ok) throw new Error(`Erreur API: ${response.status}`);
            const data = await response.json();
            renderResults(data.items);
        } catch (error) {
            console.error("Erreur:", error);
            showStatus("Erreur lors de la recherche.");
        }
    }

    if (form) {
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            const searchTerm = input.value.trim();
            rechercheYoutubeVideos(searchTerm);
        });
    }
}

// Lancement de la fonction une fois le DOM chargé
document.addEventListener('DOMContentLoaded', init_room);