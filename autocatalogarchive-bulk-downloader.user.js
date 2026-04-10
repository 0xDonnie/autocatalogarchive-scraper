// ==UserScript==
// @name         Auto Catalog Archive — Bulk Brochure Downloader
// @namespace    https://github.com/0xDonnie/autocatalogarchive-scraper
// @version      1.2.0
// @description  Adds a floating panel to autocatalogarchive.com that bulk-downloads brochures for any list of car models you choose. Runs in your real browser session, so Cloudflare is not an issue.
// @author       0xDonnie
// @license      MIT
// @homepageURL  https://github.com/0xDonnie/autocatalogarchive-scraper
// @supportURL   https://github.com/0xDonnie/autocatalogarchive-scraper/issues
// @updateURL    https://github.com/0xDonnie/autocatalogarchive-scraper/raw/main/autocatalogarchive-bulk-downloader.user.js
// @downloadURL  https://github.com/0xDonnie/autocatalogarchive-scraper/raw/main/autocatalogarchive-bulk-downloader.user.js
// @match        https://autocatalogarchive.com/*
// @match        https://www.autocatalogarchive.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_download
// @grant        GM_addStyle
// @connect      autocatalogarchive.com
// @connect      www.autocatalogarchive.com
// @run-at       document-idle
// @noframes
// ==/UserScript==

/*
 * HOW IT WORKS
 * ------------
 * autocatalogarchive.com is a WordPress + WPBakery Visual Composer site sitting
 * behind Cloudflare. Every brochure is a static PDF stored under
 * /wp-content/uploads/YYYY/MM/<Brand>-<Model>-<Year>-<Region>.pdf
 *
 * Brand pages live at /<brand-slug>/ (e.g. /lotus/, /porsche/, /mercedes/).
 * IMPORTANT: brand pages do NOT use real <a href> anchors for the brochures.
 * Each brochure card is a <div class="iconbox"> with an inline handler:
 *
 *     <div onclick="location.href='https://.../wp-content/uploads/.../File.pdf';">
 *
 * So we cannot just collect <a href> tags — we have to parse the onclick
 * attributes and extract the PDF URL via regex. The fallback path also picks
 * up real <a href> PDFs in case some pages mix templates.
 *
 * This userscript runs INSIDE your normal Chrome session on the site itself,
 * so Cloudflare and CORS are non-issues. For each "query" you configure
 * (brand-page + filename regex) it:
 *
 *   1. Fetches the brand page HTML via same-origin fetch().
 *   2. Parses every [onclick] attribute and extracts ".../*.pdf" URLs.
 *   3. Also picks up any direct <a href$=".pdf"> as a fallback.
 *   4. (Defensive) follows WordPress pagination if any.
 *   5. Filters those PDF URLs by your regex (case-insensitive, matched on
 *      the filename only).
 *   6. Downloads each match through GM_download (preferred — supports
 *      subfolder routing) with a fallback to a blob anchor click.
 *
 * Everything happens inside the page; no external server, no API, no Node.
 */

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Defaults: the user's original wishlist
  // ---------------------------------------------------------------------------
  // Each row: { label, brand, regex }
  //   - label : free text used for the subfolder name
  //   - brand : path under autocatalogarchive.com (no slashes)
  //   - regex : JavaScript regex source, matched against the PDF filename only,
  //             case-insensitive
  const DEFAULT_QUERIES = [
    { label: 'Mercedes G-Class',        brand: 'mercedes',   regex: 'Mercedes-G(-|63|65)' },
    { label: 'Lotus (all)',             brand: 'lotus',      regex: '^Lotus-' },
    { label: 'Abarth 500',              brand: 'fiat',       regex: 'Abarth-500' },
    { label: 'Maybach S600 / S-Class',  brand: 'mercedes',   regex: 'Maybach' },
    { label: 'Mitsubishi Lancer Evo X', brand: 'mitsubishi', regex: 'Lancer-Evolution' },
    { label: 'Porsche 911 GT3 RS',      brand: 'porsche',    regex: '911-GT3' },
    { label: 'Porsche Cayenne',         brand: 'porsche',    regex: 'Cayenne' },
  ];

  const DEFAULT_SETTINGS = {
    delayMs: 700,        // wait between downloads (be polite)
    maxPages: 50,        // safety cap on pagination
    useSubfolders: true, // route downloads into per-query folders
    rootFolder: 'AutoCatalogArchive', // top-level folder under your Downloads
  };

  const STORAGE_KEYS = {
    queries: 'aca_queries_v1',
    settings: 'aca_settings_v1',
    downloaded: 'aca_downloaded_v1', // dedup memory across runs
  };

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const state = {
    queries: loadJSON(STORAGE_KEYS.queries, DEFAULT_QUERIES),
    settings: { ...DEFAULT_SETTINGS, ...loadJSON(STORAGE_KEYS.settings, {}) },
    downloaded: new Set(loadJSON(STORAGE_KEYS.downloaded, [])),
    running: false,
    aborter: null,
  };

  function loadJSON(key, fallback) {
    try {
      const raw = GM_getValue(key, null);
      if (raw == null) return fallback;
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (e) {
      return fallback;
    }
  }
  function saveJSON(key, value) {
    GM_setValue(key, JSON.stringify(value));
  }

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------
  GM_addStyle(`
    #aca-panel {
      position: fixed; right: 16px; bottom: 16px; z-index: 2147483647;
      width: 420px; max-height: 80vh; display: flex; flex-direction: column;
      background: #11151c; color: #e6e8ee; font: 13px/1.4 -apple-system, Segoe UI, Roboto, sans-serif;
      border: 1px solid #2a2f3a; border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,.4);
      transition: transform .18s ease;
    }
    #aca-panel.aca-collapsed { transform: translateY(calc(100% - 44px)); }
    #aca-panel header {
      display: flex; align-items: center; gap: 8px;
      padding: 12px 14px; cursor: pointer;
      border-bottom: 1px solid #2a2f3a;
    }
    #aca-panel header .aca-dot {
      width: 10px; height: 10px; border-radius: 50%; background: #4ade80;
      box-shadow: 0 0 8px #4ade80;
    }
    #aca-panel header .aca-dot.aca-idle { background: #64748b; box-shadow: none; }
    #aca-panel header h1 {
      flex: 1; font-size: 13px; font-weight: 600; margin: 0;
      letter-spacing: .2px;
    }
    #aca-panel header .aca-toggle { opacity: .6; }
    #aca-panel .aca-body {
      display: flex; flex-direction: column; gap: 10px;
      padding: 12px 14px; overflow: auto; flex: 1;
    }
    #aca-panel .aca-row { display: flex; gap: 8px; align-items: center; }
    #aca-panel .aca-queries {
      display: flex; flex-direction: column; gap: 6px;
    }
    #aca-panel .aca-q {
      display: grid; grid-template-columns: 1fr 90px 1fr 24px;
      gap: 6px; align-items: center;
    }
    #aca-panel input[type=text], #aca-panel input[type=number], #aca-panel textarea {
      background: #1a1f2a; color: #e6e8ee;
      border: 1px solid #2a2f3a; border-radius: 6px;
      padding: 6px 8px; font: inherit; width: 100%;
      box-sizing: border-box;
    }
    #aca-panel input:focus { outline: none; border-color: #3b82f6; }
    #aca-panel button {
      background: #1f2937; color: #e6e8ee; border: 1px solid #374151;
      border-radius: 6px; padding: 6px 10px; font: inherit; cursor: pointer;
    }
    #aca-panel button:hover { background: #2a3444; }
    #aca-panel button.primary { background: #2563eb; border-color: #2563eb; color: #fff; }
    #aca-panel button.primary:hover { background: #1d4ed8; }
    #aca-panel button.danger  { background: #b91c1c; border-color: #b91c1c; color: #fff; }
    #aca-panel button.ghost   { background: transparent; border-color: transparent; opacity: .65; }
    #aca-panel button:disabled { opacity: .5; cursor: default; }
    #aca-panel .aca-log {
      background: #0b0e13; border: 1px solid #2a2f3a; border-radius: 6px;
      padding: 8px; height: 160px; overflow: auto;
      font: 11px/1.4 ui-monospace, Menlo, Consolas, monospace;
      white-space: pre-wrap; word-break: break-all;
    }
    #aca-panel .aca-log .ok  { color: #4ade80; }
    #aca-panel .aca-log .err { color: #f87171; }
    #aca-panel .aca-log .dim { color: #94a3b8; }
    #aca-panel .aca-settings { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    #aca-panel .aca-settings label { font-size: 11px; color: #94a3b8; display: block; }
    #aca-panel .aca-foot { display: flex; gap: 8px; justify-content: flex-end; }
    #aca-panel .aca-pill {
      font-size: 10px; padding: 2px 6px; border-radius: 999px;
      background: #1f2937; color: #94a3b8;
    }
  `);

  const panel = el('div', { id: 'aca-panel' });
  document.body.appendChild(panel);

  const dot = el('span', { className: 'aca-dot aca-idle' });
  const title = el('h1', {}, 'Auto Catalog Archive — Bulk Downloader');
  const counter = el('span', { className: 'aca-pill' }, '0 / 0');
  const toggle = el('span', { className: 'aca-toggle' }, '▾');
  const header = el('header', {}, [dot, title, counter, toggle]);
  header.addEventListener('click', () => panel.classList.toggle('aca-collapsed'));

  const queriesBox = el('div', { className: 'aca-queries' });

  const addBtn = el('button', { className: 'ghost' }, '+ aggiungi modello');
  addBtn.addEventListener('click', () => {
    state.queries.push({ label: '', brand: '', regex: '' });
    saveJSON(STORAGE_KEYS.queries, state.queries);
    renderQueries();
  });

  const resetBtn = el('button', { className: 'ghost' }, 'reset default');
  resetBtn.addEventListener('click', () => {
    if (!confirm('Ripristinare la lista modelli ai default?')) return;
    state.queries = JSON.parse(JSON.stringify(DEFAULT_QUERIES));
    saveJSON(STORAGE_KEYS.queries, state.queries);
    renderQueries();
  });

  const settingsBox = el('div', { className: 'aca-settings' });
  const delayInput = el('input', { type: 'number', min: '0', step: '50', value: state.settings.delayMs });
  const subfolderInput = el('input', { type: 'text', value: state.settings.rootFolder });
  delayInput.addEventListener('change', () => {
    state.settings.delayMs = Math.max(0, parseInt(delayInput.value, 10) || 0);
    saveJSON(STORAGE_KEYS.settings, state.settings);
  });
  subfolderInput.addEventListener('change', () => {
    state.settings.rootFolder = sanitizeFolder(subfolderInput.value || 'AutoCatalogArchive');
    saveJSON(STORAGE_KEYS.settings, state.settings);
  });
  settingsBox.appendChild(wrap(delayInput, 'delay tra download (ms)'));
  settingsBox.appendChild(wrap(subfolderInput, 'cartella radice'));

  const startBtn = el('button', { className: 'primary' }, 'Scarica tutto');
  const stopBtn  = el('button', { className: 'danger' }, 'Stop');
  const clearLogBtn = el('button', { className: 'ghost' }, 'pulisci log');
  const forgetBtn = el('button', { className: 'ghost' }, 'dimentica già scaricati');
  stopBtn.disabled = true;

  startBtn.addEventListener('click', () => start());
  stopBtn.addEventListener('click', () => {
    if (state.aborter) state.aborter.abort();
    state.running = false;
    setRunning(false);
    log('— interrotto dall\'utente', 'err');
  });
  clearLogBtn.addEventListener('click', () => { logEl.textContent = ''; });
  forgetBtn.addEventListener('click', () => {
    if (!confirm('Svuotare la lista dei PDF già scaricati? Verranno riscaricati al prossimo run.')) return;
    state.downloaded = new Set();
    saveJSON(STORAGE_KEYS.downloaded, []);
    log('memoria dedup svuotata', 'dim');
  });

  const logEl = el('div', { className: 'aca-log' });

  const body = el('div', { className: 'aca-body' }, [
    queriesBox,
    el('div', { className: 'aca-row' }, [addBtn, resetBtn]),
    settingsBox,
    el('div', { className: 'aca-foot' }, [forgetBtn, clearLogBtn, stopBtn, startBtn]),
    logEl,
  ]);

  panel.appendChild(header);
  panel.appendChild(body);

  function renderQueries() {
    queriesBox.innerHTML = '';
    state.queries.forEach((q, idx) => {
      const labelInput = el('input', { type: 'text', value: q.label, placeholder: 'etichetta (es. Porsche GT3 RS)' });
      const brandInput = el('input', { type: 'text', value: q.brand, placeholder: 'brand path' });
      const regexInput = el('input', { type: 'text', value: q.regex, placeholder: 'regex filename' });
      const delBtn = el('button', { className: 'ghost', title: 'rimuovi' }, '✕');

      labelInput.addEventListener('change', () => { q.label = labelInput.value; saveJSON(STORAGE_KEYS.queries, state.queries); });
      brandInput.addEventListener('change', () => { q.brand = brandInput.value.trim().replace(/^\/|\/$/g, ''); brandInput.value = q.brand; saveJSON(STORAGE_KEYS.queries, state.queries); });
      regexInput.addEventListener('change', () => { q.regex = regexInput.value; saveJSON(STORAGE_KEYS.queries, state.queries); });
      delBtn.addEventListener('click', () => {
        state.queries.splice(idx, 1);
        saveJSON(STORAGE_KEYS.queries, state.queries);
        renderQueries();
      });

      const row = el('div', { className: 'aca-q' }, [labelInput, brandInput, regexInput, delBtn]);
      queriesBox.appendChild(row);
    });
  }
  renderQueries();

  function setRunning(running) {
    state.running = running;
    startBtn.disabled = running;
    stopBtn.disabled = !running;
    dot.classList.toggle('aca-idle', !running);
  }

  function setCounter(done, total) {
    counter.textContent = `${done} / ${total}`;
  }

  function log(msg, cls) {
    const line = document.createElement('div');
    if (cls) line.className = cls;
    line.textContent = msg;
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
  }

  // ---------------------------------------------------------------------------
  // Core scraping logic
  // ---------------------------------------------------------------------------
  async function start() {
    if (state.running) return;
    state.aborter = new AbortController();
    setRunning(true);
    log('— inizio run —', 'dim');

    try {
      // 1. For each query, gather all PDF URLs from the brand page (+ pagination)
      const allTargets = []; // { url, label, filename }
      for (const q of state.queries) {
        if (!q.brand || !q.regex) {
          log(`skip "${q.label || '(senza nome)'}": brand o regex mancanti`, 'dim');
          continue;
        }
        log(`▸ "${q.label || q.brand}" — scansione /${q.brand}/`, 'dim');

        let regex;
        try { regex = new RegExp(q.regex, 'i'); }
        catch (e) { log(`  regex invalida: ${e.message}`, 'err'); continue; }

        const pdfs = await collectPdfsFromBrand(q.brand, state.aborter.signal);
        const filtered = pdfs.filter((p) => regex.test(filenameOf(p)));
        log(`  trovati ${pdfs.length} PDF totali, ${filtered.length} dopo filtro`, filtered.length ? 'ok' : 'err');

        for (const url of filtered) {
          allTargets.push({ url, label: q.label || q.brand, filename: filenameOf(url) });
        }
      }

      // dedup by URL
      const seen = new Set();
      const targets = allTargets.filter((t) => {
        if (seen.has(t.url)) return false;
        seen.add(t.url);
        return true;
      });

      log(`▸ totale PDF da scaricare: ${targets.length}`, 'dim');
      setCounter(0, targets.length);

      // 2. Download
      let done = 0, skipped = 0, failed = 0;
      for (const t of targets) {
        if (state.aborter.signal.aborted) break;

        if (state.downloaded.has(t.url)) {
          skipped++;
          done++;
          setCounter(done, targets.length);
          log(`  skip (già scaricato) ${t.filename}`, 'dim');
          continue;
        }

        try {
          await downloadPdf(t);
          state.downloaded.add(t.url);
          saveJSON(STORAGE_KEYS.downloaded, [...state.downloaded]);
          done++;
          setCounter(done, targets.length);
          log(`  ok  ${t.label} → ${t.filename}`, 'ok');
        } catch (e) {
          failed++;
          done++;
          setCounter(done, targets.length);
          log(`  err ${t.filename} — ${e.message || e}`, 'err');
        }

        await sleep(state.settings.delayMs, state.aborter.signal);
      }

      log(`— fine: ${done - skipped - failed} scaricati, ${skipped} skip, ${failed} errori —`, failed ? 'err' : 'ok');
    } catch (e) {
      log(`fatal: ${e.message || e}`, 'err');
    } finally {
      setRunning(false);
    }
  }

  // Regex used to pull a "*.pdf" URL out of an HTML attribute (typically an
  // onclick like  location.href='https://.../File.pdf';  ).
  const PDF_IN_ATTR = /['"]([^'"\s]*\.pdf(?:\?[^'"\s]*)?)['"]/i;

  // Visit /<brand>/, follow any pagination, return every PDF URL found.
  async function collectPdfsFromBrand(brand, signal) {
    const out = new Set();
    const seenPages = new Set();

    let pageUrl = `${location.origin}/${brand}/`;
    for (let i = 0; i < state.settings.maxPages; i++) {
      if (signal.aborted) break;
      if (seenPages.has(pageUrl)) break;
      seenPages.add(pageUrl);

      let html;
      try {
        const res = await fetch(pageUrl, { signal, credentials: 'include' });
        if (!res.ok) {
          log(`  HTTP ${res.status} su ${pageUrl}`, 'err');
          break;
        }
        html = await res.text();
      } catch (e) {
        if (e.name === 'AbortError') return [...out];
        log(`  fetch fallito ${pageUrl}: ${e.message}`, 'err');
        break;
      }

      const doc = new DOMParser().parseFromString(html, 'text/html');

      // PRIMARY: WPBakery iconbox cards. Each brochure is a <div onclick="
      // location.href='https://.../wp-content/uploads/.../File.pdf';">.
      // We also scan a few sister attributes that other themes occasionally use.
      const ATTR_NAMES = ['onclick', 'data-href', 'data-url', 'data-link'];
      doc.querySelectorAll('[onclick], [data-href], [data-url], [data-link]').forEach((e) => {
        for (const an of ATTR_NAMES) {
          const v = e.getAttribute(an);
          if (!v) continue;
          // Match the first quoted *.pdf in the attribute
          const m = v.match(PDF_IN_ATTR);
          if (m && m[1] && /\.pdf(\?|$)/i.test(m[1])) {
            out.add(absolutize(m[1]));
            break;
          }
          // Some attributes (data-href etc) may contain a bare URL with no quotes
          if (/\.pdf(\?|$)/i.test(v) && /^https?:|^\//i.test(v.trim())) {
            out.add(absolutize(v.trim()));
            break;
          }
        }
      });

      // FALLBACK: real <a href> PDFs, in case some pages mix templates.
      doc.querySelectorAll('a[href*="/wp-content/uploads/"]').forEach((a) => {
        const href = a.getAttribute('href') || '';
        if (/\.pdf(\?|$)/i.test(href)) out.add(absolutize(href));
      });

      // (Defensive) follow WordPress pagination if any. The current Auto Catalog
      // Archive theme puts everything on one page, but we keep this for safety.
      const nextEl =
        doc.querySelector('a.next.page-numbers') ||
        doc.querySelector('a[rel="next"]') ||
        doc.querySelector('.nav-previous a');
      if (!nextEl) break;
      const nextHref = absolutize(nextEl.getAttribute('href'));
      if (!nextHref || nextHref === pageUrl) break;
      pageUrl = nextHref;
      log(`  → pagina successiva ${pageUrl}`, 'dim');
    }

    return [...out];
  }

  // Tracks whether GM_download has worked at least once. After the first
  // failure we stop trying it and go straight to the blob anchor path, which
  // is slower (memory-buffered) but reliable because it uses the browser's
  // own fetch() with all the right Cloudflare cookies attached.
  let gmDownloadBroken = false;

  async function downloadPdf(target) {
    const subLabel = sanitizeFolder(target.label);
    const root = sanitizeFolder(state.settings.rootFolder);

    // Strategy 1: GM_download. Supports real subfolder routing inside the
    // user's Downloads folder (Tampermonkey "Downloads BETA" → Browser API).
    // Requires @connect autocatalogarchive.com in the header (added in 1.2.0).
    if (!gmDownloadBroken && typeof GM_download === 'function') {
      try {
        await tryGmDownload(target, root, subLabel);
        return; // success
      } catch (e) {
        // First failure: log it, mark broken, fall through to anchor.
        gmDownloadBroken = true;
        log(`  GM_download non disponibile (${e.message || e}) — passo al fallback fetch+blob`, 'dim');
      }
    }

    // Strategy 2: fetch the PDF as a blob and trigger a normal browser
    // download via an anchor click. This always works inside a userscript
    // because fetch() inherits the browser session cookies. Downside: the
    // browser saves to the default Downloads folder with no subfolder routing,
    // so we prefix the filename with the label for grouping.
    await anchorDownload(target, root, subLabel);
  }

  function tryGmDownload(target, root, subLabel) {
    return new Promise((resolve, reject) => {
      const name = state.settings.useSubfolders
        ? `${root}/${subLabel}/${target.filename}`
        : `${root}/${target.filename}`;
      let settled = false;
      const done = (err) => {
        if (settled) return;
        settled = true;
        err ? reject(err) : resolve();
      };
      try {
        GM_download({
          url: target.url,
          name,
          saveAs: false,
          conflictAction: 'uniquify',
          headers: { Referer: location.origin + '/' },
          onload:    () => done(),
          onerror:   (err) => done(new Error(typeof err === 'string' ? err : (err && (err.error || err.details)) || 'xhr_failed')),
          ontimeout: () => done(new Error('timeout')),
        });
      } catch (e) {
        done(e);
      }
      // Hard timeout in case neither callback ever fires
      setTimeout(() => done(new Error('no callback')), 90000);
    });
  }

  async function anchorDownload(target, root, subLabel) {
    const res = await fetch(target.url, { credentials: 'include' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // Browser saves to default Downloads dir; prefix with label so grouped runs
    // end up alphabetically adjacent on disk.
    a.download = state.settings.useSubfolders
      ? `${root}__${subLabel}__${target.filename}`
      : `${root}__${target.filename}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function absolutize(href) {
    try { return new URL(href, location.href).href; }
    catch (e) { return href; }
  }
  function filenameOf(url) {
    try {
      const u = new URL(url);
      return decodeURIComponent(u.pathname.split('/').pop() || 'file.pdf');
    } catch (e) { return 'file.pdf'; }
  }
  function sanitizeFolder(s) {
    return String(s || '').replace(/[\\/:*?"<>|]+/g, '-').replace(/^\.+/, '').trim() || 'misc';
  }
  function sleep(ms, signal) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(resolve, ms);
      if (signal) {
        signal.addEventListener('abort', () => { clearTimeout(t); reject(new Error('aborted')); }, { once: true });
      }
    });
  }
  function el(tag, attrs, children) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === 'className') e.className = attrs[k];
      else if (k in e) e[k] = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    if (children != null) {
      if (typeof children === 'string') e.textContent = children;
      else if (Array.isArray(children)) children.forEach((c) => c && e.appendChild(c));
      else e.appendChild(children);
    }
    return e;
  }
  function wrap(input, labelText) {
    const w = el('div');
    w.appendChild(el('label', {}, labelText));
    w.appendChild(input);
    return w;
  }
})();
