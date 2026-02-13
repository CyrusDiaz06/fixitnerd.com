function initIdentity() {
  if (window.netlifyIdentity) {
    window.netlifyIdentity.init();
  }
}

async function getToken() {
  if (!window.netlifyIdentity) {
    throw new Error("Netlify Identity not available.");
  }
  const user = window.netlifyIdentity.currentUser();
  if (!user) {
    throw new Error("Not logged in.");
  }
  return user.jwt();
}

function requireUser(redirectUrl = "/admin/login.html") {
  if (!window.netlifyIdentity) {
    window.location.href = redirectUrl;
    return null;
  }
  const user = window.netlifyIdentity.currentUser();
  if (!user) {
    window.location.href = redirectUrl;
    return null;
  }
  return user;
}

function logout() {
  if (window.netlifyIdentity) {
    window.netlifyIdentity.logout();
  }
}

function openLogin() {
  if (window.netlifyIdentity) {
    window.netlifyIdentity.open();
  }
}

window.Identity = {
  init: initIdentity,
  getToken,
  requireUser,
  logout,
  openLogin,
};

initIdentity();
