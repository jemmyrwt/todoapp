// Zenith X Pro - Production Ready with Render
// ✅ FIXED: All issues resolved
const API_BASE_URL = 'https://todoapp-p5hq.onrender.com/api';

console.log('🌐 RadheOS Loading...');
console.log('📡 API Base URL:', API_BASE_URL);

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

// Audio elements
const taskSound = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-select-click-1109.mp3');
const timerSound = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-alarm-digital-clock-beep-989.mp3');
const notificationSound = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-correct-answer-tone-2870.mp3');

// 1. Initial Launch
window.onload = async () => {
    console.log('🌐 RadheOS Loading...');
    
    // Check network status
    updateNetworkStatus();
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
    
    // Load saved data
    authToken = localStorage.getItem('zenith_token');
    currentUser = JSON.parse(localStorage.getItem('zenith_user'));
    
    console.log('🔍 Stored token:', authToken ? 'Present' : 'Missing');
    console.log('🔍 Stored user:', currentUser ? currentUser.email : 'None');
    
    // Load theme
    const savedTheme = localStorage.getItem('zenith_theme') || 'dark';
    document.body.setAttribute('data-theme', savedTheme);
    
    // Load settings
    const savedSettings = JSON.parse(localStorage.getItem('zenith_settings'));
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
        if (document.getElementById('themeToggle')) {
            document.getElementById('themeToggle').checked = savedTheme === 'light';
        }
    }
    
    if (authToken && currentUser) {
        try {
            if (isOnline) {
                // Verify token with backend
                console.log('🔐 Verifying token with server...');
                const response = await fetch(`${API_BASE_URL}/auth/me`, {
                    headers: {
                        'Authorization': `Bearer ${authToken}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                console.log('✅ Auth check response:', response.status);
                
                if (response.ok) {
                    const data = await response.json();
                    currentUser = data.user;
                    localStorage.setItem('zenith_user', JSON.stringify(currentUser));
                    
                    // Load data from server
                    await loadUserData();
                    showApp();
                    showToast('Welcome back!', 'success');
                } else {
                    // Token invalid, use local data
                    console.log('⚠️ Token invalid, using local data');
                    loadLocalData();
                    showToast('Session expired, please login again', 'warning');
                    // Clear invalid token
                    localStorage.removeItem('zenith_token');
                    showAuth();
                }
            } else {
                // Offline mode
                loadLocalData();
                showToast('Offline mode - using local data', 'info');
            }
        } catch (error) {
            console.error('Initial load error:', error);
            loadLocalData();
            showToast('Connected to local data', 'info');
        }
    } else {
        showAuth();
    }
    
    // Initialize clock and intervals
    updateClock();
    setInterval(updateClock, 1000);
    setInterval(syncDataIfOnline, 30000); // Sync every 30 seconds if online
    if (autosaveEnabled) {
        setInterval(autoSaveNotes, 60000); // Auto-save notes every minute
    }
    
    // Setup event listeners
    setupEventListeners();
    setupKeyboardShortcuts();
    
    // Check health
    checkServerHealth();
};

// 2. Authentication Functions
async function handleAuth() {
    console.log('🔑 handleAuth() called');
    
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
    authBtn.innerHTML = '<div class="loading"></div> Connecting...';
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
                'Accept': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();
        console.log('📥 Auth response:', response.status, data);

        if (!response.ok) {
            throw new Error(data.message || `Authentication failed (${response.status})`);
        }

        if (!isLoginMode) {
            // Registration successful - auto-login
            console.log('✅ Registration successful, auto-logging in...');
            
            // Save registration details for auto-login
            localStorage.setItem('zenith_auto_login', JSON.stringify({ email, password: pass }));
            
            // Auto-fill and login
            setTimeout(() => {
                document.getElementById('auth-email').value = email;
                document.getElementById('auth-pass').value = pass;
                isLoginMode = true;
                updateAuthUI();
                setTimeout(() => {
                    handleAuth();
                }, 500);
            }, 1000);
            
            return;
        }

        // Login successful
        authToken = data.token;
        currentUser = data.user;
        
        localStorage.setItem('zenith_token', authToken);
        localStorage.setItem('zenith_user', JSON.stringify(currentUser));
        localStorage.removeItem('zenith_auto_login'); // Clear auto-login data
        
        console.log('✅ Login successful, user:', currentUser.email);
        
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
            localStorage.setItem('zenith_settings', JSON.stringify(data.user.settings));
        }
        
        // Load data from server
        await loadUserData();
        
        showToast(data.message || 'Success!', 'success');
        showApp();
        
    } catch (error) {
        console.error('❌ Auth error:', error);
        
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
        authTitle.textContent = 'RadheOS';
        authDesc.textContent = 'Secure access to your dashboard';
        authMainBtn.textContent = 'Access Workspace';
        toggleTextSpan.textContent = 'Create Account';
        if (authExtra) authExtra.style.display = 'none';
    } else {
        authTitle.textContent = 'Create Account';
        authDesc.textContent = 'Join RadheOS today';
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
    
    // Focus on email field
    document.getElementById('auth-email').focus();
}

// 5. Network Status Function
function updateNetworkStatus() {
    isOnline = navigator.onLine;
    
    const networkIndicator = document.getElementById('network-status');
    if (!networkIndicator) {
        // Create network indicator
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

// 6. Setup Event Listeners Function
function setupEventListeners() {
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
    document.getElementById('timer-start').addEventListener('click', startTimer);
    document.getElementById('timer-reset').addEventListener('click', resetTimer);
    document.getElementById('timer-presets').addEventListener('change', function() {
        timeLeft = parseInt(this.value);
        updateTimerDisplay();
        updateTimerRing();
    });
    
    // Note controls
    document.getElementById('saveNote').addEventListener('click', saveNote);
    document.getElementById('clearNote').addEventListener('click', clearNote);
    
    // Auth toggle
    const toggleAuthLink = document.querySelector('.toggle-auth');
    if (toggleAuthLink) {
        toggleAuthLink.addEventListener('click', toggleAuthMode);
    }
    
    // Settings toggles
    const soundToggle = document.getElementById('soundToggle');
    if (soundToggle) {
        soundToggle.addEventListener('change', function() {
            soundEnabled = this.checked;
            saveSettings();
            playSound('notification');
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
            playSound('notification');
        });
    }
    
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('change', toggleTheme);
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
    
    localStorage.setItem('zenith_settings', JSON.stringify(settings));
    
    // Sync with server if authenticated
    if (authToken && currentUser) {
        try {
            await fetch(`${API_BASE_URL}/auth/settings`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
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
    tasks = JSON.parse(localStorage.getItem('zenith_tasks')) || [];
    notes = JSON.parse(localStorage.getItem('zenith_notes')) || [];
    focusSessions = parseInt(localStorage.getItem('zenith_focus_sessions')) || 0;
    totalFocusTime = parseInt(localStorage.getItem('zenith_total_focus_time')) || 0;
    
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
            logoSpan.textContent = `RadheOS | ${currentUser.name}`;
        }
    }
    
    // Set today's date
    const dateInput = document.getElementById('dateVal');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;
        dateInput.min = today;
    }
}

// 10. Show Auth Function
function showAuth() {
    const authScreen = document.getElementById('auth-screen');
    const appContent = document.getElementById('app-content');
    
    if (authScreen) authScreen.style.display = 'flex';
    if (appContent) appContent.style.display = 'none';
    
    // Check for auto-login data
    const autoLogin = JSON.parse(localStorage.getItem('zenith_auto_login'));
    if (autoLogin) {
        document.getElementById('auth-email').value = autoLogin.email;
        document.getElementById('auth-pass').value = autoLogin.password;
        isLoginMode = true;
        updateAuthUI();
        setTimeout(() => {
            document.getElementById('auth-main-btn').click();
        }, 500);
    } else {
        // Reset auth mode to login
        isLoginMode = true;
        updateAuthUI();
        
        // Focus on email field
        const emailInput = document.getElementById('auth-email');
        if (emailInput) emailInput.focus();
        
        // Clear inputs
        if (document.getElementById('auth-email')) {
            document.getElementById('auth-email').value = '';
        }
        if (document.getElementById('auth-pass')) {
            document.getElementById('auth-pass').value = '';
        }
        if (document.getElementById('auth-name')) {
            document.getElementById('auth-name').value = '';
        }
    }
}

// 11. Load User Data Function
async function loadUserData() {
    if (!authToken) return;
    
    try {
        console.log('📥 Loading user data from server...');
        
        // Load tasks
        const tasksResponse = await fetch(`${API_BASE_URL}/todos`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (tasksResponse.ok) {
            const tasksData = await tasksResponse.json();
            tasks = tasksData.todos || [];
            localStorage.setItem('zenith_tasks', JSON.stringify(tasks));
            console.log(`✅ Loaded ${tasks.length} tasks`);
        }
        
        // Load notes
        const notesResponse = await fetch(`${API_BASE_URL}/notes`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (notesResponse.ok) {
            const notesData = await notesResponse.json();
            notes = notesData.notes || [];
            localStorage.setItem('zenith_notes', JSON.stringify(notes));
            console.log(`✅ Loaded ${notes.length} notes`);
        }
        
        // Load focus stats
        const focusResponse = await fetch(`${API_BASE_URL}/focus/stats`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (focusResponse.ok) {
            const focusData = await focusResponse.json();
            focusSessions = focusData.totalStats?.totalSessions || 0;
            totalFocusTime = focusData.totalStats?.totalDuration || 0;
            localStorage.setItem('zenith_focus_sessions', focusSessions);
            localStorage.setItem('zenith_total_focus_time', totalFocusTime);
            console.log(`✅ Loaded ${focusSessions} focus sessions`);
        }
        
        // Update UI
        renderTasks();
        renderNotes();
        updateAnalytics();
        updateFocusStats();
        
        localStorage.setItem('zenith_last_sync', new Date().toISOString());
        
    } catch (error) {
        console.error('Load data error:', error);
        // Fallback to localStorage
        tasks = JSON.parse(localStorage.getItem('zenith_tasks')) || [];
        notes = JSON.parse(localStorage.getItem('zenith_notes')) || [];
        renderTasks();
        renderNotes();
    }
}

// 12. Sync Data Function
async function syncDataIfOnline() {
    if (!isOnline || !authToken) return;
    
    try {
        showLoading('Syncing data...');
        
        // Sync tasks
        for (const task of tasks) {
            if (task._id && task._id.startsWith('local_')) {
                try {
                    const response = await fetch(`${API_BASE_URL}/todos`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${authToken}`
                        },
                        body: JSON.stringify({
                            title: task.title,
                            description: task.description || '',
                            priority: task.priority || 'medium',
                            category: task.category || 'Work',
                            dueDate: task.dueDate || null,
                            tags: task.tags || [],
                            isCompleted: task.isCompleted || false
                        })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        // Update task with server ID
                        const taskIndex = tasks.findIndex(t => t.id === task.id);
                        if (taskIndex !== -1) {
                            tasks[taskIndex] = { ...data.todo, id: task.id };
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
                            'Authorization': `Bearer ${authToken}`
                        },
                        body: JSON.stringify({
                            title: note.title || 'Untitled Note',
                            content: note.content,
                            category: note.category || 'Personal',
                            tags: note.tags || []
                        })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        // Update note with server ID
                        const noteIndex = notes.findIndex(n => n.id === note.id);
                        if (noteIndex !== -1) {
                            notes[noteIndex] = { ...data.note, id: note.id };
                        }
                    }
                } catch (error) {
                    console.error('Sync note error:', error);
                }
            }
        }
        
        // Save updated data
        localStorage.setItem('zenith_tasks', JSON.stringify(tasks));
        localStorage.setItem('zenith_notes', JSON.stringify(notes));
        
        // Update last sync time
        localStorage.setItem('zenith_last_sync', new Date().toISOString());
        
        hideLoading();
        showToast('Data synced successfully', 'success');
        
    } catch (error) {
        console.error('Sync error:', error);
        hideLoading();
    }
}

// 13. Server Health Check
async function checkServerHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
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
        _id: `local_${Date.now()}`, // Temporary ID for offline
        ...taskData,
        isCompleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isLocal: !isOnline // Mark as local if offline
    };

    tasks.unshift(localTask);
    localStorage.setItem('zenith_tasks', JSON.stringify(tasks));
    
    // Clear input
    titleInput.value = '';
    
    // Update UI immediately
    renderTasks();
    updateAnalytics();
    
    // Try to sync with server if online
    if (isOnline && authToken) {
        try {
            const response = await fetch(`${API_BASE_URL}/todos`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify(taskData)
            });

            if (response.ok) {
                const data = await response.json();
                // Replace local task with server task
                const taskIndex = tasks.findIndex(t => t.id === localTask.id);
                if (taskIndex !== -1) {
                    tasks[taskIndex] = { ...data.todo, id: localTask.id };
                    localStorage.setItem('zenith_tasks', JSON.stringify(tasks));
                    renderTasks();
                }
                showToast('Task saved to cloud!', 'success');
            } else {
                showToast('Task saved locally (sync failed)', 'warning');
            }
        } catch (error) {
            console.error('Sync task error:', error);
            showToast('Task saved locally', 'info');
        }
    } else {
        showToast('Task saved locally (offline)', 'info');
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
        localStorage.setItem('zenith_tasks', JSON.stringify(tasks));
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
                    'Authorization': `Bearer ${authToken}`
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
    localStorage.setItem('zenith_tasks', JSON.stringify(tasks));
    
    // Delete from server if online
    if (isOnline && authToken && task._id && !task._id.startsWith('local_')) {
        fetch(`${API_BASE_URL}/todos/${task._id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
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
        localStorage.setItem('zenith_tasks', JSON.stringify(tasks));
        renderTasks();
        
        // Play sound
        playSound('task');
        
        showToast('Task ready for editing!', 'info');
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
    localStorage.setItem('zenith_notes', JSON.stringify(notes));
    
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
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    title: 'Untitled Note',
                    content: content,
                    category: 'Personal',
                    tags: []
                })
            });

            if (response.ok) {
                const data = await response.json();
                // Update note with server ID
                const noteIndex = notes.findIndex(n => n.id === note.id);
                if (noteIndex !== -1) {
                    notes[noteIndex] = { ...data.note, id: note.id };
                    localStorage.setItem('zenith_notes', JSON.stringify(notes));
                    renderNotes();
                }
                showToast('Note synced to cloud!', 'success');
            }
        } catch (error) {
            console.error('Sync note error:', error);
        }
    }
}

function clearNote() {
    const noteContent = document.getElementById('noteContent');
    if (noteContent) noteContent.value = '';
    showToast('Note cleared!', 'info');
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
                <i class="fas fa-trash" onclick="deleteNote(${note.id})"></i>
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
        localStorage.setItem('zenith_notes', JSON.stringify(notes));
        renderNotes();
        
        // Play sound
        playSound('task');
        
        showToast('Note ready for editing!', 'info');
    }
}

function deleteNote(noteId) {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    
    // Play sound
    playSound('notification');
    
    // Remove from local array
    notes = notes.filter(n => n.id !== noteId);
    localStorage.setItem('zenith_notes', JSON.stringify(notes));
    
    // Delete from server if online
    if (isOnline && authToken && note._id && !note._id.startsWith('local_')) {
        fetch(`${API_BASE_URL}/notes/${note._id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
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
    
    // Save note automatically
    saveNote();
    showToast('Note auto-saved', 'info');
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
        playSound('notification');
        
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
                    timerSound.play().catch(console.error);
                }
                
                showToast('Focus session completed!', 'success');
                
                // Record session
                focusSessions++;
                const presetSelect = document.getElementById('timer-presets');
                const presetValue = presetSelect ? parseInt(presetSelect.value) : 1500;
                totalFocusTime += presetValue;
                localStorage.setItem('zenith_focus_sessions', focusSessions);
                localStorage.setItem('zenith_total_focus_time', totalFocusTime);
                updateFocusStats();
                
                // Save to server if online
                if (isOnline && authToken) {
                    fetch(`${API_BASE_URL}/focus/start`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${authToken}`
                        },
                        body: JSON.stringify({
                            duration: presetValue,
                            mode: 'pomodoro'
                        })
                    }).catch(console.error);
                }
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
        // Simple streak calculation (for demo)
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
    }
    
    // Update navigation
    document.querySelectorAll('.nav-btn, .m-nav-item').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.view === viewId) {
            btn.classList.add('active');
        }
    });
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
    localStorage.setItem('zenith_theme', newTheme);
    
    // Save to settings
    const settings = JSON.parse(localStorage.getItem('zenith_settings')) || {};
    settings.theme = newTheme;
    localStorage.setItem('zenith_settings', JSON.stringify(settings));
    
    // Sync with server if online
    if (isOnline && authToken) {
        fetch(`${API_BASE_URL}/auth/settings`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
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

// 28. Helper functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatNoteContent(content) {
    return content.replace(/\n/g, '<br>');
}

function getPriorityColor(priority) {
    const colors = {
        high: '#ef4444',
        medium: '#f59e0b',
        low: '#10b981'
    };
    return colors[priority] || '#6b7280';
}

// 29. Play Sound Function
function playSound(type) {
    if (!soundEnabled) return;
    
    try {
        switch(type) {
            case 'task':
                taskSound.currentTime = 0;
                taskSound.play().catch(console.error);
                break;
            case 'timer':
                timerSound.currentTime = 0;
                timerSound.play().catch(console.error);
                break;
            case 'notification':
                notificationSound.currentTime = 0;
                notificationSound.play().catch(console.error);
                break;
        }
    } catch (error) {
        console.error('Audio error:', error);
    }
}

// 30. Logout Functions
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
    // Stop timer if running
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
    
    // Save any unsynced data
    await syncDataIfOnline();
    
    // Clear all data
    localStorage.clear();
    authToken = null;
    currentUser = null;
    tasks = [];
    notes = [];
    
    // Close modal
    closeLogoutModal();
    
    // Reset UI
    showAuth();
    
    showToast('Logged out successfully', 'success');
}

// 31. Switch Account Function
function switchAccount() {
    if (confirm('Switch to another account? You will be logged out.')) {
        logout();
    }
}

// 32. Modal Functions
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

// 33. Export Data Function
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
        a.download = `radheos-backup-${new Date().toISOString().split('T')[0]}.json`;
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

// 34. Wipe Data Function
function wipeData() {
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

// 35. Loading Overlay Functions
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

// ✅✅✅ CRITICAL: Make all functions globally available
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
window.deleteNote = deleteNote;
window.startTimer = startTimer;
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

console.log('✅ All functions are now globally available');
console.log('🚀 Zenith X Pro Script Loaded Successfully');
