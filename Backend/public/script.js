let tasks = [];
let isLoginMode = true;
let timer;
let timeLeft = 1500;

// 1. Init & Auth Logic
async function init() {
    if(localStorage.getItem('token')) {
        showApp();
    }
    updateClock();
    setInterval(updateClock, 1000);
}

function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    document.getElementById('auth-title').innerText = isLoginMode ? "Zenith X Pro" : "Join Zenith X";
    document.getElementById('reg-extra').style.display = isLoginMode ? "none" : "block";
    document.getElementById('auth-main-btn').innerText = isLoginMode ? "Login" : "Sign Up";
}

async function handleAuth() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-pass').value;
    const name = document.getElementById('auth-name') ? document.getElementById('auth-name').value : "";

    const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/register';
    const payload = isLoginMode ? { email, password } : { name, email, password };

    const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const data = await res.json();
    if(res.ok) {
        if(isLoginMode) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('userName', data.name);
            showApp();
        } else {
            alert("Account Created! Please Login.");
            toggleAuthMode();
        }
    } else { alert(data.error); }
}

function showApp() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-content').style.display = 'grid';
    document.getElementById('user-name-display').innerText = localStorage.getItem('userName');
    fetchTasks();
    setupNavigation();
}

function logout() {
    localStorage.clear();
    location.reload();
}

// 2. Task API Logic
async function fetchTasks() {
    const res = await fetch('/api/todos', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    tasks = await res.json();
    renderTasks();
    updateAnalytics();
}

document.getElementById('addBtn').onclick = async () => {
    const title = document.getElementById('taskTitle').value;
    if(!title.trim()) return;
    
    await fetch('/api/todos', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
            title,
            prio: document.getElementById('prioVal').value,
            cat: document.getElementById('catVal').value,
            date: document.getElementById('dateVal').value || 'No Deadline'
        })
    });
    document.getElementById('taskTitle').value = '';
    fetchTasks();
};

async function toggleTask(id, current) {
    await fetch(`/api/todos/${id}`, {
        method: 'PUT',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ done: !current })
    });
    fetchTasks();
}

async function deleteTask(id) {
    await fetch(`/api/todos/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    fetchTasks();
}

// 3. UI Rendering
function renderTasks() {
    const grid = document.getElementById('taskGrid');
    grid.innerHTML = '';
    tasks.forEach(t => {
        const div = document.createElement('div');
        div.className = `task-card ${t.done ? 'done' : ''}`;
        div.innerHTML = `
            <div onclick="toggleTask('${t._id}', ${t.done})" style="cursor:pointer">
                <i class="${t.done ? 'fas fa-check-circle' : 'far fa-circle'}" style="font-size:1.5rem; color:${t.done ? '#2ed573' : '#6366f1'}"></i>
            </div>
            <div style="flex:1">
                <h4 style="${t.done ? 'text-decoration:line-through; opacity:0.5' : ''}">${t.title}</h4>
                <div style="margin-top:5px">
                    <span class="prio-tag prio-${t.prio}">${t.prio}</span>
                    <small style="color:var(--text-s); margin-left:10px">#${t.cat} | ${t.date}</small>
                </div>
            </div>
            <i class="fas fa-trash-alt" style="color:var(--danger); cursor:pointer" onclick="deleteTask('${t._id}')"></i>
        `;
        grid.appendChild(div);
    });
}

// 4. Analytics & Utilities
function updateAnalytics() {
    const total = tasks.length;
    const done = tasks.filter(t => t.done).length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);

    document.getElementById('stat-total').innerText = total;
    document.getElementById('stat-efficiency').innerText = pct + '%';
    document.getElementById('ring-pct').innerText = pct + '%';
    const offset = 377 - (377 * pct) / 100;
    document.getElementById('ring').style.strokeDashoffset = offset;
}

function updateClock() {
    const clock = document.getElementById('live-clock');
    if(clock) clock.innerText = new Date().toLocaleTimeString() + " | " + new Date().toDateString();
}

function setupNavigation() {
    const navs = document.querySelectorAll('.nav-btn, .m-nav-item');
    navs.forEach(btn => {
        btn.onclick = () => {
            const viewId = btn.getAttribute('data-view');
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            document.getElementById(`view-${viewId}`).classList.add('active');
            navs.forEach(n => n.classList.remove('active'));
            btn.classList.add('active');
            if(viewId === 'analytics') updateAnalytics();
        };
    });
}

// 5. Timer Logic
document.getElementById('timer-start').addEventListener('click', function() {
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
            if(timeLeft === 0) {
                clearInterval(timer);
                alert("Focus Session Complete!");
            }
        }, 1000);
        this.innerText = 'Pause Session';
    }
});

init();
