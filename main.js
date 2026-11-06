/* EgoSurgHands project page: theme toggle, benchmark chart, copy, reveal, lightbox. */
(function () {
  "use strict";
  var root = document.documentElement;

  /* ---------- theme ---------- */
  function systemDark() { return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches; }
  function isDark() { return root.dataset.theme ? root.dataset.theme === "dark" : systemDark(); }
  var themeBtn = document.querySelector(".theme-btn");
  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      var next = isDark() ? "light" : "dark";
      root.dataset.theme = next;
      try { localStorage.setItem("esh-theme", next); } catch (e) { /* storage unavailable */ }
    });
  }

  /* ---------- benchmark data (Table 2 and its bootstrap CIs) ---------- */
  var DATA = {
    "JointTransformer": { fam: "ego", zs3: [14.95, 14.39, 15.46], jrn3: [10.70, 10.21, 11.19], zs2: [27.7, 24.2, 30.8], jrn2: [19.6, 17.2, 21.5] },
    "WildHands":        { fam: "ego", zs3: [20.48, 19.72, 21.06], jrn3: [10.40, 9.91, 10.94], zs2: [38.6, 34.9, 41.9], jrn2: [19.0, 16.7, 20.7] },
    "HaMeR":            { fam: "non", zs3: [24.99, 23.77, 25.89], jrn3: [16.11, 14.16, 17.69], zs2: [42.8, 37.6, 47.8], jrn2: [29.4, 24.3, 32.6] },
    "WiLoR":            { fam: "non", zs3: [25.34, 24.10, 26.30], jrn3: [15.91, 14.13, 17.84], zs2: [44.3, 39.2, 48.8], jrn2: [28.9, 24.6, 32.3] },
    "MeshGraphormer":   { fam: "non", zs3: [26.22, 24.66, 27.77], jrn3: [15.12, 14.43, 15.69], zs2: [47.5, 43.2, 51.4], jrn2: [27.5, 24.3, 30.2] },
    "SimpleHand":       { fam: "non", zs3: [28.59, 27.67, 29.73], jrn3: [21.10, 20.01, 22.01], zs2: [53.4, 50.2, 56.5], jrn2: [39.1, 34.7, 42.3] },
    "IntagHand":        { fam: "oth", zs3: [20.28, 19.46, 20.88], jrn3: [13.94, 13.53, 14.30], zs2: [37.9, 34.1, 41.3], jrn2: [25.5, 23.0, 27.5] },
    "MediaPipe Hands":  { fam: "oth", note: "†", zs3: [30.45, 25.92, 31.69], jrn3: [18.05, 16.51, 22.10], zs2: [47.5, 44.2, 50.3], jrn2: [29.7, 26.3, 40.0] }
  };
  var GROUPS = [
    { label: "Egocentric pretraining", items: ["JointTransformer", "WildHands"] },
    { label: "Non-egocentric", items: ["HaMeR", "WiLoR", "MeshGraphormer", "SimpleHand"] },
    { label: "Two-hand / keypoint", items: ["IntagHand", "MediaPipe Hands"] }
  ];
  var METRICS = {
    "3d": { zs: "zs3", jrn: "jrn3", unit: "mm", dec: 2, domain: [5, 35], ticks: [5, 10, 15, 20, 25, 30, 35], band: [5, 13],
            title: "3D pose error", sub: "PA-MPJPE in mm, lower is better · dots are estimates, whiskers 95% CIs",
            axis: "PA-MPJPE (mm)" },
    "2d": { zs: "zs2", jrn: "jrn2", unit: "px", dec: 1, domain: [10, 60], ticks: [10, 20, 30, 40, 50, 60], band: null,
            title: "2D projection error", sub: "PA-P2D in pixels, lower is better · dots are estimates, whiskers 95% CIs",
            axis: "PA-P2D (px)" }
  };
  var state = { metric: "3d", jrn: false };

  var host = document.getElementById("forest");
  var tip = document.getElementById("tooltip");
  var SVGNS = "http://www.w3.org/2000/svg";

  function el(tag, attrs, parent) {
    var n = document.createElementNS(SVGNS, tag);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function fmt(v, dec) { return v.toFixed(dec); }
  function colorOf(fam) { return fam === "ego" ? "var(--viz-ego)" : "var(--viz-other)"; }

  function describe(name) {
    var d = DATA[name], M = METRICS[state.metric], z = d[M.zs], j = d[M.jrn];
    var s = name + ": zero-shot " + fmt(z[0], M.dec) + " " + M.unit + " (95% CI " + fmt(z[1], M.dec) + " to " + fmt(z[2], M.dec) + ")";
    s += "; with JRN " + fmt(j[0], M.dec) + " " + M.unit + " (95% CI " + fmt(j[1], M.dec) + " to " + fmt(j[2], M.dec) + ")";
    return s;
  }

  function showTip(name, x, y) {
    var d = DATA[name], M = METRICS[state.metric];
    while (tip.firstChild) tip.removeChild(tip.firstChild);
    var h = document.createElement("div"); h.className = "tt-name"; h.textContent = name + (d.note ? " " + d.note : ""); tip.appendChild(h);
    [["zs", "Zero-shot", d[M.zs]], ["jrn", "With JRN", d[M.jrn]]].forEach(function (r) {
      var row = document.createElement("div"); row.className = "tt-row";
      var key = document.createElement("span"); key.className = "tt-key" + (r[0] === "jrn" ? " ring" : "");
      if (r[0] === "jrn") key.style.borderColor = colorOf(d.fam); else key.style.background = colorOf(d.fam);
      var val = document.createElement("span"); val.className = "tt-val"; val.textContent = fmt(r[2][0], M.dec) + " " + M.unit;
      var lab = document.createElement("span"); lab.className = "tt-lab"; lab.textContent = r[1];
      var ci = document.createElement("span"); ci.className = "tt-ci"; ci.textContent = "95% CI " + fmt(r[2][1], M.dec) + " to " + fmt(r[2][2], M.dec);
      row.appendChild(key); row.appendChild(val); row.appendChild(lab); row.appendChild(ci); tip.appendChild(row);
    });
    tip.classList.add("show");
    var w = tip.offsetWidth, hgt = tip.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
    var left = Math.min(x + 16, vw - w - 10), top = y + 16;
    if (top + hgt > vh - 10) top = y - hgt - 14;
    tip.style.left = Math.max(10, left) + "px"; tip.style.top = Math.max(10, top) + "px";
  }
  function hideTip() { tip.classList.remove("show"); }

  function render() {
    if (!host) return;
    var W = Math.max(300, host.clientWidth);
    var small = W < 560;
    var M = METRICS[state.metric];
    var labelW = small ? 124 : 176, rightPad = small ? 46 : 64;
    var top = M.band ? 30 : 12, rowH = small ? 32 : 36, grpH = 26, gap = 8, axisH = 46;
    var rows = [], y = top;
    GROUPS.forEach(function (g, gi) {
      rows.push({ type: "group", label: g.label, y: y + 17 });
      y += grpH;
      g.items.forEach(function (n) { rows.push({ type: "row", name: n, y: y + rowH / 2 }); y += rowH; });
      if (gi < GROUPS.length - 1) y += gap;
    });
    var plotBottom = y + 4, H = plotBottom + axisH;
    var x0 = labelW, x1 = W - rightPad;
    function sx(v) { return x0 + (v - M.domain[0]) / (M.domain[1] - M.domain[0]) * (x1 - x0); }

    while (host.firstChild) host.removeChild(host.firstChild);
    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, role: "presentation" }, host);

    if (M.band) {
      el("rect", { x: sx(M.band[0]), y: top - 8, width: sx(M.band[1]) - sx(M.band[0]), height: plotBottom - top + 8, rx: 6, style: "fill: var(--band)" }, svg);
      var bl = el("text", { x: (sx(M.band[0]) + sx(M.band[1])) / 2, y: top - 14, "text-anchor": "middle", "font-size": small ? 10.5 : 11.5, "font-weight": 600, style: "fill: var(--muted)" }, svg);
      bl.textContent = small ? "≈1 cm labels" : "≈1 cm label resolution";
    }
    M.ticks.forEach(function (t) {
      el("line", { x1: sx(t), x2: sx(t), y1: top - 8, y2: plotBottom, "stroke-width": 1, style: "stroke: var(--grid)" }, svg);
      var tl = el("text", { x: sx(t), y: plotBottom + 18, "text-anchor": "middle", "font-size": 12, style: "fill: var(--muted); font-variant-numeric: tabular-nums" }, svg);
      tl.textContent = t;
    });
    el("line", { x1: x0, x2: x1, y1: plotBottom, y2: plotBottom, "stroke-width": 1, style: "stroke: var(--axis)" }, svg);
    var at = el("text", { x: (x0 + x1) / 2, y: H - 6, "text-anchor": "middle", "font-size": 12, "font-weight": 600, style: "fill: var(--ink-2)" }, svg);
    at.textContent = M.axis + ", lower is better";

    rows.forEach(function (r) {
      if (r.type === "group") {
        var gt = el("text", { x: 0, y: r.y, "font-size": 10.5, "font-weight": 750, "letter-spacing": "0.08em", style: "fill: var(--muted)" }, svg);
        gt.textContent = r.label.toUpperCase();
        return;
      }
      var d = DATA[r.name], c = colorOf(d.fam), z = d[M.zs], j = d[M.jrn], cy = r.y;
      var g = el("g", { tabindex: 0, role: "img", "aria-label": describe(r.name), class: "row" }, svg);
      var hl = el("rect", { x: -6, y: cy - rowH / 2 + 2, width: W + 6, height: rowH - 4, rx: 8, style: "fill: var(--accent-soft); opacity: 0; transition: opacity .12s" }, g);
      var nt = el("text", { x: 0, y: cy + 4.5, "font-size": small ? 12.5 : 14, "font-weight": d.fam === "ego" ? 650 : 500, style: "fill: var(--ink)" }, g);
      nt.textContent = r.name + (d.note ? d.note : "");
      if (state.jrn) {
        el("line", { x1: sx(j[0]), x2: sx(z[0]), y1: cy, y2: cy, "stroke-width": 2, "stroke-linecap": "round", style: "stroke: " + c + "; opacity: .28" }, g);
        el("line", { x1: sx(j[1]), x2: sx(j[2]), y1: cy, y2: cy, "stroke-width": 2, "stroke-linecap": "round", style: "stroke: " + c + "; opacity: .45" }, g);
        el("circle", { cx: sx(j[0]), cy: cy, r: 5, "stroke-width": 2, style: "fill: var(--surface); stroke: " + c }, g);
      }
      el("line", { x1: sx(z[1]), x2: sx(z[2]), y1: cy, y2: cy, "stroke-width": 2, "stroke-linecap": "round", style: "stroke: " + c + "; opacity: .6" }, g);
      el("circle", { cx: sx(z[0]), cy: cy, r: 6, "stroke-width": 2, style: "fill: " + c + "; stroke: var(--surface)" }, g);
      var vt = el("text", { x: sx(z[2]) + 9, y: cy + 4.5, "font-size": small ? 11.5 : 12.5, "font-weight": 600, style: "fill: var(--ink-2); font-variant-numeric: tabular-nums" }, g);
      vt.textContent = fmt(z[0], M.dec);
      var hit = el("rect", { x: -6, y: cy - rowH / 2, width: W + 6, height: rowH, style: "fill: transparent" }, g);
      function on(e) { hl.style.opacity = 1; var b = g.getBoundingClientRect(); showTip(r.name, e && e.clientX != null ? e.clientX : b.left + sx(z[2]), e && e.clientY != null ? e.clientY : b.top + rowH / 2); }
      function off() { hl.style.opacity = 0; hideTip(); }
      hit.addEventListener("pointermove", on);
      hit.addEventListener("pointerleave", off);
      g.addEventListener("focus", function () { on(null); });
      g.addEventListener("blur", off);
    });
  }

  function setMetric(m) {
    state.metric = m;
    document.querySelectorAll(".seg button").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.metric === m ? "true" : "false"); });
    var M = METRICS[m];
    var t = document.getElementById("chart-title"), s = document.getElementById("chart-sub"), n = document.getElementById("chart-note");
    if (t) t.textContent = (state.jrn ? "" : "Zero-shot ") + M.title + (state.jrn ? ", zero-shot and with JRN" : "");
    if (s) s.textContent = M.sub;
    if (n) n.textContent = (M.band ? "The shaded band marks the benchmark's roughly 1 cm label resolution (5 to 13 mm). " : "") +
      "† MediaPipe Hands is scored on the 24.1% of evaluation rows where it detects a hand.";
    render();
  }

  document.querySelectorAll(".seg button").forEach(function (b) {
    b.addEventListener("click", function () { setMetric(b.dataset.metric); });
  });
  var jt = document.getElementById("jrn-toggle");
  if (jt) jt.addEventListener("change", function () {
    state.jrn = jt.checked;
    var lj = document.getElementById("legend-jrn"); if (lj) lj.hidden = !state.jrn;
    setMetric(state.metric);
  });

  if (host) {
    var raf = 0, lastW = 0;
    var ro = new ResizeObserver(function () {
      var w = host.clientWidth; if (w === lastW) return; lastW = w;
      cancelAnimationFrame(raf); raf = requestAnimationFrame(render);
    });
    ro.observe(host);
    setMetric("3d");
  }
  window.addEventListener("scroll", hideTip, { passive: true });

  /* ---------- copy BibTeX ---------- */
  var copyBtn = document.querySelector(".copy-btn");
  if (copyBtn) copyBtn.addEventListener("click", function () {
    var text = document.getElementById("bibtex").textContent;
    var label = copyBtn.querySelector("span");
    function done(ok) { label.textContent = ok ? "Copied" : "Press Ctrl+C"; setTimeout(function () { label.textContent = "Copy"; }, 1800); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
    } else {
      var ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      document.body.removeChild(ta); done(ok);
    }
  });

  /* ---------- reveal on scroll ---------- */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
    reveals.forEach(function (n) { io.observe(n); });
  } else {
    reveals.forEach(function (n) { n.classList.add("in"); });
  }

  /* ---------- active nav link ---------- */
  var links = {};
  document.querySelectorAll(".nav a").forEach(function (a) { links[a.getAttribute("href").slice(1)] = a; });
  if ("IntersectionObserver" in window) {
    var navIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        Object.keys(links).forEach(function (k) { links[k].classList.toggle("active", k === e.target.id); });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    document.querySelectorAll("section[id]").forEach(function (s) { navIo.observe(s); });
  }

  /* ---------- lightbox ---------- */
  var lb = document.getElementById("lightbox");
  var lbImg = lb ? lb.querySelector("img") : null;
  function closeLb() { lb.classList.remove("open"); lb.setAttribute("aria-hidden", "true"); }
  document.querySelectorAll("img.zoomable").forEach(function (img) {
    img.addEventListener("click", function () {
      lbImg.src = img.currentSrc || img.src; lbImg.alt = img.alt;
      lb.classList.add("open"); lb.setAttribute("aria-hidden", "false");
    });
  });
  if (lb) lb.addEventListener("click", closeLb);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && lb && lb.classList.contains("open")) closeLb(); });
})();
