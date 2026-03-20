const { createClient } = supabase;
const sb = createClient(
    "https://ygddhfvjndsggrvxllov.supabase.co",
    "sb_publishable_rLRI3_s6y-Z592cPNy0q7w_gMuhcSex"
);

const authTitle     = document.getElementById("auth-title");
const authSubtitle  = document.getElementById("auth-subtitle");
const authSubmit    = document.getElementById("auth-submit");
const authSwitch    = document.getElementById("auth-switch");
const switchBtn     = document.getElementById("switch-btn");
const fieldName     = document.getElementById("field-name");
const inputName     = document.getElementById("input-name");
const inputEmail    = document.getElementById("input-email");
const inputPassword = document.getElementById("input-password");
const authError     = document.getElementById("auth-error");
const togglePassword = document.getElementById("toggle-password");
const eyeOpen       = document.getElementById("eye-open");
const eyeClosed     = document.getElementById("eye-closed");

let isLogin = true;

function setMode(login) {
    isLogin = login;
    authError.textContent = "";
    authTitle.textContent    = login ? "Welcome back." : "Create an account";
    authSubtitle.textContent = login ? "Sign in to your account to continue." : "Sign up to start writing";
    authSubmit.textContent   = login ? "Sign in" : "Sign up";
    switchBtn.textContent    = login ? "Sign up" : "Sign in";
    authSwitch.firstChild.textContent = login ? "Don't have an account? " : "Already have an account? ";
    if (login) {
        fieldName.classList.add("hidden");
        inputName.value = "";
    } else {
        fieldName.classList.remove("hidden");
    }
}

function getRedirectTarget() {
    const next = new URLSearchParams(location.search).get("next");
    return next ? decodeURIComponent(next) : "main.html";
}

switchBtn.addEventListener("click", () => setMode(!isLogin));

togglePassword.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const isText = inputPassword.type === "text";
    inputPassword.type      = isText ? "password" : "text";
    eyeOpen.style.display   = isText ? "block" : "none";
    eyeClosed.style.display = isText ? "none" : "block";
});

authSubmit.addEventListener("click", async () => {
    authError.textContent = "";
    const email    = inputEmail.value.trim();
    const password = inputPassword.value;
    const name     = inputName.value.trim();

    if (!isLogin && !name) { authError.textContent = "Please enter your name."; return; }
    if (!email || !/\S+@\S+\.\S+/.test(email)) { authError.textContent = "Please enter a valid email."; return; }
    if (!password || password.length < 6) { authError.textContent = "Password must be at least 6 characters."; return; }

    authSubmit.textContent = isLogin ? "Signing in…" : "Creating account…";
    authSubmit.disabled = true;

    if (isLogin) {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) {
            authError.textContent = error.message;
            authSubmit.textContent = "Sign in";
            authSubmit.disabled = false;
        } else {
            window.location.href = getRedirectTarget();
        }
    } else {
        const { error } = await sb.auth.signUp({
            email,
            password,
            options: { data: { full_name: name } }
        });
        if (error) {
            authError.textContent = error.message;
            authSubmit.textContent = "Sign up";
            authSubmit.disabled = false;
        } else {
            window.location.href = getRedirectTarget();
        }
    }
});

document.querySelectorAll(".field input").forEach(input => {
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") authSubmit.click(); });
});

sb.auth.getSession().then(({ data: { session } }) => {
    if (session) window.location.href = getRedirectTarget();
});