const { createClient } = supabase;
const sb = createClient(
    "https://ygddhfvjndsggrvxllov.supabase.co",
    "sb_publishable_rLRI3_s6y-Z592cPNy0q7w_gMuhcSex"
);

let currentUser = null;
let allArticles = [];
let currentSort = "newest";
let authorFilter = "";

sb.auth.getSession().then(({ data: { session } }) => {
    currentUser = session?.user || null;
    applyAuthUI();
    loadFeed();
});

function applyAuthUI() {
    const signInBtn = document.getElementById("btn-account-nav");
    const userLabel = document.getElementById("btn-user-name");
    if (currentUser) {
        const name = currentUser.user_metadata?.full_name || currentUser.email.split("@")[0];
        signInBtn.style.display = "none";
        userLabel.style.display = "inline";
        userLabel.textContent = name;
    } else {
        signInBtn.style.display = "inline";
        userLabel.style.display = "none";
    }
}

async function loadFeed() {
    showLoading(true);
    const { data, error } = await sb
        .from("articles")
        .select("id, title, body, published_at, views, likes, author_name, user_id")
        .eq("is_published", true)
        .order("published_at", { ascending: false });

    showLoading(false);

    if (error || !data || data.length === 0) {
        document.getElementById("feed-empty").style.display = "block";
        return;
    }

    allArticles = data;
    renderList(allArticles);
}

function renderList(articles) {
    const list = document.getElementById("article-list");
    list.innerHTML = "";

    if (articles.length === 0) {
        document.getElementById("feed-empty").style.display = "block";
        return;
    }

    document.getElementById("feed-empty").style.display = "none";

    articles.forEach((article, i) => {
        const row = document.createElement("div");
        row.className = "article-row";
        row.style.animationDelay = `${i * 0.04}s`;
        row.style.cursor = "pointer";
        row.addEventListener("click", () => {
            sessionStorage.setItem("openArticleId", article.id);
            window.location.href = "./article.html";
        });

        const wordCount = countWords(article.body);
        const isAuthor = currentUser && currentUser.id === article.user_id;

        row.innerHTML = `
    <span class="row-title">${escHtml(article.title || "Untitled")}</span>
    <span class="row-date">${formatDate(article.published_at)}</span>
    <span class="row-words">${wordCount} words</span>
    <span class="row-author">${escHtml(article.author_name || "Anonymous")}</span>
    ${isAuthor ? `<button class="row-delete" title="Delete article">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
        </svg>
    </button>` : `<span></span>`}
`;
        if (isAuthor) {
            row.querySelector(".row-delete").addEventListener("click", async (e) => {
                e.stopPropagation();
                const ok = confirm("Are you sure you want to delete this article? This cannot be undone.");
                if (!ok) return;
                const { error } = await sb.from("articles").delete().eq("id", article.id);
                if (!error) row.remove();
            });
        }

        list.appendChild(row);
    });
}

// ── FILTER & SORT ──────────────────────────────────────────────────────────
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

    renderList(articles);
}

// ── HELPERS ────────────────────────────────────────────────────────────────
function showLoading(on) {
    document.getElementById("feed-loading").classList.toggle("hidden", !on);
}

function formatDate(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function countWords(body) {
    if (!body) return 0;
    return body.trim().split(/\s+/).filter(Boolean).length;
}

function escHtml(s) {
    return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}