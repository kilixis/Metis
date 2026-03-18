const { createClient } = supabase;
const sb = createClient(
    "https://ygddhfvjndsggrvxllov.supabase.co",
    "sb_publishable_rLRI3_s6y-Z592cPNy0q7w_gMuhcSex"
);

let currentUser = null;

sb.auth.getSession().then(({ data: { session } }) => {
    if (!session) {
        window.location.href = "auth.html";
    } else {
        currentUser = session.user;
        init();
    }
});

sb.auth.onAuthStateChange((_event, session) => {
    if (!session) window.location.href = "auth.html";
});

const titleInput    = document.getElementById("title");
const editor        = document.getElementById("editor");
const preview       = document.getElementById("preview");
const toggle        = document.getElementById("md-toggle");
const sidebar       = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebar-toggle");
const overlay       = document.getElementById("sidebar-overlay");
const noteList      = document.getElementById("note-list");
const newNoteBtn    = document.getElementById("new-note");

let currentId   = null;
let saveTimeout = null;

function genId() {
    return "note-" + Date.now();
}

function getNotes() {
    return JSON.parse(localStorage.getItem("notes") || "{}");
}

function saveNotesLocal(notes) {
    localStorage.setItem("notes", JSON.stringify(notes));
}

async function saveCurrentNote() {
    if (!currentId) return;
    const notes = getNotes();
    notes[currentId] = {
        id: currentId,
        title: titleInput.value,
        body: editor.value,
        updated: Date.now()
    };
    saveNotesLocal(notes);
    renderNoteList();

    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        await sb.from("notes").upsert({
            id: currentId,
            user_id: currentUser.id,
            title: titleInput.value,
            body: editor.value,
            updated: Date.now()
        });
    }, 800);
}

function loadNote(id) {
    const notes = getNotes();
    const note = notes[id];
    if (!note) return;
    currentId = id;
    titleInput.value = note.title;
    editor.value = note.body;
    document.title = note.title.trim() || "New note";
    editor.style.height = "auto";
    editor.style.height = editor.scrollHeight + "px";
    renderNoteList();
}

function createNote() {
    const id = genId();
    const notes = getNotes();
    notes[id] = { id, title: "", body: "", updated: Date.now() };
    saveNotesLocal(notes);
    loadNote(id);
}

function deleteNote(id) {
    const notes = getNotes();
    delete notes[id];
    saveNotesLocal(notes);
    sb.from("notes").delete().eq("id", id);
    const remaining = Object.keys(getNotes());
    if (remaining.length === 0) {
        createNote();
    } else {
        loadNote(Object.values(getNotes()).sort((a, b) => b.updated - a.updated)[0].id);
    }
}

function renderNoteList() {
    const notes = getNotes();
    const sorted = Object.values(notes).sort((a, b) => b.updated - a.updated);
    noteList.innerHTML = "";
    sorted.forEach(note => {
        const item = document.createElement("div");
        item.className = "note-item" + (note.id === currentId ? " active" : "");

        const label = document.createElement("span");
        label.className = "note-label";
        label.textContent = note.title.trim() || "Untitled";
        label.addEventListener("click", () => { loadNote(note.id); closeSidebar(); });

        const del = document.createElement("button");
        del.className = "note-delete";
        del.textContent = "×";
        del.addEventListener("click", (e) => { e.stopPropagation(); deleteNote(note.id); });

        item.appendChild(label);
        item.appendChild(del);
        noteList.appendChild(item);
    });
}

function openSidebar() {
    sidebar.classList.add("open");
    overlay.classList.add("visible");
}

function closeSidebar() {
    sidebar.classList.remove("open");
    overlay.classList.remove("visible");
}

sidebarToggle.addEventListener("click", openSidebar);
overlay.addEventListener("click", closeSidebar);
newNoteBtn.addEventListener("click", createNote);

titleInput.addEventListener("input", () => {
    document.title = titleInput.value.trim() || "New note";
    saveCurrentNote();
});

editor.addEventListener("input", () => {
    saveCurrentNote();
    editor.style.height = "auto";
    editor.style.height = editor.scrollHeight + "px";
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

async function init() {
    const { data: remoteNotes } = await sb
        .from("notes")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("updated", { ascending: false });

    if (remoteNotes && remoteNotes.length > 0) {
        const notesObj = {};
        remoteNotes.forEach(n => { notesObj[n.id] = n; });
        saveNotesLocal(notesObj);
    }

    const notes = getNotes();
    const existing = Object.keys(notes);
    if (existing.length === 0) {
        createNote();
    } else {
        loadNote(Object.values(notes).sort((a, b) => b.updated - a.updated)[0].id);
    }
}

const island      = document.getElementById("island");
const btnShare    = document.getElementById("btn-share");
const btnFormat   = document.getElementById("btn-format");
const btnAccount  = document.getElementById("btn-account");
const panelShare  = document.getElementById("panel-share");
const panelFormat = document.getElementById("panel-format");
const panelAccount = document.getElementById("panel-account");

const panels = [
    { btn: btnShare,   panel: panelShare,   cls: "expanded-share" },
    { btn: btnFormat,  panel: panelFormat,  cls: "expanded-format" },
    { btn: btnAccount, panel: panelAccount, cls: "expanded-account" },
];

function openPanel(targetPanel, targetBtn, cls) {
    const alreadyOpen = targetPanel.classList.contains("visible");
    closeAllPanels();
    if (!alreadyOpen) {
        targetBtn.classList.add("collapsed");
        targetPanel.classList.add("visible");
        island.classList.add(cls);
    }
}

function closeAllPanels() {
    panels.forEach(({ btn, panel, cls }) => {
        btn.classList.remove("active", "collapsed");
        panel.classList.remove("visible");
        island.classList.remove(cls);
    });
}

btnShare.addEventListener("click",   () => openPanel(panelShare,   btnShare,   "expanded-share"));
btnFormat.addEventListener("click",  () => openPanel(panelFormat,  btnFormat,  "expanded-format"));
btnAccount.addEventListener("click", () => openPanel(panelAccount, btnAccount, "expanded-account"));

document.addEventListener("click", (e) => {
    if (!island.contains(e.target)) closeAllPanels();
});

document.querySelectorAll(".fmt-btn, .island-btn, .panel-item").forEach(el => {
    el.addEventListener("mousedown", (e) => e.preventDefault());
});

function insertAround(before, after) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selected = editor.value.slice(start, end);
    editor.setRangeText(before + selected + after, start, end, "select");
    editor.dispatchEvent(new Event("input"));
}

function insertLinePrefix(prefix) {
    const start = editor.selectionStart;
    const lineStart = editor.value.lastIndexOf("\n", start - 1) + 1;
    const alreadyHas = editor.value.slice(lineStart).startsWith(prefix);
    if (alreadyHas) {
        editor.setRangeText("", lineStart, lineStart + prefix.length, "end");
    } else {
        editor.setRangeText(prefix, lineStart, lineStart, "end");
    }
    editor.dispatchEvent(new Event("input"));
}

document.querySelectorAll(".fmt-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        if (action === "bold")            insertAround("**", "**");
        else if (action === "italic")     insertAround("*", "*");
        else if (action === "underline")  insertAround("__", "__");
        else if (action === "strikethrough") insertAround("~~", "~~");
        else if (action === "code")       insertAround("`", "`");
        else if (action === "h1")         insertLinePrefix("# ");
        else if (action === "h2")         insertLinePrefix("## ");
        else if (action === "h3")         insertLinePrefix("### ");
        else if (action === "bullet")     insertLinePrefix("- ");
        else if (action === "blockquote") insertLinePrefix("> ");
        else if (action === "subtext")    insertLinePrefix("-# ");
    });
});

function getFilename(ext) {
    return (titleInput.value.trim() || "note") + "." + ext;
}

document.getElementById("action-download-md").addEventListener("click", () => {
    const blob = new Blob([editor.value], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = getFilename("md");
    a.click();
});

document.getElementById("action-download-txt").addEventListener("click", () => {
    const plain = editor.value.replace(/[*_~`>#-]/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
    const blob = new Blob([plain], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = getFilename("txt");
    a.click();
});

document.getElementById("action-download-pdf").addEventListener("click", () => {
    window.print();
});

document.getElementById("action-copy-link").addEventListener("click", () => {
    navigator.clipboard.writeText(window.location.href);
});

const settingsPanel   = document.getElementById("settings-panel");
const settingsOverlay = document.getElementById("settings-overlay");
const settingsClose   = document.getElementById("settings-close");
const settingsEmail   = document.getElementById("settings-user-email");

function openSettings() {
    settingsEmail.textContent = currentUser?.email || "";
    settingsPanel.classList.add("open");
    settingsOverlay.classList.add("visible");
    closeAllPanels();
}

function closeSettings() {
    settingsPanel.classList.remove("open");
    settingsOverlay.classList.remove("visible");
}

document.getElementById("action-settings").addEventListener("click", openSettings);
settingsClose.addEventListener("click", closeSettings);
settingsOverlay.addEventListener("click", closeSettings);

document.getElementById("action-signin").addEventListener("click", () => {
    window.location.href = "auth.html";
});

document.getElementById("action-signout").addEventListener("click", async () => {
    await sb.auth.signOut();
    localStorage.removeItem("notes");
    window.location.href = "auth.html";
});

document.getElementById("btn-change-password").addEventListener("click", async () => {
    const btn = document.getElementById("btn-change-password");
    await sb.auth.resetPasswordForEmail(currentUser.email);
    btn.textContent = "Email sent!";
    setTimeout(() => { btn.textContent = "Send reset email"; }, 3000);
});

let fontSize   = parseInt(localStorage.getItem("editor-font-size") || "19");
let lineHeight = parseFloat(localStorage.getItem("editor-line-height") || "1.6");

function applyEditorPrefs() {
    editor.style.fontSize    = fontSize + "px";
    preview.style.fontSize   = fontSize + "px";
    editor.style.lineHeight  = lineHeight;
    preview.style.lineHeight = lineHeight;
    document.getElementById("font-size-label").textContent = fontSize;
    document.getElementById("lh-label").textContent        = lineHeight.toFixed(1);
    localStorage.setItem("editor-font-size",   fontSize);
    localStorage.setItem("editor-line-height", lineHeight);
}

applyEditorPrefs();

document.getElementById("font-increase").addEventListener("click", () => { if (fontSize < 32) { fontSize++;  applyEditorPrefs(); } });
document.getElementById("font-decrease").addEventListener("click", () => { if (fontSize > 12) { fontSize--;  applyEditorPrefs(); } });
document.getElementById("lh-increase").addEventListener("click",  () => { if (lineHeight < 3.0) { lineHeight = Math.round((lineHeight + 0.1) * 10) / 10; applyEditorPrefs(); } });
document.getElementById("lh-decrease").addEventListener("click",  () => { if (lineHeight > 1.0) { lineHeight = Math.round((lineHeight - 0.1) * 10) / 10; applyEditorPrefs(); } });

const spellcheckToggle = document.getElementById("spellcheck-toggle");
spellcheckToggle.checked = localStorage.getItem("spellcheck") !== "false";
editor.spellcheck = spellcheckToggle.checked;

spellcheckToggle.addEventListener("change", () => {
    editor.spellcheck = spellcheckToggle.checked;
    localStorage.setItem("spellcheck", spellcheckToggle.checked);
});

document.getElementById("btn-delete-notes").addEventListener("click", async () => {
    if (!confirm("Delete all notes? This cannot be undone.")) return;
    await sb.from("notes").delete().eq("user_id", currentUser.id);
    localStorage.removeItem("notes");
    createNote();
    closeSettings();
});

document.getElementById("btn-delete-account").addEventListener("click", async () => {
    if (!confirm("Permanently delete your account and all data? This cannot be undone.")) return;
    await sb.from("notes").delete().eq("user_id", currentUser.id);
    await sb.rpc("delete_own_account");
    await sb.auth.signOut();
    localStorage.clear();
    window.location.href = "auth.html";
});