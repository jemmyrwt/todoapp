// Zenith X Pro - Production Ready with Render
const API_BASE_URL = window.location.hostname.includes('localhost') 
  ? 'http://localhost:10000/api' 
  : 'https://todoapp-p5hq.onrender.com/api';

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
  console.log('📡 API Base URL:', API_BASE_URL);
  
  // Check network status
  updateNetworkStatus();
  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);
  
  // Load saved data
  authToken = localStorage.getItem('zenith_token');
  currentUser = JSON.parse(localStorage.getItem('zenith_user'));
  
  if (authToken && currentUser) {
    try {
      if (isOnline) {
        // Verify token with backend
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });
        
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
          loadLocalData();
          showToast('Using offline mode', 'warning');
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

// Load data from localStorage
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
  }
  
  showApp();
}

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

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `Authentication failed (${response.status})`);
    }

    // Save auth data
    authToken = data.token;
    currentUser = data.user;
    
    localStorage.setItem('zenith_token', authToken);
    localStorage.setItem('zenith_user', JSON.stringify(currentUser));
    localStorage.setItem('zenith_last_sync', new Date().toISOString());
    
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
    console.error('Auth error:', error);
    
    if (error.name === 'AbortError') {
      showToast('Request timeout. Please check your connection.', 'error');
    } else if (!isOnline) {
      showToast('You are offline. Please check your internet connection.', 'error');
    } else {
      showToast(error.message || 'Authentication failed. Please try again.', 'error');
    }
  } finally {
    authBtn.textContent = originalText;
    authBtn.disabled = false;
  }
}

// 3. Data Loading Functions
async function loadUserData() {
  if (!authToken || !isOnline) return;
  
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

// 4. Task Management with Offline Support
async function addTask() {
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
  
  // Play sound
  playSound(659.25, 0.2);
}

// 5. Sync Functions
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

// 6. Network Status
function updateNetworkStatus() {
  isOnline = navigator.onLine;
  
  const networkIndicator = document.getElementById('network-indicator');
  if (!networkIndicator) {
    // Create network indicator
    const indicator = document.createElement('div');
    indicator.id = 'network-indicator';
    indicator.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      padding: 5px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: bold;
      z-index: 9999;
      display: none;
      transition: all 0.3s ease;
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

// 7. Server Health Check
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

// 8. Updated Logout Function
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

// 9. Export Data Function
async function exportData() {
  try {
    let exportData = {
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
      exportDate: new Date().toISOString(),
      version: '1.0.0'
    };
    
    // Try to get fresh data from server if online
    if (isOnline && authToken) {
      try {
        const [tasksRes, notesRes] = await Promise.all([
          fetch(`${API_BASE_URL}/todos`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
          }),
          fetch(`${API_BASE_URL}/notes`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
          })
        ]);
        
        if (tasksRes.ok) exportData.tasks = await tasksRes.json();
        if (notesRes.ok) exportData.notes = await notesRes.json();
      } catch (error) {
        console.error('Export fetch error:', error);
      }
    }
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
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

// 10. Utility Functions
function showAuth() {
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app-content').style.display = 'none';
  document.getElementById('auth-email').focus();
}

function showApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app-content').style.display = 'grid';
  
  // Initialize app
  setupNavigation();
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

// ... Rest of your existing functions remain the same
// (renderTasks, renderNotes, toggleTask, deleteTask, etc.)
// Just make sure they use the tasks/notes arrays and update localStorage
