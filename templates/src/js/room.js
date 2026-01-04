function init_room() {

    const socket = io();

    // 1. Récupérer les infos depuis l'URL
    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get('room');
    const username = params.get('user');

    if (!roomCode || !username) {
        window.location.href = '/';
        return;
    }

    const displayCode = document.getElementById('display-code');
    if(displayCode) displayCode.textContent = roomCode;

    // 2. Se connecter au salon
    socket.emit('join_room', { roomCode, username });

    // --- VARIABLES DOM ---
    const chatBox = document.getElementById('chat-box');
    const usersList = document.getElementById('users-list');
    const msgInput = document.getElementById('msg-input');
    const typingIndicator = document.getElementById('typing-indicator');
    const btnSend = document.getElementById('btn-send');

    // --- GESTION LISTE UTILISATEURS ---
    socket.on('update_users', (users) => {
        if (usersList) {
            usersList.innerHTML = users.map(u =>
                `<li class="text-white"><span style="color:#0f0;">●</span> ${u.username}</li>`
            ).join('');
        }
    });

    // --- GESTION RECEPTION MESSAGE ---
    socket.on('receive_message', (data) => {
        if (!chatBox) return;
        const div = document.createElement('div');

        if (data.isSystem) {
            div.className = 'system-msg';
            div.textContent = data.text;
        } else {
            div.innerHTML = `<strong>${data.username}:</strong> ${data.text}`;
        }

        chatBox.appendChild(div);
        chatBox.scrollTop = chatBox.scrollHeight;
    });

    // --- ENVOI MESSAGE ---
    function sendMessage() {
        if (msgInput && msgInput.value.trim()) {
            socket.emit('send_message', { roomCode, username, text: msgInput.value });
            msgInput.value = '';
        }
    }

    if (btnSend) btnSend.addEventListener('click', sendMessage);
    if (msgInput) {
        msgInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
        // Typing
        msgInput.addEventListener('input', () => {
            socket.emit('typing', { roomCode, username });
        });
    }

    // Typing reception
    let typingTimer;
    socket.on('user_typing', (userTyping) => {
        if (typingIndicator) {
            typingIndicator.textContent = `${userTyping} est en train d'écrire...`;
            clearTimeout(typingTimer);
            typingTimer = setTimeout(() => {
                typingIndicator.textContent = '';
            }, 3000);
        }
    });

    // --- YOUTUBE API ---
    // On doit attacher la fonction à window pour que l'API Google la trouve
    window.onYouTubeIframeAPIReady = function() {
        window.player = new YT.Player('player', {
            height: '100%',
            width: '100%',
            videoId: '3y5H4XINDEU', // Vidéo par défaut
            playerVars: { 'autoplay': 0, 'controls': 1 },
            events: {
                'onStateChange': onPlayerStateChange
            }
        });
    };

    // Chargement du script API YouTube
    var tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    var firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);


    // --- SYNC VIDEO ---
    let currentController = null;
    let isSyncing = false;

    const btnControl = document.getElementById('btn-control');
    if (btnControl) {
        btnControl.addEventListener('click', () => {
            socket.emit('claim_control', { roomCode, username });
        });
    }

    socket.on('update_controller', (name) => {
        currentController = name;
        const ctrlName = document.getElementById('controller-name');
        if (ctrlName) ctrlName.textContent = name;
    });

    socket.on('load_video', (videoId) => {
        if (window.player && window.player.loadVideoById) {
            window.player.loadVideoById(videoId);
        }
    });

    function onPlayerStateChange(event) {
        if (currentController === username && !isSyncing) {
            let state = event.data;
            let time = window.player.getCurrentTime();

            if (state === YT.PlayerState.PLAYING) {
                socket.emit('video_action', { roomCode, type: 'play', currentTime: time });
            } else if (state === YT.PlayerState.PAUSED) {
                socket.emit('video_action', { roomCode, type: 'pause', currentTime: time });
            }
        }
    }

    socket.on('sync_video', (data) => {
        if (!window.player || !window.player.seekTo) return;

        isSyncing = true;
        if (Math.abs(window.player.getCurrentTime() - data.currentTime) > 1) {
            window.player.seekTo(data.currentTime);
        }
        if (data.type === 'play') window.player.playVideo();
        else if (data.type === 'pause') window.player.pauseVideo();

        setTimeout(() => { isSyncing = false; }, 500);
    });


    // --- PLAYLIST ---
    const playlistList = document.getElementById('playlist-list');
    let playlist = [];

    function renderPlaylist() {
        if (!playlistList) return;
        playlistList.innerHTML = "";

        if (playlist.length === 0) {
            playlistList.innerHTML = `
            <li class="list-group-item bg-dark text-muted text-center small border-secondary">
                Aucune vidéo dans la playlist.
            </li>`;
            return;
        }

        playlist.forEach((video, index) => {
            const li = document.createElement("li");
            li.className = "list-group-item bg-dark border-secondary text-white d-flex justify-content-between align-items-center";
            li.innerHTML = `
            <span style="cursor:pointer;" class="video-play" data-index="${index}">
                ${video.title}
            </span>
            <button class="btn btn-sm btn-outline-danger remove-video" data-index="${index}">X</button>
        `;
            playlistList.appendChild(li);
        });

        // Events Playlist
        document.querySelectorAll(".video-play").forEach(el => {
            el.addEventListener("click", () => {
                const v = playlist[el.dataset.index];
                socket.emit("change_video", { roomCode, videoId: v.id });
            });
        });
        document.querySelectorAll(".remove-video").forEach(btn => {
            btn.addEventListener("click", () => {
                playlist.splice(btn.dataset.index, 1);
                renderPlaylist();
            });
        });
    }

    function addVideoToPlaylist(videoId, title) {
        playlist.push({ id: videoId, title: title });
        renderPlaylist();
    }

    const btnAddCurrent = document.getElementById("add-current-video-btn");
    if (btnAddCurrent) {
        btnAddCurrent.addEventListener("click", () => {
            if (!window.player || !window.player.getVideoData) return;
            const data = window.player.getVideoData();
            addVideoToPlaylist(data.video_id, data.title || "Vidéo sans titre");
        });
    }

    // --- RECHERCHE ---
    const apiKey = "AIzaSyBw4LHeP6A8wnFZmvnHy01umvhWJieDlPU";
    const API_URL = "https://www.googleapis.com/youtube/v3/search";
    const formSearch = document.getElementById('search-form');
    const inputSearch = document.getElementById('search-input');
    const resultsContainer = document.getElementById('results-container');

    function videoRecherchee(video) {
        const videoId = video.id.videoId;
        const title = video.snippet.title;
        const thumbnailUrl = video.snippet.thumbnails.high.url;
        return `
            <div class="col-md-4 mb-3">
                <div class="card h-100 bg-dark border-secondary text-white video-result" 
                    data-video-id="${videoId}" style="cursor:pointer;">
                    <img src="${thumbnailUrl}" class="card-img-top" alt="${title}" style="height: 140px; object-fit: cover;">
                    <div class="card-body p-2">
                        <p class="card-text small text-truncate">${title}</p>
                    </div>
                </div>
            </div>`;
    }

    function renderResults(items) {
        if (!items) return;
        resultsContainer.innerHTML = items.map(videoRecherchee).join('');
        resultsContainer.scrollIntoView({ behavior: "smooth" });

        document.querySelectorAll('.video-result').forEach(card => {
            card.addEventListener('click', () => {
                socket.emit('change_video', { roomCode, videoId: card.dataset.videoId });
                document.getElementById('player-container').scrollIntoView({ behavior: "smooth" });
            });
        });
    }

    async function rechercheYoutubeVideos(recherche) {
        const params = new URLSearchParams({ part: 'snippet', q: recherche, key: apiKey, type: 'video', maxResults: 12 });
        try {
            const res = await fetch(`${API_URL}?${params.toString()}`);
            const data = await res.json();
            renderResults(data.items);
        } catch (e) { console.error(e); }
    }

    if (formSearch) {
        formSearch.addEventListener('submit', (e) => {
            e.preventDefault();
            rechercheYoutubeVideos(inputSearch.value.trim());
        });
    }
}

document.addEventListener('DOMContentLoaded', init_room);