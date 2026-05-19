const { createClient } = supabase;
const sb = createClient(
    "https://ygddhfvjndsggrvxllov.supabase.co",
    "sb_publishable_rLRI3_s6y-Z592cPNy0q7w_gMuhcSex"
);

let currentUser  = null;
let allArticles  = [];
let currentSort  = "newest";
let authorFilter = "";

// ── AUTH ──────────────────────────────────────────────────────────────────
sb.auth.getSession().then(({ data: { session } }) => {
    currentUser = session?.user || null;
    applyAuthUI();
    loadFeed();
});

function applyAuthUI() {
    const signInBtn  = document.getElementById("btn-account-nav");
    const userLabel  = document.getElementById("btn-user-name");
    if (currentUser) {
        const name = currentUser.user_metadata?.full_name || currentUser.email.split("@")[0];
        signInBtn.style.display  = "none";
        userLabel.style.display  = "inline";
        userLabel.textContent    = name;
    } else {
        signInBtn.style.display  = "inline";
        userLabel.style.display  = "none";
    }
}

// ── LOAD FEED ─────────────────────────────────────────────────────────────
async function loadFeed() {
    showLoading(true);

    const { data, error } = await sb
        .from("articles")
        .select("id, title, body, published_at, views, likes, user_id")
        .eq("is_published", true)
        .order("published_at", { ascending: false });

    showLoading(false);

    if (error || !data || data.length === 0) {
        document.getElementById("feed-empty").style.display = "block";
        document.getElementById("hero-banner").style.display = "none";
        return;
    }

    // Fetch author names from profiles (user metadata via a view or fallback)
    // We store full_name in auth.users.raw_user_meta_data — we'll use a helper RPC
    // or fall back to fetching from our own profiles if they exist.
    // For now we embed author_name at publish time (see main.js), so it's in the row.
    allArticles = data;
    renderHero(data[0]);
    renderGrid(data.slice(1));
}

// ── HERO ──────────────────────────────────────────────────────────────────
function renderHero(article) {
    const hero = document.getElementById("hero-banner");
    hero.style.display = "flex";

    document.getElementById("hero-author").textContent = article.author_name || "Anonymous";
    document.getElementById("hero-date").textContent   = formatDate(article.published_at);
    document.getElementById("hero-title").textContent  = article.title || "Untitled";
    document.getElementById("hero-excerpt").textContent = excerpt(article.body, 180);
    document.getElementById("hero-views").textContent  = `${article.views ?? 0} views`;
    document.getElementById("hero-likes").textContent  = `${article.likes ?? 0} likes`;

    const readBtn = document.getElementById("hero-read-btn");
    readBtn.href  = `article.html?id=${article.id}`;

    hero.addEventListener("click", (e) => {
        if (e.target === readBtn || readBtn.contains(e.target)) return;
        window.location.href = `article.html?id=${article.id}`;
    });

    // Decorative bg color based on title hash
    document.getElementById("hero-bg").style.background = titleColor(article.title);
}

// ── GRID ──────────────────────────────────────────────────────────────────
const LAYOUT_PATTERN = [
    "card-wide", "card-tall",
    "card-regular", "card-regular", "card-regular",
    "card-half", "card-half",
    "card-regular", "card-regular", "card-regular",
];

function renderGrid(articles) {
    const grid = document.getElementById("card-grid");
    grid.innerHTML = "";

    if (articles.length === 0) {
        document.getElementById("feed-empty").style.display = "block";
        return;
    }

    document.getElementById("feed-empty").style.display = "none";

    articles.forEach((article, i) => {
        const cls   = LAYOUT_PATTERN[i % LAYOUT_PATTERN.length];
        const card  = buildCard(article, cls, i);
        grid.appendChild(card);
    });
}

function buildCard(article, cls, index) {
    const card = document.createElement("a");
    card.className = `card ${cls}`;
    card.href = `article.html?id=${article.id}`;
    card.style.animationDelay = `${index * 0.06}s`;

    const authorInitial = (article.author_name || "A")[0].toUpperCase();
    const readTime = estimateReadTime(article.body);

    card.innerHTML = `
        <div class="card-accent-bar"></div>
        <div class="card-body">
            <div class="card-author-row">
                <div class="card-avatar" style="background:${avatarColor(article.author_name)}">${authorInitial}</div>
                <span class="card-author">${escHtml(article.author_name || "Anonymous")}</span>
                <span class="card-date">${formatDate(article.published_at)}</span>
            </div>
            <div class="card-title">${escHtml(article.title || "Untitled")}</div>
            <div class="card-excerpt">${escHtml(excerpt(article.body, 160))}</div>
        </div>
        <div class="card-footer">
            <span class="card-stat">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                ${article.views ?? 0}
            </span>
            <span class="card-stat">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                ${article.likes ?? 0}
            </span>
            <span class="card-read-time">${readTime} min read</span>
        </div>
    `;

    return card;
}

// ── FILTER & SORT ─────────────────────────────────────────────────────────
document.querySelectorAll(".sort-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".sort-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        currentSort = btn.dataset.sort;
        applyFilterSort();
    });
});

document.getElementById("filter-author").addEventListener("input", (e) => {
    authorFilter = e.target.value.trim().toLowerCase();
    applyFilterSort();
});

function applyFilterSort() {
    let articles = [...allArticles];

    if (authorFilter) {
        articles = articles.filter(a =>
            (a.author_name || "").toLowerCase().includes(authorFilter)
        );
    }

    if (currentSort === "newest") {
        articles.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
    } else if (currentSort === "views") {
        articles.sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
    } else if (currentSort === "likes") {
        articles.sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0));
    }

    if (articles.length > 0) {
        renderHero(articles[0]);
        renderGrid(articles.slice(1));
    } else {
        document.getElementById("hero-banner").style.display = "none";
        renderGrid([]);
    }
}

// ── HELPERS ───────────────────────────────────────────────────────────────
function showLoading(on) {
    document.getElementById("feed-loading").classList.toggle("hidden", !on);
}

function formatDate(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function excerpt(body, maxLen) {
    if (!body) return "";
    // Strip markdown symbols
    const plain = body
        .replace(/#{1,6} /g, "")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/\*([^*]+)\*/g, "$1")
        .replace(/~~([^~]+)~~/g, "$1")
        .replace(/__([^_]+)__/g, "$1")
        .replace(/_([^_]+)_/g, "$1")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/^[>-] /gm, "")
        .replace(/\n+/g, " ")
        .trim();
    return plain.length > maxLen ? plain.slice(0, maxLen).trimEnd() + "…" : plain;
}

function estimateReadTime(body) {
    if (!body) return 1;
    const words = body.trim().split(/\s+/).length;
    return Math.max(1, Math.round(words / 200));
}

function escHtml(s) {
    return (s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function titleColor(title) {
    // Generate a muted dark color from the title string
    let hash = 0;
    for (let i = 0; i < (title || "").length; i++) hash = title.charCodeAt(i) + ((hash << 5) - hash);
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 25%, 18%)`;
}

function avatarColor(name) {
    let hash = 0;
    for (let i = 0; i < (name || "").length; i++) hash = (name || "").charCodeAt(i) + ((hash << 5) - hash);
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 40%, 30%)`;
}