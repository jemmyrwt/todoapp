// TaskController - Fixed Authentication for Render
const API_BASE_URL = window.location.origin.includes('render.com') 
    ? 'https://todoapp-p5hq.onrender.com/api' 
    : 'http://localhost:10000/api';

console.log('🌐 TaskController Loading...');
console.log('📡 API Base URL:', API_BASE_URL);
console.log('🌍 Current Origin:', window.location.origin);
console.log('🔍 Environment:', process.env.NODE_ENV);

let tasks = [];
let notes = [];
let isLoginMode = true;
let timer = null;
let timeLeft = 1500;
let timerRunning = false;
let soundEnabled = true;
let autosaveEnabled = true;
let remindersEnabled = false;
let currentFilter = 'all';
let focusSessions = 0;
let totalFocusTime = 0;
let authToken = null;
let currentUser = null;
let isOnline = navigator.onLine;
let pendingDeleteTaskId = null;
let pendingDeleteNoteId = null;

// Storage keys
const STORAGE_KEYS = {
    TOKEN: 'taskcontroller_token',
    USER: 'taskcontroller_user',
    SETTINGS: 'taskcontroller_settings',
    THEME: 'taskcontroller_theme',
    TASKS: 'taskcontroller_tasks',
    NOTES: 'taskcontroller_notes',
    FOCUS_SESSIONS: 'taskcontroller_focus_sessions',
    FOCUS_TIME: 'taskcontroller_total_focus_time',
    AUTO_LOGIN: 'taskcontroller_auto_login',
    LAST_SYNC: 'taskcontroller_last_sync'
};

// Audio elements
const taskSound = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-select-click-1109.mp3');
const timerSound = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-alarm-digital-clock-beep-989.mp3');
const notificationSound = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-correct-answer-tone-2870.mp3');

// Preload audio
taskSound.load();
timerSound.load();
notificationSound.load();

// 1. Initial Launch - FIXED AUTH LOAD
window.onload = async () => {
    console.log('🌐 TaskController Initializing...');
    
    // Check network status
    updateNetworkStatus();
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
    
    // Load saved data
    authToken = localStorage.getItem(STORAGE_KEYS.TOKEN);
    currentUser = JSON.parse(localStorage.getItem(STORAGE_KEYS.USER));
    
    console.log('🔍 Auth check on load:');
    console.log('   - Token:', authToken ? `Present (${authToken.substring(0, 20)}...)` : 'Missing');
    console.log('   - User:', currentUser ? `${currentUser.email}` : 'None');
    
    // Load theme
    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) || 'dark';
    document.body.setAttribute('data-theme', savedTheme);
    
    // Update theme toggle
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.checked = savedTheme === 'light';
    }
    
    // Load settings
    const savedSettings = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS));
    if (savedSettings) {
        soundEnabled = savedSettings.soundEnabled !== undefined ? savedSettings.soundEnabled : true;
        autosaveEnabled = savedSettings.autosaveEnabled !== undefined ? savedSettings.autosaveEnabled : true;
        remindersEnabled = savedSettings.remindersEnabled !== undefined ? savedSettings.remindersEnabled : false;
        
        // Update toggle switches
        if (document.getElementById('soundToggle')) {
            document.getElementById('soundToggle').checked = soundEnabled;
        }
        if (document.getElementById('autosaveToggle')) {
            document.getElementById('autosaveToggle').checked = autosaveEnabled;
        }
        if (document.getElementById('reminderToggle')) {
            document.getElementById('reminderToggle').checked = remindersEnabled;
        }
    }
    
    // ✅ FIXED: Setup event listeners FIRST
    setupEventListeners();
    
    // ✅ FIXED: Check authentication with better error handling
    if (authToken && currentUser) {
        try {
            console.log('🔐 Attempting to verify existing token...');
            
            // First check if server is reachable
            const healthCheck = await fetch(`${API_BASE_URL}/health`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                },
                signal: AbortSignal.timeout(5000)
            }).catch(() => null);
            
            if (!healthCheck || !healthCheck.ok) {
                console.log('⚠️ Server not reachable, using offline mode');
                loadLocalData();
                showToast('Offline mode - using local data', 'info');
                showApp();
                return;
            }
            
            // Verify token with backend
            console.log('🔐 Verifying token with server...');
            const response = await fetch(`${API_BASE_URL}/auth/me`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                signal: AbortSignal.timeout(10000)
            });
            
            console.log('✅ Auth check response:', response.status, response.statusText);
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Token valid, user data:', data.user.email);
                
                currentUser = data.user;
                localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(currentUser));
                
                // Load data from server
                await loadUserData();
                showApp();
                showToast(`Welcome back, ${currentUser.name}!`, 'success');
            } else {
                // Token invalid
                const errorData = await response.json().catch(() => ({}));
                console.error('❌ Token invalid:', response.status, errorData);
                
                // Clear invalid token
                localStorage.removeItem(STORAGE_KEYS.TOKEN);
                localStorage.removeItem(STORAGE_KEYS.USER);
                authToken = null;
                currentUser = null;
                
                // Show auth screen
                showAuth();
                showToast('Session expired, please login again', 'warning');
            }
        } catch (error) {
            console.error('❌ Auth verification error:', error);
            
            if (error.name === 'AbortError') {
                console.log('⚠️ Auth check timeout, using local data');
                loadLocalData();
                showToast('Server timeout, using local data', 'warning');
                showApp();
            } else {
                // Network or other error
                console.log('⚠️ Network error, using offline mode');
                loadLocalData();
                showToast('Offline mode - using local data', 'info');
                showApp();
            }
        }
    } else {
        // No token found, show auth screen
        console.log('🔐 No existing token found, showing auth screen');
        showAuth();
    }
    
    // Initialize clock and intervals
    updateClock();
    setInterval(updateClock, 1000);
    setInterval(syncDataIfOnline, 30000);
    if (autosaveEnabled) {
        setInterval(autoSaveNotes, 60000);
    }
    
    setupKeyboardShortcuts();
    
    // Check server health
    checkServerHealth();
    
    // Initialize audio
    initAudio();
    
    // Debug auth elements
    debugAuthElements();
};

// Initialize audio
function initAudio() {
    taskSound.volume = 0.5;
    timerSound.volume = 0.5;
    notificationSound.volume = 0.5;
}

// Debug function to check if elements exist
function debugAuthElements() {
    console.log('🔍 Debugging auth elements:');
    console.log('   - auth-main-btn:', document.getElementById('auth-main-btn') ? 'Found' : 'Not found');
    console.log('   - toggle-auth:', document.querySelector('.toggle-auth') ? 'Found' : 'Not found');
    console.log('   - auth-email:', document.getElementById('auth-email') ? 'Found' : 'Not found');
    console.log('   - auth-pass:', document.getElementById('auth-pass') ? 'Found' : 'Not found');
    console.log('   - auth-name:', document.getElementById('auth-name') ? 'Found' : 'Not found');
}

// 2. Authentication Functions - COMPLETELY FIXED
async function handleAuth() {
    console.log('🔑 handleAuth() called');
    console.log('📡 API Base URL:', API_BASE_URL);
    
    const email = document.getElementById('auth-email').value.trim();
    const pass = document.getElementById('auth-pass').value.trim();
    const name = document.getElementById('auth-name') ? document.getElementById('auth-name').value.trim() : '';

    if (!email || !pass) {
        showToast('Please fill all required fields!', 'error');
        return;
    }

    if (!isLoginMode && !name) {
        showToast('Please enter your full name!', 'error');
        return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showToast('Please enter a valid email address!', 'error');
        return;
    }

    if (pass.length < 6) {
        showToast('Password must be at least 6 characters!', 'error');
        return;
    }

    // Show loading
    const authBtn = document.getElementById('auth-main-btn');
    const originalText = authBtn.textContent;
    authBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
    authBtn.disabled = true;

    try {
        const endpoint = isLoginMode ? '/auth/login' : '/auth/register';
        const body = isLoginMode ? { email, password: pass } : { name, email, password: pass };

        console.log('📤 Sending auth request to:', `${API_BASE_URL}${endpoint}`);
        console.log('📦 Request body:', { ...body, password: '***' });

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Origin': window.location.origin
            },
            body: JSON.stringify(body),
            credentials: 'include'
        });

        console.log('📥 Auth response status:', response.status, response.statusText);
        
        const data = await response.json();
        console.log('📥 Auth response data:', data);

        if (!response.ok) {
            throw new Error(data.message || `Authentication failed (${response.status})`);
        }

        if (!isLoginMode) {
            // Registration successful
            console.log('✅ Registration successful for:', email);
            
            // Save registration details for auto-login
            localStorage.setItem(STORAGE_KEYS.AUTO_LOGIN, JSON.stringify({ email, password: pass }));
            
            // Show success message and switch to login
            showToast('Account created successfully! Please login.', 'success');
            
            // Switch to login mode
            isLoginMode = true;
            updateAuthUI();
            
            // Auto-fill login form
            setTimeout(() => {
                document.getElementById('auth-email').value = email;
                document.getElementById('auth-pass').value = pass;
                document.getElementById('auth-pass').focus();
            }, 500);
            
            return;
        }

        // ✅ FIXED: Login successful - proper token handling
        if (!data.token) {
            throw new Error('No authentication token received from server');
        }
        
        if (!data.user) {
            throw new Error('No user data received from server');
        }
        
        authToken = data.token;
        currentUser = data.user;
        
        console.log('✅ Login successful:');
        console.log('   - User:', currentUser.email);
        console.log('   - Token received:', authToken.substring(0, 20) + '...');
        console.log('   - User data:', currentUser);
        
        // Save to localStorage
        localStorage.setItem(STORAGE_KEYS.TOKEN, authToken);
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(currentUser));
        localStorage.removeItem(STORAGE_KEYS.AUTO_LOGIN); // Clear auto-login data
        
        // Verify token was saved
        const savedToken = localStorage.getItem(STORAGE_KEYS.TOKEN);
        const savedUser = JSON.parse(localStorage.getItem(STORAGE_KEYS.USER));
        
        console.log('💾 Storage verification:');
        console.log('   - Token saved:', savedToken ? 'Yes' : 'No');
        console.log('   - User saved:', savedUser ? savedUser.email : 'No');
        
        // Update settings from server
        if (data.user.settings) {
            soundEnabled = data.user.settings.soundEnabled;
            autosaveEnabled = data.user.settings.autosaveEnabled;
            remindersEnabled = data.user.settings.remindersEnabled;
            
            // Update toggle switches
            if (document.getElementById('soundToggle')) {
                document.getElementById('soundToggle').checked = soundEnabled;
            }
            if (document.getElementById('autosaveToggle')) {
                document.getElementById('autosaveToggle').checked = autosaveEnabled;
            }
            if (document.getElementById('reminderToggle')) {
                document.getElementById('reminderToggle').checked = remindersEnabled;
            }
            
            // Save settings locally
            localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(data.user.settings));
        }
        
        // Load data from server
        await loadUserData();
        
        showToast(data.message || 'Login successful!', 'success');
        showApp();
        
    } catch (error) {
        console.error('❌ Auth error:', error);
        console.error('❌ Error stack:', error.stack);
        
        if (!isOnline) {
            showToast('You are offline. Please check your internet connection.', 'error');
        } else {
            showToast(error.message || 'Authentication failed. Please try again.', 'error');
        }
    } finally {
        authBtn.textContent = originalText;
        authBtn.disabled = false;
    }
}

// 3. Update Authentication UI
function updateAuthUI() {
    const authTitle = document.getElementById('auth-title');
    const authDesc = document.getElementById('auth-desc');
    const authMainBtn = document.getElementById('auth-main-btn');
    const toggleTextSpan = document.getElementById('toggle-text-span');
    const authExtra = document.getElementById('reg-extra');
    
    if (isLoginMode) {
        authTitle.textContent = 'TaskController';
        authDesc.textContent = 'Secure access to your dashboard';
        authMainBtn.textContent = 'Access Workspace';
        toggleTextSpan.textContent = 'Create Account';
        if (authExtra) authExtra.style.display = 'none';
        
        // Check for auto-login data
        const autoLogin = JSON.parse(localStorage.getItem(STORAGE_KEYS.AUTO_LOGIN));
        if (autoLogin) {
            setTimeout(() => {
                document.getElementById('auth-email').value = autoLogin.email;
                document.getElementById('auth-pass').value = autoLogin.password;
                showToast('Auto-filled credentials from registration', 'info');
            }, 100);
        }
    } else {
        authTitle.textContent = 'Create Account';
        authDesc.textContent = 'Join TaskController today';
        authMainBtn.textContent = 'Create Account';
        toggleTextSpan.textContent = 'Login';
        if (authExtra) authExtra.style.display = 'block';
    }
}

// 4. Toggle Auth Mode Function
function toggleAuthMode() {
    console.log('🔄 toggleAuthMode() called');
    
    isLoginMode = !isLoginMode;
    updateAuthUI();
    
    // Clear inputs
    if (document.getElementById('auth-name')) {
        document.getElementById('auth-name').value = '';
    }
    document.getElementById('auth-email').value = '';
    document.getElementById('auth-pass').value = '';
    
    // Focus on appropriate field
    if (isLoginMode) {
        document.getElementById('auth-email').focus();
    } else {
        document.getElementById('auth-name').focus();
    }
}

// 5. Network Status Function
function updateNetworkStatus() {
    isOnline = navigator.onLine;
    
    const networkIndicator = document.getElementById('network-status');
    if (!networkIndicator) {
        const indicator = document.createElement('div');
        indicator.id = 'network-status';
        document.body.appendChild(indicator);
    }
    
    const indicator = document.getElementById('network-status');
    
    if (isOnline) {
        indicator.textContent = '✅ Online';
        indicator.className = 'online';
        
        // Auto-sync when coming online
        setTimeout(syncDataIfOnline, 2000);
        
        setTimeout(() => {
            indicator.style.display = 'none';
        }, 3000);
    } else {
        indicator.textContent = '⚠️ Offline';
        indicator.className = 'offline';
        
        setTimeout(() => {
            indicator.style.display = 'none';
        }, 5000);
    }
}

// 6. Setup Event Listeners Function - FIXED
function setupEventListeners() {
    console.log('🔧 Setting up event listeners...');
    
    // ✅ FIXED: AUTH BUTTON EVENT LISTENER - PROPER BINDING
    const authBtn = document.getElementById('auth-main-btn');
    if (authBtn) {
        console.log('✅ Auth button found, adding event listener');
        // Remove any existing listeners
        authBtn.replaceWith(authBtn.cloneNode(true));
        const newAuthBtn = document.getElementById('auth-main-btn');
        newAuthBtn.addEventListener('click', handleAuth);
    } else {
        console.log('❌ Auth button not found!');
    }
    
    // ✅ FIXED: AUTH TOGGLE LINK
    const toggleAuthLink = document.querySelector('.toggle-auth');
    if (toggleAuthLink) {
        console.log('✅ Toggle auth link found');
        toggleAuthLink.addEventListener('click', function(e) {
            e.preventDefault();
            toggleAuthMode();
        });
    }
    
    // ✅ FIXED: AUTH FORM ENTER KEY
    const authEmail = document.getElementById('auth-email');
    const authPass = document.getElementById('auth-pass');
    const authName = document.getElementById('auth-name');
    
    if (authEmail) {
        authEmail.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleAuth();
            }
        });
    }
    
    if (authPass) {
        authPass.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleAuth();
            }
        });
    }
    
    if (authName) {
        authName.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleAuth();
            }
        });
    }
    
    // Add task button
    document.getElementById('addBtn').addEventListener('click', addTask);
    
    // Task input enter key
    document.getElementById('taskTitle').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addTask();
        }
    });
    
    // Task filters
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.dataset.filter;
            renderTasks();
        });
    });
    
    // Navigation
    document.querySelectorAll('.nav-btn, .m-nav-item').forEach(btn => {
        btn.addEventListener('click', function() {
            const view = this.dataset.view;
            switchView(view);
        });
    });
    
    // Timer controls
    const timerStartBtn = document.getElementById('timer-start');
    const timerPauseBtn = document.getElementById('timer-pause');
    const timerResetBtn = document.getElementById('timer-reset');
    
    if (timerStartBtn) {
        timerStartBtn.addEventListener('click', startTimer);
    }
    
    if (timerPauseBtn) {
        timerPauseBtn.addEventListener('click', pauseTimer);
    }
    
    if (timerResetBtn) {
        timerResetBtn.addEventListener('click', resetTimer);
    }
    
    // Timer presets
    const timerPresets = document.getElementById('timer-presets');
    if (timerPresets) {
        timerPresets.addEventListener('change', function() {
            timeLeft = parseInt(this.value);
            updateTimerDisplay();
            updateTimerRing();
            if (!timerRunning) {
                resetTimer();
            }
        });
    }
    
    // Note controls
    const saveNoteBtn = document.getElementById('saveNote');
    const clearNoteBtn = document.getElementById('clearNote');
    
    if (saveNoteBtn) {
        saveNoteBtn.addEventListener('click', saveNote);
    }
    
    if (clearNoteBtn) {
        clearNoteBtn.addEventListener('click', clearNote);
    }
    
    // Settings toggles
    const soundToggle = document.getElementById('soundToggle');
    if (soundToggle) {
        soundToggle.addEventListener('change', function() {
            soundEnabled = this.checked;
            saveSettings();
            if (soundEnabled) {
                playSound('notification');
            }
        });
    }
    
    const autosaveToggle = document.getElementById('autosaveToggle');
    if (autosaveToggle) {
        autosaveToggle.addEventListener('change', function() {
            autosaveEnabled = this.checked;
            saveSettings();
            if (autosaveEnabled) {
                autoSaveNotes();
                showToast('Auto-save enabled', 'success');
            } else {
                showToast('Auto-save disabled', 'warning');
            }
        });
    }
    
    const reminderToggle = document.getElementById('reminderToggle');
    if (reminderToggle) {
        reminderToggle.addEventListener('change', function() {
            remindersEnabled = this.checked;
            saveSettings();
            if (remindersEnabled && soundEnabled) {
                playSound('notification');
            }
        });
    }
    
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('change', toggleTheme);
    }
    
    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', function() {
            const modal = this.closest('.modal');
            if (modal) {
                modal.classList.remove('show');
            }
        });
    });
    
    // Close modal on outside click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.classList.remove('show');
            }
        });
    });
    
    console.log('✅ Event listeners setup complete');
}

// Add missing pauseTimer function
function pauseTimer() {
    if (timerRunning) {
        clearInterval(timer);
        timerRunning = false;
        const startBtn = document.getElementById('timer-start');
        const pauseBtn = document.getElementById('timer-pause');
        if (startBtn) {
            startBtn.innerHTML = '<i class="fas fa-play"></i> Resume';
            startBtn.style.display = 'flex';
        }
        if (pauseBtn) pauseBtn.style.display = 'none';
        showToast('Timer paused', 'info');
    }
}

// 7. Save Settings Function
async function saveSettings() {
    const settings = {
        theme: document.body.getAttribute('data-theme'),
        soundEnabled,
        autosaveEnabled,
        remindersEnabled
    };
    
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    
    // Sync with server if authenticated
    if (authToken && currentUser) {
        try {
            await fetch(`${API_BASE_URL}/auth/settings`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`,
                    'Accept': 'application/json'
                },
                body: JSON.stringify(settings)
            });
        } catch (error) {
            console.error('Save settings error:', error);
        }
    }
}

// 8. Load Local Data Function
function loadLocalData() {
    tasks = JSON.parse(localStorage.getItem(STORAGE_KEYS.TASKS)) || [];
    notes = JSON.parse(localStorage.getItem(STORAGE_KEYS.NOTES)) || [];
    focusSessions = parseInt(localStorage.getItem(STORAGE_KEYS.FOCUS_SESSIONS)) || 0;
    totalFocusTime = parseInt(localStorage.getItem(STORAGE_KEYS.FOCUS_TIME)) || 0;
    
    showApp();
}

// 9. Show App Function
function showApp() {
    const authScreen = document.getElementById('auth-screen');
    const appContent = document.getElementById('app-content');
    
    if (authScreen) authScreen.style.display = 'none';
    if (appContent) appContent.style.display = 'grid';
    
    // Initialize app
    renderTasks();
    renderNotes();
    updateAnalytics();
    updateFocusStats();
    
    // Update user info
    if (currentUser) {
        const logoSpan = document.getElementById('logo-text');
        if (logoSpan) {
            logoSpan.textContent = `TaskController | ${currentUser.name}`;
        }
    }
    
    // Set today's date
    const dateInput = document.getElementById('dateVal');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;
        dateInput.min = today;
    }
    
    // Show logout buttons
    const logoutBtns = document.querySelectorAll('.logout-btn, .switch-account-btn');
    logoutBtns.forEach(btn => {
        if (btn) btn.style.display = 'flex';
    });
    
    console.log('✅ App shown successfully');
    console.log('👤 Current user:', currentUser ? currentUser.email : 'None');
}

// 10. Show Auth Function - FIXED
function showAuth() {
    const authScreen = document.getElementById('auth-screen');
    const appContent = document.getElementById('app-content');
    
    if (authScreen) authScreen.style.display = 'flex';
    if (appContent) appContent.style.display = 'none';
    
    // Check for auto-login data
    const autoLogin = JSON.parse(localStorage.getItem(STORAGE_KEYS.AUTO_LOGIN));
    if (autoLogin) {
        console.log('🔍 Auto-login data found for:', autoLogin.email);
        document.getElementById('auth-email').value = autoLogin.email;
        document.getElementById('auth-pass').value = autoLogin.password;
        isLoginMode = true;
        updateAuthUI();
        
        // Auto-login after short delay
        setTimeout(() => {
            console.log('🔄 Attempting auto-login...');
            document.getElementById('auth-main-btn').click();
        }, 500);
    } else {
        // Reset auth mode to login
        isLoginMode = true;
        updateAuthUI();
        
        // Focus on email field
        const emailInput = document.getElementById('auth-email');
        if (emailInput) {
            emailInput.focus();
            emailInput.value = '';
        }
        if (document.getElementById('auth-pass')) {
            document.getElementById('auth-pass').value = '';
        }
        if (document.getElementById('auth-name')) {
            document.getElementById('auth-name').value = '';
        }
    }
    
    console.log('🔐 Auth screen shown');
}

// 11. Load User Data Function - FIXED
async function loadUserData() {
    if (!authToken || !currentUser) {
        console.log('❌ Cannot load user data: No token or user');
        return;
    }
    
    console.log('📥 Loading user data from server...');
    
    try {
        // Load tasks
        const tasksResponse = await fetch(`${API_BASE_URL}/todos`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            signal: AbortSignal.timeout(15000)
        });
        
        if (tasksResponse.ok) {
            const tasksData = await tasksResponse.json();
            tasks = tasksData.todos || [];
            localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
            console.log(`✅ Loaded ${tasks.length} tasks`);
        } else {
            console.error('❌ Failed to load tasks:', tasksResponse.status);
        }
        
        // Load notes
        const notesResponse = await fetch(`${API_BASE_URL}/notes`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            signal: AbortSignal.timeout(15000)
        });
        
        if (notesResponse.ok) {
            const notesData = await notesResponse.json();
            notes = notesData.notes || [];
            localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(notes));
            console.log(`✅ Loaded ${notes.length} notes`);
        } else {
            console.error('❌ Failed to load notes:', notesResponse.status);
        }
        
        // Load focus stats
        const focusResponse = await fetch(`${API_BASE_URL}/focus/stats`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            signal: AbortSignal.timeout(15000)
        });
        
        if (focusResponse.ok) {
            const focusData = await focusResponse.json();
            focusSessions = focusData.totalStats?.totalSessions || 0;
            totalFocusTime = focusData.totalStats?.totalDuration || 0;
            localStorage.setItem(STORAGE_KEYS.FOCUS_SESSIONS, focusSessions);
            localStorage.setItem(STORAGE_KEYS.FOCUS_TIME, totalFocusTime);
            console.log(`✅ Loaded ${focusSessions} focus sessions`);
        } else {
            console.error('❌ Failed to load focus stats:', focusResponse.status);
        }
        
        // Update UI
        renderTasks();
        renderNotes();
        updateAnalytics();
        updateFocusStats();
        
        localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
        console.log('✅ User data loaded successfully');
        
    } catch (error) {
        console.error('❌ Load data error:', error);
        
        if (error.name === 'AbortError') {
            showToast('Data load timeout, using local data', 'warning');
        } else {
            showToast('Failed to load data, using local cache', 'error');
        }
        
        // Fallback to localStorage
        tasks = JSON.parse(localStorage.getItem(STORAGE_KEYS.TASKS)) || [];
        notes = JSON.parse(localStorage.getItem(STORAGE_KEYS.NOTES)) || [];
        renderTasks();
        renderNotes();
    }
}

// 12. Sync Data Function
async function syncDataIfOnline() {
    if (!isOnline || !authToken || !currentUser) return;
    
    try {
        let syncedItems = 0;
        
        // Sync tasks
        for (const task of tasks) {
            if (task._id && task._id.startsWith('local_')) {
                try {
                    const response = await fetch(`${API_BASE_URL}/todos`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${authToken}`,
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify({
                            title: task.title,
                            description: task.description || '',
                            priority: task.priority || 'medium',
                            category: task.category || 'Work',
                            dueDate: task.dueDate || null,
                            tags: task.tags || [],
                            isCompleted: task.isCompleted || false
                        }),
                        signal: AbortSignal.timeout(10000)
                    });

                    if (response.ok) {
                        const data = await response.json();
                        const taskIndex = tasks.findIndex(t => t.id === task.id);
                        if (taskIndex !== -1) {
                            tasks[taskIndex] = { ...data.todo, id: task.id };
                            syncedItems++;
                        }
                    }
                } catch (error) {
                    console.error('Sync task error:', error);
                }
            }
        }
        
        // Sync notes
        for (const note of notes) {
            if (note._id && note._id.startsWith('local_')) {
                try {
                    const response = await fetch(`${API_BASE_URL}/notes`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${authToken}`,
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify({
                            title: note.title || 'Untitled Note',
                            content: note.content,
                            category: note.category || 'Personal',
                            tags: note.tags || []
                        }),
                        signal: AbortSignal.timeout(10000)
                    });

                    if (response.ok) {
                        const data = await response.json();
                        const noteIndex = notes.findIndex(n => n.id === note.id);
                        if (noteIndex !== -1) {
                            notes[noteIndex] = { ...data.note, id: note.id };
                            syncedItems++;
                        }
                    }
                } catch (error) {
                    console.error('Sync note error:', error);
                }
            }
        }
        
        // Save updated data
        if (syncedItems > 0) {
            localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
            localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(notes));
            localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
            console.log(`✅ Silent sync completed: ${syncedItems} items synced`);
        }
        
    } catch (error) {
        console.error('Sync error:', error);
    }
}

// 13. Server Health Check
async function checkServerHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`, {
            signal: AbortSignal.timeout(5000)
        });
        if (response.ok) {
            console.log('✅ Server is healthy');
        } else {
            console.warn('⚠️ Server health check failed');
        }
    } catch (error) {
        console.warn('⚠️ Server is unreachable');
    }
}

// 14. Task Management Functions
async function addTask() {
    const titleInput = document.getElementById('taskTitle');
    if (!titleInput) return;
    
    const title = titleInput.value.trim();
    if (!title) {
        showToast('Please enter a task title!', 'warning');
        titleInput.focus();
        return;
    }

    const taskData = {
        title: title,
        priority: document.getElementById('prioVal') ? document.getElementById('prioVal').value : 'medium',
        category: document.getElementById('catVal') ? document.getElementById('catVal').value : 'Work',
        dueDate: document.getElementById('dateVal') ? document.getElementById('dateVal').value || null : null,
        description: '',
        tags: []
    };

    // Play sound
    playSound('task');

    // Create local task immediately
    const localTask = {
        id: Date.now(),
        _id: `local_${Date.now()}`,
        ...taskData,
        isCompleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isLocal: !isOnline
    };

    tasks.unshift(localTask);
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    
    // Clear input
    titleInput.value = '';
    
    // Update UI immediately
    renderTasks();
    updateAnalytics();
    
    // Show success toast
    showToast('Task added successfully!', 'success');
    
    // Try to sync with server if online
    if (isOnline && authToken) {
        try {
            const response = await fetch(`${API_BASE_URL}/todos`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`,
                    'Accept': 'application/json'
                },
                body: JSON.stringify(taskData),
                signal: AbortSignal.timeout(10000)
            });

            if (response.ok) {
                const data = await response.json();
                const taskIndex = tasks.findIndex(t => t.id === localTask.id);
                if (taskIndex !== -1) {
                    tasks[taskIndex] = { ...data.todo, id: localTask.id };
                    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
                    renderTasks();
                }
            }
        } catch (error) {
            console.error('Sync task error:', error);
        }
    }
}

// 15. Render Tasks
function renderTasks() {
    const taskGrid = document.getElementById('taskGrid');
    if (!taskGrid) return;
    
    // Filter tasks
    let filteredTasks = tasks;
    if (currentFilter === 'pending') {
        filteredTasks = tasks.filter(task => !task.isCompleted);
    } else if (currentFilter === 'completed') {
        filteredTasks = tasks.filter(task => task.isCompleted);
    }
    
    if (filteredTasks.length === 0) {
        taskGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clipboard-list"></i>
                <h3>No tasks found</h3>
                <p>${currentFilter === 'all' ? 'Add your first task above!' : 'No tasks match this filter'}</p>
            </div>
        `;
        return;
    }
    
    taskGrid.innerHTML = filteredTasks.map(task => `
        <div class="task-card ${task.isCompleted ? 'completed' : ''} ${task.priority}-priority" data-id="${task.id}">
            <div class="task-checkbox" onclick="toggleTask(${task.id})">
                <i class="fas fa-${task.isCompleted ? 'check-circle' : 'circle'}"></i>
            </div>
            <div class="task-content">
                <h4>${escapeHtml(task.title)}</h4>
                <small>
                    <span class="task-category">${task.category}</span>
                    <i class="fas fa-flag" style="color: ${getPriorityColor(task.priority)}"></i>
                    ${task.dueDate ? `<i class="fas fa-calendar"></i> ${new Date(task.dueDate).toLocaleDateString()}` : ''}
                </small>
            </div>
            <div class="task-actions">
                <i class="fas fa-edit" onclick="editTask(${task.id})"></i>
                <i class="fas fa-trash" onclick="showDeleteModal(${task.id})"></i>
            </div>
        </div>
    `).join('');
    
    // Update progress
    updateTaskProgress();
}

// 16. Toggle Task Completion
function toggleTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
        task.isCompleted = !task.isCompleted;
        task.completedAt = task.isCompleted ? new Date().toISOString() : null;
        localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
        renderTasks();
        updateAnalytics();
        
        // Play sound
        playSound('task');
        
        showToast(`Task ${task.isCompleted ? 'completed' : 'marked incomplete'}!`, 'success');
        
        // Sync with server if online
        if (isOnline && authToken && task._id && !task._id.startsWith('local_')) {
            fetch(`${API_BASE_URL}/todos/${task._id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`,
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    isCompleted: task.isCompleted
                })
            }).catch(console.error);
        }
    }
}

// 17. Show Delete Modal
function showDeleteModal(taskId) {
    pendingDeleteTaskId = taskId;
    const modal = document.getElementById('delete-modal');
    if (modal) {
        modal.classList.add('show');
    }
}

// 18. Close Delete Modal
function closeDeleteModal() {
    pendingDeleteTaskId = null;
    const modal = document.getElementById('delete-modal');
    if (modal) {
        modal.classList.remove('show');
    }
}

// 19. Confirm Delete
function confirmDelete() {
    if (pendingDeleteTaskId) {
        deleteTask(pendingDeleteTaskId);
        closeDeleteModal();
    }
}

// 20. Delete Task
function deleteTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    // Play sound
    playSound('notification');
    
    // Remove from local array
    tasks = tasks.filter(t => t.id !== taskId);
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    
    // Delete from server if online
    if (isOnline && authToken && task._id && !task._id.startsWith('local_')) {
        fetch(`${API_BASE_URL}/todos/${task._id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Accept': 'application/json'
            }
        }).catch(console.error);
    }
    
    renderTasks();
    updateAnalytics();
    showToast('Task deleted!', 'success');
}

// 21. Edit Task
function editTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
        const titleInput = document.getElementById('taskTitle');
        if (titleInput) titleInput.value = task.title;
        
        const prioSelect = document.getElementById('prioVal');
        if (prioSelect) prioSelect.value = task.priority;
        
        const catSelect = document.getElementById('catVal');
        if (catSelect) catSelect.value = task.category;
        
        const dateInput = document.getElementById('dateVal');
        if (dateInput) dateInput.value = task.dueDate || '';
        
        // Remove task from list
        tasks = tasks.filter(t => t.id !== taskId);
        localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
        renderTasks();
        
        // Play sound
        playSound('task');
        
        showToast('Task ready for editing!', 'info');
        
        // Focus on input
        if (titleInput) {
            titleInput.focus();
            titleInput.select();
        }
    }
}

// 22. Update Task Progress
function updateTaskProgress() {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.isCompleted).length;
    const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    
    const taskProgress = document.getElementById('task-progress');
    const analyticsProgress = document.getElementById('analytics-progress');
    
    if (taskProgress) taskProgress.style.width = `${progress}%`;
    if (analyticsProgress) analyticsProgress.style.width = `${progress}%`;
    
    // Update ring chart
    const ring = document.getElementById('ring');
    const ringPct = document.getElementById('ring-pct');
    if (ring && ringPct) {
        const circumference = 2 * Math.PI * 75;
        const offset = circumference - (progress / 100) * circumference;
        ring.style.strokeDashoffset = offset;
        ringPct.textContent = `${Math.round(progress)}%`;
    }
}

// 23. Update Analytics
function updateAnalytics() {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.isCompleted).length;
    const pendingTasks = totalTasks - completedTasks;
    const efficiency = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    const statTotal = document.getElementById('stat-total');
    const statCompleted = document.getElementById('stat-completed');
    const statEfficiency = document.getElementById('stat-efficiency');
    const statPending = document.getElementById('stat-pending');
    
    if (statTotal) statTotal.textContent = totalTasks;
    if (statCompleted) statCompleted.textContent = completedTasks;
    if (statEfficiency) statEfficiency.textContent = `${efficiency}%`;
    if (statPending) statPending.textContent = pendingTasks;
    
    // Update progress bars
    updateTaskProgress();
}

// 24. Notes Functions
async function saveNote() {
    const noteContent = document.getElementById('noteContent');
    if (!noteContent) return;
    
    const content = noteContent.value.trim();
    if (!content) {
        showToast('Please enter note content!', 'warning');
        return;
    }
    
    // Play sound
    playSound('task');
    
    const note = {
        id: Date.now(),
        _id: `local_${Date.now()}`,
        title: 'Untitled Note',
        content: content,
        category: 'Personal',
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isLocal: !isOnline
    };
    
    notes.unshift(note);
    localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(notes));
    
    // Clear textarea
    noteContent.value = '';
    
    // Update UI
    renderNotes();
    showToast('Note saved!', 'success');
    
    // Sync with server if online
    if (isOnline && authToken) {
        try {
            const response = await fetch(`${API_BASE_URL}/notes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`,
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    title: 'Untitled Note',
                    content: content,
                    category: 'Personal',
                    tags: []
                }),
                signal: AbortSignal.timeout(10000)
            });

            if (response.ok) {
                const data = await response.json();
                const noteIndex = notes.findIndex(n => n.id === note.id);
                if (noteIndex !== -1) {
                    notes[noteIndex] = { ...data.note, id: note.id };
                    localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(notes));
                    renderNotes();
                }
            }
        } catch (error) {
            console.error('Sync note error:', error);
        }
    }
}

function clearNote() {
    const noteContent = document.getElementById('noteContent');
    if (noteContent) {
        noteContent.value = '';
        showToast('Note cleared!', 'info');
    }
}

function renderNotes() {
    const notesGrid = document.getElementById('notesGrid');
    if (!notesGrid) return;
    
    if (notes.length === 0) {
        notesGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-sticky-note"></i>
                <h3>No notes yet</h3>
                <p>Add your first note above!</p>
            </div>
        `;
        return;
    }
    
    notesGrid.innerHTML = notes.map(note => `
        <div class="note-card" data-id="${note.id}">
            <div class="note-content">${formatNoteContent(note.content)}</div>
            <div class="note-date">
                <i class="far fa-clock"></i>
                ${new Date(note.createdAt).toLocaleDateString()}
            </div>
            <div class="note-actions">
                <i class="fas fa-edit" onclick="editNote(${note.id})"></i>
                <i class="fas fa-trash" onclick="deleteNotePrompt(${note.id})"></i>
            </div>
        </div>
    `).join('');
}

function editNote(noteId) {
    const note = notes.find(n => n.id === noteId);
    if (note) {
        const noteContent = document.getElementById('noteContent');
        if (noteContent) noteContent.value = note.content;
        
        // Remove note from list
        notes = notes.filter(n => n.id !== noteId);
        localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(notes));
        renderNotes();
        
        // Play sound
        playSound('task');
        
        showToast('Note ready for editing!', 'info');
        
        // Focus on textarea
        if (noteContent) {
            noteContent.focus();
        }
    }
}

function deleteNotePrompt(noteId) {
    pendingDeleteNoteId = noteId;
    if (confirm('Are you sure you want to delete this note?')) {
        deleteNote(noteId);
    }
}

function deleteNote(noteId) {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    
    // Play sound
    playSound('notification');
    
    // Remove from local array
    notes = notes.filter(n => n.id !== noteId);
    localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(notes));
    
    // Delete from server if online
    if (isOnline && authToken && note._id && !note._id.startsWith('local_')) {
        fetch(`${API_BASE_URL}/notes/${note._id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Accept': 'application/json'
            }
        }).catch(console.error);
    }
    
    renderNotes();
    showToast('Note deleted!', 'success');
}

// 25. Auto-save Notes
function autoSaveNotes() {
    if (!autosaveEnabled) return;
    
    const noteContent = document.getElementById('noteContent');
    if (!noteContent || !noteContent.value.trim()) return;
    
    // Save note automatically (silent)
    saveNote();
}

// 26. Timer Functions
function startTimer() {
    if (timerRunning) {
        // Pause timer
        clearInterval(timer);
        timerRunning = false;
        const startBtn = document.getElementById('timer-start');
        const pauseBtn = document.getElementById('timer-pause');
        if (startBtn) {
            startBtn.innerHTML = '<i class="fas fa-play"></i> Resume';
            startBtn.style.display = 'flex';
        }
        if (pauseBtn) pauseBtn.style.display = 'none';
        showToast('Timer paused', 'info');
    } else {
        // Start timer
        timerRunning = true;
        const startBtn = document.getElementById('timer-start');
        const pauseBtn = document.getElementById('timer-pause');
        if (startBtn) {
            startBtn.innerHTML = '<i class="fas fa-pause"></i> Pause';
            startBtn.style.display = 'none';
        }
        if (pauseBtn) pauseBtn.style.display = 'flex';
        
        // Play start sound
        if (soundEnabled) {
            playSound('notification');
        }
        
        timer = setInterval(() => {
            timeLeft--;
            updateTimerDisplay();
            updateTimerRing();
            
            if (timeLeft <= 0) {
                clearInterval(timer);
                timerRunning = false;
                if (startBtn) {
                    startBtn.innerHTML = '<i class="fas fa-play"></i> Start Focus';
                    startBtn.style.display = 'flex';
                }
                if (pauseBtn) pauseBtn.style.display = 'none';
                
                // Play completion sound
                if (soundEnabled) {
                    timerSound.currentTime = 0;
                    timerSound.play().catch(console.error);
                }
                
                showToast('Focus session completed!', 'success');
                
                // Record session
                focusSessions++;
                const presetSelect = document.getElementById('timer-presets');
                const presetValue = presetSelect ? parseInt(presetSelect.value) : 1500;
                totalFocusTime += presetValue;
                localStorage.setItem(STORAGE_KEYS.FOCUS_SESSIONS, focusSessions);
                localStorage.setItem(STORAGE_KEYS.FOCUS_TIME, totalFocusTime);
                updateFocusStats();
                
                // Save to server if online
                if (isOnline && authToken) {
                    fetch(`${API_BASE_URL}/focus/start`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${authToken}`,
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify({
                            duration: presetValue,
                            mode: 'pomodoro'
                        })
                    }).catch(console.error);
                }
                
                // Reset timer
                timeLeft = presetValue;
                updateTimerDisplay();
                updateTimerRing();
            }
        }, 1000);
    }
}

function resetTimer() {
    clearInterval(timer);
    timerRunning = false;
    const presetSelect = document.getElementById('timer-presets');
    timeLeft = presetSelect ? parseInt(presetSelect.value) : 1500;
    updateTimerDisplay();
    updateTimerRing();
    const startBtn = document.getElementById('timer-start');
    const pauseBtn = document.getElementById('timer-pause');
    if (startBtn) {
        startBtn.innerHTML = '<i class="fas fa-play"></i> Start Focus';
        startBtn.style.display = 'flex';
    }
    if (pauseBtn) pauseBtn.style.display = 'none';
    showToast('Timer reset', 'info');
}

function updateTimerDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    const display = document.getElementById('timer-display');
    if (display) {
        display.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
}

function updateTimerRing() {
    const presetSelect = document.getElementById('timer-presets');
    const totalTime = presetSelect ? parseInt(presetSelect.value) : 1500;
    const progress = ((totalTime - timeLeft) / totalTime) * 565;
    const ring = document.getElementById('timer-ring-fill');
    if (ring) {
        ring.style.strokeDashoffset = 565 - progress;
    }
}

function updateFocusStats() {
    const focusSessionsEl = document.getElementById('focus-sessions');
    const totalFocusTimeEl = document.getElementById('total-focus-time');
    const focusStreakEl = document.getElementById('focus-streak');
    
    if (focusSessionsEl) {
        focusSessionsEl.textContent = `${focusSessions} Sessions`;
    }
    if (totalFocusTimeEl) {
        const hours = Math.floor(totalFocusTime / 3600);
        const minutes = Math.floor((totalFocusTime % 3600) / 60);
        if (hours > 0) {
            totalFocusTimeEl.textContent = `${hours}h ${minutes}m Total`;
        } else {
            totalFocusTimeEl.textContent = `${minutes}m Total`;
        }
    }
    if (focusStreakEl) {
        // Simple streak calculation
        const streak = Math.floor(focusSessions / 3);
        focusStreakEl.textContent = `${streak} Day Streak`;
    }
}

// 27. Utility Functions
function switchView(viewId) {
    // Hide all views
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    
    // Show selected view
    const selectedView = document.getElementById(`view-${viewId}`);
    if (selectedView) {
        selectedView.classList.add('active');
        selectedView.scrollTop = 0;
    }
    
    // Update navigation
    document.querySelectorAll('.nav-btn, .m-nav-item').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.view === viewId) {
            btn.classList.add('active');
        }
    });
    
    // Stop timer if switching away from focus view
    if (viewId !== 'focus' && timerRunning) {
        clearInterval(timer);
        timerRunning = false;
        const startBtn = document.getElementById('timer-start');
        const pauseBtn = document.getElementById('timer-pause');
        if (startBtn) {
            startBtn.innerHTML = '<i class="fas fa-play"></i> Start Focus';
            startBtn.style.display = 'flex';
        }
        if (pauseBtn) pauseBtn.style.display = 'none';
    }
}

function updateClock() {
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    const clockElement = document.getElementById('live-clock');
    if (clockElement) {
        clockElement.textContent = timeString;
    }
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastTitle = document.getElementById('toast-title');
    const toastMessage = document.getElementById('toast-message');
    
    if (!toast || !toastTitle || !toastMessage) return;
    
    // Set type
    toast.className = 'toast';
    toast.classList.add(type);
    
    // Set content
    const titles = {
        success: 'Success',
        error: 'Error',
        warning: 'Warning',
        info: 'Info'
    };
    toastTitle.textContent = titles[type] || 'Info';
    toastMessage.textContent = message;
    
    // Show toast
    toast.classList.add('show');
    
    // Play sound
    if (soundEnabled && type !== 'info') {
        playSound('notification');
    }
    
    // Auto hide
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function hideToast() {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.classList.remove('show');
    }
}

// 28. Toggle Theme
function toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', newTheme);
    
    // Update toggle switch
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.checked = newTheme === 'light';
    }
    
    // Save to localStorage
    localStorage.setItem(STORAGE_KEYS.THEME, newTheme);
    
    // Save to settings
    const settings = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS)) || {};
    settings.theme = newTheme;
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    
    // Sync with server if online
    if (isOnline && authToken) {
        fetch(`${API_BASE_URL}/auth/settings`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
                'Accept': 'application/json'
            },
            body: JSON.stringify({ theme: newTheme })
        }).catch(console.error);
    }
    
    showToast(`Theme changed to ${newTheme} mode`, 'success');
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl+N for new task
        if (e.ctrlKey && e.key === 'n') {
            e.preventDefault();
            const taskTitle = document.getElementById('taskTitle');
            if (taskTitle) {
                taskTitle.focus();
                taskTitle.select();
            }
        }
        
        // Ctrl+Enter to save
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            const taskTitle = document.getElementById('taskTitle');
            const noteContent = document.getElementById('noteContent');
            
            if (taskTitle && taskTitle.value) {
                addTask();
            } else if (noteContent && noteContent.value) {
                saveNote();
            }
        }
        
        // Ctrl+F for focus timer
        if (e.ctrlKey && e.key === 'f') {
            e.preventDefault();
            switchView('focus');
            const timerStart = document.getElementById('timer-start');
            if (timerStart) timerStart.focus();
        }
        
        // Ctrl+T for theme toggle
        if (e.ctrlKey && e.key === 't') {
            e.preventDefault();
            toggleTheme();
        }
        
        // Esc to close modal
        if (e.key === 'Escape') {
            closeDeleteModal();
            closeLogoutModal();
            closeWipeModal();
            closeShortcutsModal();
        }
    });
}

// 29. Helper functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatNoteContent(content) {
    return content.replace(/\n/g, '<br>').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getPriorityColor(priority) {
    const colors = {
        high: '#ef4444',
        medium: '#f59e0b',
        low: '#10b981'
    };
    return colors[priority] || '#6b7280';
}

// 30. Play Sound Function
function playSound(type) {
    if (!soundEnabled) return;
    
    try {
        let sound;
        switch(type) {
            case 'task':
                sound = taskSound;
                break;
            case 'timer':
                sound = timerSound;
                break;
            case 'notification':
                sound = notificationSound;
                break;
            default:
                sound = notificationSound;
        }
        
        sound.currentTime = 0;
        sound.play().catch(error => {
            console.log('Audio play failed:', error);
        });
    } catch (error) {
        console.error('Audio error:', error);
    }
}

// 31. Logout Functions - FIXED
function showLogoutModal() {
    const modal = document.getElementById('logout-modal');
    if (modal) {
        modal.classList.add('show');
    }
}

function closeLogoutModal() {
    const modal = document.getElementById('logout-modal');
    if (modal) {
        modal.classList.remove('show');
    }
}

async function logout() {
    console.log('👋 Logging out...');
    
    // Stop timer if running
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
    
    // Save any unsynced data
    await syncDataIfOnline();
    
    // Clear authentication data only
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.AUTO_LOGIN);
    
    // Clear variables
    authToken = null;
    currentUser = null;
    
    // Close modal
    closeLogoutModal();
    
    // Reset UI and show auth screen
    showAuth();
    
    showToast('Logged out successfully', 'success');
    console.log('✅ Logout completed');
}

// 32. Switch Account Function
function switchAccount() {
    if (confirm('Switch to another account? You will be logged out.')) {
        logout();
    }
}

// 33. Modal Functions
function showKeyboardShortcutsModal() {
    const modal = document.getElementById('shortcuts-modal');
    if (modal) modal.classList.add('show');
}

function closeShortcutsModal() {
    const modal = document.getElementById('shortcuts-modal');
    if (modal) modal.classList.remove('show');
}

function showWipeModal() {
    const modal = document.getElementById('wipe-modal');
    if (modal) modal.classList.add('show');
}

function closeWipeModal() {
    const modal = document.getElementById('wipe-modal');
    if (modal) modal.classList.remove('show');
}

// 34. Export Data Function
async function exportData() {
    try {
        const dataToExport = {
            user: currentUser,
            tasks: tasks,
            notes: notes,
            settings: {
                soundEnabled,
                autosaveEnabled,
                remindersEnabled,
                theme: document.body.getAttribute('data-theme')
            },
            stats: {
                focusSessions,
                totalFocusTime
            },
            exportDate: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `taskcontroller-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast('Data exported successfully!', 'success');
        
    } catch (error) {
        console.error('Export error:', error);
        showToast('Export failed', 'error');
    }
}

// 35. Wipe Data Function
function wipeData() {
    if (confirm('⚠️ This will permanently delete ALL your local data including tasks, notes, and settings. This action cannot be undone.\n\nAre you sure?')) {
        localStorage.clear();
        tasks = [];
        notes = [];
        focusSessions = 0;
        totalFocusTime = 0;
        authToken = null;
        currentUser = null;
        
        // Close modal
        closeWipeModal();
        
        // Reload the app
        location.reload();
    }
}

// 36. Loading Overlay Functions
function showLoading(message = 'Loading...') {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        const p = overlay.querySelector('p');
        if (p) p.textContent = message;
        overlay.classList.add('show');
    }
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.remove('show');
    }
}

// Make all functions globally available
window.handleAuth = handleAuth;
window.toggleAuthMode = toggleAuthMode;
window.logout = logout;
window.switchAccount = switchAccount;
window.addTask = addTask;
window.toggleTask = toggleTask;
window.showDeleteModal = showDeleteModal;
window.closeDeleteModal = closeDeleteModal;
window.confirmDelete = confirmDelete;
window.editTask = editTask;
window.saveNote = saveNote;
window.clearNote = clearNote;
window.editNote = editNote;
window.deleteNotePrompt = deleteNotePrompt;
window.deleteNote = deleteNote;
window.startTimer = startTimer;
window.pauseTimer = pauseTimer;
window.resetTimer = resetTimer;
window.toggleTheme = toggleTheme;
window.showKeyboardShortcutsModal = showKeyboardShortcutsModal;
window.closeShortcutsModal = closeShortcutsModal;
window.showLogoutModal = showLogoutModal;
window.closeLogoutModal = closeLogoutModal;
window.showWipeModal = showWipeModal;
window.closeWipeModal = closeWipeModal;
window.exportData = exportData;
window.wipeData = wipeData;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.hideToast = hideToast;
window.switchView = switchView;

console.log('✅ All authentication functions loaded');
console.log('🚀 TaskController Authentication System Ready');
