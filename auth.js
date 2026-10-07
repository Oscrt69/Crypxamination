// Ini adalah file untuk mengatur Login dan Registrasi menggunakan SUPABASE

import { supabaseUrl, supabase } from './supabaseConfig.js';

// Elemen UI
const roleTabs = document.querySelectorAll('.role-tab');
const loginBtn = document.getElementById('login-btn');
const toggleAuth = document.getElementById('toggle-auth');
const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const confirmPasswordGroup = document.getElementById('confirm-password-group');
const confirmPasswordInput = document.getElementById('confirm-password');
const errorMsg = document.getElementById('error-msg');
const successMsg = document.getElementById('success-msg');

function showSuccess(msg) {
    errorMsg.style.display = 'none';
    successMsg.textContent = msg;
    successMsg.style.display = 'block';
}

function showError(msg) {
    successMsg.style.display = 'none';
    errorMsg.textContent = msg;
    errorMsg.style.display = 'block';
}

let currentRole = 'murid';
let isLoginMode = true; // true = login, false = register

// Logika Ganti Role
roleTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        roleTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentRole = tab.dataset.role;
        updateUI();
    });
});

toggleAuth.addEventListener('click', (e) => {
    e.preventDefault();
    isLoginMode = !isLoginMode;
    updateUI();
});

function updateUI() {
    errorMsg.style.display = 'none';
    successMsg.style.display = 'none';

    const roleText = currentRole === 'murid' ? 'Murid' : 'Guru';

    if (isLoginMode) {
        loginBtn.textContent = `Login sebagai ${roleText}`;
        confirmPasswordGroup.style.display = 'none';
        confirmPasswordInput.required = false;
        toggleAuth.parentElement.innerHTML = `Belum punya akun? <a href="#" id="toggle-auth">Daftar sekarang</a>`;
    } else {
        loginBtn.textContent = `Daftar sebagai ${roleText}`;
        confirmPasswordGroup.style.display = 'block';
        confirmPasswordInput.required = true;
        toggleAuth.parentElement.innerHTML = `Sudah punya akun? <a href="#" id="toggle-auth">Login di sini</a>`;
    }

    document.getElementById('toggle-auth').addEventListener('click', (e) => {
        e.preventDefault();
        isLoginMode = !isLoginMode;
        updateUI();
    });
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!supabaseUrl || !supabaseUrl.startsWith("http")) {
        showError("Mohon masukkan URL dan Key Supabase terlebih dahulu di file auth.js!");
        return;
    }

    const email = emailInput.value;
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (!isLoginMode && password !== confirmPassword) {
        showError("Password dan Konfirmasi Password tidak cocok.");
        return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = "Loading...";

    try {
        if (isLoginMode) {
            // PROSES LOGIN
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (error) throw error;

            // Supabase menyimpan custom data (role) di dalam user_metadata
            const userRole = data.user.user_metadata?.role;

            if (userRole !== currentRole) {
                showError(`Akun ini terdaftar sebagai ${userRole || 'Murid'}, bukan ${currentRole}.`);
                await supabase.auth.signOut();
            } else {
                localStorage.setItem('userRole', userRole);
                localStorage.setItem('userEmail', data.user.email);
                window.location.href = "index.html";
            }
        } else {
            // PROSES REGISTER
            const { data, error } = await supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        role: currentRole
                    }
                }
            });

            if (error) throw error;

            isLoginMode = true;
            emailInput.value = '';
            passwordInput.value = '';
            confirmPasswordInput.value = '';

            showSuccess(`Pendaftaran berhasil! Silakan login untuk melanjutkan.`);
        }
    } catch (error) {
        console.error(error);
        if (error.message.includes("Invalid login credentials")) {
            showError("Email atau Password salah.");
        } else if (error.message.includes("User already registered") || error.message.includes("already registered")) {
            showError("Email sudah digunakan.");
        } else {
            showError("Terjadi kesalahan: " + error.message);
        }
    } finally {
        loginBtn.disabled = false;
        const roleText = currentRole === 'murid' ? 'Murid' : 'Guru';
        loginBtn.textContent = isLoginMode ? `Login sebagai ${roleText}` : `Daftar sebagai ${roleText}`;
    }
});
