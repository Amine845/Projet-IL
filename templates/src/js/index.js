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

    // --- ÉLÉMENTS PREMIUM ---
    const btnSubscribePro = document.getElementById('btn-subscribe-pro');
    const subscribeMsg = document.getElementById('subscribe-msg');
    const btnShowPremium = document.getElementById('btn-show-premium');

    // Fonction pour activer l'interface PRO
    function applyProStyle() {
        if (btnShowPremium) {
            btnShowPremium.innerHTML = '<i class="fas fa-check"></i> Compte PRO';
            btnShowPremium.classList.replace('btn-outline-warning', 'btn-success');
            btnShowPremium.disabled = true;
        }
        if (btnSubscribePro) {
            btnSubscribePro.innerHTML = '<i class="fas fa-check"></i> Abonnement Actif';
            btnSubscribePro.classList.replace('btn-warning', 'btn-success');
            btnSubscribePro.disabled = true;
            if (subscribeMsg) {
                subscribeMsg.className = "text-center small mt-2 text-success fw-bold";
                subscribeMsg.innerText = "Vous êtes déjà membre Premium.";
            }
        }
    }

    // Fonction pour réinitialiser l'interface PRO (en cas de déconnexion)
    function resetProStyle() {
        if (btnShowPremium) {
            btnShowPremium.innerHTML = '<i class="fas fa-crown"></i> Passer PRO';
            btnShowPremium.classList.replace('btn-success', 'btn-outline-warning');
            btnShowPremium.disabled = false;
        }
        if (btnSubscribePro) {
            btnSubscribePro.innerHTML = 'Souscrire à l\'offre PRO';
            btnSubscribePro.classList.replace('btn-success', 'btn-warning');
            btnSubscribePro.disabled = false;
            if (subscribeMsg) {
                subscribeMsg.className = "text-center small mt-2 text-muted";
                subscribeMsg.innerText = "14 jours d'essai offerts. Sans engagement.";
            }
        }
    }

    // Vérifier en BDD si l'utilisateur est premium
    async function checkPremiumStatus(username) {
        try {
            const res = await fetch(`/api/user-status/${username}`);
            const data = await res.json();
            if (data.is_premium) {
                applyProStyle();
            } else {
                resetProStyle();
            }
        } catch (e) {
            console.error("Erreur vérification premium", e);
        }
    }

    function checkAuth() {
        // C'est ICI qu'était le secret : on utilise streamSquad_user !
        const savedUser = localStorage.getItem('streamSquad_user');
        
        if (savedUser) {
            // MODE CONNECTÉ
            if(navGuest) navGuest.classList.add('d-none');
            if(navLogged) navLogged.classList.remove('d-none');
            if(navUserDisplay) navUserDisplay.textContent = `👤 ${savedUser}`;
            
            if (usernameInput) {
                usernameInput.value = savedUser;
                usernameInput.readOnly = true; 
                usernameInput.style.backgroundColor = "rgba(0, 0, 0, 0.5)"; 
                usernameInput.style.cursor = "not-allowed";
                usernameInput.title = "Déconnectez-vous pour changer de pseudo";
            }

            // On vérifie le statut Premium à chaque fois qu'on se connecte / rafraîchit
            checkPremiumStatus(savedUser);

        } else {
            // MODE INVITÉ
            if(navGuest) navGuest.classList.remove('d-none');
            if(navLogged) navLogged.classList.add('d-none');
            
            if (usernameInput) {
                usernameInput.value = "";
                usernameInput.readOnly = false;
                usernameInput.style.backgroundColor = "#e3f0ff"; 
                usernameInput.style.cursor = "text";
                usernameInput.title = "";
            }

            // On remet les boutons PRO à zéro
            resetProStyle();
        }
    }

    // Vérification au démarrage
    checkAuth();

    // DÉCONNEXION
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            localStorage.removeItem('streamSquad_user');
            checkAuth(); // Cela va vider, déverrouiller le champ et retirer le style PRO
        });
    }

    // --- LOGIQUE SOUSCRIPTION PREMIUM ---
    if (btnSubscribePro) {
        btnSubscribePro.addEventListener('click', async () => {
            const currentUsername = localStorage.getItem('streamSquad_user');
            
            if (!currentUsername) {
                if (subscribeMsg) {
                    subscribeMsg.className = "text-center small mt-2 text-danger";
                    subscribeMsg.innerHTML = "Vous devez être <a href='/login'>connecté</a> pour souscrire.";
                }
                return;
            }

            btnSubscribePro.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Création de l\'abonnement...';
            btnSubscribePro.disabled = true;

            try {
                const response = await fetch('/api/subscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: currentUsername })
                });
                
                const result = await response.json();

                if (result.success) {
                    // Si la BDD est mise à jour, on applique le style visuel
                    applyProStyle();
                    if (subscribeMsg) {
                        subscribeMsg.className = "text-center small mt-2 text-success fw-bold";
                        subscribeMsg.innerText = "Paiement simulé avec succès ! Votre compte est maintenant Premium.";
                    }
                } else {
                    btnSubscribePro.innerHTML = 'Erreur. Réessayer.';
                    btnSubscribePro.disabled = false;
                }
            } catch (error) {
                console.error("Erreur d'abonnement:", error);
                btnSubscribePro.innerHTML = 'Erreur réseau';
                btnSubscribePro.disabled = false;
            }
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