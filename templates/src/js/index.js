function init_index(){

    const socket = io();
        const usernameInput = document.getElementById('username');

        // 1. CRÉER : On demande un code au serveur
        document.getElementById('btn-create').addEventListener('click', () => {
            const user = usernameInput.value;
            if(!user) return alert("Pseudo requis !");
            
            socket.emit('request_create_room');
        });

        // Le serveur nous donne un code -> on redirige
        socket.on('room_created', (code) => {
            const user = usernameInput.value;
            // Redirection vers room.html avec paramètres dans l'URL
            window.location.href = `/room?room=${code}&user=${user}`;
        });

        // 2. REJOINDRE : On redirige directement si on a le code
        document.getElementById('btn-join').addEventListener('click', () => {
            const user = usernameInput.value;
            const code = document.getElementById('room-code').value;
            
            if(!user || !code) return alert("Pseudo et Code requis !");
            
            window.location.href = `/room?room=${code}&user=${user}`;
        });

}