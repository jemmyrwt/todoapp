let tasks = JSON.parse(localStorage.getItem('zenith_tasks')) || [];
let timer;
let timeLeft = 1500;

function init() {
    renderTasks();
    setupNavigation();
    updateClock();
    setInterval(updateClock, 1000);
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
            // Desktop aur Mobile dono buttons ko active karo
            document.querySelectorAll(`[data-view="${viewId}"]`).forEach(el => el.classList.add('active'));
            if(viewId === 'analytics') updateAnalytics();
        };
    });
}

document.getElementById('addBtn').onclick = () => {
    const title = document.getElementById('taskTitle').value;
    if(!title.trim()) return;
    tasks.unshift({
        id: Date.now(),
        title, 
        prio: document.getElementById('prioVal').value,
        cat: document.getElementById('catVal').value,
        date: document.getElementById('dateVal').value || 'No Deadline',
        done: false
    });
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
                <i class="${t.done ? 'fas fa-check-circle' : 'far fa-circle'}" style="font-size:1.5rem; color:${t.done ? '#2ed573' : '#6366f1'}"></i>
            </div>
            <div style="flex:1">
                <h4 style="${t.done ? 'text-decoration:line-through; opacity:0.5' : ''}">${t.title}</h4>
                <small style="color:var(--text-s)">${t.prio} | ${t.cat} | ${t.date}</small>
            </div>
            <i class="fas fa-trash-alt" style="color:var(--danger); cursor:pointer" onclick="deleteTask(${t.id})"></i>
        `;
        grid.appendChild(div);
    });
}

function updateAnalytics() {
    const total = tasks.length;
    const done = tasks.filter(t => t.done).length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    document.getElementById('stat-total').innerText = total;
    document.getElementById('stat-efficiency').innerText = pct + '%';
    document.getElementById('ring-pct').innerText = pct + '%';
    document.getElementById('ring').style.strokeDashoffset = 377 - (377 * pct) / 100;
}

document.getElementById('timer-start').onclick = function() {
    if(timer) { clearInterval(timer); timer = null; this.innerText = 'Start Focus'; }
    else {
        timer = setInterval(() => {
            timeLeft--;
            const m = Math.floor(timeLeft / 60); const s = timeLeft % 60;
            document.getElementById('timer-display').innerText = `${m}:${s < 10 ? '0' : ''}${s}`;
        }, 1000);
        this.innerText = 'Pause';
    }
};

function toggleTheme() {
    document.body.setAttribute('data-theme', document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
}

init();
