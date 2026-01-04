function init_index() {
    const socket = io();
    const usernameInput = document.getElementById('username');
    const roomCodeInput = document.getElementById('room-code');
    const errorMsg = document.getElementById('error-msg');

    // --- GESTION AUTHENTIFICATION ---
    const navGuest = document.getElementById('nav-guest');
    const navLogged = document.getElementById('nav-logged');
    const navUserDisplay = document.getElementById('nav-username-display');
    const btnLogout = document.getElementById('btn-logout');

    function checkAuth() {
        const savedUser = localStorage.getItem('streamSquad_user');
        
        if (savedUser) {
            // === MODE CONNECTÉ ===
            if(navGuest) navGuest.classList.add('d-none');
            if(navLogged) navLogged.classList.remove('d-none');
            if(navUserDisplay) navUserDisplay.textContent = `👤 ${savedUser}`;
            
            if (usernameInput) {
                usernameInput.value = savedUser;
                
                // ON VERROUILLE LE CHAMP
                usernameInput.readOnly = true; 
                
                // On change le style pour montrer que c'est bloqué
                usernameInput.style.backgroundColor = "rgba(0, 0, 0, 0.5)"; 
                usernameInput.style.cursor = "not-allowed";
                usernameInput.title = "Déconnectez-vous pour changer de pseudo";
            }
        } else {
            // === MODE INVITÉ ===
            if(navGuest) navGuest.classList.remove('d-none');
            if(navLogged) navLogged.classList.add('d-none');
            
            if (usernameInput) {
                usernameInput.value = "";
                
                // ON DÉVERROUILLE LE CHAMP
                usernameInput.readOnly = false;
                
                // On remet le style normal
                usernameInput.style.backgroundColor = "#e3f0ff"; 
                usernameInput.style.cursor = "text";
                usernameInput.title = "";
            }
        }
    }

    // Vérification au démarrage
    checkAuth();

    // DÉCONNEXION
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            localStorage.removeItem('streamSquad_user');
            checkAuth(); // Cela va vider et déverrouiller le champ automatiquement
        });
    }

    // --- LOGIQUE SALONS ---

    // 1. CRÉER
    const btnCreate = document.getElementById('btn-create');
    if (btnCreate) {
        btnCreate.addEventListener('click', () => {
            const user = usernameInput.value.trim();
            if (!user) {
                if (errorMsg) errorMsg.textContent = "Pseudo requis !";
                return;
            }
            // Pas de sauvegarde localStorage ici (géré par le login)
            socket.emit('request_create_room');
        });
    }

    socket.on('room_created', (code) => {
        const user = usernameInput.value;
        window.location.href = `/room?room=${code}&user=${user}`;
    });

    // 2. REJOINDRE
    const btnJoin = document.getElementById('btn-join');
    if (btnJoin) {
        btnJoin.addEventListener('click', () => {
            const user = usernameInput.value.trim();
            const code = roomCodeInput.value.trim();

            if (errorMsg) errorMsg.textContent = "";

            if (!user || !code) {
                if (errorMsg) errorMsg.textContent = "Pseudo et Code requis !";
                return;
            }
            socket.emit('check_room_existence', code);
        });
    }

    // Réponse serveur
    socket.on('room_existence_result', (data) => {
        if (data.exists) {
            const user = usernameInput.value;
            const code = roomCodeInput.value;
            window.location.href = `/room?room=${code}&user=${user}`;
        } else {
            if (errorMsg) errorMsg.textContent = "Ce salon n'existe pas";
        }
    });

    // Navigation boutons
    const js_access_button = document.querySelectorAll('.js-access-button');
    js_access_button.forEach(element => {
        element.addEventListener('click', (event) => {
            const target = element.getAttribute("href");
            if (target) window.location.href = target;
        });
    });
}

document.addEventListener('DOMContentLoaded', init_index);