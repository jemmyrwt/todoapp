
let isLogin = true;
const API_AUTH = '/api/auth';
const API_TODO = '/api/todos';

// Check if user is already logged in
if (localStorage.getItem('token')) {
    showApp();
}

function toggleAuth() {
    isLogin = !isLogin;
    document.getElementById('auth-title').innerText = isLogin ? "Welcome Back" : "Create Account";
    document.getElementById('register-fields').style.display = isLogin ? "none" : "block";
    document.getElementById('auth-btn').innerText = isLogin ? "Sign In" : "Register";
}

async function handleAuth() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-pass').value;
    const name = document.getElementById('reg-name').value;

    const endpoint = isLogin ? `${API_AUTH}/login` : `${API_AUTH}/register`;
    const body = isLogin ? { email, password } : { name, email, password };

    const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    const data = await res.json();
    if (res.ok) {
        if (isLogin) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('userName', data.name);
            showApp();
        } else {
            alert("Registration Successful! Please Login.");
            toggleAuth();
        }
    } else {
        alert(data.error);
    }
}

function showApp() {
    document.getElementById('auth-page').style.display = 'none';
    document.getElementById('main-app').style.display = 'block';
    document.getElementById('user-display-name').innerText = localStorage.getItem('userName');
    fetchTasks();
}

function logout() {
    localStorage.clear();
    location.reload();
}

// Update fetchTasks to send Token
async function fetchTasks() {
    const res = await fetch(API_TODO, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    // ... rest of the render logic
}
