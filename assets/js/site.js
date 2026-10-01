/* SheafStain project page: small, dependency-free behaviour shared by index.html and gallery.html.
   Tabs, BibTeX copy and the collapsed references follow the STREAM project page (chokevin8/STREAM-Patho).
   1. Hero montage on index.html (6 x 2): assets/gallery/manifest.json "hero.tiles".
   2. BibTeX copy button.
   3. ARIA tabs (arrow keys, Home/End): the index results tables ([data-tabs]) and the gallery tabs (#hash).
   4. Gallery: per tab, four rows of three cases (expression level, low to high). A case is an H&E / SheafStain
      comparison slider next to the ground-truth IHC. Dragging the slider moves the divider; a click or tap on
      either image (or Enter on the slider) opens the lightbox with the ground truth, SheafStain and six prior
      methods. Arrow keys move the divider.
   5. References: one collapsed <details id="refs-box"> per page; a superscript click or #ref-N hash opens it.
   6. Video clips (.clip, as on the STREAM page): muted loop, plays only while in view and without
      prefers-reduced-motion; a pause/play toggle appears once the video has loaded. */
(function () {
  "use strict";

  var MANIFEST_URL = "assets/gallery/manifest.json";
  var HERO_TILES = 12;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, cls, attrs) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (attrs) for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) n.setAttribute(k, attrs[k]);
    return n;
  }
  function img(src, alt, lazy) {
    var i = el("img");
    i.src = src; i.alt = alt || ""; i.width = 640; i.height = 640;
    i.decoding = "async"; i.draggable = false;
    if (lazy) i.loading = "lazy";
    return i;
  }

  function loadManifest() {
    if (!window.fetch) return Promise.resolve(null);
    return fetch(MANIFEST_URL, { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .catch(function () { return null; });
  }

  /* ---------------------------------------------------------------- 1. hero montage */
  function initMontage() {
    var host = $("#montage");
    if (!host) return;
    function draw(tiles) {
      host.innerHTML = "";
      for (var i = 0; i < HERO_TILES; i++) {
        var li = el("li"), t = tiles[i];
        if (t && t.src) {
          var f = el("figure", "tile");
          var im = img(t.src, t.alt, false);
          im.addEventListener("error", function () { this.parentNode.classList.add("is-empty"); this.remove(); });
          f.appendChild(im);
          li.appendChild(f);
        } else {
          li.appendChild(el("div", "tile is-empty", { "aria-hidden": "true" }));
        }
        host.appendChild(li);
      }
    }
    draw([]);
    loadManifest().then(function (m) {
      draw((m && m.hero && m.hero.tiles) || []);
      var note = $("#montage-note");
      if (note) note.hidden = !!m;
    });
  }

  /* ---------------------------------------------------------------- 2. BibTeX copy */
  function initCopy() {
    $all("button[data-copy]").forEach(function (btn) {
      var target = $(btn.getAttribute("data-copy"));
      var label = $("span", btn);
      var status = $("#copy-status");
      if (!target) return;
      btn.addEventListener("click", function () {
        var text = target.textContent;
        function done(ok) {
          btn.classList.toggle("is-done", ok);
          if (label) label.textContent = ok ? "Copied" : "Press Ctrl+C";
          if (status) status.textContent = ok ? "BibTeX copied to clipboard" : "Copy failed; select the text and copy it manually";
          setTimeout(function () { btn.classList.remove("is-done"); if (label) label.textContent = "Copy"; }, 1800);
        }
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(fallback(text)); });
        } else done(fallback(text));
      });
    });
    function fallback(text) {
      var ta = el("textarea");
      ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      ta.remove();
      return ok;
    }
  }

  /* ---------------------------------------------------------------- 3. ARIA tabs */
  function initTablist(tablist, onSelect) {
    var tabs = $all('[role="tab"]', tablist);
    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(t.getAttribute("aria-controls"));
        if (panel) panel.hidden = !on;
      });
      if (focus) tab.focus();
      if (onSelect) onSelect(tab);
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { select(t, false); });
      t.addEventListener("keydown", function (e) {
        var j = null;
        if (e.key === "ArrowRight") j = (i + 1) % tabs.length;
        else if (e.key === "ArrowLeft") j = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === "Home") j = 0;
        else if (e.key === "End") j = tabs.length - 1;
        if (j !== null) { e.preventDefault(); select(tabs[j], true); }
      });
    });
    return { tabs: tabs, select: select };
  }

  function initFigureTabs() {
    $all("[data-tabs]").forEach(function (box) {
      var list = $('[role="tablist"]', box);
      if (!list) return;
      var tl = initTablist(list, null);
      var initial = tl.tabs.filter(function (t) { return t.getAttribute("aria-selected") === "true"; })[0] || tl.tabs[0];
      if (initial) tl.select(initial, false);
    });
  }

  /* ---------------------------------------------------------------- 4. gallery */
  /* H&E (left of the divider) over the SheafStain output (right). A press that moves less than 4 px is a click. */
  function compareSlider(c, label, n, lazy, onOpen) {
    var box = el("div", "cmp", {
      tabindex: "0", role: "slider", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": "50",
      "aria-label": label + " case " + n + ": input H&E on the left, SheafStain on the right. Arrow keys move the divider; Enter opens the comparison."
    });
    box.appendChild(img(c.pred, "SheafStain output, " + label + " case " + n, lazy));
    var top = el("div", "cmp-top");
    top.appendChild(img(c.he, "Input H&E, " + label + " case " + n, lazy));
    box.appendChild(top);
    box.appendChild(el("div", "cmp-handle", { "aria-hidden": "true" }));
    var tl = el("span", "tag tag-l"); tl.textContent = "H&E";
    var tr = el("span", "tag tag-r tag-pred"); tr.textContent = "SheafStain";
    box.appendChild(tl); box.appendChild(tr);

    function set(p) {
      p = Math.max(0, Math.min(100, p));
      box.style.setProperty("--pos", p + "%");
      box.setAttribute("aria-valuenow", String(Math.round(p)));
    }
    set(50);
    var down = null;
    box.addEventListener("pointerdown", function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      down = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
    });
    box.addEventListener("pointermove", function (e) {
      if (!down || e.pointerId !== down.id) return;
      if (!down.moved) {
        if (Math.abs(e.clientX - down.x) < 4 && Math.abs(e.clientY - down.y) < 4) return;
        down.moved = true;
        try { box.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ }
        box.classList.add("is-dragging");
      }
      var r = box.getBoundingClientRect();
      set((e.clientX - r.left) / r.width * 100);
    });
    function end(e, cancelled) {
      if (!down || (e && e.pointerId !== down.id)) return;
      var moved = down.moved;
      down = null;
      box.classList.remove("is-dragging");
      if (!moved && !cancelled) onOpen();
    }
    box.addEventListener("pointerup", function (e) { end(e, false); });
    box.addEventListener("pointercancel", function (e) { end(e, true); });
    box.addEventListener("keydown", function (e) {
      var now = parseFloat(box.getAttribute("aria-valuenow")) || 50;
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); set(now - 5); }
      else if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); set(now + 5); }
      else if (e.key === "Home") { e.preventDefault(); set(0); }
      else if (e.key === "End") { e.preventDefault(); set(100); }
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); }
    });
    return box;
  }

  function initGallery() {
    var root = $("#gallery");
    if (!root) return;
    var lb = $("#lightbox"), lbGrid = $("#lb-grid"), lbCap = $("#lb-cap");
    var current = { list: [], i: 0, label: "" }, methods = [], lbImgs = {};

    var initialId = null;
    var tablist = $('[role="tablist"]', root);
    if (tablist) {
      var tl = initTablist(tablist, function (tab) {
        if (history.replaceState) history.replaceState(null, "", "#" + tab.getAttribute("data-tab"));
      });
      var initial = tl.tabs.filter(function (t) { return "#" + t.getAttribute("data-tab") === location.hash; })[0] || tl.tabs[0];
      if (initial) { tl.select(initial, false); initialId = initial.getAttribute("data-tab"); }
    }

    function buildLightbox() {
      if (!lbGrid) return;
      lbGrid.innerHTML = "";
      methods.forEach(function (m) {
        var f = el("figure", m.key === "sheafstain" ? "is-pred" : (m.key === "gt" ? "is-gt" : ""));
        var im = el("img", null, { width: "768", height: "768", alt: "" });
        im.decoding = "async";
        var cap = el("figcaption"); cap.textContent = m.label;
        f.appendChild(im); f.appendChild(cap);
        lbGrid.appendChild(f);
        lbImgs[m.key] = im;
      });
    }
    function show(i) {
      var c = current.list[i];
      if (!c) return;
      current.i = i;
      methods.forEach(function (m) {
        var im = lbImgs[m.key];
        if (!im) return;
        im.src = (c.full && c.full[m.key]) || "";
        im.alt = m.label + ", " + current.label + " case " + (i + 1);
      });
      lbCap.textContent = current.label + " · case " + (i + 1) + " of " + current.list.length + (c.caption ? " · " + c.caption : "");
    }
    function open(list, i, label) {
      current.list = list; current.label = label;
      if (!lb || typeof lb.showModal !== "function") {
        window.open((list[i].full && list[i].full.gt) || list[i].gt, "_blank", "noopener");
        return;
      }
      show(i);
      if (!lb.open) lb.showModal();
    }
    if (lb) {
      $("#lb-prev").addEventListener("click", function () { show((current.i - 1 + current.list.length) % current.list.length); });
      $("#lb-next").addEventListener("click", function () { show((current.i + 1) % current.list.length); });
      $("#lb-close").addEventListener("click", function () { lb.close(); });
      lb.addEventListener("keydown", function (e) {
        if (e.key === "ArrowLeft") { e.preventDefault(); $("#lb-prev").click(); }
        else if (e.key === "ArrowRight") { e.preventDefault(); $("#lb-next").click(); }
      });
      lb.addEventListener("click", function (e) { if (e.target === lb) lb.close(); });
      lb.addEventListener("close", function () {
        Object.keys(lbImgs).forEach(function (k) { lbImgs[k].removeAttribute("src"); });
      });
    }

    function draw(m) {
      methods = (m && m.methods) || [];
      buildLightbox();
      ((m && m.tabs) || []).forEach(function (t) {
        var host = $('[data-tab-rows="' + t.id + '"]', root);
        if (!host) return;
        host.innerHTML = "";
        var list = [];
        (t.rows || []).forEach(function (row) { row.forEach(function (c) { list.push(c); }); });
        var lazy = t.id !== initialId;
        var k = 0;
        (t.rows || []).forEach(function (row) {
          var ul = el("ul", "gal-row");
          row.forEach(function (c) {
            var idx = k++, n = idx + 1;
            var li = el("li", "case");
            var openThis = function () { open(list, idx, t.label); };
            li.appendChild(compareSlider(c, t.label, n, lazy, openThis));
            var gt = el("button", "gt-tile", { type: "button", "aria-label": "Compare " + t.label + " case " + n + " with the ground truth and prior methods" });
            gt.appendChild(img(c.gt, "Ground-truth IHC, " + t.label + " case " + n, lazy));
            var tag = el("span", "tag tag-l"); tag.textContent = "IHC (Ground Truth)";
            gt.appendChild(tag);
            gt.addEventListener("click", openThis);
            li.appendChild(gt);
            ul.appendChild(li);
          });
          host.appendChild(ul);
        });
      });
      var note = $("#manifest-note");
      if (note) note.hidden = !!m;
    }
    loadManifest().then(draw);
  }

  /* ---------------------------------------------------------------- 5. collapsed References list */
  function initRefs() {
    var box = document.getElementById("refs-box");
    if (!box) return;
    function entry(hash) {
      if (!/^#ref-\d+$/.test(hash || "")) return null;
      var t = document.getElementById(hash.slice(1));
      return t && box.contains(t) ? t : null;
    }
    document.addEventListener("click", function (e) {
      var a = e.target && e.target.closest ? e.target.closest("sup.cite a") : null;
      if (a && entry(a.getAttribute("href"))) box.open = true;
    });
    function reveal() {
      var t = entry(location.hash);
      if (!t) return;
      box.open = true;
      t.scrollIntoView({ block: "center" });
    }
    window.addEventListener("hashchange", reveal);
    reveal();
  }

  /* ---------------------------------------------------------------- 6. video clips */
  var ICON_PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/></svg>';
  var ICON_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.2v13.6a.8.8 0 0 0 1.2.7l10.6-6.8a.8.8 0 0 0 0-1.4L9.2 4.5A.8.8 0 0 0 8 5.2z"/></svg>';
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function initClips() {
    var clips = $all(".clip");
    if (!clips.length) return;
    var io = ("IntersectionObserver" in window) ? new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var v = en.target;
        if (v.dataset.userPaused === "1") return;
        if (en.isIntersecting) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        else v.pause();
      });
    }, { threshold: 0.35 }) : null;
    clips.forEach(function (fig) {
      var v = $("video", fig), frame = $(".clip-frame", fig), toggle = null;
      if (!v) return;
      function sync() {
        if (!toggle) return;
        var playing = !v.paused && !v.ended;
        toggle.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
        toggle.setAttribute("aria-label", playing ? "Pause animation" : "Play animation");
      }
      function ready() {
        if (fig.classList.contains("is-ready")) return;
        fig.classList.add("is-ready");
        toggle = el("button", "clip-toggle", { type: "button" });
        toggle.addEventListener("click", function () {
          if (v.paused) { v.dataset.userPaused = "0"; var p = v.play(); if (p && p.catch) p.catch(function () {}); }
          else { v.dataset.userPaused = "1"; v.pause(); }
        });
        frame.appendChild(toggle);
        sync();
      }
      v.addEventListener("loadeddata", ready);
      v.addEventListener("loadedmetadata", function () { if (reduceMotion) ready(); });
      v.addEventListener("play", sync);
      v.addEventListener("pause", sync);
      if (reduceMotion) { v.autoplay = false; v.dataset.userPaused = "1"; return; }
      if (io) io.observe(v);
      else { v.autoplay = true; var p = v.play(); if (p && p.catch) p.catch(function () {}); }
    });
  }

  function init() {
    initClips();
    initMontage();
    initCopy();
    initFigureTabs();
    initGallery();
    initRefs();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
