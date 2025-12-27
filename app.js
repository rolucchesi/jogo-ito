// ==================== FIREBASE INITIALIZATION ====================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    onSnapshot, 
    updateDoc, 
    arrayUnion, 
    arrayRemove 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ==================== GLOBAL STATE ====================
let themes = [];
let selectedThemeId = null;
let selectedThemeObj = null;
let unsubscribeFromRoom = null;

// ==================== DOM ELEMENTS ====================
const mainContainer = document.getElementById('main-container');
const pages = document.querySelectorAll('.page');

// Navigation
const playArranjoBtn = document.getElementById('play-arranjo-btn');
const createRoomForm = document.getElementById('createRoomForm');
const joinRoomForm = document.getElementById('joinRoomForm');

// Game elements
const drawThemeBtn = document.getElementById('drawThemeBtn');
const roomCodeDisplay = document.getElementById('roomCodeDisplay');
const currentUserEl = document.getElementById('currentUser');
const userListEl = document.getElementById('userList');
const userNumberEl = document.getElementById('userNumber');
const themeResultEl = document.getElementById('theme-result');
const themeDrawnEl = document.getElementById('themeDrawn');
const minValueEl = document.getElementById('minValue');
const maxValueEl = document.getElementById('maxValue');
const joinErrorEl = document.getElementById('joinError');

// Modals
const confirmationModal = document.getElementById('confirmation-modal');
const cancelNewGameBtn = document.getElementById('cancel-new-game');
const confirmNewGameBtn = document.getElementById('confirm-new-game');
const rulesModal = document.getElementById('rules-modal');
const showRulesBtn = document.getElementById('show-rules-btn');
const showRulesBtnIngame = document.getElementById('show-rules-btn-ingame');
const closeRulesBtn = document.getElementById('close-rules-btn');

// Settings
const settingsBtn = document.getElementById('settingsBtn');
const settingsDropdown = document.getElementById('settingsDropdown');
const chooseThemeMenuBtn = document.getElementById('chooseThemeMenuBtn');
const logoutMenuBtn = document.getElementById('logoutMenuBtn');

// Theme change
const confirmThemeModal = document.getElementById('confirm-theme-modal');
const selectedThemeName = document.getElementById('selectedThemeName');
const cancelThemeChangeBtn = document.getElementById('cancel-theme-change');
const confirmThemeChangeBtn = document.getElementById('confirm-theme-change');

// ==================== THEME MANAGEMENT ====================
async function loadThemes() {
    try {
        const response = await fetch('themes.json');
        if (!response.ok) throw new Error('Erro ao carregar temas');
        themes = await response.json();
    } catch (e) {
        console.error('Erro ao carregar themes.json:', e);
        themes = [];
    }
}

function getThemeListModal() {
    const themeListModalId = 'theme-list-modal';
    let themeListModal = document.getElementById(themeListModalId);
    
    if (!themeListModal) {
        themeListModal = document.createElement('div');
        themeListModal.id = themeListModalId;
        themeListModal.className = 'hidden fixed inset-0 bg-blue-900 bg-opacity-40 flex items-center justify-center z-50';
        themeListModal.innerHTML = `
            <div class="card p-8 shadow-lg text-center max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
                <button id="close-theme-modal-x" class="sticky top-0 float-right text-gray-400 hover:text-blue-700 font-bold text-2xl -mt-1" title="Fechar">×</button>
                <h3 class="text-xl font-bold text-blue-700 mb-4">Escolha um tema</h3>
                <div id="themeListContainer" class="grid grid-cols-1 gap-2 text-left"></div>
                <div class="flex justify-center space-x-4 mt-6">
                    <button id="close-theme-list" class="btn-main bg-gray-300 hover:bg-gray-400 text-blue-700">Cancelar</button>
                </div>
            </div>
        `;
        document.body.appendChild(themeListModal);
        
        const closeBtnX = themeListModal.querySelector('#close-theme-modal-x');
        const closeBtn = themeListModal.querySelector('#close-theme-list');
        
        const closeModal = () => {
            themeListModal.classList.add('hidden');
            themeListModal.classList.remove('flex');
        };
        
        if (closeBtnX) {
            closeBtnX.addEventListener('click', closeModal);
        }
        if (closeBtn) {
            closeBtn.addEventListener('click', closeModal);
        }
        
        themeListModal.addEventListener('click', (e) => {
            if (e.target === themeListModal) {
                closeModal();
            }
        });
    }
    
    return themeListModal;
}

function openThemeListModal() {
    const modal = getThemeListModal();
    const themeListContainer = modal.querySelector('#themeListContainer');
    
    if (!themeListContainer) return;
    
    themeListContainer.innerHTML = '';
    themes.forEach(theme => {
        const btn = document.createElement('button');
        btn.className = 'w-full text-left px-4 py-2 rounded hover:bg-blue-100 theme-option';
        btn.type = 'button';
        btn.textContent = theme.descricao;
        btn.onclick = () => {
            selectedThemeId = theme.id;
            selectedThemeObj = theme;
            selectedThemeName.textContent = theme.descricao;
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            confirmThemeModal.classList.remove('hidden');
            confirmThemeModal.classList.add('flex');
        };
        themeListContainer.appendChild(btn);
    });
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

// ==================== ROOM MANAGEMENT ====================
function getRoomIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('room');
}

function generateUniqueNumber(usedNumbers) {
    if (usedNumbers.length >= 100) return null;
    let uniqueNumber;
    do {
        uniqueNumber = Math.floor(Math.random() * 100) + 1;
    } while (usedNumbers.includes(uniqueNumber));
    return uniqueNumber;
}

function showPage(pageId) {
    if (pageId === 'app-page') {
        mainContainer.classList.remove('max-w-md');
        mainContainer.classList.add('max-w-5xl');
    } else {
        mainContainer.classList.remove('max-w-5xl');
        mainContainer.classList.add('max-w-md');
    }
    pages.forEach(page => page.classList.toggle('active', page.id === pageId));
}

async function enterRoom(roomId, username) {
    const roomRef = doc(db, "rooms", roomId);
    const roomSnap = await getDoc(roomRef);

    if (!roomSnap.exists()) {
        alert("Sala não encontrada!");
        window.location.search = '';
        return;
    }
    
    const room = roomSnap.data();

    if (room.users.some(user => user.username.toLowerCase() === username.toLowerCase())) {
        joinErrorEl.textContent = 'Este nome de usuário já está em uso na sala.';
        return;
    }

    const usedNumbers = room.users.map(u => u.number);
    const newNumber = generateUniqueNumber(usedNumbers);
    if (newNumber === null) {
        alert('A sala está cheia!');
        return;
    }
    
    const newUser = { username, number: newNumber };
    await updateDoc(roomRef, {
        users: arrayUnion(newUser)
    });

    sessionStorage.setItem('currentRoomId', roomId);
    sessionStorage.setItem('currentUsername', username);

    listenToRoomUpdates(roomId, username);
    showPage('app-page');
}

function listenToRoomUpdates(roomId, username) {
    const roomRef = doc(db, "rooms", roomId);
    if (unsubscribeFromRoom) unsubscribeFromRoom();
    
    unsubscribeFromRoom = onSnapshot(roomRef, (docSnap) => {
        if (docSnap.exists()) {
            const room = docSnap.data();
            const currentUserData = room.users.find(u => u.username === username);

            if (!currentUserData) {
                alert("Você foi removido da sala.");
                logout();
                return;
            }
            
            currentUserEl.textContent = username;
            userNumberEl.textContent = currentUserData.number;
            roomCodeDisplay.textContent = roomId;
            updateUserList(room, username);
            updateThemeDisplay(room);
        } else {
            alert("A sala que você acessava não existe mais.");
            logout();
        }
    });
}

function updateUserList(room, currentUsername) {
    userListEl.innerHTML = '';
    const isHost = room.host === currentUsername;

    room.users.sort((a, b) => a.username.localeCompare(b.username));
    room.users.forEach(user => {
        const li = document.createElement('li');
        li.className = 'flex justify-between items-center bg-gray-100 p-3 rounded-lg text-gray-800 font-medium';
        
        let userLabel = document.createElement('span');
        userLabel.textContent = user.username;
        if (user.username === room.host) {
            userLabel.textContent += ' 👑';
        }
        li.appendChild(userLabel);

        if (isHost && user.username !== currentUsername) {
            const removeBtn = document.createElement('button');
            removeBtn.textContent = '✖';
            removeBtn.className = 'text-red-500 hover:text-red-700 font-bold ml-2';
            removeBtn.title = `Remover ${user.username}`;
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                removeUser(room.id, user);
            };
            li.appendChild(removeBtn);
        }
        userListEl.appendChild(li);
    });
}

function updateThemeDisplay(room) {
    const theme = room.currentTheme;
    if (theme) {
        themeDrawnEl.textContent = theme.descricao;
        minValueEl.textContent = theme.valor_minimo;
        maxValueEl.textContent = theme.valor_maximo;
        themeResultEl.classList.remove('hidden');
    } else {
        themeResultEl.classList.add('hidden');
    }
}

async function removeUser(roomId, userToRemove) {
    const roomRef = doc(db, "rooms", roomId);
    await updateDoc(roomRef, {
        users: arrayRemove(userToRemove)
    });
}

async function logout() {
    const roomId = sessionStorage.getItem('currentRoomId');
    const username = sessionStorage.getItem('currentUsername');
    if (roomId && username) {
        const roomRef = doc(db, "rooms", roomId);
        const roomSnap = await getDoc(roomRef);
        if (roomSnap.exists()) {
            const room = roomSnap.data();
            const userToRemove = room.users.find(u => u.username === username);
            if (userToRemove) {
                await removeUser(roomId, userToRemove);
            }
        }
    }
    if (unsubscribeFromRoom) unsubscribeFromRoom();
    sessionStorage.removeItem('currentRoomId');
    sessionStorage.removeItem('currentUsername');
    window.location.href = window.location.pathname;
}

async function startNewGame() {
    const roomId = sessionStorage.getItem('currentRoomId');
    if (!roomId) return;

    const roomRef = doc(db, "rooms", roomId);
    const roomSnap = await getDoc(roomRef);

    if (roomSnap.exists()) {
        const room = roomSnap.data();
        const drawnThemeNumber = Math.floor(Math.random() * themes.length);
        const newTheme = themes[drawnThemeNumber];

        let availableNumbers = Array.from({ length: 100 }, (_, i) => i + 1);
        for (let i = availableNumbers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [availableNumbers[i], availableNumbers[j]] = [availableNumbers[j], availableNumbers[i]];
        }

        const updatedUsers = room.users.map(user => ({
            ...user,
            number: availableNumbers.pop()
        }));

        await updateDoc(roomRef, {
            currentTheme: newTheme,
            users: updatedUsers
        });
    }
}

async function changeTheme() {
    if (!selectedThemeObj) return;
    const roomId = sessionStorage.getItem('currentRoomId');
    if (!roomId) return;
    
    const roomRef = doc(db, "rooms", roomId);
    const roomSnap = await getDoc(roomRef);
    
    if (roomSnap.exists()) {
        const room = roomSnap.data();
        let availableNumbers = Array.from({ length: 100 }, (_, i) => i + 1);
        for (let i = availableNumbers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [availableNumbers[i], availableNumbers[j]] = [availableNumbers[j], availableNumbers[i]];
        }
        
        const updatedUsers = room.users.map(user => ({
            ...user,
            number: availableNumbers.pop()
        }));
        
        await updateDoc(roomRef, {
            currentTheme: selectedThemeObj,
            users: updatedUsers
        });
    }
    confirmThemeModal.classList.add('hidden');
    confirmThemeModal.classList.remove('flex');
}

// ==================== EVENT LISTENERS ====================

// Navigation
if (playArranjoBtn) {
    playArranjoBtn.addEventListener('click', () => showPage('home-page'));
}

// Create room
if (createRoomForm) {
    createRoomForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const hostUsername = document.getElementById('hostUsername').value.trim();
        if (!hostUsername) return;

        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        const roomRef = doc(db, "rooms", roomId);
        const newNumber = generateUniqueNumber([]);

        const newRoom = {
            id: roomId,
            host: hostUsername,
            users: [{ username: hostUsername, number: newNumber }],
            currentTheme: null
        };
        
        await setDoc(roomRef, newRoom);
        sessionStorage.setItem('currentRoomId', roomId);
        sessionStorage.setItem('currentUsername', hostUsername);

        const newUrl = `${window.location.pathname}?room=${roomId}`;
        history.pushState({path: newUrl}, '', newUrl);

        listenToRoomUpdates(roomId, hostUsername);
        showPage('app-page');
    });
}

// Join room
if (joinRoomForm) {
    joinRoomForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('joinUsername').value.trim();
        if (!username) return;
        const roomId = getRoomIdFromUrl();
        enterRoom(roomId, username);
    });
}

// Settings dropdown
if (settingsBtn && settingsDropdown) {
    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsDropdown.classList.toggle('hidden');
    });
    document.addEventListener('click', (e) => {
        if (!settingsDropdown.contains(e.target) && e.target !== settingsBtn) {
            settingsDropdown.classList.add('hidden');
        }
    });
}

// Logout from menu
if (logoutMenuBtn) {
    logoutMenuBtn.addEventListener('click', () => {
        settingsDropdown.classList.add('hidden');
        logout();
    });
}

// Choose theme from menu
if (chooseThemeMenuBtn) {
    chooseThemeMenuBtn.addEventListener('click', () => {
        settingsDropdown.classList.add('hidden');
        openThemeListModal();
    });
}

// Game controls
if (drawThemeBtn) {
    drawThemeBtn.addEventListener('click', () => {
        confirmationModal.classList.remove('hidden');
        confirmationModal.classList.add('flex');
    });
}

if (cancelNewGameBtn) {
    cancelNewGameBtn.addEventListener('click', () => {
        confirmationModal.classList.add('hidden');
        confirmationModal.classList.remove('flex');
    });
}

if (confirmNewGameBtn) {
    confirmNewGameBtn.addEventListener('click', () => {
        startNewGame();
        confirmationModal.classList.add('hidden');
        confirmationModal.classList.remove('flex');
    });
}

// Room code copy
if (roomCodeDisplay) {
    roomCodeDisplay.addEventListener('click', () => {
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(() => {
            const originalText = roomCodeDisplay.textContent;
            roomCodeDisplay.textContent = 'Copiado!';
            roomCodeDisplay.classList.add('text-green-500');
            setTimeout(() => {
                roomCodeDisplay.textContent = originalText;
                roomCodeDisplay.classList.remove('text-green-500');
            }, 1500);
        });
    });
}

// Share link button
const shareLinkBtn = document.getElementById('share-link-btn');
if (shareLinkBtn) {
    shareLinkBtn.addEventListener('click', () => {
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(() => {
            shareLinkBtn.textContent = 'Link copiado!';
            setTimeout(() => {
                shareLinkBtn.textContent = 'Compartilhar';
            }, 1500);
        });
    });
}

// Rules modal
if (showRulesBtn) {
    showRulesBtn.addEventListener('click', () => {
        rulesModal.classList.remove('hidden');
    });
}

if (showRulesBtnIngame) {
    showRulesBtnIngame.addEventListener('click', () => {
        rulesModal.classList.remove('hidden');
    });
}

if (closeRulesBtn) {
    closeRulesBtn.addEventListener('click', () => {
        rulesModal.classList.add('hidden');
    });
}

if (rulesModal) {
    rulesModal.addEventListener('click', (e) => {
        if (e.target === rulesModal) {
            rulesModal.classList.add('hidden');
        }
    });
}

// Theme change modal
if (cancelThemeChangeBtn) {
    cancelThemeChangeBtn.addEventListener('click', () => {
        confirmThemeModal.classList.add('hidden');
        confirmThemeModal.classList.remove('flex');
    });
}

if (confirmThemeChangeBtn) {
    confirmThemeChangeBtn.addEventListener('click', () => {
        changeTheme();
    });
}

// ==================== INITIALIZATION ====================
async function init() {
    await loadThemes();
    
    const roomId = getRoomIdFromUrl();
    const sessionUser = sessionStorage.getItem('currentUsername');
    const sessionRoom = sessionStorage.getItem('currentRoomId');

    if (!roomId) {
        showPage('game-selection-page');
    } else {
        const roomRef = doc(db, "rooms", roomId);
        const roomSnap = await getDoc(roomRef);

        if (!roomSnap.exists()) {
            alert('Sala não encontrada. Redirecionando para a página inicial.');
            window.location.href = window.location.pathname;
        } else if (sessionUser && sessionRoom === roomId) {
            listenToRoomUpdates(roomId, sessionUser);
            showPage('app-page');
        } else {
            showPage('join-page');
        }
    }
}

init();
