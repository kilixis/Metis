const { createClient } = supabase;
const sb = createClient(
    "https://ygddhfvjndsggrvxllov.supabase.co",
    "sb_publishable_rLRI3_s6y-Z592cPNy0q7w_gMuhcSex"
);

let currentUser = null;

const titleInput    = document.getElementById("title");
const editor        = document.getElementById("editor");
const preview       = document.getElementById("preview");
const toggle        = document.getElementById("md-toggle");
const sidebar       = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebar-toggle");
const overlay       = document.getElementById("sidebar-overlay");
const noteList      = document.getElementById("note-list");
const newNoteBtn    = document.getElementById("new-note");

const darkToggle = document.getElementById("dark-mode-toggle");
if (localStorage.getItem("dark-mode") === "true") {
    document.documentElement.setAttribute("data-theme", "dark");
    darkToggle.checked = true;
}
darkToggle.addEventListener("change", () => {
    if (darkToggle.checked) {
        document.documentElement.setAttribute("data-theme", "dark");
        localStorage.setItem("dark-mode", "true");
    } else {
        document.documentElement.removeAttribute("data-theme");
        localStorage.setItem("dark-mode", "false");
    }
});

function applyAuthUI() {
    const signedIn = !!currentUser;
    document.getElementById("action-signin").style.display            = signedIn ? "none" : "flex";
    document.getElementById("action-signout").style.display           = signedIn ? "flex" : "none";
    document.getElementById("settings-account-section").style.display = signedIn ? "block" : "none";
    document.getElementById("settings-danger-section").style.display  = signedIn ? "block" : "none";
}

sb.auth.getSession().then(({ data: { session } }) => {
    currentUser = session?.user || null;
    applyAuthUI();
    checkIncomingShare().then((handled) => {
        if (!handled) {
            if (currentUser) { syncAndInit(); } else { localInit(); }
        } else {
            renderNoteList();
        }
    });
});

sb.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user || null;
    applyAuthUI();
});

let currentId   = null;
let saveTimeout = null;

function genId() { return "note-" + Date.now(); }
function getNotes() { return JSON.parse(localStorage.getItem("notes") || "{}"); }
function saveNotesLocal(notes) { localStorage.setItem("notes", JSON.stringify(notes)); }

function saveCurrentNote() {
    if (!currentId) return;
    const notes = getNotes();
    notes[currentId] = {
        id: currentId,
        title: titleInput.value,
        body: editor.value,
        updated: Date.now(),
        shared: notes[currentId]?.shared || false
    };
    saveNotesLocal(notes);
    renderNoteList();
    if (!currentUser) return;
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        await sb.from("notes").upsert({
            id: currentId, user_id: currentUser.id,
            title: titleInput.value, body: editor.value, updated: Date.now()
        });
    }, 800);
}

const wordCountEl = document.getElementById("word-count");

function updateWordCount() {
    const text = editor.value.trim();
    const count = text === "" ? 0 : text.split(/\s+/).length;
    wordCountEl.textContent = count === 1 ? "1 word" : `${count} words`;
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
    updateWordCount();
}

function createNote() {
    const id = genId();
    const notes = getNotes();
    notes[id] = { id, title: "", body: "", updated: Date.now(), shared: false };
    saveNotesLocal(notes);
    loadNote(id);
}

function deleteNote(id) {
    const notes = getNotes();
    delete notes[id];
    saveNotesLocal(notes);
    if (currentUser) sb.from("notes").delete().eq("id", id);
    const remaining = Object.keys(getNotes());
    if (remaining.length === 0) { createNote(); }
    else { loadNote(Object.values(getNotes()).sort((a, b) => b.updated - a.updated)[0].id); }
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

        if (note.shared) {
            const icon = document.createElement("span");
            icon.className = "note-shared-icon";
            icon.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`;
            label.appendChild(icon);
        }

        const del = document.createElement("button");
        del.className = "note-delete";
        del.textContent = "×";
        del.addEventListener("click", (e) => { e.stopPropagation(); deleteNote(note.id); });

        item.appendChild(label);
        item.appendChild(del);
        noteList.appendChild(item);
    });
}

function localInit() {
    const notes = getNotes();
    if (Object.keys(notes).length === 0) { createNote(); }
    else { loadNote(Object.values(notes).sort((a, b) => b.updated - a.updated)[0].id); }
}

async function syncAndInit() {
    const { data: remoteNotes } = await sb.from("notes").select("*")
        .eq("user_id", currentUser.id).order("updated", { ascending: false });
    if (remoteNotes && remoteNotes.length > 0) {
        const local = getNotes();
        const notesObj = {};
        remoteNotes.forEach(n => { notesObj[n.id] = { ...n, shared: local[n.id]?.shared || false }; });
        saveNotesLocal(notesObj);
    }
    localInit();
}

async function checkIncomingShare() {
    const params = new URLSearchParams(location.search);
    const shareId = params.get("share");
    if (!shareId) return false;

    const { data: shared, error } = await sb.from("shared_notes").select("*").eq("id", shareId).single();
    if (error || !shared) {
        window.history.replaceState({}, "", location.pathname);
        return false;
    }

    if (shared.mode === "allowlist") {
        if (!currentUser) {
            window.location.href = `auth.html?next=${encodeURIComponent(location.pathname + location.search)}`;
            return true;
        }
        const { data: allowed } = await sb.from("share_allowlist")
            .select("email")
            .eq("shared_note_id", shareId)
            .eq("email", currentUser.email);
        if (!allowed || allowed.length === 0) {
            window.history.replaceState({}, "", location.pathname);
            alert("Your account doesn't have access to this shared note.");
            return false;
        }
    }

    window.history.replaceState({}, "", location.pathname);

    const newId = "note-" + Date.now();
    const notes = getNotes();
    notes[newId] = { id: newId, title: shared.title, body: shared.body, updated: Date.now(), shared: true };
    saveNotesLocal(notes);

    if (currentUser) {
        await sb.from("notes").upsert({
            id: newId, user_id: currentUser.id,
            title: shared.title, body: shared.body, updated: Date.now()
        });
    }

    loadNote(newId);
    return true;
}

function openSidebar() { sidebar.classList.add("open"); overlay.classList.add("visible"); }
function closeSidebar() { sidebar.classList.remove("open"); overlay.classList.remove("visible"); }

sidebarToggle.addEventListener("click", openSidebar);
overlay.addEventListener("click", closeSidebar);
newNoteBtn.addEventListener("click", createNote);

titleInput.addEventListener("input", () => {
    document.title = titleInput.value.trim() || "New note";
    saveCurrentNote();
});

editor.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
        e.preventDefault();
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        editor.setRangeText("    ", start, end, "end");
        editor.dispatchEvent(new Event("input"));
    }
});

editor.addEventListener("input", () => {
    saveCurrentNote();
    editor.style.height = "auto";
    editor.style.height = editor.scrollHeight + "px";
    const overflow = editor.getBoundingClientRect().bottom - (window.innerHeight * 0.98);
    if (overflow > 0) window.scrollBy({ top: overflow, behavior: "instant" });
    updateWordCount();
});

function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
    preview.innerHTML = editor.value.split('\n').map(renderLine).join('');
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

const island       = document.getElementById("island");
const btnShare     = document.getElementById("btn-share");
const btnFormat    = document.getElementById("btn-format");
const btnAccount   = document.getElementById("btn-account");
const panelShare   = document.getElementById("panel-share");
const panelFormat  = document.getElementById("panel-format");
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
    if (alreadyHas) { editor.setRangeText("", lineStart, lineStart + prefix.length, "end"); }
    else { editor.setRangeText(prefix, lineStart, lineStart, "end"); }
    editor.dispatchEvent(new Event("input"));
}

document.querySelectorAll(".fmt-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        const a = btn.dataset.action;
        if (a === "bold")            insertAround("**", "**");
        else if (a === "italic")     insertAround("*", "*");
        else if (a === "underline")  insertAround("__", "__");
        else if (a === "strikethrough") insertAround("~~", "~~");
        else if (a === "code")       insertAround("`", "`");
        else if (a === "h1")         insertLinePrefix("# ");
        else if (a === "h2")         insertLinePrefix("## ");
        else if (a === "h3")         insertLinePrefix("### ");
        else if (a === "bullet")     insertLinePrefix("- ");
        else if (a === "blockquote") insertLinePrefix("> ");
        else if (a === "subtext")    insertLinePrefix("-# ");
    });
});

function getFilename(ext) { return (titleInput.value.trim() || "note") + "." + ext; }

document.getElementById("action-download-md").addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([editor.value], { type: "text/markdown" }));
    a.download = getFilename("md"); a.click();
});

document.getElementById("action-download-txt").addEventListener("click", () => {
    const plain = editor.value.replace(/[*_~`>#-]/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([plain], { type: "text/plain" }));
    a.download = getFilename("txt"); a.click();
});

document.getElementById("action-download-pdf").addEventListener("click", () => window.print());

const shareBackdrop   = document.getElementById("share-backdrop");
const shareModal      = document.getElementById("share-modal");
const shareModalClose = document.getElementById("share-modal-close");
const sharePublic     = document.getElementById("share-public");
const shareAllowlist  = document.getElementById("share-allowlist");
const shareEmailWrap  = document.getElementById("share-email-wrap");
const shareEmailInput = document.getElementById("share-email-input");
const shareEmailTags  = document.getElementById("share-email-tags");
const shareCopyBtn    = document.getElementById("share-copy-btn");

let allowedEmails = [];

function isValidEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

function openShareModal() {
    sharePublic.checked = false;
    shareAllowlist.checked = false;
    allowedEmails = [];
    shareEmailTags.innerHTML = "";
    shareEmailInput.value = "";
    shareEmailWrap.classList.remove("visible");
    shareCopyBtn.disabled = true;
    shareCopyBtn.textContent = "Copy link";
    shareBackdrop.classList.add("visible");
    shareModal.classList.add("visible");
    closeAllPanels();
}

function closeShareModal() {
    shareBackdrop.classList.remove("visible");
    shareModal.classList.remove("visible");
}

document.getElementById("action-copy-link").addEventListener("click", openShareModal);
shareModalClose.addEventListener("click", closeShareModal);
shareBackdrop.addEventListener("click", closeShareModal);

function updateShareCopyBtn() {
    if (sharePublic.checked) { shareCopyBtn.disabled = false; }
    else if (shareAllowlist.checked) { shareCopyBtn.disabled = allowedEmails.length === 0; }
    else { shareCopyBtn.disabled = true; }
}

sharePublic.addEventListener("change", () => {
    if (sharePublic.checked) {
        shareAllowlist.checked = false;
        shareEmailWrap.classList.remove("visible");
    }
    updateShareCopyBtn();
});

shareAllowlist.addEventListener("change", () => {
    if (shareAllowlist.checked) {
        sharePublic.checked = false;
        shareEmailWrap.classList.add("visible");
        shareEmailInput.focus();
    } else {
        shareEmailWrap.classList.remove("visible");
    }
    updateShareCopyBtn();
});

function addEmailTag(email) {
    if (!isValidEmail(email) || allowedEmails.includes(email)) return;
    allowedEmails.push(email);
    const tag = document.createElement("div");
    tag.className = "email-tag";
    tag.innerHTML = `<span>${email}</span><button type="button">×</button>`;
    tag.querySelector("button").addEventListener("click", () => {
        allowedEmails = allowedEmails.filter(e => e !== email);
        tag.remove();
        updateShareCopyBtn();
    });
    shareEmailTags.appendChild(tag);
    updateShareCopyBtn();
}

shareEmailInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        const val = shareEmailInput.value.trim().replace(/,$/, "");
        if (val) { addEmailTag(val); shareEmailInput.value = ""; }
    }
});

shareEmailInput.addEventListener("blur", () => {
    const val = shareEmailInput.value.trim();
    if (val) { addEmailTag(val); shareEmailInput.value = ""; }
});

shareCopyBtn.addEventListener("click", async () => {
    if (!currentId) return;
    const notes = getNotes();
    const note  = notes[currentId];
    if (!note) return;

    shareCopyBtn.textContent = "Creating link…";
    shareCopyBtn.disabled = true;

    const shareId = "share-" + Date.now();
    const mode = sharePublic.checked ? "public" : "allowlist";

    const { error } = await sb.from("shared_notes").insert({
        id: shareId,
        owner_id: currentUser?.id || null,
        note_id: currentId,
        title: note.title,
        body: note.body,
        mode
    });

    if (!error && mode === "allowlist" && allowedEmails.length > 0) {
        await sb.from("share_allowlist").insert(
            allowedEmails.map(email => ({ shared_note_id: shareId, email }))
        );
    }

    if (error) {
        shareCopyBtn.textContent = "Error — try again";
        shareCopyBtn.disabled = false;
        return;
    }

    const url = `${location.origin}${location.pathname}?share=${shareId}`;
    await navigator.clipboard.writeText(url);
    shareCopyBtn.textContent = "Link copied!";
    setTimeout(() => { closeShareModal(); }, 1500);
});

const settingsPanel   = document.getElementById("settings-panel");
const settingsOverlay = document.getElementById("settings-overlay");
const settingsClose   = document.getElementById("settings-close");
const settingsEmail   = document.getElementById("settings-user-email");

function openSettings() {
    if (currentUser) settingsEmail.textContent = currentUser.email;
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

document.getElementById("action-signin").addEventListener("click", () => { window.location.href = "auth.html"; });

document.getElementById("action-signout").addEventListener("click", async () => {
    await sb.auth.signOut();
    localStorage.removeItem("notes");
    window.location.href = "auth.html";
});

document.getElementById("btn-change-password").addEventListener("click", async () => {
    const btn = document.getElementById("btn-change-password");
    if (!currentUser) return;
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
    if (currentUser) await sb.from("notes").delete().eq("user_id", currentUser.id);
    localStorage.removeItem("notes");
    createNote();
    closeSettings();
});

document.getElementById("btn-delete-account").addEventListener("click", async () => {
    if (!confirm("Permanently delete your account and all data? This cannot be undone.")) return;
    if (currentUser) {
        await sb.from("notes").delete().eq("user_id", currentUser.id);
        await sb.rpc("delete_own_account");
    }
    await sb.auth.signOut();
    localStorage.clear();
    window.location.href = "auth.html";
});