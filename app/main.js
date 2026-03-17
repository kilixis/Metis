const titleInput = document.getElementById("title");
const editor = document.getElementById("editor");
const preview = document.getElementById("preview");
const toggle = document.getElementById("md-toggle");

titleInput.addEventListener("input", () => {
    document.title = titleInput.value.trim() || "New note";
});

editor.addEventListener("input", () => {
    const overflow = editor.getBoundingClientRect().bottom - (window.innerHeight * 0.98);
    if (overflow > 0) window.scrollBy({ top: overflow, behavior: "instant" });
});

function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function applyInline(s) {
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/__([^_]+)__/g, '<u>$1</u>');
    s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    s = s.replace(/_([^_]+)_/g, '<em>$1</em>');
    s = s.replace(/~~([^~]+)~~/g, '<s>$1</s>');
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    return s;
}

function renderLine(line) {
    let s = escapeHtml(line);

    if (/^### (.+)/.test(s)) return s.replace(/^### (.+)/, (_, t) => `<h3>${applyInline(t)}</h3>`);
    if (/^## (.+)/.test(s))  return s.replace(/^## (.+)/,  (_, t) => `<h2>${applyInline(t)}</h2>`);
    if (/^# (.+)/.test(s))   return s.replace(/^# (.+)/,   (_, t) => `<h1>${applyInline(t)}</h1>`);
    if (/^-# (.+)/.test(s))  return s.replace(/^-# (.+)/,  (_, t) => `<span class="subtext">${applyInline(t)}</span>`);
    if (/^&gt; (.+)/.test(s)) return s.replace(/^&gt; (.+)/, (_, t) => `<blockquote>${applyInline(t)}</blockquote>`);
    if (/^[*-] (.+)/.test(s)) return s.replace(/^[*-] (.+)/, (_, t) => `<li>${applyInline(t)}</li>`);

    s = applyInline(s);
    return `<div>${s || '<br>'}</div>`;
}

function renderPreview() {
    const lines = editor.value.split('\n');
    preview.innerHTML = lines.map(renderLine).join('');
}

toggle.addEventListener("change", () => {
    if (toggle.checked) {
        renderPreview();
        editor.style.display = "none";
        preview.style.display = "block";
    } else {
        editor.style.display = "block";
        preview.style.display = "none";
        editor.focus();
    }
});