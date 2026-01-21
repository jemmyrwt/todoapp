// Zenith X Pro - Core Logic
let tasks = JSON.parse(localStorage.getItem('zenith_tasks')) || [];
let isLoginMode = true;
let timer = null;
let timeLeft = 1500; // 25 minutes

// 1. Initial Launch
window.onload = () => {
    const token = localStorage.getItem('token');
    if (token) {
        showApp();
    } else {
        document.getElementById('auth-screen').style.display = 'flex';
        document.getElementById('app-content').style.display = 'none';
    }
    updateClock();
    setInterval(updateClock, 1000);
};

// 2. Authentication Logic
function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    document.getElementById('auth-title').innerText = isLoginMode ? "Zenith X Pro" : "Join Zenith";
    document.getElementById('reg-extra').style.display = isLoginMode ? "none" : "block";
    document.getElementById('auth-main-btn').innerText = isLoginMode ? "Access Dashboard" : "Create Account";
}

function handleAuth() {
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-pass').value;

    if (!email || !pass) {
        alert("Please fill all fields!");
        return;
    }

    // Temporary session save
    localStorage.setItem('token', 'session_' + Date.now());
    localStorage.setItem('userName', email.split('@')[0]);
    showApp();
}

function showApp() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-content').style.display = 'grid';
    initApp();
}

function logout() {
    localStorage.clear();
    location.reload();
}

// 3. App Initialization
function initApp() {
    setupNavigation();
    renderTasks();
    updateAnalytics();
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
            
            if(viewId === 'analytics') updateAnalytics();
        };
    });
}

// 4. Task Management
document.getElementById('addBtn').onclick = () => {
    const title = document.getElementById('taskTitle').value;
    if(!title.trim()) return;

    const newTask = {
        id: Date.now(),
        title: title,
        prio: document.getElementById('prioVal').value,
        cat: document.getElementById('catVal').value,
        date: document.getElementById('dateVal').value || 'No Date',
        done: false
    };

    tasks.unshift(newTask);
    document.getElementById('taskTitle').value = '';
    save();
};

function toggleTask(id) {
    tasks = tasks.map(t => t.id === id ? {...t, done: !t.done} : t);
    save();
}

function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    save();
}

function save() {
    localStorage.setItem('zenith_tasks', JSON.stringify(tasks));
    renderTasks();
    updateAnalytics();
}

function renderTasks() {
    const grid = document.getElementById('taskGrid');
    if(!grid) return;
    grid.innerHTML = '';

    tasks.forEach(t => {
        const div = document.createElement('div');
        div.className = `task-card`;
        div.innerHTML = `
            <div onclick="toggleTask(${t.id})" style="cursor:pointer">
                <i class="${t.done ? 'fas fa-check-circle' : 'far fa-circle'}" style="font-size:1.6rem; color:${t.done ? '#2ed573' : '#6366f1'}"></i>
            </div>
            <div style="flex:1">
                <h4 style="${t.done ? 'text-decoration:line-through; opacity:0.5' : ''}">${t.title}</h4>
                <small style="color:var(--text-s)">${t.prio.toUpperCase()} | ${t.cat} | ${t.date}</small>
            </div>
            <i class="fas fa-trash-alt" style="color:var(--danger); cursor:pointer" onclick="deleteTask(${t.id})"></i>
        `;
        grid.appendChild(div);
    });
}

// 5. Analytics Logic
function updateAnalytics() {
    const total = tasks.length;
    const done = tasks.filter(t => t.done).length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);

    const statTotal = document.getElementById('stat-total');
    const statEff = document.getElementById('stat-efficiency');
    const ringPct = document.getElementById('ring-pct');
    const ring = document.getElementById('ring');

    if(statTotal) statTotal.innerText = total;
    if(statEff) statEff.innerText = pct + '%';
    if(ringPct) ringPct.innerText = pct + '%';
    if(ring) {
        const offset = 377 - (377 * pct) / 100;
        ring.style.strokeDashoffset = offset;
    }
}

// 6. Timer Logic
document.getElementById('timer-start').onclick = function() {
    if(timer) {
        clearInterval(timer);
        timer = null;
        this.innerText = 'Start Focus';
    } else {
        timer = setInterval(() => {
            timeLeft--;
            const m = Math.floor(timeLeft / 60);
            const s = timeLeft % 60;
            document.getElementById('timer-display').innerText = `${m}:${s < 10 ? '0' : ''}${s}`;
            if(timeLeft <= 0) {
                clearInterval(timer);
                alert("Session Finished!");
                timeLeft = 1500;
            }
        }, 1000);
        this.innerText = 'Pause Session';
    }
};

document.getElementById('timer-reset').onclick = () => {
    clearInterval(timer);
    timer = null;
    timeLeft = 1500;
    document.getElementById('timer-display').innerText = "25:00";
    document.getElementById('timer-start').innerText = 'Start Focus';
};

// 7. Utilities
function updateClock() {
    const clock = document.getElementById('live-clock');
    if(clock) clock.innerText = new Date().toLocaleTimeString();
}

function toggleTheme() {
    const current = document.body.getAttribute('data-theme');
    document.body.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
}
