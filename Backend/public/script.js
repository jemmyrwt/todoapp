// Zenith X Pro - Enhanced Core Logic (V7.0)
let tasks = JSON.parse(localStorage.getItem('zenith_tasks')) || [];
let notes = JSON.parse(localStorage.getItem('zenith_notes')) || [];
let isLoginMode = true;
let timer = null;
let timeLeft = 1500; // 25 minutes
let timerRunning = false;
let soundEnabled = true;
let autosaveEnabled = true;
let remindersEnabled = false;
let currentFilter = 'all';
let focusSessions = parseInt(localStorage.getItem('zenith_focus_sessions')) || 0;
let totalFocusTime = parseInt(localStorage.getItem('zenith_total_focus_time')) || 0;

// Audio Context for Timer Sounds
let audioContext;
let gainNode;

// Initialize audio context on user interaction
function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        gainNode = audioContext.createGain();
        gainNode.connect(audioContext.destination);
        gainNode.gain.value = 0.3;
    }
}

// Play sound
function playSound(frequency = 440, duration = 0.2) {
    if (!soundEnabled || !audioContext) return;
    
    const oscillator = audioContext.createOscillator();
    oscillator.connect(gainNode);
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
}

// 1. Initial Launch
window.onload = () => {
    const token = localStorage.getItem('zenith_token');
    if (token) {
        showApp();
    } else {
        document.getElementById('auth-screen').style.display = 'flex';
        document.getElementById('app-content').style.display = 'none';
    }
    updateClock();
    setInterval(updateClock, 1000);
    
    // Load saved settings
    const savedSound = localStorage.getItem('zenith_sound_enabled');
    const savedAutosave = localStorage.getItem('zenith_autosave_enabled');
    const savedReminders = localStorage.getItem('zenith_reminders_enabled');
    
    soundEnabled = savedSound !== null ? savedSound === 'true' : true;
    autosaveEnabled = savedAutosave !== null ? savedAutosave === 'true' : true;
    remindersEnabled = savedReminders !== null ? savedReminders === 'true' : false;
    
    document.getElementById('soundToggle').checked = soundEnabled;
    document.getElementById('autosaveToggle').checked = autosaveEnabled;
    document.getElementById('reminderToggle').checked = remindersEnabled;
    
    // Auto-save interval
    if (autosaveEnabled) {
        setInterval(autoSave, 60000); // Auto-save every minute
    }
    
    // Initialize focus stats
    updateFocusStats();
    
    // Add keyboard shortcuts
    setupKeyboardShortcuts();
    
    // Add drag and drop support
    setupDragAndDrop();
};

// 2. Authentication Logic
function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    const authTitle = document.getElementById('auth-title');
    const authDesc = document.getElementById('auth-desc');
    const regExtra = document.getElementById('reg-extra');
    const authBtn = document.getElementById('auth-main-btn');
    const toggleText = document.getElementById('toggle-text-span');
    
    if (isLoginMode) {
        authTitle.textContent = "Zenith X Pro";
        authDesc.textContent = "Secure access to your dashboard";
        authBtn.textContent = "Access Workspace";
        toggleText.textContent = "Create Account";
        regExtra.style.display = "none";
    } else {
        authTitle.textContent = "Join Zenith";
        authDesc.textContent = "Create your premium workspace";
        authBtn.textContent = "Create Account";
        toggleText.textContent = "Sign In";
        regExtra.style.display = "block";
    }
}

function handleAuth() {
    const email = document.getElementById('auth-email').value.trim();
    const pass = document.getElementById('auth-pass').value.trim();
    const name = document.getElementById('auth-name').value.trim();

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

    // Password validation
    if (pass.length < 6) {
        showToast('Password must be at least 6 characters!', 'error');
        return;
    }

    // Show loading state
    const authBtn = document.getElementById('auth-main-btn');
    const originalText = authBtn.textContent;
    authBtn.innerHTML = '<div class="loading"></div>';
    authBtn.disabled = true;

    // Simulate API call
    setTimeout(() => {
        // Save user data
        if (!isLoginMode) {
            localStorage.setItem('zenith_user_name', name);
        }
        
        const userName = isLoginMode ? email.split('@')[0] : name;
        localStorage.setItem('zenith_token', 'session_' + Date.now());
        localStorage.setItem('zenith_user_email', email);
        localStorage.setItem('zenith_user_name', userName);
        
        showToast(isLoginMode ? 'Welcome back!' : 'Account created successfully!', 'success');
        showApp();
        
        // Reset button
        authBtn.textContent = originalText;
        authBtn.disabled = false;
    }, 1500);
}

function showApp() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-content').style.display = 'grid';
    initApp();
}

function logout() {
    if (timer) {
        clearInterval(timer);
        timer = null;
        timerRunning = false;
    }
    
    // Save current data before logout
    saveData();
    
    localStorage.clear();
    showToast('Logged out successfully', 'success');
    
    // Reset to auth screen
    setTimeout(() => {
        location.reload();
    }, 1000);
}

// 3. App Initialization
function initApp() {
    initAudio(); // Initialize audio context
    setupNavigation();
    renderTasks();
    renderNotes();
    updateAnalytics();
    setupEventListeners();
    
    const userName = localStorage.getItem('zenith_user_name');
    if (userName) {
        document.querySelector('.logo span').textContent = `Zenith X | ${userName}`;
    }
    
    // Auto-select today's date
    document.getElementById('dateVal').valueAsDate = new Date();
}

function setupNavigation() {
    const navs = document.querySelectorAll('.nav-btn, .m-nav-item');
    navs.forEach(btn => {
        btn.onclick = () => {
            const viewId = btn.getAttribute('data-view');
            
            // Views switching
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            document.getElementById(`view-${viewId}`).classList.add('active');
            
            // Active state management
            navs.forEach(n => n.classList.remove('active'));
            document.querySelectorAll(`[data-view="${viewId}"]`).forEach(el => el.classList.add('active'));
            
            if (viewId === 'analytics') updateAnalytics();
            if (viewId === 'focus') updateFocusStats();
            
            // Play navigation sound
            playSound(523.25, 0.1);
        };
    });
}

function setupEventListeners() {
    // Task input enter key
    document.getElementById('taskTitle').addEventListener('keypress', handleTaskKeyPress);
    
    // Add task button
    document.getElementById('addBtn').addEventListener('click', addTask);
    
    // Timer presets
    document.getElementById('timer-presets').addEventListener('change', handleTimerPreset);
    
    // Timer controls
    document.getElementById('timer-start').addEventListener('click', toggleTimer);
    document.getElementById('timer-reset').addEventListener('click', resetTimer);
    
    // Notes
    document.getElementById('saveNote').addEventListener('click', saveNote);
    document.getElementById('clearNote').addEventListener('click', clearNote);
    
    // Settings toggles
    document.getElementById('soundToggle').addEventListener('change', toggleSound);
    document.getElementById('autosaveToggle').addEventListener('change', toggleAutosave);
    document.getElementById('reminderToggle').addEventListener('change', toggleReminders);
    
    // Task filters
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const filter = btn.getAttribute('data-filter');
            setFilter(filter);
        });
    });
    
    // Initialize audio on first user interaction
    document.addEventListener('click', initAudio, { once: true });
}

// 4. Task Management
function handleTaskKeyPress(event) {
    if (event.key === 'Enter') {
        addTask();
    }
}

function addTask() {
    const title = document.getElementById('taskTitle').value.trim();
    if (!title) {
        showToast('Please enter a task title!', 'warning');
        document.getElementById('taskTitle').focus();
        return;
    }

    const newTask = {
        id: Date.now(),
        title: title,
        prio: document.getElementById('prioVal').value,
        cat: document.getElementById('catVal').value,
        date: document.getElementById('dateVal').value || 'No Date',
        done: false,
        createdAt: new Date().toISOString()
    };

    tasks.unshift(newTask);
    document.getElementById('taskTitle').value = '';
    saveData();
    showToast('Task added successfully!', 'success');
    
    // Play success sound
    playSound(659.25, 0.2);
}

function toggleTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    
    task.done = !task.done;
    task.completedAt = task.done ? new Date().toISOString() : null;
    
    saveData();
    
    // Play toggle sound
    playSound(task.done ? 523.25 : 392, 0.1);
    
    showToast(task.done ? 'Task completed! 🎉' : 'Task marked as pending', 'success');
}

function deleteTask(id) {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    tasks = tasks.filter(t => t.id !== id);
    saveData();
    showToast('Task deleted', 'success');
    playSound(349.23, 0.2);
}

function editTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    
    document.getElementById('taskTitle').value = task.title;
    document.getElementById('prioVal').value = task.prio;
    document.getElementById('catVal').value = task.cat;
    document.getElementById('dateVal').value = task.date;
    
    // Remove task and focus on input
    tasks = tasks.filter(t => t.id !== id);
    renderTasks();
    document.getElementById('taskTitle').focus();
    
    showToast('Task ready for editing', 'info');
}

function setFilter(filter) {
    currentFilter = filter;
    
    // Update active filter button
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-filter') === filter);
    });
    
    renderTasks();
}

function renderTasks() {
    const grid = document.getElementById('taskGrid');
    if (!grid) return;
    
    let filteredTasks = tasks;
    
    switch (currentFilter) {
        case 'pending':
            filteredTasks = tasks.filter(t => !t.done);
            break;
        case 'completed':
            filteredTasks = tasks.filter(t => t.done);
            break;
        case 'all':
        default:
            filteredTasks = tasks;
    }
    
    if (filteredTasks.length === 0) {
        const emptyState = currentFilter === 'all' ? 'tasks' : currentFilter + ' tasks';
        grid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-tasks"></i>
                <h3>No ${emptyState} found</h3>
                <p>${currentFilter === 'all' ? 'Create your first task to get started!' : 'Try switching filters or create new tasks'}</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = '';
    
    filteredTasks.forEach(t => {
        const div = document.createElement('div');
        div.className = `task-card ${t.done ? 'completed' : ''} ${t.prio}-priority`;
        div.setAttribute('draggable', 'true');
        div.setAttribute('data-id', t.id);
        
        // Format date
        let dateDisplay = t.date;
        if (t.date !== 'No Date') {
            const taskDate = new Date(t.date);
            const today = new Date();
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            if (taskDate.toDateString() === today.toDateString()) {
                dateDisplay = 'Today';
            } else if (taskDate.toDateString() === tomorrow.toDateString()) {
                dateDisplay = 'Tomorrow';
            } else {
                dateDisplay = taskDate.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                });
            }
        }
        
        div.innerHTML = `
            <div class="task-checkbox" onclick="toggleTask(${t.id})">
                <i class="${t.done ? 'fas fa-check-circle' : 'far fa-circle'}" style="font-size:1.6rem; color:${t.done ? '#10b981' : '#6366f1'}"></i>
            </div>
            <div class="task-content">
                <h4>${t.title}</h4>
                <small>
                    <span class="task-category">${t.cat}</span>
                    <span><i class="fas fa-flag"></i> ${t.prio.charAt(0).toUpperCase() + t.prio.slice(1)}</span>
                    <span><i class="fas fa-calendar"></i> ${dateDisplay}</span>
                </small>
            </div>
            <div class="task-actions">
                <i class="fas fa-edit" onclick="editTask(${t.id})" title="Edit"></i>
                <i class="fas fa-trash-alt" onclick="deleteTask(${t.id})" title="Delete"></i>
            </div>
        `;
        grid.appendChild(div);
    });
    
    updateTaskProgress();
}

function updateTaskProgress() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.done).length;
    const progress = total === 0 ? 0 : (completed / total) * 100;
    
    const progressBar = document.getElementById('task-progress');
    if (progressBar) {
        progressBar.style.width = `${progress}%`;
    }
}

// 5. Notes Management
function saveNote() {
    const content = document.getElementById('noteContent').value.trim();
    if (!content) {
        showToast('Please enter note content!', 'warning');
        return;
    }

    const newNote = {
        id: Date.now(),
        content: content,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    notes.unshift(newNote);
    saveData();
    renderNotes();
    clearNote();
    showToast('Note saved successfully!', 'success');
    playSound(523.25, 0.2);
}

function clearNote() {
    document.getElementById('noteContent').value = '';
    document.getElementById('noteContent').focus();
}

function deleteNote(id) {
    if (!confirm('Are you sure you want to delete this note?')) return;
    
    notes = notes.filter(n => n.id !== id);
    saveData();
    renderNotes();
    showToast('Note deleted', 'success');
}

function renderNotes() {
    const grid = document.getElementById('notesGrid');
    if (!grid) return;
    
    if (notes.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-sticky-note"></i>
                <h3>No notes yet</h3>
                <p>Add your first note to capture thoughts and ideas</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = '';
    
    notes.forEach(note => {
        const div = document.createElement('div');
        div.className = 'note-card';
        
        const date = new Date(note.createdAt);
        const formattedDate = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        div.innerHTML = `
            <div class="note-content">${note.content}</div>
            <div class="note-date">
                <i class="fas fa-clock"></i> ${formattedDate}
            </div>
            <div class="note-actions">
                <i class="fas fa-trash-alt" onclick="deleteNote(${note.id})" title="Delete"></i>
            </div>
        `;
        grid.appendChild(div);
    });
}

// 6. Timer Logic
function toggleTimer() {
    if (timerRunning) {
        pauseTimer();
    } else {
        startTimer();
    }
}

function startTimer() {
    if (timer) {
        clearInterval(timer);
    }
    
    timerRunning = true;
    document.getElementById('timer-start').textContent = 'Pause Session';
    document.getElementById('timer-start').classList.add('active');
    
    timer = setInterval(() => {
        timeLeft--;
        
        const m = Math.floor(timeLeft / 60);
        const s = timeLeft % 60;
        document.getElementById('timer-display').textContent = 
            `${m}:${s < 10 ? '0' : ''}${s}`;
        
        // Update document title with timer
        document.title = `${m}:${s < 10 ? '0' : ''}${s} - Zenith X Pro`;
        
        // Play tick sound every minute
        if (s === 0 && m > 0) {
            playSound(220, 0.1);
        }
        
        if (timeLeft <= 0) {
            completeTimer();
        }
    }, 1000);
    
    showToast('Focus session started! Stay productive 🚀', 'success');
    playSound(659.25, 0.3);
}

function pauseTimer() {
    clearInterval(timer);
    timer = null;
    timerRunning = false;
    document.getElementById('timer-start').textContent = 'Resume Focus';
    document.getElementById('timer-start').classList.remove('active');
    document.title = 'Zenith X Pro | Focus Timer';
    
    showToast('Focus session paused', 'info');
}

function resetTimer() {
    clearInterval(timer);
    timer = null;
    timerRunning = false;
    
    const preset = document.getElementById('timer-presets').value;
    timeLeft = parseInt(preset);
    
    const m = Math.floor(timeLeft / 60);
    const s = timeLeft % 60;
    document.getElementById('timer-display').textContent = 
        `${m}:${s < 10 ? '0' : ''}${s}`;
    
    document.getElementById('timer-start').textContent = 'Initiate Focus';
    document.getElementById('timer-start').classList.remove('active');
    document.title = 'Zenith X Pro';
    
    showToast('Timer reset', 'info');
    playSound(392, 0.2);
}

function completeTimer() {
    clearInterval(timer);
    timer = null;
    timerRunning = false;
    
    // Update stats
    focusSessions++;
    totalFocusTime += parseInt(document.getElementById('timer-presets').value) - timeLeft;
    
    localStorage.setItem('zenith_focus_sessions', focusSessions);
    localStorage.setItem('zenith_total_focus_time', totalFocusTime);
    
    updateFocusStats();
    
    // Play completion sound
    if (soundEnabled) {
        playSound(880, 0.5);
        setTimeout(() => playSound(659.25, 0.5), 300);
        setTimeout(() => playSound(523.25, 0.5), 600);
    }
    
    // Notification
    showToast('Focus session completed! 🎉 Time for a break.', 'success');
    
    // Reset to default preset
    document.getElementById('timer-presets').value = '1500';
    resetTimer();
    
    // Flash notification
    if (document.hidden) {
        new Notification('Zenith X Pro', {
            body: 'Focus session completed! Time for a break.',
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="%236366f1"/></svg>'
        });
    }
}

function handleTimerPreset(event) {
    const preset = event.target.value;
    timeLeft = parseInt(preset);
    
    const m = Math.floor(timeLeft / 60);
    const s = timeLeft % 60;
    document.getElementById('timer-display').textContent = 
        `${m}:${s < 10 ? '0' : ''}${s}`;
    
    if (timerRunning) {
        resetTimer();
    }
}

function updateFocusStats() {
    document.getElementById('focus-sessions').textContent = `${focusSessions} Sessions`;
    
    const totalHours = Math.floor(totalFocusTime / 3600);
    const totalMinutes = Math.floor((totalFocusTime % 3600) / 60);
    
    if (totalHours > 0) {
        document.getElementById('total-focus-time').textContent = 
            `${totalHours}h ${totalMinutes}m Total`;
    } else {
        document.getElementById('total-focus-time').textContent = 
            `${totalMinutes}m Total`;
    }
}

// 7. Analytics Logic
function updateAnalytics() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.done).length;
    const pending = total - completed;
    const efficiency = total === 0 ? 0 : Math.round((completed / total) * 100);
    
    // Update stats cards
    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-completed').textContent = completed;
    document.getElementById('stat-pending').textContent = pending;
    document.getElementById('stat-efficiency').textContent = `${efficiency}%`;
    
    // Update ring chart
    document.getElementById('ring-pct').textContent = `${efficiency}%`;
    const ring = document.getElementById('ring');
    if (ring) {
        const offset = 471 - (471 * efficiency) / 100;
        ring.style.strokeDashoffset = offset;
    }
    
    // Update progress bars
    document.getElementById('analytics-progress').style.width = `${efficiency}%`;
    
    // Update category breakdown
    updateCategoryBreakdown();
}

function updateCategoryBreakdown() {
    const breakdown = document.getElementById('category-breakdown');
    if (!breakdown) return;
    
    const categories = {};
    tasks.forEach(task => {
        if (!categories[task.cat]) {
            categories[task.cat] = { total: 0, completed: 0 };
        }
        categories[task.cat].total++;
        if (task.done) categories[task.cat].completed++;
    });
    
    breakdown.innerHTML = '';
    
    Object.entries(categories).forEach(([cat, data]) => {
        const pct = data.total === 0 ? 0 : Math.round((data.completed / data.total) * 100);
        const div = document.createElement('div');
        div.className = 'category-item';
        div.innerHTML = `
            <h4>${cat}</h4>
            <p>${data.completed}/${data.total} completed</p>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${pct}%"></div>
            </div>
            <small>${pct}% efficiency</small>
        `;
        breakdown.appendChild(div);
    });
}

// 8. Settings Functions
function toggleTheme() {
    const current = document.body.getAttribute('data-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('zenith_theme', newTheme);
    
    showToast(`Switched to ${newTheme} mode`, 'success');
    playSound(523.25, 0.1);
}

function toggleSound() {
    soundEnabled = document.getElementById('soundToggle').checked;
    localStorage.setItem('zenith_sound_enabled', soundEnabled);
    showToast(`Sounds ${soundEnabled ? 'enabled' : 'disabled'}`, 'success');
}

function toggleAutosave() {
    autosaveEnabled = document.getElementById('autosaveToggle').checked;
    localStorage.setItem('zenith_autosave_enabled', autosaveEnabled);
    showToast(`Auto-save ${autosaveEnabled ? 'enabled' : 'disabled'}`, 'success');
}

function toggleReminders() {
    remindersEnabled = document.getElementById('reminderToggle').checked;
    localStorage.setItem('zenith_reminders_enabled', remindersEnabled);
    
    if (remindersEnabled) {
        if (!("Notification" in window)) {
            alert("This browser does not support notifications");
            document.getElementById('reminderToggle').checked = false;
            return;
        }
        
        if (Notification.permission === "default") {
            Notification.requestPermission().then(permission => {
                if (permission === "granted") {
                    showToast('Reminders enabled!', 'success');
                }
            });
        }
    }
    
    showToast(`Reminders ${remindersEnabled ? 'enabled' : 'disabled'}`, 'success');
}

function exportData() {
    const data = {
        tasks: tasks,
        notes: notes,
        settings: {
            theme: document.body.getAttribute('data-theme'),
            soundEnabled: soundEnabled,
            autosaveEnabled: autosaveEnabled,
            remindersEnabled: remindersEnabled
        },
        exportDate: new Date().toISOString(),
        version: '7.0'
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zenith-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('Data exported successfully!', 'success');
}

function wipeData() {
    if (!confirm('⚠️ WARNING: This will delete ALL your tasks, notes, and settings. This action cannot be undone. Are you absolutely sure?')) {
        return;
    }
    
    if (!confirm('FINAL WARNING: All your data will be permanently deleted. Press OK to confirm.')) {
        return;
    }
    
    tasks = [];
    notes = [];
    focusSessions = 0;
    totalFocusTime = 0;
    
    localStorage.removeItem('zenith_tasks');
    localStorage.removeItem('zenith_notes');
    localStorage.removeItem('zenith_focus_sessions');
    localStorage.removeItem('zenith_total_focus_time');
    
    renderTasks();
    renderNotes();
    updateAnalytics();
    updateFocusStats();
    
    showToast('All data has been wiped', 'warning');
    playSound(220, 0.5);
}

// 9. Utility Functions
function updateClock() {
    const clock = document.getElementById('live-clock');
    if (!clock) return;
    
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    clock.textContent = timeString;
}

function saveData() {
    localStorage.setItem('zenith_tasks', JSON.stringify(tasks));
    localStorage.setItem('zenith_notes', JSON.stringify(notes));
    updateAnalytics();
}

function autoSave() {
    if (autosaveEnabled) {
        saveData();
        console.log('Auto-saved at', new Date().toLocaleTimeString());
    }
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastTitle = document.getElementById('toast-title');
    const toastMessage = document.getElementById('toast-message');
    const toastIcon = toast.querySelector('.toast-icon');
    
    // Set content and type
    toastTitle.textContent = type.charAt(0).toUpperCase() + type.slice(1);
    toastMessage.textContent = message;
    
    // Set icon based on type
    let iconClass = 'fas fa-check-circle';
    switch (type) {
        case 'error':
            iconClass = 'fas fa-exclamation-circle';
            break;
        case 'warning':
            iconClass = 'fas fa-exclamation-triangle';
            break;
        case 'info':
            iconClass = 'fas fa-info-circle';
            break;
    }
    toastIcon.className = iconClass + ' toast-icon';
    
    // Set type class
    toast.className = `toast ${type}`;
    
    // Show toast
    toast.classList.add('show');
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function hideToast() {
    document.getElementById('toast').classList.remove('show');
}

// 10. Keyboard Shortcuts
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Don't trigger shortcuts if user is typing in inputs
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            // Allow Ctrl+Enter for saving
            if (e.ctrlKey && e.key === 'Enter') {
                if (document.getElementById('taskTitle') === document.activeElement) {
                    addTask();
                } else if (document.getElementById('noteContent') === document.activeElement) {
                    saveNote();
                }
            }
            return;
        }
        
        // Global shortcuts
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'n':
                    e.preventDefault();
                    document.getElementById('taskTitle').focus();
                    showToast('New task - start typing!', 'info');
                    break;
                    
                case 'f':
                    e.preventDefault();
                    const focusView = document.getElementById('view-focus');
                    if (!focusView.classList.contains('active')) {
                        // Switch to focus view
                        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
                        focusView.classList.add('active');
                        
                        document.querySelectorAll('.nav-btn, .m-nav-item').forEach(btn => {
                            btn.classList.remove('active');
                            if (btn.getAttribute('data-view') === 'focus') {
                                btn.classList.add('active');
                            }
                        });
                        
                        showToast('Focus timer activated', 'success');
                    }
                    
                    if (!timerRunning) {
                        startTimer();
                    }
                    break;
                    
                case 't':
                    e.preventDefault();
                    toggleTheme();
                    break;
                    
                case 's':
                    e.preventDefault();
                    saveData();
                    showToast('All data saved!', 'success');
                    break;
            }
        } else if (e.key === 'Escape') {
            // Close modal if open
            const modal = document.getElementById('shortcuts-modal');
            if (modal.classList.contains('show')) {
                closeModal();
            }
        }
    });
}

// 11. Modal Functions
function showKeyboardShortcuts() {
    document.getElementById('shortcuts-modal').classList.add('show');
}

function closeModal() {
    document.getElementById('shortcuts-modal').classList.remove('show');
}

// 12. Drag and Drop
function setupDragAndDrop() {
    let draggedTask = null;
    
    document.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('task-card')) {
            draggedTask = e.target;
            e.target.classList.add('dragging');
        }
    });
    
    document.addEventListener('dragend', (e) => {
        if (e.target.classList.contains('task-card')) {
            e.target.classList.remove('dragging');
            draggedTask = null;
        }
    });
    
    document.addEventListener('dragover', (e) => {
        e.preventDefault();
        const taskGrid = document.getElementById('taskGrid');
        if (taskGrid) {
            taskGrid.classList.add('drop-zone');
        }
    });
    
    document.addEventListener('dragleave', (e) => {
        const taskGrid = document.getElementById('taskGrid');
        if (taskGrid && !e.relatedTarget || !taskGrid.contains(e.relatedTarget)) {
            taskGrid.classList.remove('drop-zone');
        }
    });
    
    document.addEventListener('drop', (e) => {
        e.preventDefault();
        const taskGrid = document.getElementById('taskGrid');
        if (taskGrid) {
            taskGrid.classList.remove('drop-zone');
        }
        
        if (draggedTask) {
            const taskId = parseInt(draggedTask.getAttribute('data-id'));
            toggleTask(taskId);
            
            // Add visual feedback
            draggedTask.style.transform = 'scale(0.95)';
            setTimeout(() => {
                draggedTask.style.transform = '';
            }, 200);
        }
    });
}

// Initialize theme from localStorage
const savedTheme = localStorage.getItem('zenith_theme');
if (savedTheme) {
    document.body.setAttribute('data-theme', savedTheme);
}

// Request notification permission on startup
if ("Notification" in window && Notification.permission === "default") {
    setTimeout(() => {
        Notification.requestPermission();
    }, 2000);
}
