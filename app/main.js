const titleInput = document.getElementById("title");
const editor = document.getElementById("editor");

titleInput.addEventListener("input", () => {
    document.title = titleInput.value.trim() || "New note";
});

editor.addEventListener("input", () => {
    editor.style.height = "auto";
    editor.style.height = editor.scrollHeight + "px";
});