const { createClient } = supabase;
const sb = createClient(
    "https://ygddhfvjndsggrvxllov.supabase.co",
    "sb_publishable_rLRI3_s6y-Z592cPNy0q7w_gMuhcSex"
);

let currentUser = null;
let articleId = null;
let hasLiked = false;

articleId = sessionStorage.getItem("openArticleId");
sessionStorage.removeItem("openArticleId");

if (!articleId) window.location.href = "feed.html";

sb.auth.getSession().then(({ data: { session } }) => {
    currentUser = session?.user || null;
    applyAuthUI();
    loadArticle();
});

function applyAuthUI() {
    const userEl = document.getElementById("top-user");
    if (currentUser) {
        const name = currentUser.user_metadata?.full_name || currentUser.email.split("@")[0];
        userEl.style.display = "inline";
        userEl.textContent = name;
    }
}

async function loadArticle() {
    const { data: article, error } = await sb
        .from("articles")
        .select("*")
        .eq("id", articleId)
        .single();

    console.log("articleId:", articleId);
    console.log("article:", article);
    console.log("error:", error);


    if (error || !article) {
        window.location.href = "feed.html";
        return;

    }


    // Increment view count
    try { await sb.rpc("increment_views", { article_id: articleId }); } catch (_) { }

    // Render
    document.title = article.title || "Article";
    document.getElementById("meta-author").textContent = article.author_name || "Anonymous";
    document.getElementById("meta-date").textContent = formatDate(article.published_at);
    document.getElementById("meta-words").textContent = countWords(article.body) + " words";
    document.getElementById("article-title").textContent = article.title || "Untitled";
    document.getElementById("article-body").innerHTML = renderMarkdown(article.body || "");
    document.getElementById("like-count").textContent = article.likes ?? 0;
    document.getElementById("view-count").textContent = `${(article.views ?? 0) + 1} views`;

    // Check if current user already liked
    if (currentUser) {
        const { data: likeRow } = await sb
            .from("article_likes")
            .select("user_id")
            .eq("article_id", articleId)
            .eq("user_id", currentUser.id)
            .maybeSingle();
        if (likeRow) {
            hasLiked = true;
            document.getElementById("btn-like").classList.add("liked");
        }
    }
}

// ── LIKE ──────────────────────────────────────────────────────────────────
document.getElementById("btn-like").addEventListener("click", async () => {
    if (!currentUser) {
        window.location.href = `auth.html?next=${encodeURIComponent(location.pathname + location.search)}`;
        return;
    }

    const btn = document.getElementById("btn-like");
    const countEl = document.getElementById("like-count");
    const current = parseInt(countEl.textContent) || 0;

    if (!hasLiked) {
        hasLiked = true;
        btn.classList.add("liked");
        countEl.textContent = current + 1;
        await sb.from("article_likes").insert({ user_id: currentUser.id, article_id: articleId });
    } else {
        hasLiked = false;
        btn.classList.remove("liked");
        countEl.textContent = Math.max(0, current - 1);
        await sb.from("article_likes").delete()
            .eq("user_id", currentUser.id)
            .eq("article_id", articleId);
    }
});

// ── MARKDOWN RENDERER ─────────────────────────────────────────────────────
function escHtml(s) {
    return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function applyInline(s) {
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/__([^_]+)__/g, '<u>$1</u>');
    s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    s = s.replace(/_([^_]+)_/g, '<em>$1</em>');
    s = s.replace(/~~([^~]+)~~/g, '<s>$1</s>');
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return s;
}

function renderMarkdown(raw) {
    const lines = raw.split("\n");
    let html = "";
    let inList = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let s = escHtml(line);

        if (/^### (.+)/.test(s)) {
            if (inList) { html += "</ul>"; inList = false; }
            html += s.replace(/^### (.+)/, (_, t) => `<h3>${applyInline(t)}</h3>`);
        } else if (/^## (.+)/.test(s)) {
            if (inList) { html += "</ul>"; inList = false; }
            html += s.replace(/^## (.+)/, (_, t) => `<h2>${applyInline(t)}</h2>`);
        } else if (/^# (.+)/.test(s)) {
            if (inList) { html += "</ul>"; inList = false; }
            html += s.replace(/^# (.+)/, (_, t) => `<h1>${applyInline(t)}</h1>`);
        } else if (/^-# (.+)/.test(s)) {
            if (inList) { html += "</ul>"; inList = false; }
            html += s.replace(/^-# (.+)/, (_, t) => `<span class="subtext">${applyInline(t)}</span>`);
        } else if (/^&gt; (.+)/.test(s)) {
            if (inList) { html += "</ul>"; inList = false; }
            html += s.replace(/^&gt; (.+)/, (_, t) => `<blockquote>${applyInline(t)}</blockquote>`);
        } else if (/^[*-] (.+)/.test(s)) {
            if (!inList) { html += "<ul>"; inList = true; }
            html += s.replace(/^[*-] (.+)/, (_, t) => `<li>${applyInline(t)}</li>`);
        } else {
            if (inList) { html += "</ul>"; inList = false; }
            html += `<div>${applyInline(s) || "<br>"}</div>`;
        }
    }

    if (inList) html += "</ul>";
    return html;
}

// ── HELPERS ───────────────────────────────────────────────────────────────
function formatDate(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function countWords(body) {
    if (!body) return 0;
    return body.trim().split(/\s+/).filter(Boolean).length;
}