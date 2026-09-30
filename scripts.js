const $ = (id) => document.getElementById(id);
const TOKEN = "{{MARKDOWN}}";
const TOKEN_RE = /{{\s*MARKDOWN\s*}}/i;
const TOKEN_RE_GLOBAL = /{{\s*MARKDOWN\s*}}/gi;
const TPL_KEY = "mda.template.v1";
const TPLS_KEY = "mda.templates.v1";
const DEFAULT_TPL = TOKEN;
const THEME_KEY = "mda.theme.v1";
const FONT_KEY = "mda.font.v1";
const AC_KEY = "mda.autocopy.v1";
const AD_KEY = "mda.autodelete.v1";
const FS_ACCESS_SUPPORTED = typeof window.showOpenFilePicker === "function";
const UNDO_WINDOW_MS = 6000;
const SHARE_CACHE_URL = new URL("./__shared", location.href).href;
const consumedShareIds = new Set();

const fileInput = $("fileInput");
const drop = $("drop");
const srcText = $("srcText");
const tplText = $("tplText");
const outText = $("outText");
const srcDot = $("srcDot");
const srcStatus = $("srcStatus");
const tplDot = $("tplDot");
const tplStatus = $("tplStatus");
const outDot = $("outDot");
const outStatus = $("outStatus");
const outCountEl = $("outCount");
const outFileEl = $("outFile");
const globalDot = $("globalDot");
const globalState = $("globalState");
const copyBtn = $("copyBtn");
const dlBtn = $("dlBtn");
const sendBtn = $("sendBtn");
const toastEl = $("toast");
const actionbar = $("actionbar");
const barCopy = $("barCopy");
const barLabel = $("barLabel");
const autoCopyEl = $("autoCopy");
const autoDeleteEl = $("autoDelete");
const chipsEl = $("chips");
const tplFileInput = $("tplFileInput");
const delDialog = $("delDialog");
const delNameEl = $("delName");
const themeDD = $("themeDD");
const themeTrigger = $("themeTrigger");
const themeMenu = $("themeMenu");
const triggerSwatch = $("triggerSwatch");
const triggerLabel = $("triggerLabel");
const fontDD = $("fontDD");
const fontTrigger = $("fontTrigger");
const fontMenu = $("fontMenu");
const fontTriggerLabel = $("fontTriggerLabel");

let fileName = "";
let toastTimer;
let barBusy = false;
let autoCopyTimer = null;
let renderPending = false;
let sourceUpdatePending = false;
let autoLoaded = false;

const transition = (fn) => {
  if (document.startViewTransition) {
    document.startViewTransition(fn);
  } else {
    fn();
  }
};

const themeBtns = [...document.querySelectorAll("[data-set-theme]")];
const fontBtns = [...document.querySelectorAll("[data-set-font]")];

function saveTheme(id) {
  try {
    localStorage.setItem(THEME_KEY, id);
  } catch (e) {}

  const writeCookie = () => {
    try {
      document.cookie = `${THEME_KEY}=${encodeURIComponent(id)};max-age=31536000;path=/;SameSite=Lax`;
    } catch (e) {}
  };

  if ("requestIdleCallback" in window) {
    requestIdleCallback(writeCookie, { timeout: 1000 });
  } else {
    writeCookie();
  }
}

function saveFont(id) {
  try {
    localStorage.setItem(FONT_KEY, id);
  } catch (e) {}

  const writeCookie = () => {
    try {
      document.cookie = `${FONT_KEY}=${encodeURIComponent(id)};max-age=31536000;path=/;SameSite=Lax`;
    } catch (e) {}
  };

  if ("requestIdleCallback" in window) {
    requestIdleCallback(writeCookie, { timeout: 1000 });
  } else {
    writeCookie();
  }
}

function loadFont() {
  let f = null;

  try {
    f = localStorage.getItem(FONT_KEY);
  } catch (e) {}

  if (!f) {
    const m = document.cookie.match(
      new RegExp("(?:^|;\\s*)" + FONT_KEY.replace(/\\./g, "\\\\.") + "=([^;]*)")
    );
    if (m) f = decodeURIComponent(m[1]);
    if (f) {
      try {
        localStorage.setItem(FONT_KEY, f);
      } catch (e) {}
    }
  }

  return f;
}

function setFontMenu(open) {
  fontMenu.classList.toggle("open", open);
  fontTrigger.setAttribute("aria-expanded", open ? "true" : "false");
  if (open) {
    const active = fontMenu.querySelector('[role="radio"][aria-checked="true"]');
    active?.focus();
  }
}

function updateFontTrigger(id) {
  const active = fontBtns.find((b) => b.dataset.setFont === id);
  if (active) fontTriggerLabel.textContent = active.dataset.fontName || active.textContent.trim();
}

function applyFont(id, persist) {
  if (!fontBtns.some((b) => b.dataset.setFont === id)) return;
  document.documentElement.dataset.font = id;
  fontBtns.forEach((b) => {
    const selected = b.dataset.setFont === id;
    b.setAttribute("aria-checked", selected ? "true" : "false");
    b.tabIndex = selected ? 0 : -1;
  });
  updateFontTrigger(id);
  if (persist) saveFont(id);
}

function loadTheme() {
  let t = null;

  try {
    t = localStorage.getItem(THEME_KEY);
  } catch (e) {}

  if (!t) {
    const m = document.cookie.match(
      new RegExp("(?:^|;\\s*)" + THEME_KEY.replace(/\./g, "\\.") + "=([^;]*)")
    );

    if (m) {
      t = decodeURIComponent(m[1]);
    }

    if (t) {
      try {
        localStorage.setItem(THEME_KEY, t);
      } catch (e) {}
    }
  }

  return t;
}

function setThemeMenu(open) {
  themeMenu.classList.toggle("open", open);
  themeTrigger.setAttribute("aria-expanded", open ? "true" : "false");

  if (open) {
    const active = themeMenu.querySelector('[role="radio"][aria-checked="true"]');
    active?.focus();
  }
}

function updateTrigger(id) {
  const active = themeBtns.find((b) => b.dataset.setTheme === id);
  if (!active) return;

  triggerSwatch.className = "swatch swatch--" + id;
  triggerLabel.textContent = active.dataset.themeName || active.textContent.trim();
}

function applyTheme(id, persist) {
  transition(() => {
    document.documentElement.dataset.theme = id;

    themeBtns.forEach((b) => {
      const selected = b.dataset.setTheme === id;
      b.setAttribute("aria-checked", selected ? "true" : "false");
      b.tabIndex = selected ? 0 : -1;
    });

    updateTrigger(id);

    if (persist) {
      saveTheme(id);
    }

    requestAnimationFrame(() => {
      const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
      const meta = document.querySelector('meta[name="theme-color"]:not([media])');

      if (meta && bg) {
        meta.content = bg;
      }
    });
  });
}

themeTrigger.addEventListener("click", () => {
  if (fontMenu.classList.contains("open")) setFontMenu(false);
  setThemeMenu(!themeMenu.classList.contains("open"));
});

document.addEventListener("click", (e) => {
  if (themeMenu.classList.contains("open") && !themeDD.contains(e.target)) {
    setThemeMenu(false);
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && themeMenu.classList.contains("open")) {
    setThemeMenu(false);
    themeTrigger.focus();
  } else if (e.key === "Escape" && fontMenu.classList.contains("open")) {
    setFontMenu(false);
    fontTrigger.focus();
  }
});

themeMenu.addEventListener("keydown", (e) => {
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;

  const buttons = [...themeMenu.querySelectorAll('[role="radio"]')];
  const currentIndex = buttons.findIndex((b) => b === document.activeElement);

  if (currentIndex === -1 || !buttons.length) return;

  e.preventDefault();

  let nextIndex = currentIndex;

  if (e.key === "Home") nextIndex = 0;
  else if (e.key === "End") nextIndex = buttons.length - 1;
  else {
    const delta = e.key === "ArrowDown" ? 1 : -1;
    nextIndex = (currentIndex + delta + buttons.length) % buttons.length;
  }

  const next = buttons[nextIndex];
  next.focus();
  applyTheme(next.dataset.setTheme, true);
});

themeBtns.forEach((b) => {
  b.addEventListener("click", () => {
    applyTheme(b.dataset.setTheme, true);
    setThemeMenu(false);
  });
});

fontTrigger.addEventListener("click", () => {
  setFontMenu(!fontMenu.classList.contains("open"));
  if (themeMenu.classList.contains("open")) setThemeMenu(false);
});

fontBtns.forEach((b) => {
  b.addEventListener("click", () => {
    applyFont(b.dataset.setFont, true);
    setFontMenu(false);
  });
});

fontMenu.addEventListener("keydown", (e) => {
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
  const buttons = [...fontMenu.querySelectorAll('[role="radio"]')];
  const currentIndex = buttons.findIndex((b) => b === document.activeElement);
  if (currentIndex === -1 || !buttons.length) return;
  e.preventDefault();
  let nextIndex = currentIndex;
  if (e.key === "Home") nextIndex = 0;
  else if (e.key === "End") nextIndex = buttons.length - 1;
  else {
    const delta = e.key === "ArrowDown" ? 1 : -1;
    nextIndex = (currentIndex + delta + buttons.length) % buttons.length;
  }
  const next = buttons[nextIndex];
  next.focus();
  applyFont(next.dataset.setFont, true);
});

document.addEventListener("click", (e) => {
  if (fontMenu.classList.contains("open") && !fontDD.contains(e.target)) setFontMenu(false);
});

const savedFont = loadFont();
applyFont(
  savedFont && fontBtns.some((b) => b.dataset.setFont === savedFont)
    ? savedFont
    : "space",
  false
);

const savedTheme = loadTheme();

applyTheme(
  savedTheme && themeBtns.some((b) => b.dataset.setTheme === savedTheme)
    ? savedTheme
    : "ember",
  false
);

const fmtBytes = (b) =>
  b < 1024
    ? b + " B"
    : b < 1048576
    ? (b / 1024).toFixed(1) + " KB"
    : (b / 1048576).toFixed(2) + " MB";

const stats = (t) => ({
  bytes: new Blob([t]).size,
  lines: t ? 1 + (t.match(/\n/g)?.length || 0) : 0,
});

function toast(msg, tone, onTap) {
  toastEl.textContent = msg;
  toastEl.className = "show" + (tone ? " " + tone : "") + (onTap ? " clickable" : "");

  toastEl.onclick = onTap
    ? () => {
        clearTimeout(toastTimer);
        toastEl.className = "";
        toastEl.onclick = null;
        onTap();
      }
    : null;

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toastEl.className = "";
    toastEl.onclick = null;
  }, onTap ? UNDO_WINDOW_MS + 300 : 2300);
}

const setDot = (d, c) => {
  d.className = c ? "dot " + c : "dot";
};

const setGlobal = (s, c) => {
  globalState.textContent = s;
  setDot(globalDot, c);
};

function downloadBlob(data, mime, filename) {
  const url = URL.createObjectURL(new Blob([data], { type: mime }));
  const a = document.createElement("a");

  a.href = url;
  a.download = filename;

  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const buzz = (p) => {
  try {
    if (navigator.vibrate) navigator.vibrate(p);
  } catch (e) {}
};

async function copyOutput() {
  if (!outText.value) return false;

  try {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
    await navigator.clipboard.writeText(outText.value);
    buzz(12);
    return true;
  } catch (_) {
    outText.focus();
    outText.select();

    let copied = false;

    try {
      copied = document.execCommand("copy");
    } catch (__) {}

    const sel = getSelection();
    if (sel) sel.removeAllRanges();

    if (copied) buzz(12);
    return copied;
  }
}

function updateBar() {
  const has = !!outText.value;

  actionbar.classList.toggle("show", has);
  actionbar.setAttribute("aria-hidden", has ? "false" : "true");

  if (has && !barBusy) {
    barLabel.textContent = "Copy result";
  }
}

function barFlash() {
  barBusy = true;
  barCopy.classList.add("done");
  barLabel.textContent = "Copied";

  setTimeout(() => {
    barBusy = false;
    barCopy.classList.remove("done");
    updateBar();
  }, 1300);
}

function scheduleAutoCopy() {
  clearTimeout(autoCopyTimer);

  autoCopyTimer = setTimeout(async () => {
    if (!outText.value || !autoCopyEl.checked) return;

    if (await copyOutput()) {
      barFlash();
    }
  }, 600);
}

function render() {
  const src = srcText.value;
  const tpl = tplText.value;

  if (!src.trim()) {
    outText.value = "";
    outCountEl.textContent = "0 chars · 0 lines";
    outFileEl.textContent = "—";
    outStatus.textContent = "Waiting for source";

    setDot(outDot, "");
    setGlobal("Idle", "");

    clearTimeout(autoCopyTimer);
    updateBar();

    return;
  }

  const out = TOKEN_RE.test(tpl)
    ? tpl.replace(TOKEN_RE_GLOBAL, src)
    : (tpl.trim() ? tpl + "\n\n" : "") + src;

  outText.value = out;

  const s = stats(out);

  outCountEl.textContent = out.length.toLocaleString() + " chars · " + s.lines + " lines";

  const baseName = (fileName || "assembled").replace(/\.[^.]*$/, "") || "assembled";
  outFileEl.textContent = baseName + ".txt";

  outStatus.textContent =
    "Assembled " +
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  setDot(outDot, "ok");
  setGlobal("Output ready", "ok");
  updateBar();

  if (autoCopyEl.checked) {
    scheduleAutoCopy();
  } else {
    clearTimeout(autoCopyTimer);
  }
}

function scheduleRender() {
  if (renderPending) return;

  renderPending = true;

  requestAnimationFrame(() => {
    renderPending = false;
    render();
  });
}

function loadText(name, text) {
  fileName = name || "";
  srcText.value = text;

  updateSrcStatus();
  render();

  outText.classList.remove("flash");
  void outText.offsetWidth;
  outText.classList.add("flash");

  buzz([12, 40, 12]);
  toast("Loaded " + (name || "Markdown"));
}

function updateSrcStatus() {
  const t = srcText.value;

  if (!t) {
    srcStatus.textContent = "No source loaded.";
    setDot(srcDot, "");
    return;
  }

  const s = stats(t);

  setDot(srcDot, "on");
  srcStatus.textContent =
    (fileName || "edited") + " · " + fmtBytes(s.bytes) + " · " + s.lines + " lines";
}

function scheduleSourceUpdate() {
  if (sourceUpdatePending) return;

  sourceUpdatePending = true;

  requestAnimationFrame(() => {
    sourceUpdatePending = false;
    updateSrcStatus();
    render();
  });
}

async function readFile(f, fileHandle = null, hasReadWrite = false) {
  try {
    const text = await f.text();
    loadText(f.name, text);

    if (autoDeleteEl.checked && fileHandle && /\.(md|markdown)$/i.test(f.name)) {
      const name = f.name;

      if (!hasReadWrite) {
        toast("Loaded " + name + " — read-only access, can't auto-delete", "warn");
        return;
      }

      const timer = setTimeout(async () => {
        try {
          await fileHandle.remove();
          toast("Deleted " + name);
        } catch (err) {
          toast("Loaded " + name + " — could not delete it", "warn");
        }
      }, UNDO_WINDOW_MS);

      toast("Loaded " + name + " — deleting in a few seconds, tap to keep it", null, () => {
        clearTimeout(timer);
        toast("Kept " + name);
      });
    }
  } catch (err) {
    toast("Could not read file", "warn");
  }
}

async function chooseFile() {
  if (FS_ACCESS_SUPPORTED) {
    try {
      const [handle] = await window.showOpenFilePicker({ startIn: "downloads" });

      let hasReadWrite = false;

      if (autoDeleteEl.checked) {
        try {
          const perm = await handle.requestPermission({ mode: "readwrite" });
          hasReadWrite = perm === "granted";
        } catch (e) {}
      }

      const file = await handle.getFile();
      await readFile(file, handle, hasReadWrite);

      return;
    } catch (err) {
      if (err && err.name === "AbortError") return;
    }
  }

  fileInput.click();
}

fileInput.addEventListener("change", () => {
  const f = fileInput.files[0];

  if (f) {
    readFile(f);
  }

  fileInput.value = "";
});

drop.addEventListener("click", (e) => {
  e.preventDefault();
  chooseFile();
});

drop.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    chooseFile();
  }
});

let dragDepth = 0;

["dragenter", "dragover"].forEach((ev) => {
  drop.addEventListener(ev, (e) => {
    e.preventDefault();

    if (ev === "dragenter") {
      dragDepth++;
    }

    drop.classList.add("over");
  });
});

drop.addEventListener("dragleave", (e) => {
  e.preventDefault();

  if (--dragDepth <= 0) {
    dragDepth = 0;
    drop.classList.remove("over");
  }
});

drop.addEventListener("drop", async (e) => {
  e.preventDefault();

  dragDepth = 0;
  drop.classList.remove("over");

  const files = e.dataTransfer.files;

  const f =
    files && files.length
      ? [...files].find((x) => /\.(md|markdown|txt)$/i.test(x.name)) || files[0]
      : null;

  if (f) {
    let handle = null;
    let hasReadWrite = false;

    if (autoDeleteEl.checked && /\.(md|markdown)$/i.test(f.name)) {
      const item = [...(e.dataTransfer.items || [])].find((it) => {
        if (it.kind !== "file" || typeof it.getAsFile !== "function") {
          return false;
        }

        const file = it.getAsFile();
        return file && file.name === f.name;
      });

      if (item && typeof item.getAsFileSystemHandle === "function") {
        try {
          const h = await item.getAsFileSystemHandle();

          if (h && h.kind === "file") {
            const perm = await h.requestPermission({ mode: "readwrite" });

            if (perm === "granted") {
              handle = h;
              hasReadWrite = true;
            }
          }
        } catch (e) {}
      }
    }

    readFile(f, handle, hasReadWrite);

    return;
  }

  const t = e.dataTransfer.getData("text");

  if (t) {
    loadText("dropped.md", t);
  }
});

window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => e.preventDefault());

srcText.addEventListener("paste", (e) => {
  const text = e.clipboardData && e.clipboardData.getData("text");

  if (!text) return;

  e.preventDefault();
  loadText(fileName || "clipboard.md", text);
});

srcText.addEventListener("input", scheduleSourceUpdate);

$("pasteBtn").addEventListener("click", async () => {
  try {
    if (!navigator.clipboard || !navigator.clipboard.readText) throw 0;

    const t = await navigator.clipboard.readText();

    if (!t) {
      toast("Clipboard is empty", "warn");
      return;
    }

    loadText(fileName || "clipboard.md", t);
  } catch (e) {
    toast("Clipboard blocked — paste into the editor manually", "warn");
    srcText.focus();
  }
});

$("clearBtn").addEventListener("click", () => {
  srcText.value = "";
  fileName = "";

  updateSrcStatus();
  render();
});

let tpls = null;
let saveTimer = null;

const newId = () =>
  "t" +
  (crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : Date.now().toString(36) + Math.random().toString(36).slice(2, 6));

const hasToken = (body) => TOKEN_RE.test(body || "");

const nameIsFree = (name, exceptId) => {
  const n = name.trim().toLowerCase();
  return !tpls.list.some((t) => t.id !== exceptId && t.name.toLowerCase() === n);
};

const nextFreeName = () => {
  const used = new Set(tpls.list.map((t) => t.name.trim().toLowerCase()));
  let i = tpls.list.length + 1;

  while (used.has(("Template " + i).toLowerCase())) {
    i++;
  }

  return "Template " + i;
};

function loadTpls() {
  let raw = null;

  try {
    raw = localStorage.getItem(TPLS_KEY);
  } catch (e) {}

  if (raw) {
    try {
      const p = JSON.parse(raw);

      if (p && Array.isArray(p.list) && p.list.length) {
        if (!p.list.some((t) => t.id === p.active)) {
          p.active = p.list[0].id;
        }

        return p;
      }
    } catch (e) {}
  }

  let old = null;

  try {
    old = localStorage.getItem(TPL_KEY);
  } catch (e) {}

  const first = {
    id: newId(),
    name: "Default",
    body: old !== null && old !== "" ? old : DEFAULT_TPL,
  };

  try {
    localStorage.removeItem(TPL_KEY);
  } catch (e) {}

  return {
    active: first.id,
    list: [first],
  };
}

function persistTpls() {
  try {
    localStorage.setItem(TPLS_KEY, JSON.stringify(tpls));
  } catch (e) {}
}

const activeTpl = () => tpls.list.find((t) => t.id === tpls.active) || tpls.list[0];

function tplSettled() {
  const t = activeTpl();

  if (hasToken(t.body)) {
    setDot(tplDot, "ok");
    tplStatus.textContent = t.name;
  } else {
    setDot(tplDot, "warn");
    tplStatus.textContent = t.name + " · missing " + TOKEN;
  }
}

function tplTyping() {
  const body = tplText.value;

  if (hasToken(body)) {
    setDot(tplDot, "on");
    tplStatus.textContent = "Saving…";
  } else {
    setDot(tplDot, "warn");
    tplStatus.textContent = "Missing " + TOKEN;
  }
}

function commitBody(silent) {
  clearTimeout(saveTimer);

  const t = activeTpl();

  if (t && t.body !== tplText.value) {
    t.body = tplText.value;
    persistTpls();

    if (!silent && !hasToken(t.body)) {
      toast("Template saved, but " + TOKEN + " is missing", "warn");
    }
  }

  tplSettled();
}

function renderChips() {
  chipsEl.innerHTML = "";

  tpls.list.forEach((t) => {
    const b = document.createElement("button");

    b.type = "button";
    b.className = "chip" + (t.id === tpls.active ? " on" : "");
    b.dataset.id = t.id;
    b.textContent = t.name;
    b.title = t.name;

    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", t.id === tpls.active ? "true" : "false");

    b.addEventListener("click", () => switchTpl(t.id));

    chipsEl.appendChild(b);
  });
}

function switchTpl(id) {
  if (id === tpls.active) return;

  transition(() => {
    const old = activeTpl();

    if (old && old.body !== tplText.value && !hasToken(tplText.value)) {
      toast("Template saved without " + TOKEN, "warn");
    }

    commitBody(true);

    tpls.active = id;

    persistTpls();

    tplText.value = activeTpl().body;

    renderChips();
    tplSettled();
    scheduleRender();

    buzz(6);
  });
}

function newTpl() {
  commitBody(true);

  const name = nextFreeName();
  const t = {
    id: newId(),
    name,
    body: DEFAULT_TPL,
  };

  tpls.list.push(t);
  tpls.active = t.id;

  persistTpls();

  tplText.value = t.body;

  renderChips();
  tplSettled();
  scheduleRender();

  buzz(8);

  startRename();
}

function startRename() {
  const t = activeTpl();

  if (!t) return;

  const chip = chipsEl.querySelector('[data-id="' + t.id + '"]');

  if (!chip) return;

  const originalName = t.name;

  const input = document.createElement("input");

  input.className = "chip-edit";
  input.value = t.name;
  input.maxLength = 28;
  input.setAttribute("aria-label", "Template name");

  chip.replaceWith(input);

  input.focus();
  input.select();

  let done = false;

  const commit = () => {
    if (done) return;

    done = true;

    const v = input.value.trim();

    if (!v) {
      toast("Name cannot be empty", "warn");
      t.name = originalName;
    } else if (v.toLowerCase() === originalName.toLowerCase()) {
      // unchanged
    } else if (!nameIsFree(v, t.id)) {
      toast('Name "' + v + '" is already used', "warn");
      t.name = originalName;
      input.classList.add("invalid");
    } else {
      t.name = v;
    }

    persistTpls();
    renderChips();
    tplSettled();
  };

  input.addEventListener("blur", commit);

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    }

    if (e.key === "Escape") {
      done = true;
      renderChips();
    }
  });
}

$("newTplBtn").addEventListener("click", newTpl);
$("renameTplBtn").addEventListener("click", startRename);

$("delTplBtn").addEventListener("click", () => {
  if (tpls.list.length < 2) {
    toast("Cannot delete the last template", "warn");
    return;
  }

  delNameEl.textContent = activeTpl().name;
  delDialog.showModal();
});

$("cancelDel").addEventListener("click", () => delDialog.close());

$("confirmDel").addEventListener("click", () => {
  delDialog.close();

  commitBody(true);

  const idx = tpls.list.findIndex((t) => t.id === tpls.active);
  const gone = tpls.list[idx].name;

  tpls.list.splice(idx, 1);
  tpls.active = tpls.list[Math.max(0, idx - 1)].id;

  persistTpls();

  tplText.value = activeTpl().body;

  renderChips();
  tplSettled();
  scheduleRender();

  buzz(10);

  toast('Deleted "' + gone + '"');
});

$("resetTplBtn").addEventListener("click", () => {
  tplText.value = DEFAULT_TPL;

  commitBody(true);
  scheduleRender();

  toast("Body reset to " + TOKEN);

  tplText.focus();
});

$("exportTplBtn").addEventListener("click", () => {
  commitBody(true);

  const t = activeTpl();
  const missing = !hasToken(t.body);

  const data = JSON.stringify(
    {
      app: "md-assembler",
      version: 1,
      exported: new Date().toISOString(),
      list: [
        {
          name: t.name,
          body: t.body,
        },
      ],
    },
    null,
    2
  );

  const safeName =
    (t.name || "")
      .trim()
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")
      .replace(/\s+/g, " ")
      .slice(0, 80) || "template";

  downloadBlob(data, "application/json", `Template-${safeName}.json`);

  buzz(12);

  if (missing) {
    toast(`Exported · template "${t.name}" is missing ${TOKEN}`, "warn");
  } else {
    toast(`Template "${t.name}" exported`);
  }
});

$("importTplBtn").addEventListener("click", () => tplFileInput.click());

tplFileInput.addEventListener("change", async () => {
  const f = tplFileInput.files[0];

  tplFileInput.value = "";

  if (!f) return;

  let raw;

  try {
    raw = await f.text();
  } catch (e) {
    toast("Could not read file", "warn");
    return;
  }

  try {
    let p;

    try {
      p = JSON.parse(raw);
    } catch (_) {
      const fixed = raw.replace(/"\s*([^"\s]+?)\s*"\s*:/g, '"$1":');
      p = JSON.parse(fixed);
    }

    const items = p && Array.isArray(p.list) ? p.list : Array.isArray(p) ? p : null;

    if (!items) throw new Error("bad shape");

    let added = 0;
    let skipped = 0;

    items.forEach((it) => {
      if (!it || typeof it.body !== "string") {
        skipped++;
        return;
      }

      const name =
        typeof it.name === "string" && it.name.trim() ? it.name.trim() : "Imported";

      if (tpls.list.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
        skipped++;
        return;
      }

      tpls.list.push({
        id: newId(),
        name,
        body: it.body,
      });

      added++;
    });

    if (added) {
      persistTpls();
      renderChips();
      buzz(10);

      toast(
        "Imported " +
          added +
          " template" +
          (added > 1 ? "s" : "") +
          (skipped ? " · " + skipped + " skipped" : "")
      );
    } else {
      toast(skipped ? "Nothing new to import" : "No valid templates found", "warn");
    }
  } catch (e) {
    toast("Import failed — not a valid template file", "warn");
  }
});

tplText.addEventListener("input", () => {
  tplTyping();

  clearTimeout(saveTimer);

  saveTimer = setTimeout(() => commitBody(false), 450);

  scheduleRender();
});

addEventListener("pagehide", () => commitBody(true));

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    commitBody(true);
  }
});

tpls = loadTpls();

persistTpls();

tplText.value = activeTpl().body;

renderChips();
tplSettled();

copyBtn.addEventListener("click", async () => {
  if (!outText.value) {
    toast("Nothing to copy yet", "warn");
    return;
  }

  if (await copyOutput()) {
    copyBtn.classList.add("done");
    copyBtn.querySelector("span").textContent = "Copied";

    setTimeout(() => {
      copyBtn.classList.remove("done");
      copyBtn.querySelector("span").textContent = "Copy";
    }, 1500);
  } else {
    toast("Could not copy the result", "warn");
  }
});

sendBtn.addEventListener("click", async () => {
  if (!outText.value) {
    toast("Nothing to share yet", "warn");
    return;
  }

  if (typeof navigator.share !== "function") {
    toast("Share not supported in this browser", "warn");
    return;
  }

  if (!window.isSecureContext) {
    toast("Share requires HTTPS — use Copy instead", "warn");
    return;
  }

  try {
    if (navigator.canShare && !navigator.canShare({ text: outText.value })) {
      toast("Cannot share this content", "warn");
      return;
    }

    await navigator.share({ text: outText.value });

    buzz(12);
  } catch (e) {
    if (e && e.name === "AbortError") return;

    if (await copyOutput()) {
      toast("Share failed — copied to clipboard instead", "warn");
      barFlash();
    } else {
      toast("Share failed and clipboard copy was unavailable", "warn");
    }
  }
});

dlBtn.addEventListener("click", () => {
  if (!outText.value) {
    toast("Nothing to download yet", "warn");
    return;
  }

  const base = (fileName || "assembled").replace(/\.[^.]*$/, "") || "assembled";

  downloadBlob(outText.value, "text/plain;charset=utf-8", base + ".txt");

  buzz(12);

  toast("Downloading " + base + ".txt");
});

barCopy.addEventListener("click", async () => {
  if (!outText.value) return;

  if (await copyOutput()) {
    barFlash();
  }
});

autoCopyEl.addEventListener("change", async () => {
  try {
    localStorage.setItem(AC_KEY, autoCopyEl.checked ? "1" : "0");
  } catch (e) {}

  buzz(8);

  if (autoCopyEl.checked && outText.value) {
    if (await copyOutput()) {
      barFlash();
    }
  }
});

autoDeleteEl.addEventListener("change", () => {
  try {
    localStorage.setItem(AD_KEY, autoDeleteEl.checked ? "1" : "0");
  } catch (e) {}

  buzz(8);
});

try {
  if (
    "launchQueue" in window &&
    "LaunchParams" in window &&
    "files" in LaunchParams.prototype
  ) {
    launchQueue.setConsumer(async (params) => {
      if (!params.files || !params.files.length) return;

      try {
        const file = await params.files[0].getFile();
        loadText(file.name, await file.text());
      } catch (e) {
        toast("Could not open that file", "warn");
      }
    });
  }
} catch (e) {}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data && event.data.type === "md-share") {
      const id = typeof event.data.id === "string" ? event.data.id : "";
      if (id && consumedShareIds.has(id)) return;
      if (id) consumedShareIds.add(id);

      caches
        .open("mda-share")
        .then((cache) => cache.delete(SHARE_CACHE_URL))
        .catch(() => {});

      autoLoaded = true;
      loadText(event.data.name, event.data.text);
    }
  });
}

(function incoming() {
  try {
    const q = new URLSearchParams(location.search);
    const t = q.get("text");

    if (t) {
      history.replaceState(null, "", location.pathname);

      autoLoaded = true;

      loadText(q.get("title") || "shared.md", t);

      return;
    }
  } catch (e) {}

  if ("caches" in window) {
    caches
      .open("mda-share")
      .then(async (cache) => {
        const response = await cache.match(SHARE_CACHE_URL);

        if (!response) return;

        await cache.delete(SHARE_CACHE_URL);

        try {
          const data = await response.json();
          const id = typeof data?.id === "string" ? data.id : "";
          if (id && consumedShareIds.has(id)) return;
          if (id) consumedShareIds.add(id);
          const createdAt = Number(data?.createdAt) || 0;
          const fresh = createdAt > 0 && Date.now() - createdAt <= 10 * 60 * 1000;

          if (fresh && typeof data.text === "string" && data.text) {
            autoLoaded = true;
            loadText(data.name || "shared.md", data.text);
          }
        } catch (e) {}
      })
      .catch(() => {});
  }
})();

let deferredPrompt = null;
const installBtn = $("installBtn");

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();

  deferredPrompt = e;
  installBtn.hidden = false;
});

installBtn.addEventListener("click", async () => {
  if (!deferredPrompt) return;

  await deferredPrompt.prompt();

  deferredPrompt = null;
  installBtn.hidden = true;
});

window.addEventListener("appinstalled", () => {
  installBtn.hidden = true;
  setGlobal("Installed", "ok");
});

const updateConnectionState = () => {
  if (navigator.onLine) {
    setGlobal("Online", "ok");
  } else {
    setGlobal("Offline", "warn");
  }
};

addEventListener("online", updateConnectionState);
addEventListener("offline", updateConnectionState);
updateConnectionState();

if ("serviceWorker" in navigator) {
  addEventListener(
    "load",
    () => {
      navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).catch(() => {});
    },
    { once: true }
  );

  let hadServiceWorkerController = !!navigator.serviceWorker.controller;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadServiceWorkerController) {
      hadServiceWorkerController = true;
      return;
    }

    setGlobal("Updated", "ok");
  });
}

try {
  autoCopyEl.checked = localStorage.getItem(AC_KEY) === "1";
} catch (e) {}

try {
  if (FS_ACCESS_SUPPORTED) {
    autoDeleteEl.checked = localStorage.getItem(AD_KEY) !== "0";
  } else {
    autoDeleteEl.checked = false;
    autoDeleteEl.disabled = true;

    const lbl = autoDeleteEl.closest(".toggle");

    if (lbl) {
      lbl.title =
        "Not available in this browser — needs a Chromium-based browser (Chrome, Edge, Brave, etc.)";
    }
  }
} catch (e) {}

if (!autoLoaded) {
  updateSrcStatus();
  render();
}