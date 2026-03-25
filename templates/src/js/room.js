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
    if (displayCode) displayCode.textContent = roomCode;

    socket.emit('join_room', { roomCode, username });
    socket.emit('request_markers', roomCode);

    // --- DOM CHAT ---
    const chatBox = document.getElementById('chat-box');
    const usersList = document.getElementById('users-list');
    const msgInput = document.getElementById('msg-input');
    const typingIndicator = document.getElementById('typing-indicator');
    const btnSend = document.getElementById('btn-send');

    // =========================
    // ✅ VIDEO SEARCH HANDLER (CORRIGÉ)
    // =========================
    const videoSearchForm = document.getElementById('video-search-form');

    if (videoSearchForm) {
        videoSearchForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const input = videoSearchForm.querySelector('input');
            const videoId = input?.value?.trim();

            if (videoId && window.player && window.player.loadVideoById) {
                window.player.loadVideoById(videoId);
            }
        });
    }

    // =========================
    // USERS
    // =========================
    socket.on('update_users', (users) => {
        if (usersList) {
            usersList.innerHTML = users.map(u =>
                `<li class="text-white"><span style="color:#0f0;">●</span> ${u.username}</li>`
            ).join('');
        }
    });

    // =========================
    // CHAT
    // =========================
    socket.on('receive_message', (data) => {
        if (!chatBox) return;

        const div = document.createElement('div');

        if (data.isSystem) {
            div.className = 'system-msg';
            div.textContent = data.text;
        } else {
            const time = data.currentVideoTime || 0;
            const min = Math.floor(time / 60);
            const sec = Math.floor(time % 60);
            const formatted = `${min < 10 ? '0'+min : min}:${sec < 10 ? '0'+sec : sec}`;

            div.innerHTML = `<strong>[${formatted}] ${data.username}:</strong> ${data.message_text}`;
        }

        chatBox.appendChild(div);
        chatBox.scrollTop = chatBox.scrollHeight;
    });

    function sendMessage() {
        if (msgInput && msgInput.value.trim()) {

            let currentVideoTime = 0;
            if (window.player && window.player.getCurrentTime) {
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
    }

    if (btnSend) {
        btnSend.type = "button";
        btnSend.addEventListener('click', sendMessage);
    }

    if (msgInput) {
        msgInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });

        msgInput.addEventListener('input', () => {
            socket.emit('typing', { roomCode, username });
        });
    }

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

    // =========================
    // LEAVE
    // =========================
    const btnLeave = document.getElementById('btn-leave-room');
    if (btnLeave) {
        btnLeave.addEventListener('click', () => {
            socket.emit('explicit_leave', { roomCode, username });
            window.location.href = '/';
        });
    }

    // =========================
    // YOUTUBE
    // =========================
    window.onYouTubeIframeAPIReady = function () {
        window.player = new YT.Player('player', {
            height: '100%',
            width: '100%',
            videoId: '',
            playerVars: { autoplay: 0, controls: 1 },
            events: { onStateChange: onPlayerStateChange }
        });
    };

    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);

    // =========================
    // SYNC VIDEO
    // =========================
    let currentController = null;
    let isSyncing = false;

    const btnControl = document.getElementById('btn-control');
    if (btnControl) {
        btnControl.type = "button";

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
            const state = event.data;
            const time = window.player.getCurrentTime();

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

    // =========================
    // CHAT HISTORY
    // =========================
    socket.on('chat_history', (messages) => {
        if (!chatBox) return;

        chatBox.innerHTML = "";

        messages.forEach(msg => {
            const div = document.createElement('div');

            const time = msg.currentvideotime || 0;
            const min = Math.floor(time / 60);
            const sec = Math.floor(time % 60);
            const formatted = `${min < 10 ? '0'+min : min}:${sec < 10 ? '0'+sec : sec}`;

            div.innerHTML = `<strong>[${formatted}] ${msg.username}:</strong> ${msg.message_text}`;
            chatBox.appendChild(div);
        });

        chatBox.scrollTop = chatBox.scrollHeight;
    });

}

document.addEventListener('DOMContentLoaded', init_room);