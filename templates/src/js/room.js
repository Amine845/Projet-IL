// templates/src/js/room.js

function init_room() {

    const socket = io();

    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get('room');
    const username = params.get('user');

    if (!roomCode || !username) {
        window.location.href = '/';
        return;
    }

    socket.emit('join_room', { roomCode, username });
    socket.emit('request_markers', roomCode);

    const chatBox = document.getElementById('chat-box');
    const msgInput = document.getElementById('msg-input');
    const btnSend = document.getElementById('btn-send');

    function formatTime(seconds) {
        const min = Math.floor(seconds / 60);
        const sec = Math.floor(seconds % 60);
        return `${min < 10 ? '0'+min : min}:${sec < 10 ? '0'+sec : sec}`;
    }

    socket.on('receive_message', (data) => {
        const div = document.createElement('div');

        const time = formatTime(data.currentVideoTime || 0);

        div.innerHTML = `<strong>[${time}] ${data.username}:</strong> ${data.message_text}`;
        chatBox.appendChild(div);
    });

    function sendMessage() {
        if (!msgInput.value.trim()) return;

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

    btnSend?.addEventListener('click', sendMessage);

    msgInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    socket.on('chat_history', (messages) => {
        chatBox.innerHTML = "";

        messages.forEach(msg => {
            const div = document.createElement('div');

            const time = formatTime(msg.currentvideotime || 0);

            div.innerHTML = `<strong>[${time}] ${msg.username}:</strong> ${msg.message_text}`;
            chatBox.appendChild(div);
        });
    });

}

document.addEventListener('DOMContentLoaded', init_room);