let tasks = [];
let timer;
let timeLeft = 1500;
const API_URL = '/api/todos';

// Init: Database se data lana
async function init() {
    await fetchTasks(); // localStorage ki jagah DB se data ayega
    setupNavigation();
    updateClock();
    setInterval(updateClock, 1000);
}

async function fetchTasks() {
    const token = localStorage.getItem('token');
    if(!token) return console.log("User not logged in");

    const res = await fetch(API_URL, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    tasks = await res.json();
    renderTasks();
    updateAnalytics();
}

// Add Task to MongoDB
document.getElementById('addBtn').addEventListener('click', async () => {
    const title = document.getElementById('taskTitle').value;
    const prio = document.getElementById('prioVal').value;
    const cat = document.getElementById('catVal').value;
    const date = document.getElementById('dateVal').value;

    if(!title.trim()) return;

    const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ 
            title, prio, cat, 
            date: date || 'No Deadline' 
        })
    });

    if(res.ok) {
        document.getElementById('taskTitle').value = '';
        await fetchTasks();
    }
});

async function toggleTask(id, currentStatus) {
    await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ done: !currentStatus })
    });
    await fetchTasks();
}

async function deleteTask(id) {
    await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    await fetchTasks();
}

// Render Tasks (Aapka original design)
function renderTasks() {
    const grid = document.getElementById('taskGrid');
    if(!grid) return;
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

// Baki ka aapka Analytics, Timer aur Navigation code yahan niche as-it-is rahega...
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

function setupNavigation() {
    const navs = document.querySelectorAll('.nav-btn, .m-nav-item');
    navs.forEach(btn => {
        btn.addEventListener('click', () => {
            const viewId = btn.getAttribute('data-view');
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            document.getElementById(`view-${viewId}`).classList.add('active');
            navs.forEach(n => n.classList.remove('active'));
            btn.classList.add('active');
            if(viewId === 'analytics') updateAnalytics();
        });
    });
}

// Timer Logic (Same as yours)
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
            if(timeLeft === 0) clearInterval(timer);
        }, 1000);
        this.innerText = 'Pause Session';
    }
});

init();
