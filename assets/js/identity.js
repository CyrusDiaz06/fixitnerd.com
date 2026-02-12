export function initIdentity() {
    if (window.netlifyIdentity) {
        window.netlifyIdentity.init();
    }
}

export function getCurrentUser() {
    return window.netlifyIdentity ? window.netlifyIdentity.currentUser() : null;
}

export async function getAuthToken() {
    const user = getCurrentUser();
    if (!user) return null;
    return user.jwt();
}

export async function requireAdminAuth() {
    if (!window.netlifyIdentity) {
        throw new Error('Netlify Identity is not available.');
    }
    window.netlifyIdentity.init();
    const user = window.netlifyIdentity.currentUser();
    if (!user) {
        window.location.href = '/admin/login.html';
        return null;
    }
    return user;
}

export function setupLoginPage() {
    initIdentity();
    const statusEl = document.getElementById('loginStatus');

    if (!window.netlifyIdentity) {
        if (statusEl) statusEl.textContent = 'Netlify Identity is not available.';
        return;
    }

    window.netlifyIdentity.on('login', () => {
        window.location.href = '/admin/queue.html';
    });

    window.netlifyIdentity.on('logout', () => {
        if (statusEl) statusEl.textContent = 'Logged out.';
    });

    if (statusEl) {
        statusEl.textContent = 'Use your admin email to sign in.';
    }
}

export function setupLogoutButton(buttonId = 'logoutBtn') {
    const button = document.getElementById(buttonId);
    if (!button || !window.netlifyIdentity) return;
    button.addEventListener('click', (event) => {
        event.preventDefault();
        window.netlifyIdentity.logout();
        window.location.href = '/admin/login.html';
    });
}

if (document.getElementById('identityWidget')) {
    setupLoginPage();
}
