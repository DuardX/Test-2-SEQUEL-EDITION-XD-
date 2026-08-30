(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const TOKEN = "{{MARKDOWN}}";
  const TOKEN_RE = /\{\{\s*MARKDOWN\s*\}\}/i;
  const TPL_KEY = "mda.template.v1";
  const TPLS_KEY = "mda.templates.v1";
  const DEFAULT_TPL = TOKEN;
  const THEME_KEY = "mda.theme.v1";
  const AC_KEY = "mda.autocopy.v1";
  const SHARE_CACHE_URL = new URL("./__shared", location.href).href;

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
  const chipsEl = $("chips");
  const tplFileInput = $("tplFileInput");
  const delDialog = $("delDialog");
  const delNameEl = $("delName");
  const themeDD = $("themeDD");
  const themeTrigger = $("themeTrigger");
  const themeMenu = $("themeMenu");
  const triggerSwatch = $("triggerSwatch");
  const triggerLabel = $("triggerLabel");

  let fileName = "";
  let toastTimer;
  let barBusy = false;
  let autoCopyTimer = null;
  let renderPending = false;
  let srcStatusPending = false;
  let autoLoaded = false;

  const transition = (fn) => {
    if (document.startViewTransition) {
      document.startViewTransition(fn);
    } else {
      fn();
    }
  };

  // ===== Theme =====
  const themeBtns = [...document.querySelectorAll("[data-set-theme]")];

  function saveTheme(id) {
    try { localStorage.setItem(THEME_KEY, id); } catch (e) {}
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

  function loadTheme() {
    let t = null;
    try { t = localStorage.getItem(THEME_KEY); } catch (e) {}
    if (!t) {
      const m = document.cookie.match(
        new RegExp("(?:^|;\\s*)" + THEME_KEY.replace(/\./g, "\\.") + "=([^;]*)")
      );
      if (m) t = decodeURIComponent(m[1]);
      if (t) {
        try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
      }
    }
    return t;
  }

  function setThemeMenu(open) {
    themeMenu.classList.toggle("open", open);
    themeTrigger.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function updateTrigger(id) {
    const active = themeBtns.find((b) => b.dataset.setTheme === id);
    if (!active) return;
    triggerSwatch.style.setProperty("--sw-bg", active.style.getPropertyValue("--sw-bg"));
    triggerSwatch.style.setProperty("--sw-acc", active.style.getPropertyValue("--sw-acc"));
    triggerLabel.textContent = active.dataset.themeName || active.textContent.trim();
  }

  function applyTheme(id, persist) {
    transition(() => {
      document.documentElement.dataset.theme = id;
      themeBtns.forEach((b) => {
        b.setAttribute("aria-checked", b.dataset.setTheme === id ? "true" : "false");
      });
      updateTrigger(id);
      if (persist) saveTheme(id);
      requestAnimationFrame(() => {
        const bg = getComputedStyle(document.documentElement)
          .getPropertyValue("--bg")
          .trim();
        const meta = document.querySelector('meta[name="theme-color"]:not([media])');
        if (meta && bg) meta.content = bg;
      });
    });
  }

  themeTrigger.addEventListener("click", () => {
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
    }
  });

  themeMenu.addEventListener("keydown", (e) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    const buttons = [...themeMenu.querySelectorAll('[role="radio"]')];
    const currentIndex = buttons.findIndex((b) => b === document.activeElement);
    if (currentIndex === -1) return;
    e.preventDefault();
    if (e.key === "Home") {
      buttons[0].focus();
      return;
    }
    if (e.key === "End") {
      buttons[buttons.length - 1].focus();
      return;
    }
    const delta = e.key === "ArrowDown" ? 1 : -1;
    buttons[(currentIndex + delta + buttons.length) % buttons.length].focus();
  });

  themeBtns.forEach((b) => {
    b.addEventListener("click", () => {
      applyTheme(b.dataset.setTheme, true);
      setThemeMenu(false);
    });
  });

  const savedTheme = loadTheme();
  applyTheme(
    savedTheme && themeBtns.some((b) => b.dataset.setTheme === savedTheme)
      ? savedTheme
      : "ember",
    false
  );

  // ===== Helpers =====
  const fmtBytes = (b) =>
    b < 1024
      ? b + " B"
      : b < 1048576
        ? (b / 1024).toFixed(1) + " KB"
        : (b / 1048576).toFixed(2) + " MB";

  const stats = (t) => ({
    bytes: new Blob([t]).size,
    lines: t ? t.split("\n").length : 0,
  });

  function toast(msg, tone) {
    toastEl.textContent = msg;
    toastEl.className = "show" + (tone ? " " + tone : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.className = "";
    }, 2300);
  }

  const setDot = (d, c) => {
    d.className = "dot" + (c ? " " + c : "");
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
      await navigator.clipboard.writeText(outText.value);
    } catch (e) {
      outText.focus();
      outText.select();
      try {
        document.execCommand("copy");
      } catch (_) {}
      const sel = getSelection();
      if (sel) sel.removeAllRanges();
    }
    buzz(12);
    return true;
  }

  function updateBar() {
    const has = !!outText.value;
    actionbar.classList.toggle("show", has);
    actionbar.setAttribute("aria-hidden", has ? "false" : "true");
    if (has && !barBusy) barLabel.textContent = "Copy result";
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
      if (await copyOutput()) barFlash();
    }, 600);
  }

  // ===== Rendering =====
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
    const out = tpl.includes(TOKEN)
      ? tpl.split(TOKEN).join(src)
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

  function scheduleSrcStatus() {
    if (srcStatusPending) return;
    srcStatusPending = true;
    requestAnimationFrame(() => {
      srcStatusPending = false;
      updateSrcStatus();
    });
  }

  // ===== File input & drop =====
  // A normal <input type=file> gives us only a File object, which browsers
  // intentionally cannot delete. Chromium's File System Access API can
  // grant a per-file handle (via showOpenFilePicker) that supports remove()
  // after a successful read.
  //
  // This deliberately uses a *file* handle, not a directory handle. Chrome
  // refuses to hand out a directory handle for Downloads/Desktop/Documents/
  // the home folder (its built-in "sensitive folder" blocklist — the picker
  // shows "Can't open this folder" and won't let you confirm the selection),
  // but picking an individual file that happens to live inside one of those
  // folders is fine. That's the fix for the "Chrome won't let me use my
  // Downloads folder" problem.
  async function readFile(f, fileHandle = null) {
    try {
      const text = await f.text();
      loadText(f.name, text);

      if (fileHandle && /\.(md|markdown)$/i.test(f.name)) {
        try {
          const perm = await fileHandle.requestPermission({ mode: "readwrite" });
          if (perm !== "granted") throw new Error("readwrite permission not granted");
          await fileHandle.remove();
          toast("Loaded and deleted " + f.name);
        } catch (err) {
          console.warn("Could not delete source file", err);
          toast("Loaded " + f.name + " — could not delete it", "warn");
        }
      }
    } catch (err) {
      console.error(err);
      toast("Could not read file", "warn");
    }
  }

  async function chooseFile() {
    if (typeof window.showOpenFilePicker === "function") {
      try {
        const handles = await window.showOpenFilePicker({
          multiple: true,
          startIn: "downloads",
          types: [
            {
              description: "Markdown files",
              accept: { "text/markdown": [".md", ".markdown"] },
            },
          ],
        });

        let chosen = handles[0];
        if (handles.length > 1) {
          const listing = handles.map((h, i) => `${i + 1}. ${h.name}`).join("\n");
          const answer = prompt("Choose the Markdown file to assemble:\n\n" + listing + "\n\nEnter its number:");
          if (answer === null) return;
          const n = Number.parseInt(answer, 10);
          if (!Number.isInteger(n) || n < 1 || n > handles.length) {
            toast("Invalid file selection", "warn");
            return;
          }
          chosen = handles[n - 1];
        }

        const file = await chosen.getFile();
        await readFile(file, chosen);
        return;
      } catch (err) {
        if (err && err.name === "AbortError") return;
        console.warn("File picker unavailable or failed", err);
      }
    }

    // Safe fallback for Firefox, Safari, and any browser without File
    // System Access. Auto-delete genuinely can't happen here — a plain
    // <input type=file> only ever hands the page a read-only File object,
    // by browser design (Firefox has no shipped equivalent to
    // showOpenFilePicker/showDirectoryPicker). That's the "Gecko can't use
    // this" limitation, and there's no client-side workaround for it —
    // the file still loads normally, it just won't be deleted afterward.
    fileInput.click();
  }

  fileInput.addEventListener("change", () => {
    const f = fileInput.files[0];
    if (f) readFile(f);
    fileInput.value = "";
  });

  // Prevent the label's default <label for=fileInput> action so supported
  // Chromium builds use the directory picker instead of the legacy picker.
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
      if (ev === "dragenter") dragDepth++;
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

  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    dragDepth = 0;
    drop.classList.remove("over");
    const files = e.dataTransfer.files;
    const f =
      files && files.length
        ? [...files].find((x) => /\.(md|markdown|txt)$/i.test(x.name)) || files[0]
        : null;
    if (f) {
      readFile(f);
      return;
    }
    const t = e.dataTransfer.getData("text");
    if (t) loadText("dropped.md", t);
  });

  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => e.preventDefault());

  srcText.addEventListener("paste", (e) => {
    const text = e.clipboardData && e.clipboardData.getData("text");
    if (!text) return;
    e.preventDefault();
    loadText(fileName || "clipboard.md", text);
  });

  srcText.addEventListener("input", () => {
    scheduleSrcStatus();
    scheduleRender();
  });

  // ===== Buttons =====
  $("pasteBtn").addEventListener("click", async () => {
    try {
      if (!navigator.clipboard || !navigator.clipboard.readText) throw 0;
      const t = await navigator.clipboard.readText();
      if (!t) {
        toast("Clipboard is empty", "warn");
        return;
      }
      loadText(fileName || "clipboard.md", t);
    } catch {
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

  // ===== Templates =====
  let tpls = null;
  let saveTimer = null;

  const newId = () =>
    "t" +
    (crypto.randomUUID
      ? crypto.randomUUID().slice(0, 8)
      : Date.now().toString(36) + Math.random().toString(36).slice(2, 6));

  // Проверка наличия токена в теле шаблона (регистронезависимо, с допустимыми пробелами)
  const hasToken = (body) => TOKEN_RE.test(body || "");

  // Проверка уникальности имени среди всех шаблонов, кроме шаблона с указанным id
  const nameIsFree = (name, exceptId) => {
    const n = name.trim().toLowerCase();
    return !tpls.list.some((t) => t.id !== exceptId && t.name.toLowerCase() === n);
  };

  // Генерация первого свободного имени "Template N"
  const nextFreeName = () => {
    const used = new Set(tpls.list.map((t) => t.name.trim().toLowerCase()));
    let i = tpls.list.length + 1;
    while (used.has(("Template " + i).toLowerCase())) i++;
    return "Template " + i;
  };

  function loadTpls() {
    let raw = null;
    try { raw = localStorage.getItem(TPLS_KEY); } catch (e) {}
    if (raw) {
      try {
        const p = JSON.parse(raw);
        if (p && Array.isArray(p.list) && p.list.length) {
          if (!p.list.some((t) => t.id === p.active)) p.active = p.list[0].id;
          return p;
        }
      } catch (e) {}
    }
    let old = null;
    try { old = localStorage.getItem(TPL_KEY); } catch (e) {}
    const first = {
      id: newId(),
      name: "Default",
      body: old !== null && old !== "" ? old : DEFAULT_TPL,
    };
    try { localStorage.removeItem(TPL_KEY); } catch (e) {}
    return { active: first.id, list: [first] };
  }

  function persistTpls() {
    try { localStorage.setItem(TPLS_KEY, JSON.stringify(tpls)); } catch (e) {}
  }

  const activeTpl = () => tpls.list.find((t) => t.id === tpls.active) || tpls.list[0];

  // Обновление статуса шаблона с учётом валидации токена
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
        toast('Template saved, but ' + TOKEN + ' is missing', "warn");
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
        toast('Template saved without ' + TOKEN, "warn");
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
    const t = { id: newId(), name, body: DEFAULT_TPL };
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
        // Пустое имя — откат
        toast("Name cannot be empty", "warn");
        t.name = originalName;
      } else if (v.toLowerCase() === originalName.toLowerCase()) {
        // Имя не изменилось (регистронезависимо) — ок
      } else if (!nameIsFree(v, t.id)) {
        // Имя уже занято другим шаблоном — откат
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
    const missing = tpls.list.filter((t) => !hasToken(t.body));
    const data = JSON.stringify(
      {
        app: "md-assembler",
        version: 1,
        exported: new Date().toISOString(),
        list: tpls.list.map((t) => ({ name: t.name, body: t.body })),
      },
      null,
      2
    );
    downloadBlob(data, "application/json", "md-assembler-templates.json");
    buzz(12);
    if (missing.length) {
      const names = missing.map((t) => '"' + t.name + '"').join(", ");
      toast("Exported · " + missing.length + " template(s) missing " + TOKEN + ": " + names, "warn");
    } else {
      toast("Templates exported");
    }
  });

  $("importTplBtn").addEventListener("click", () => tplFileInput.click());

  tplFileInput.addEventListener("change", () => {
    const f = tplFileInput.files[0];
    tplFileInput.value = "";
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const raw = String(r.result);
        // Normalize keys that may have trailing spaces from broken formatters
        const fixed = raw.replace(/"\s*([^"\s]+?)\s*"\s*:/g, '"$1":');
        const p = JSON.parse(fixed);

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
          tpls.list.push({ id: newId(), name, body: it.body });
          added++;
        });
        if (added) {
          persistTpls();
          renderChips();
          buzz(10);
          toast(
            "Imported " + added + " template" + (added > 1 ? "s" : "") +
            (skipped ? " · " + skipped + " skipped" : "")
          );
        } else {
          toast(skipped ? "Nothing new to import" : "No valid templates found", "warn");
        }
      } catch (e) {
        toast("Import failed — not a valid template file", "warn");
      }
    };
    r.onerror = () => toast("Could not read file", "warn");
    r.readAsText(f);
  });

  tplText.addEventListener("input", () => {
    tplTyping();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => commitBody(false), 450);
    scheduleRender();
  });

  addEventListener("pagehide", () => commitBody(true));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") commitBody(true);
  });

  tpls = loadTpls();
  persistTpls();
  tplText.value = activeTpl().body;
  renderChips();
  tplSettled();

  // ===== Output actions =====
  copyBtn.addEventListener("click", async () => {
    if (!outText.value) {
      toast("Nothing to copy yet", "warn");
      return;
    }
    await copyOutput();
    copyBtn.classList.add("done");
    copyBtn.querySelector("span").textContent = "Copied";
    setTimeout(() => {
      copyBtn.classList.remove("done");
      copyBtn.querySelector("span").textContent = "Copy";
    }, 1500);
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
      toast("Share failed — copied to clipboard instead", "warn");
      await copyOutput();
      barFlash();
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
    if (await copyOutput()) barFlash();
  });

  autoCopyEl.addEventListener("change", async () => {
    try {
      localStorage.setItem(AC_KEY, autoCopyEl.checked ? "1" : "0");
    } catch (e) {}
    buzz(8);
    if (autoCopyEl.checked && outText.value) {
      if (await copyOutput()) barFlash();
    }
  });

  // ===== Launch Queue / Share Target =====
  try {
    if ("launchQueue" in window && "LaunchParams" in window && "files" in LaunchParams.prototype) {
      launchQueue.setConsumer(async (params) => {
        if (!params.files || !params.files.length) return;
        try {
          const file = await params.files[0].getFile();
          loadText(file.name, await file.text());
        } catch {
          toast("Could not open that file", "warn");
        }
      });
    }
  } catch {}

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data && event.data.type === "md-share") {
        autoLoaded = true;
        loadText(event.data.name, event.data.text);
      }
    });
  }

  // ===== Incoming shared data =====
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
    } catch {}
    if ("caches" in window) {
      caches
        .open("mda-share")
        .then(async (cache) => {
          const response = await cache.match(SHARE_CACHE_URL);
          if (!response) return;
          await cache.delete(SHARE_CACHE_URL);
          try {
            const data = await response.json();
            if (data && data.text) {
              autoLoaded = true;
              loadText(data.name || "shared.md", data.text);
            }
          } catch {}
        })
        .catch(() => {});
    }
  })();

  // ===== PWA install =====
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

  if ("serviceWorker" in navigator) {
    addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }, { once: true });

    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }

  // ===== Init =====
  try {
    autoCopyEl.checked = localStorage.getItem(AC_KEY) === "1";
  } catch (e) {}

  if (!autoLoaded) {
    updateSrcStatus();
    render();
  }
})();