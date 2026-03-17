const titleInput = document.getElementById("title");
const editor = document.getElementById("editor");
const preview = document.getElementById("preview");
const toggle = document.getElementById("md-toggle");
const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebar-toggle");
const overlay = document.getElementById("sidebar-overlay");
const noteList = document.getElementById("note-list");
const newNoteBtn = document.getElementById("new-note");

let currentId = null;

function genId() {
    return "note-" + Date.now();
}

function getNotes() {
    return JSON.parse(localStorage.getItem("notes") || "{}");
}

function saveNotes(notes) {
    localStorage.setItem("notes", JSON.stringify(notes));
}

function saveCurrentNote() {
    if (!currentId) return;
    const notes = getNotes();
    notes[currentId] = {
        id: currentId,
        title: titleInput.value,
        body: editor.value,
        updated: Date.now()
    };
    saveNotes(notes);
    renderNoteList();
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
    saveNotes(notes);
    loadNote(id);
}

function deleteNote(id) {
    const notes = getNotes();
    delete notes[id];
    saveNotes(notes);
    const remaining = Object.keys(notes);
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

const notes = getNotes();
const existing = Object.keys(notes);
if (existing.length === 0) {
    createNote();
} else {
    loadNote(Object.values(notes).sort((a, b) => b.updated - a.updated)[0].id);
}