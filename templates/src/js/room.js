function init_room() {

    const socket = io();

    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get('room');
    const username = params.get('user');

    if (!roomCode || !username) {
        window.location.href = '/';
        return;
    }

    const displayCode = document.getElementById('display-code');
    if(displayCode) displayCode.textContent = roomCode;

    // --- NOUVEAU : AFFICHER LE PSEUDO ---
    const displayUsername = document.getElementById('display-username');
    if(displayUsername) displayUsername.textContent = username;

    // --- NOUVEAU : GESTION DU STATUT PREMIUM ---
    let isUserPremium = false; // Par défaut, on considère l'utilisateur gratuit
    const premiumBadge = document.getElementById('premium-badge');

async function checkRoomPremiumStatus(user) {
        try {
            const res = await fetch(`/api/user-status/${user}`);
            const data = await res.json();
            isUserPremium = data.is_premium;

            const filterTextInput = document.getElementById('filter-text');
            const filterTextWrapper = document.getElementById('filter-text-wrapper');

            if (isUserPremium) {
                // ... (Logique des badges existante) ...
                if (premiumBadge) {
                    premiumBadge.innerHTML = '<i class="fa fa-crown"></i> PRO';
                    premiumBadge.className = 'badge bg-warning text-dark ms-2 align-middle';
                }
                document.querySelectorAll('.pro-option').forEach(el => el.classList.remove('pro-locked'));
                
                // NOUVEAU : Déverrouiller le champ texte
                if (filterTextInput) {
                    filterTextInput.disabled = false;
                    filterTextInput.style.pointerEvents = "auto";
                }
                if (filterTextWrapper) filterTextWrapper.classList.remove('pro-locked');

            } else {
                // ... (Logique des badges existante) ...
                if (premiumBadge) {
                    premiumBadge.innerHTML = 'Gratuit';
                    premiumBadge.className = 'badge bg-secondary ms-2 align-middle';
                }
                document.querySelectorAll('.pro-option').forEach(el => el.classList.add('pro-locked'));
                
                // NOUVEAU : Verrouiller le champ texte
                if (filterTextInput) {
                    filterTextInput.disabled = true;
                    filterTextInput.style.pointerEvents = "none";
                }
                if (filterTextWrapper) filterTextWrapper.classList.add('pro-locked');
            }
        } catch (e) {
            console.error("Erreur vérification statut premium:", e);
        }
    }

    // On lance la vérification dès l'entrée dans la room
    checkRoomPremiumStatus(username);

    socket.emit('join_room', { roomCode, username });

    socket.emit('join_room', { roomCode, username });
    socket.emit('request_markers', roomCode);

    // --- VARIABLES DOM CHAT ---
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

    function sendMessage() {
        if (msgInput && msgInput.value.trim()) {
            socket.emit('send_message', { roomCode, username, text: msgInput.value });
            msgInput.value = '';
        }
    }

    if (btnSend) btnSend.addEventListener('click', sendMessage);
    if (msgInput) {
        msgInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
        msgInput.addEventListener('input', () => socket.emit('typing', { roomCode, username }));
    }

    let typingTimer;
    socket.on('user_typing', (userTyping) => {
        if (typingIndicator) {
            typingIndicator.textContent = `${userTyping} est en train d'écrire...`;
            clearTimeout(typingTimer);
            typingTimer = setTimeout(() => { typingIndicator.textContent = ''; }, 3000);
        }
    });

    // --- DÉPART DE LA ROOM ---
    const btnLeave = document.getElementById('btn-leave-room');
    if (btnLeave) {
        btnLeave.addEventListener('click', () => {
            // On prévient le serveur qu'on quitte la room
            socket.emit('explicit_leave', { roomCode, username });
            // On redirige vers l'accueil
            window.location.href = '/';
        });
    }

    // --- YOUTUBE API ---
    window.onYouTubeIframeAPIReady = function() {
        window.player = new YT.Player('player', {
            height: '100%',
            width: '100%',
            videoId: '', 
            playerVars: { 'autoplay': 0, 'controls': 1 },
            events: { 'onStateChange': onPlayerStateChange }
        });
    };

    var tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    var firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

    // --- SYNC VIDEO ---
    let currentController = null;
    let isSyncing = false;

    const btnControl = document.getElementById('btn-control');
    if (btnControl) {
        btnControl.addEventListener('click', () => socket.emit('claim_control', { roomCode, username }));
    }

    socket.on('update_controller', (name) => {
        currentController = name;
        const ctrlName = document.getElementById('controller-name');
        if (ctrlName) ctrlName.textContent = name;
    });

    socket.on('load_video', (videoId) => {
        if (window.player && window.player.loadVideoById) window.player.loadVideoById(videoId);
    });

    function onPlayerStateChange(event) {
        if (currentController === username && !isSyncing) {
            let state = event.data;
            let time = window.player.getCurrentTime();
            if (state === YT.PlayerState.PLAYING) socket.emit('video_action', { roomCode, type: 'play', currentTime: time });
            else if (state === YT.PlayerState.PAUSED) socket.emit('video_action', { roomCode, type: 'pause', currentTime: time });
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
    let playlist =[];

    function renderPlaylist() {
        if (!playlistList) return;
        playlistList.innerHTML = "";
        if (playlist.length === 0) {
            playlistList.innerHTML = `<li class="list-group-item bg-dark text-muted text-center small border-secondary">Aucune vidéo dans la playlist.</li>`;
            return;
        }

        playlist.forEach((video, index) => {
            const li = document.createElement("li");
            li.className = "list-group-item bg-dark border-secondary text-white d-flex justify-content-between align-items-center";
            li.innerHTML = `<span style="cursor:pointer;" class="video-play text-primary" data-index="${index}">${video.title}</span>
            <button class="btn btn-sm btn-outline-danger remove-video" data-index="${index}">X</button>`;
            playlistList.appendChild(li);
        });

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
        // --- NOUVEAU : LE BRIDAGE DE LA PLAYLIST ---
        if (!isUserPremium && playlist.length >= 2) {
            alert("La version gratuite est limitée à 2 vidéos par playlist. Passez PRO pour des playlists illimitées !");
            return; // On bloque l'ajout
        }

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

    // --- RECHERCHE ET FILTRES ---
    const apiKey = "AIzaSyBw4LHeP6A8wnFZmvnHy01umvhWJieDlPU";
    const API_URL = "https://www.googleapis.com/youtube/v3/search";
    const formSearch = document.getElementById('search-form');
    const inputSearch = document.getElementById('search-input');
    const resultsContainer = document.getElementById('results-container');

    let allResults = [];
    let displayedResults = [];
    let activeFilters = { sort: "relevance", shorts: "all", text: "", duration: "all", uploadDate: "all" };

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
        if (!items || !resultsContainer) return;
        resultsContainer.innerHTML = items.map(videoRecherchee).join('');
        resultsContainer.scrollIntoView({ behavior: "smooth" });

        document.querySelectorAll('.video-result').forEach(card => {
            card.addEventListener('click', () => {
                socket.emit('change_video', { roomCode, videoId: card.dataset.videoId });
                document.getElementById('player-container').scrollIntoView({ behavior: "smooth" });
            });
        });
    }

    async function fetchVideoDurations(videoIds) {
        const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoIds.join(",")}&key=${apiKey}`);
        const data = await res.json();
        const map = {};
        data.items.forEach(v => { map[v.id] = v.contentDetails.duration; });
        return map;
    }

    function parseDuration(duration) {
        if (!duration) return 0;
        const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
        const hours = parseInt(match[1]) || 0;
        const minutes = parseInt(match[2]) || 0;
        const seconds = parseInt(match[3]) || 0;
        return hours*3600 + minutes*60 + seconds;
    }

    // --- NOUVEAU : PAYWALL POUR LE CHAMP TEXTE ---
    const filterTextWrapper = document.getElementById('filter-text-wrapper');
    if (filterTextWrapper) {
        filterTextWrapper.addEventListener('click', () => {
            if (!isUserPremium) {
                alert("La recherche par mots-clés est une fonctionnalité avancée réservée aux comptes PRO. Retournez à l'accueil pour y souscrire !");
            }
        });
    }

    function applyFilters() {
        let filtered = [...allResults];

        if (activeFilters.text) filtered = filtered.filter(v => v.snippet.title.toLowerCase().includes(activeFilters.text.toLowerCase()));
        if (activeFilters.sort === "alpha_asc") filtered.sort((a,b) => a.snippet.title.localeCompare(b.snippet.title));
        if (activeFilters.sort === "date_new") filtered.sort((a,b) => new Date(b.snippet.publishedAt) - new Date(a.snippet.publishedAt));

        if (activeFilters.duration !== "all") {
            filtered = filtered.filter(v => {
                const d = v.durationSec;
                if (activeFilters.duration === "short") return d < 180;
                if (activeFilters.duration === "medium") return d >= 180 && d <= 1200;
                if (activeFilters.duration === "long") return d > 1200;
                return true;
            });
        }

        if (activeFilters.uploadDate !== "all") {
            const now = new Date();
            filtered = filtered.filter(v => {
                const diff = (now - new Date(v.snippet.publishedAt)) / (1000*60*60*24);
                if (activeFilters.uploadDate === "today") return diff < 1;
                if (activeFilters.uploadDate === "week") return diff < 7;
                if (activeFilters.uploadDate === "month") return diff < 30;
                if (activeFilters.uploadDate === "year") return diff < 365;
                return true;
            });
        }
        displayedResults = filtered.slice(0, 9);
        renderResults(displayedResults);
    }

    function resetFilters() {
        activeFilters = { sort: "relevance", shorts: "all", text: "", duration: "all", uploadDate: "all" };
        document.querySelectorAll(".filter-option").forEach(el => el.classList.remove("text-primary", "fw-bold"));
        document.getElementById("filter-text").value = "";
        applyFilters();
    }

    const btnToggleFilters = document.getElementById("btn-toggle-filters");
    if(btnToggleFilters) btnToggleFilters.addEventListener("click", () => document.getElementById("filters-panel").classList.toggle("d-none"));
    
    const btnResetFilters = document.getElementById("reset-filters");
    if(btnResetFilters) btnResetFilters.addEventListener("click", resetFilters);

document.querySelectorAll(".filter-option").forEach(el => {
        el.addEventListener("click", () => {
            const type = el.dataset.type;
            const val = el.dataset.value;

            // --- NOUVEAU : LE MUR DE PAIEMENT (PAYWALL) ---
            // Si l'utilisateur n'est pas PRO ET qu'il clique sur une option ayant la classe 'pro-option'
            if (!isUserPremium && el.classList.contains('pro-option')) {
                alert("Cette option de filtrage avancée est réservée aux comptes PRO. Retournez à l'accueil pour y souscrire !");
                return; // Annulation totale de l'action
            }

            document.querySelectorAll(`.filter-option[data-type="${type}"]`).forEach(e => e.classList.remove("text-primary", "fw-bold"));
            el.classList.add("text-primary", "fw-bold");
            activeFilters[type] = val;
            applyFilters();
        });
    });

    const filterText = document.getElementById("filter-text");
    if(filterText) filterText.addEventListener("input", (e) => { activeFilters.text = e.target.value; applyFilters(); });

    async function rechercheYoutubeVideos(recherche) {
        resetFilters();
        const params = new URLSearchParams({ part: 'snippet', q: recherche, key: apiKey, type: 'video', maxResults: 50 });
        try {
            const res = await fetch(`${API_URL}?${params.toString()}`);
            const data = await res.json();
            const ids = data.items.map(v => v.id.videoId);
            const durations = await fetchVideoDurations(ids);
            data.items.forEach(v => { v.durationSec = parseDuration(durations[v.id.videoId]); });
            allResults = data.items;
            applyFilters();
        } catch(e) { console.error(e); }
    }

    if (formSearch) {
        formSearch.addEventListener('submit', (e) => {
            e.preventDefault();
            rechercheYoutubeVideos(inputSearch.value.trim());
        });
    }

    // --- GESTION DES MARQUEURS ---
    const markerInput = document.getElementById('marker-input');
    const markerCategory = document.getElementById('marker-category');
    const btnAddMarker = document.getElementById('btn-add-marker');
    const btnCaptureTime = document.getElementById('btn-capture-time');
    const markersList = document.getElementById('markers-list');
    const currentTimeDisplay = document.getElementById('current-time-display');
    let isMarkerCooldown = false;
    const COOLDOWN_TIME = 3000; // 3 secondes de délai entre les marqueurs

    function formatTime(seconds) {
        const min = Math.floor(seconds / 60);
        const sec = Math.floor(seconds % 60);
        return `${min < 10 ? '0'+min : min}:${sec < 10 ? '0'+sec : sec}`;
    }

    let capturedTimestamp = null;

    setInterval(() => {
        if (window.player && window.player.getCurrentTime) {
            if(currentTimeDisplay) currentTimeDisplay.textContent = formatTime(window.player.getCurrentTime());
        }
    }, 1000);

    if (btnCaptureTime) {
        btnCaptureTime.addEventListener('click', () => {
            if (window.player && window.player.getCurrentTime) {
                capturedTimestamp = window.player.getCurrentTime();
                btnCaptureTime.classList.replace('btn-outline-warning', 'btn-warning');
                markerInput.placeholder = `Note pour ${formatTime(capturedTimestamp)}...`;
                markerInput.focus();
            }
        });
    }

    function addMarker() {
        // 1. On bloque si le cooldown est actif
        if (isMarkerCooldown) return;

        if (!markerInput.value.trim() || !window.player) return;
        const timeToSend = (capturedTimestamp !== null) ? capturedTimestamp : window.player.getCurrentTime();

        // Envoi au serveur
        socket.emit('add_marker', {
            roomCode: roomCode,
            username: username,
            timestamp: timeToSend,
            comment: markerInput.value.trim(),
            category: markerCategory.value
        });

        markerInput.value = '';
        markerInput.placeholder = "Ajouter une observation à ce moment...";
        capturedTimestamp = null;
        if(btnCaptureTime) btnCaptureTime.classList.replace('btn-warning', 'btn-outline-warning');

        // 2. cooldown affichage
        isMarkerCooldown = true;
        if (btnAddMarker) {
            btnAddMarker.disabled = true;
            const originalText = btnAddMarker.textContent;
            btnAddMarker.textContent = "Patientez...";

            setTimeout(() => {
                isMarkerCooldown = false;
                btnAddMarker.disabled = false;
                btnAddMarker.textContent = originalText;
            }, COOLDOWN_TIME);
        }
    }

    if (btnAddMarker) btnAddMarker.addEventListener('click', addMarker);
    if (markerInput) markerInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') addMarker(); });

    socket.on('update_markers', (markers) => {
        if (!markersList) return;
        markersList.innerHTML = markers.map(m => {
            const colorMap = { 'info': 'bg-primary', 'success': 'bg-success', 'danger': 'bg-danger', 'warning': 'bg-warning' };
            const badgeColor = colorMap[m.category] || 'bg-primary';
            return `
                <li class="list-group-item bg-dark text-white border-secondary d-flex justify-content-between align-items-center">
                    <span>
                        <span class="badge ${badgeColor} me-2" style="cursor:pointer" onclick="if(window.player) { window.player.seekTo(${m.timestamp_seconds}, true); window.player.playVideo(); }">
                            ${formatTime(m.timestamp_seconds)}
                        </span>
                        <strong>${m.username ? m.username : '<i>Ancien invité</i>'}:</strong> ${m.comment}
                    </span>
                </li>`;
        }).join('');
    });

}

document.addEventListener('DOMContentLoaded', init_room);