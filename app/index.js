const { createClient } = supabase;
const sb = createClient(
    "https://ygddhfvjndsggrvxllov.supabase.co",
    "sb_publishable_rLRI3_s6y-Z592cPNy0q7w_gMuhcSex"
);

sb.auth.getSession().then(({ data: { session } }) => {
    if (session) window.location.href = "main.html";
});

const demoTitleEl  = document.getElementById("demo-title-text");
const demoTextEl   = document.getElementById("demo-text");
const cursorTitle  = document.getElementById("demo-cursor-title");
const cursorBody   = document.getElementById("demo-cursor-body");

const sequences = [
    {
        title: "Meeting notes",
        body: "## Agenda\n\n- Review **Q3 targets**\n- Discuss _new features_\n- ~~Skip the small talk~~\n\n> Ship it."
    },
    {
        title: "Big idea",
        body: "# The plan\n\nFind `more` partners and __funding__ .\n\n-# 21/3/26."
    },
    {
        title: "Today",
        body: "- Buy groceries\n- Call mum\n- **Actually** finish the project\n\n> One thing at a time."
    }
];

let seqIndex = 0;

function applyInline(s) {
    s = s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    s = s.replace(/`([^`]+)`/g,        "<code>$1</code>");
    s = s.replace(/\*\*([^*]+)\*\*/g,  "<strong>$1</strong>");
    s = s.replace(/__([^_]+)__/g,      "<u>$1</u>");
    s = s.replace(/\*([^*]+)\*/g,      "<em>$1</em>");
    s = s.replace(/_([^_]+)_/g,        "<em>$1</em>");
    s = s.replace(/~~([^~]+)~~/g,      "<s>$1</s>");
    return s;
}

function renderBody(raw) {
    const lines = raw.split("\n");
    return lines.map(line => {
        let s = line.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
        if (/^## (.+)/.test(s))  return s.replace(/^## (.+)/, (_,t) => `<strong style="font-size:1.1em;font-family:'Work Sans';font-weight:1000;">${applyInline(t)}</strong><br>`);
        if (/^# (.+)/.test(s))   return s.replace(/^# (.+)/,  (_,t) => `<strong style="font-size:1.3em;font-family:'Work Sans';font-weight:1000;">${applyInline(t)}</strong><br>`);
        if (/^-# (.+)/.test(s))  return s.replace(/^-# (.+)/, (_,t) => `<span class="subtext">${applyInline(t)}</span>`);
        if (/^&gt; (.+)/.test(s)) return s.replace(/^&gt; (.+)/, (_,t) => `<blockquote>${applyInline(t)}</blockquote>`);
        if (/^- (.+)/.test(s))   return s.replace(/^- (.+)/,  (_,t) => `• ${applyInline(t)}<br>`);
        if (s.trim() === "")     return `<br>`;
        return applyInline(s) + "<br>";
    }).join("");
}

function typeSequence(seq, onDone) {
    const fullTitle = seq.title;
    const fullBody  = seq.body;
    let ti = 0, bi = 0;
    let phase = "title";

    cursorTitle.style.display = "inline";
    cursorBody.style.display  = "none";
    demoTitleEl.textContent   = "";
    demoTextEl.innerHTML      = "";

    function tick() {
        if (phase === "title") {
            if (ti < fullTitle.length) {
                demoTitleEl.textContent += fullTitle[ti++];
                setTimeout(tick, 65 + Math.random() * 40);
            } else {
                phase = "pause";
                setTimeout(tick, 420);
            }
        } else if (phase === "pause") {
            cursorTitle.style.display = "none";
            cursorBody.style.display  = "inline";
            phase = "body";
            setTimeout(tick, 80);
        } else if (phase === "body") {
            if (bi < fullBody.length) {
                bi++;
                demoTextEl.innerHTML = renderBody(fullBody.slice(0, bi));
                const delay = fullBody[bi - 1] === "\n" ? 120 : 45 + Math.random() * 35;
                setTimeout(tick, delay);
            } else {
                setTimeout(onDone, 2200);
            }
        }
    }
    tick();
}

function eraseAndNext() {
    const titleLen = demoTitleEl.textContent.length;
    const bodyRaw  = sequences[seqIndex].body;
    let bi = bodyRaw.length;
    let ti = titleLen;

    cursorBody.style.display  = "none";
    cursorTitle.style.display = "none";

    function eraseBody() {
        if (bi > 0) {
            bi--;
            demoTextEl.innerHTML = renderBody(bodyRaw.slice(0, bi));
            setTimeout(eraseBody, 18);
        } else {
            eraseTitle();
        }
    }

    function eraseTitle() {
        if (ti > 0) {
            ti--;
            demoTitleEl.textContent = sequences[seqIndex].title.slice(0, ti);
            setTimeout(eraseTitle, 40);
        } else {
            seqIndex = (seqIndex + 1) % sequences.length;
            setTimeout(() => typeSequence(sequences[seqIndex], eraseAndNext), 300);
        }
    }

    eraseBody();
}

typeSequence(sequences[seqIndex], eraseAndNext);