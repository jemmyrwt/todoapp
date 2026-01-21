// Zenith X Pro - Production Ready with Render
// ✅ FIXED: Updated API base URL
const API_BASE_URL = window.location.hostname.includes('localhost') 
  ? 'http://localhost:10000/api' 
  : '/api'; // Use relative path for production

console.log('🌐 Current hostname:', window.location.hostname);
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

// 1. Initial Launch
window.onload = async () => {
  console.log('🌐 Zenith X Pro Loading...');
  
  // Check network status
  updateNetworkStatus();
  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);
  
  // Load saved data
  authToken = localStorage.getItem('zenith_token');
  currentUser = JSON.parse(localStorage.getItem('zenith_user'));
  
  console.log('🔍 Stored token:', authToken ? 'Present' : 'Missing');
  console.log('🔍 Stored user:', currentUser ? currentUser.email : 'None');
  
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
  
  // Setup event listeners
  setupEventListeners();
  setupKeyboardShortcuts();
  
  // Check health
  checkServerHealth();
};

// 2. Authentication Functions
async function handleAuth() {
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

    // Save auth data
    authToken = data.token;
    currentUser = data.user;
    
    localStorage.setItem('zenith_token', authToken);
    localStorage.setItem('zenith_user', JSON.stringify(currentUser));
    localStorage.setItem('zenith_last_sync', new Date().toISOString());
    
    console.log('✅ Auth successful, user:', currentUser.email);
    
    // Update settings from server
    if (data.user.settings) {
      soundEnabled = data.user.settings.soundEnabled;
      autosaveEnabled = data.user.settings.autosaveEnabled;
      remindersEnabled = data.user.settings.remindersEnabled;
      
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

// 3. Toggle Auth Mode Function
function toggleAuthMode() {
  isLoginMode = !isLoginMode;
  
  const authTitle = document.getElementById('auth-title');
  const authDesc = document.getElementById('auth-desc');
  const authMainBtn = document.getElementById('auth-main-btn');
  const toggleTextSpan = document.getElementById('toggle-text-span');
  const authExtra = document.getElementById('reg-extra');
  
  if (isLoginMode) {
    authTitle.textContent = 'Zenith X Pro';
    authDesc.textContent = 'Secure access to your dashboard';
    authMainBtn.textContent = 'Access Workspace';
    toggleTextSpan.textContent = 'Create Account';
    authExtra.style.display = 'none';
  } else {
    authTitle.textContent = 'Create Account';
    authDesc.textContent = 'Join Zenith X Pro today';
    authMainBtn.textContent = 'Create Account';
    toggleTextSpan.textContent = 'Login';
    authExtra.style.display = 'block';
  }
  
  // Clear inputs
  document.getElementById('auth-name').value = '';
  document.getElementById('auth-email').value = '';
  document.getElementById('auth-pass').value = '';
  
  // Focus on email field
  document.getElementById('auth-email').focus();
}

// 4. Network Status Function
function updateNetworkStatus() {
  isOnline = navigator.onLine;
  
  const networkIndicator = document.getElementById('network-indicator');
  if (!networkIndicator) {
    // Create network indicator
    const indicator = document.createElement('div');
    indicator.id = 'network-indicator';
    indicator.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 10px 20px;
      border-radius: 25px;
      font-size: 14px;
      font-weight: bold;
      z-index: 9999;
      display: none;
      transition: all 0.3s ease;
      box-shadow: 0 5px 15px rgba(0,0,0,0.3);
    `;
    document.body.appendChild(indicator);
  }
  
  const indicator = document.getElementById('network-indicator');
  
  if (isOnline) {
    indicator.textContent = '✅ Online';
    indicator.style.background = 'var(--success)';
    indicator.style.color = 'white';
    indicator.style.display = 'block';
    
    // Auto-sync when coming online
    setTimeout(syncDataIfOnline, 2000);
    
    setTimeout(() => {
      indicator.style.display = 'none';
    }, 3000);
  } else {
    indicator.textContent = '⚠️ Offline';
    indicator.style.background = 'var(--warning)';
    indicator.style.color = 'black';
    indicator.style.display = 'block';
    
    setTimeout(() => {
      indicator.style.display = 'none';
    }, 5000);
  }
}

// 5. Setup Event Listeners Function
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
  });
  
  // Note controls
  document.getElementById('saveNote').addEventListener('click', saveNote);
  document.getElementById('clearNote').addEventListener('click', clearNote);
  
  // Auth toggle
  document.querySelector('.toggle-auth').addEventListener('click', toggleAuthMode);
  
  // Theme toggle
  document.querySelector('[onclick="toggleTheme()"]').addEventListener('click', toggleTheme);
  
  // Settings toggles
  document.getElementById('soundToggle').addEventListener('change', function() {
    soundEnabled = this.checked;
    saveSettings();
  });
  
  document.getElementById('autosaveToggle').addEventListener('change', function() {
    autosaveEnabled = this.checked;
    saveSettings();
  });
  
  document.getElementById('reminderToggle').addEventListener('change', function() {
    remindersEnabled = this.checked;
    saveSettings();
  });
}

// 6. Save Settings Function
function saveSettings() {
  const settings = {
    theme: document.body.getAttribute('data-theme'),
    soundEnabled,
    autosaveEnabled,
    remindersEnabled
  };
  
  localStorage.setItem('zenith_settings', JSON.stringify(settings));
  
  // Sync with server if authenticated
  if (authToken && currentUser) {
    fetch(`${API_BASE_URL}/auth/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(settings)
    }).catch(console.error);
  }
}

// 7. Load Local Data Function
function loadLocalData() {
  tasks = JSON.parse(localStorage.getItem('zenith_tasks')) || [];
  notes = JSON.parse(localStorage.getItem('zenith_notes')) || [];
  focusSessions = parseInt(localStorage.getItem('zenith_focus_sessions')) || 0;
  totalFocusTime = parseInt(localStorage.getItem('zenith_total_focus_time')) || 0;
  
  // Load settings
  const savedSettings = JSON.parse(localStorage.getItem('zenith_settings'));
  if (savedSettings) {
    soundEnabled = savedSettings.soundEnabled;
    autosaveEnabled = savedSettings.autosaveEnabled;
    remindersEnabled = savedSettings.remindersEnabled;
    document.body.setAttribute('data-theme', savedSettings.theme || 'dark');
    
    // Update toggle switches
    document.getElementById('soundToggle').checked = soundEnabled;
    document.getElementById('autosaveToggle').checked = autosaveEnabled;
    document.getElementById('reminderToggle').checked = remindersEnabled;
  }
  
  showApp();
}

// 8. Show App Function
function showApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app-content').style.display = 'grid';
  
  // Initialize app
  renderTasks();
  renderNotes();
  updateAnalytics();
  updateFocusStats();
  
  // Update user info
  if (currentUser) {
    document.querySelector('.logo span').textContent = `Zenith X | ${currentUser.name}`;
  }
  
  // Set today's date
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('dateVal').value = today;
  document.getElementById('dateVal').min = today;
}

// 9. Show Auth Function
function showAuth() {
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app-content').style.display = 'none';
  document.getElementById('auth-email').focus();
  
  // Reset auth mode to login
  isLoginMode = true;
  const authExtra = document.getElementById('reg-extra');
  authExtra.style.display = 'none';
  
  // Clear inputs
  document.getElementById('auth-email').value = '';
  document.getElementById('auth-pass').value = '';
  document.getElementById('auth-name').value = '';
}

// 10. Load User Data Function
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

// 11. Sync Data Function
async function syncDataIfOnline() {
  if (!isOnline || !authToken) return;
  
  try {
    // Check for unsynced tasks
    const unsyncedTasks = tasks.filter(t => t._id && t._id.startsWith('local_'));
    
    for (const task of unsyncedTasks) {
      try {
        const response = await fetch(`${API_BASE_URL}/todos`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            title: task.title,
            priority: task.priority,
            category: task.category,
            dueDate: task.dueDate
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
    
    // Save updated tasks
    localStorage.setItem('zenith_tasks', JSON.stringify(tasks));
    
    // Update last sync time
    localStorage.setItem('zenith_last_sync', new Date().toISOString());
    
  } catch (error) {
    console.error('Sync error:', error);
  }
}

// 12. Server Health Check
async function checkServerHealth() {
  try {
    const response = await fetch(`${API_BASE_URL.replace('/api', '')}/api/health`);
    if (response.ok) {
      console.log('✅ Server is healthy');
    } else {
      console.warn('⚠️ Server health check failed');
    }
  } catch (error) {
    console.warn('⚠️ Server is unreachable');
  }
}

// 13. Task Management Functions
function addTask() {
  const title = document.getElementById('taskTitle').value.trim();
  if (!title) {
    showToast('Please enter a task title!', 'warning');
    document.getElementById('taskTitle').focus();
    return;
  }

  const taskData = {
    title: title,
    priority: document.getElementById('prioVal').value,
    category: document.getElementById('catVal').value,
    dueDate: document.getElementById('dateVal').value || null
  };

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
  document.getElementById('taskTitle').value = '';
  
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

// 14. Render Tasks
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
        <i class="fas fa-trash" onclick="deleteTask(${task.id})"></i>
      </div>
    </div>
  `).join('');
  
  // Update progress
  updateTaskProgress();
}

// 15. Toggle Task Completion
function toggleTask(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (task) {
    task.isCompleted = !task.isCompleted;
    task.completedAt = task.isCompleted ? new Date().toISOString() : null;
    localStorage.setItem('zenith_tasks', JSON.stringify(tasks));
    renderTasks();
    updateAnalytics();
    showToast(`Task ${task.isCompleted ? 'completed' : 'marked incomplete'}!`, 'success');
  }
}

// 16. Delete Task
function deleteTask(taskId) {
  if (confirm('Delete this task?')) {
    tasks = tasks.filter(t => t.id !== taskId);
    localStorage.setItem('zenith_tasks', JSON.stringify(tasks));
    renderTasks();
    updateAnalytics();
    showToast('Task deleted!', 'success');
  }
}

// 17. Edit Task
function editTask(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (task) {
    document.getElementById('taskTitle').value = task.title;
    document.getElementById('prioVal').value = task.priority;
    document.getElementById('catVal').value = task.category;
    document.getElementById('dateVal').value = task.dueDate || '';
    
    // Remove task from list
    tasks = tasks.filter(t => t.id !== taskId);
    localStorage.setItem('zenith_tasks', JSON.stringify(tasks));
    renderTasks();
    showToast('Task ready for editing!', 'info');
  }
}

// 18. Update Task Progress
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

// 19. Update Analytics
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

// 20. Notes Functions
function saveNote() {
  const content = document.getElementById('noteContent').value.trim();
  if (!content) {
    showToast('Please enter note content!', 'warning');
    return;
  }
  
  const note = {
    id: Date.now(),
    content: content,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  notes.unshift(note);
  localStorage.setItem('zenith_notes', JSON.stringify(notes));
  
  // Clear textarea
  document.getElementById('noteContent').value = '';
  
  // Update UI
  renderNotes();
  showToast('Note saved!', 'success');
}

function clearNote() {
  document.getElementById('noteContent').value = '';
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
    document.getElementById('noteContent').value = note.content;
    
    // Remove note from list
    notes = notes.filter(n => n.id !== noteId);
    localStorage.setItem('zenith_notes', JSON.stringify(notes));
    renderNotes();
    showToast('Note ready for editing!', 'info');
  }
}

function deleteNote(noteId) {
  if (confirm('Delete this note?')) {
    notes = notes.filter(n => n.id !== noteId);
    localStorage.setItem('zenith_notes', JSON.stringify(notes));
    renderNotes();
    showToast('Note deleted!', 'success');
  }
}

// 21. Timer Functions
function startTimer() {
  if (timerRunning) {
    clearInterval(timer);
    timerRunning = false;
    document.getElementById('timer-start').textContent = 'Resume Focus';
    showToast('Timer paused', 'info');
  } else {
    timerRunning = true;
    document.getElementById('timer-start').textContent = 'Pause Focus';
    
    timer = setInterval(() => {
      timeLeft--;
      updateTimerDisplay();
      
      if (timeLeft <= 0) {
        clearInterval(timer);
        timerRunning = false;
        document.getElementById('timer-start').textContent = 'Initiate Focus';
        showToast('Focus session completed!', 'success');
        
        // Record session
        focusSessions++;
        totalFocusTime += parseInt(document.getElementById('timer-presets').value) - timeLeft;
        localStorage.setItem('zenith_focus_sessions', focusSessions);
        localStorage.setItem('zenith_total_focus_time', totalFocusTime);
        updateFocusStats();
        
        // Play sound if enabled
        if (soundEnabled) {
          playTimerSound();
        }
      }
    }, 1000);
  }
}

function resetTimer() {
  clearInterval(timer);
  timerRunning = false;
  timeLeft = parseInt(document.getElementById('timer-presets').value);
  updateTimerDisplay();
  document.getElementById('timer-start').textContent = 'Initiate Focus';
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

function updateFocusStats() {
  const focusSessionsEl = document.getElementById('focus-sessions');
  const totalFocusTimeEl = document.getElementById('total-focus-time');
  
  if (focusSessionsEl) {
    focusSessionsEl.textContent = `${focusSessions} Sessions`;
  }
  if (totalFocusTimeEl) {
    totalFocusTimeEl.textContent = `${Math.floor(totalFocusTime / 60)}m Total`;
  }
}

function playTimerSound() {
  // Simple beep sound
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (e) {
    console.log('Audio not supported');
  }
}

// 22. Utility Functions
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
  
  if (!toast) return;
  
  // Set type
  toast.className = 'toast';
  toast.classList.add(type);
  
  // Set content
  toastTitle.textContent = type.charAt(0).toUpperCase() + type.slice(1);
  toastMessage.textContent = message;
  
  // Show toast
  toast.classList.add('show');
  
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
  
  // Save to settings
  const settings = JSON.parse(localStorage.getItem('zenith_settings')) || {};
  settings.theme = newTheme;
  localStorage.setItem('zenith_settings', JSON.stringify(settings));
  
  showToast(`Theme changed to ${newTheme}`, 'success');
}

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl+N for new task
    if (e.ctrlKey && e.key === 'n') {
      e.preventDefault();
      document.getElementById('taskTitle').focus();
    }
    
    // Ctrl+Enter to save
    if (e.ctrlKey && e.key === 'Enter') {
      if (document.getElementById('taskTitle').value) {
        addTask();
      } else if (document.getElementById('noteContent').value) {
        saveNote();
      }
    }
    
    // Ctrl+F for focus timer
    if (e.ctrlKey && e.key === 'f') {
      e.preventDefault();
      switchView('focus');
      document.getElementById('timer-start').focus();
    }
    
    // Ctrl+T for theme toggle
    if (e.ctrlKey && e.key === 't') {
      e.preventDefault();
      toggleTheme();
    }
    
    // Esc to close modal
    if (e.key === 'Escape') {
      closeShortcutsModal();
    }
  });
}

// 23. Helper functions
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

// 24. Logout Function
async function logout() {
  if (confirm('Are you sure you want to logout?')) {
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
    
    // Reset UI
    document.getElementById('app-content').style.display = 'none';
    document.getElementById('auth-screen').style.display = 'flex';
    
    // Reset auth form
    document.getElementById('auth-email').value = '';
    document.getElementById('auth-pass').value = '';
    document.getElementById('auth-name').value = '';
    
    showToast('Logged out successfully', 'success');
  }
}

// 25. Modal Functions (YEH ADD KARO)
function showKeyboardShortcutsModal() {
  document.getElementById('shortcuts-modal').classList.add('show');
}

function closeShortcutsModal() {
  document.getElementById('shortcuts-modal').classList.remove('show');
}

// 26. Export Data Function (YEH ADD KARO)
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
    a.download = `zenith-backup-${new Date().toISOString().split('T')[0]}.json`;
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

// 27. Wipe Data Function (YEH ADD KARO)
function wipeData() {
  if (confirm('⚠️ This will delete ALL your local data. Are you sure?')) {
    localStorage.clear();
    tasks = [];
    notes = [];
    focusSessions = 0;
    totalFocusTime = 0;
    
    // Reload the app
    location.reload();
  }
}

// 28. Loading Overlay Functions (YEH ADD KARO)
function showLoading(message = 'Syncing...') {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.querySelector('p').textContent = message;
    overlay.style.display = 'flex';
  }
}

function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
}

// 29. Make all functions globally available
window.handleAuth = handleAuth;
window.toggleAuthMode = toggleAuthMode;
window.logout = logout;
window.addTask = addTask;
window.toggleTask = toggleTask;
window.deleteTask = deleteTask;
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
window.exportData = exportData;
window.wipeData = wipeData;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.hideToast = hideToast;

// ✅ END OF SCRIPT
