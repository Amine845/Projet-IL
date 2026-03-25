function init_room() {

    const socket = io();

    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get('room');
    const username = params.get('user');

    if (!roomCode || !username) {
        window.location.href = '/';
        return;
    }

    document.getElementById('display-code').textContent = roomCode;

    socket.emit('join_room', { roomCode, username });

    // ================= CHAT =================
    const chatBox = document.getElementById('chat-box');
    const msgInput = document.getElementById('msg-input');

    document.getElementById('btn-send').addEventListener('click', () => {
        if (msgInput.value.trim()) {

            let currentVideoTime = 0;
            if (window.player) {
                currentVideoTime = window.player.getCurrentTime();
            }

            socket.emit('send_message', {
                roomCode,
                username,
                message_text: msgInput.value,
                currentVideoTime
            });

            msgInput.value = '';
        }
    });

    socket.on('receive_message', (data) => {
        const div = document.createElement('div');

        const time = data.currentVideoTime || 0;
        const min = Math.floor(time / 60);
        const sec = Math.floor(time % 60);

        div.innerHTML = `<strong>[${min}:${sec}] ${data.username}:</strong> ${data.message_text}`;
        chatBox.appendChild(div);
    });

    // ================= VIDEO SEARCH =================
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const resultsContainer = document.getElementById('results-container');

    const YOUTUBE_API_KEY = "AIzaSyBw4LHeP6A8wnFZmvnHy01umvhWJieDlPU";

    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const query = searchInput.value.trim();
        if (!query) return;

        resultsContainer.innerHTML = "Chargement...";

        try {
            const res = await fetch(
                `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=6&q=${encodeURIComponent(query)}&key=${YOUTUBE_API_KEY}`
            );

            const data = await res.json();

            resultsContainer.innerHTML = "";

            data.items.forEach(item => {
                const videoId = item.id.videoId;
                const title = item.snippet.title;
                const thumbnail = item.snippet.thumbnails.medium.url;

                const col = document.createElement('div');
                col.className = "col-md-4";

                col.innerHTML = `
                    <div class="card bg-dark text-white border-secondary">
                        <img src="${thumbnail}" class="card-img-top">
                        <div class="card-body">
                            <p class="card-text small">${title}</p>
                            <button class="btn btn-primary btn-sm w-100">Lire</button>
                        </div>
                    </div>
                `;

                col.querySelector('button').addEventListener('click', () => {

                    // Charge vidéo localement
                    if (window.player) {
                        window.player.loadVideoById(videoId);
                    }

                    // Sync avec les autres
                    socket.emit('load_video', { roomCode, videoId });

                });

                resultsContainer.appendChild(col);
            });

        } catch (err) {
            console.error(err);
            resultsContainer.innerHTML = "Erreur lors de la recherche.";
        }
    });

    // réception vidéo sync
    socket.on('load_video', (videoId) => {
        if (window.player) {
            window.player.loadVideoById(videoId);
        }
    });

    // ================= SYNC VIDEO =================
    socket.on('sync_video', (data) => {
        if (!window.player) return;

        if (Math.abs(window.player.getCurrentTime() - data.currentTime) > 1) {
            window.player.seekTo(data.currentTime);
        }

        if (data.type === 'play') window.player.playVideo();
        if (data.type === 'pause') window.player.pauseVideo();
    });

}

document.addEventListener('DOMContentLoaded', init_room);