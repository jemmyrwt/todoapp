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

// Add this missing function
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

// 6. Load Local Data Function
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

// 7. Show App Function
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

// 8. Show Auth Function
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
