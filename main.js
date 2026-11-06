/* EgoSurgHands project page: theme, live video wall and clips, MPS readouts and 3D hands,
   benchmark chart, copy, reveal, lightbox. No dependencies. */
(function () {
  "use strict";
  var root = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- theme: dark by default ---------- */
  var themeBtn = document.querySelector(".theme-btn");
  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      var next = root.dataset.theme === "light" ? "dark" : "light";
      root.dataset.theme = next;
      try { localStorage.setItem("esh-theme", next); } catch (e) { /* storage unavailable */ }
    });
  }

  /* ---------- clips: Aria RGB at 30 fps with MPS 3D hands drawn by the lab's overlay renderer ---------- */
  var CLIPS = [
    { pr: "PR123", chip: "Simple interrupted · blue", task: "Simple interrupted + instrument tie", glove: "blue", cy: 0.607 },
    { pr: "PR116", chip: "Figure-of-8, one-hand tie", task: "Figure-of-8 + one-hand tie", glove: "blue", cy: 0.543 },
    { pr: "PR143", chip: "Simple interrupted · white", task: "Simple interrupted + instrument tie", glove: "white", cy: 0.609 },
    { pr: "PR132", chip: "Horizontal mattress", task: "Horizontal mattress + instrument tie", glove: "white", cy: 0.609 },
    { pr: "PR184", chip: "Figure-of-8, two-hand tie", task: "Figure-of-8 + two-handed tie", glove: "brown", cy: 0.743 },
    { pr: "PR117", chip: "Vertical mattress", task: "Vertical mattress + instrument tie", glove: "blue", cy: 0.666 },
    { pr: "PR122", chip: "Running subcuticular", task: "Running subcuticular + Aberdeen knot", glove: "blue", cy: 0.556 },
    { pr: "PR175", chip: "Needle loading", task: "Needle loading", glove: "brown", cy: 0.728 },
    { pr: "PR174", chip: "Cutting", task: "Cutting", glove: "brown", cy: 0.71 },
    { pr: "PR115", chip: "Two-hand tie", task: "Simple interrupted + two-hand tie", glove: "blue", cy: 0.648 },
    { pr: "PR128", chip: "Figure-of-8, instrument tie", task: "Figure-of-8 + instrument tie", glove: "white", cy: 0.567 }
  ];
  var GLOVE = { blue: "#7FA6E8", white: "#E7EBF2", brown: "#C2A57E" };
  var TEL = {}; /* per-clip telemetry, loaded on demand */
  function clip(pr) { for (var i = 0; i < CLIPS.length; i++) if (CLIPS[i].pr === pr) return CLIPS[i]; return null; }

  /* keep the hands in view when a square clip fills a wide box */
  function fitPos(v) {
    var c = clip(v.dataset.pr), w = v.clientWidth, h = v.clientHeight;
    if (!c || !w || !h || h >= w) { v.style.objectPosition = ""; return; }
    var f = h / w, p = Math.min(1, Math.max(0, (c.cy - f / 2) / (1 - f)));
    v.style.objectPosition = "50% " + (p * 100).toFixed(1) + "%";
  }
  function setClip(v, pr) {
    var base = "media/" + pr + "_full960";
    if (v.dataset.pr !== pr || !v.getAttribute("src")) { v.dataset.pr = pr; v.poster = base + ".jpg"; v.src = base + ".mp4"; }
    fitPos(v); tele(pr);
  }
  function play(v) { if (reduce) return; var p = v.play(); if (p && p.catch) p.catch(function () {}); }

  var visible = new Set();
  var vio = ("IntersectionObserver" in window) ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var v = e.target;
      if (e.isIntersecting) { visible.add(v); play(v); } else { visible.delete(v); v.pause(); }
    });
  }, { threshold: 0.12 }) : null;
  function watch(v) { if (vio) vio.observe(v); else play(v); }

  var wall = document.getElementById("wall");
  if (wall) {
    var small = window.innerWidth < 720;
    wall.poster = "media/" + (small ? "wall_m" : "wall") + ".jpg";
    if (!reduce) wall.src = "media/" + (small ? "wall_m" : "wall") + ".mp4";
    watch(wall);
  }
  var corev = document.getElementById("corev");
  if (corev) { setClip(corev, corev.dataset.pr); watch(corev); }
  window.addEventListener("resize", function () { document.querySelectorAll("video[data-pr]").forEach(fitPos); });

  /* ---------- telemetry: per-frame MPS readouts and camera-frame 3D joints ---------- */
  function tele(pr) {
    if (pr in TEL) return TEL[pr];
    TEL[pr] = null;
    fetch("media/" + pr + ".json").then(function (r) { return r.json(); }).then(function (d) { TEL[pr] = d; }).catch(function () {});
    return null;
  }
  function frameOf(v, d) { return Math.min(d.telemetry.length - 1, Math.max(0, Math.floor((v.currentTime || 0) * 30))); }
  function fmt(h) { return h ? h.d.toFixed(1) + " cm from lens · conf " + h.conf.toFixed(2) : "not tracked"; }
  function updateHuds() {
    document.querySelectorAll("[data-hud]").forEach(function (el) {
      var v = document.getElementById(el.dataset.for);
      if (!v || !visible.has(v)) return;
      var d = TEL[v.dataset.pr]; if (!d) return;
      var r = d.telemetry[frameOf(v, d)];
      el.innerHTML = '<div class="l">L wrist ' + fmt(r.left) + '</div><div class="r">R wrist ' + fmt(r.right) + "</div>";
    });
  }

  /* ---------- 3D hands (camera frame shown upright: screen x = -Y, screen y = +X) ---------- */
  var BONES = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[0,9],[9,10],[10,11],[11,12],[0,13],[13,14],[14,15],[15,16],[0,17],[17,18],[18,19],[19,20]];
  function fit(d) {
    if (d._fit) return d._fit;
    var P = [];
    d.telemetry.forEach(function (r) { ["left", "right"].forEach(function (s) { if (r[s] && r[s].j3) r[s].j3.forEach(function (p) { if (p) P.push([-p[1], p[0], p[2]]); }); }); });
    if (!P.length) return null;
    var c = [0, 1, 2].map(function (q) { return P.reduce(function (m, p) { return m + p[q]; }, 0) / P.length; });
    var rx = 0.02, ry = 0.02;
    P.forEach(function (p) { rx = Math.max(rx, Math.hypot(p[0] - c[0], p[2] - c[2])); ry = Math.max(ry, Math.abs(p[1] - c[1])); });
    d._fit = { c: c, rx: rx, ry: ry };
    return d._fit;
  }
  function j3At(d, k) {
    for (var s = 0; s < 3; s++) { var r = d.telemetry[Math.max(0, k - s)]; if (r && ((r.left && r.left.j3) || (r.right && r.right.j3))) return r; }
    return null;
  }
  function draw3d(cv, t) {
    var v = document.getElementById(cv.dataset.sync);
    if (!v || !visible.has(v)) return;
    var d = TEL[v.dataset.pr];
    var dpr = Math.min(2, window.devicePixelRatio || 1), w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    var cx = cv.getContext("2d");
    cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.clearRect(0, 0, w, h);
    var light = root.dataset.theme === "light";
    cx.strokeStyle = light ? "rgba(53,103,190,.14)" : "rgba(127,166,232,.14)"; cx.lineWidth = 1;
    for (var g = -5; g <= 5; g++) { cx.beginPath(); cx.moveTo(w / 2 + g * w / 11, h * .8); cx.lineTo(w / 2 + g * w / 5, h); cx.stroke(); }
    if (!d) return;
    var F = fit(d), r = j3At(d, frameOf(v, d));
    if (!F || !r) return;
    var ang = reduce ? 0.5 : Math.sin(t / 4200) * 0.9, ca = Math.cos(ang), sa = Math.sin(ang);
    var sc = 0.56 * Math.min(w / F.rx, h / F.ry);
    function proj(p) { var x = -p[1] - F.c[0], y = p[0] - F.c[1], z = p[2] - F.c[2]; return [w / 2 + (x * ca + z * sa) * sc, h / 2 + y * sc]; }
    [["left", "#50AAFF"], ["right", "#5AF078"]].forEach(function (pair) {
      var s = pair[0], col = pair[1];
      if (!r[s] || !r[s].j3) return;
      var P = r[s].j3.map(function (p) { return p ? proj(p) : null; });
      cx.shadowColor = col; cx.shadowBlur = light ? 0 : 6; cx.strokeStyle = col; cx.lineWidth = 2.2; cx.lineCap = "round";
      BONES.forEach(function (b) { if (P[b[0]] && P[b[1]]) { cx.beginPath(); cx.moveTo(P[b[0]][0], P[b[0]][1]); cx.lineTo(P[b[1]][0], P[b[1]][1]); cx.stroke(); } });
      cx.shadowBlur = 0;
      P.forEach(function (p) { if (!p) return; cx.fillStyle = light ? "#1F2633" : "#0F1A33"; cx.beginPath(); cx.arc(p[0], p[1], 3.8, 0, 7); cx.fill(); cx.fillStyle = "#F4F1EA"; cx.beginPath(); cx.arc(p[0], p[1], 2.3, 0, 7); cx.fill(); });
    });
  }

  /* ---------- live player ---------- */
  var pv = document.getElementById("pv");
  var chipsEl = document.getElementById("pv-chips");
  function selectClip(pr) {
    var c = clip(pr); if (!c || !pv) return;
    setClip(pv, pr);
    if (visible.has(pv)) play(pv);
    document.getElementById("pv-title").textContent = c.task;
    document.getElementById("pv-cap").textContent = c.task;
    document.getElementById("pv-meta").innerHTML = '<span class="vchip"><i class="gdot" style="display:inline-block;vertical-align:-1px;margin-right:6px;background:' + GLOVE[c.glove] + '"></i>' + c.glove + ' gloves</span><span class="vchip">' + c.pr + "</span>";
    chipsEl.querySelectorAll(".chip-btn").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.pr === pr ? "true" : "false"); });
  }
  if (pv && chipsEl) {
    chipsEl.innerHTML = CLIPS.map(function (c) {
      return '<button class="chip-btn" type="button" data-pr="' + c.pr + '" aria-pressed="false"><i class="gdot" style="background:' + GLOVE[c.glove] + '"></i>' + c.chip + "</button>";
    }).join("");
    chipsEl.addEventListener("click", function (e) { var b = e.target.closest(".chip-btn"); if (b) selectClip(b.dataset.pr); });
    selectClip("PR123");
    watch(pv);
  }

  /* ---------- the animation loop: readouts and 3D views of the clips in view ---------- */
  var canvases = document.querySelectorAll("canvas[data-sync]");
  function loop(t) { updateHuds(); canvases.forEach(function (cv) { draw3d(cv, t); }); requestAnimationFrame(loop); }
  requestAnimationFrame(loop);

  /* ---------- Aria diagram hotspots ---------- */
  var tipEl = document.getElementById("tip");
  document.querySelectorAll("#diagram .hot").forEach(function (h) {
    function show() { var parts = h.dataset.tip.split("|"); tipEl.innerHTML = "<b>" + parts[0] + "</b>" + parts[1]; tipEl.style.left = h.style.left; tipEl.style.top = h.style.top; tipEl.classList.add("show"); }
    function hide() { tipEl.classList.remove("show"); }
    h.addEventListener("mouseenter", show); h.addEventListener("focus", show); h.addEventListener("click", show);
    h.addEventListener("mouseleave", hide); h.addEventListener("blur", hide);
  });

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

  /* mini leaderboard in the release cards, ranked by zero-shot PA-MPJPE */
  var mini = document.getElementById("lb-mini");
  if (mini) {
    var names = Object.keys(DATA).sort(function (a, b) { return DATA[a].zs3[0] - DATA[b].zs3[0]; });
    var rank = 0;
    mini.innerHTML = names.map(function (n) {
      var d = DATA[n], v = d.zs3[0], ego = d.fam === "ego", star = !!d.note;
      if (!star) rank += 1;
      return '<div class="row' + (ego ? " ego" : "") + '"><span class="rk">' + (star ? "" : rank) + '</span><div class="bar"><i style="width:' + (v / 32 * 100).toFixed(1) + '%"></i><span>' + n + (star ? "*" : "") + (ego ? "<em>EGO</em>" : "") + '</span></div><span class="val">' + v.toFixed(2) + "</span></div>";
    }).join("");
  }

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
  function f(v, dec) { return v.toFixed(dec); }
  function colorOf(fam) { return fam === "ego" ? "var(--viz-ego)" : "var(--viz-other)"; }
  function describe(name) {
    var d = DATA[name], M = METRICS[state.metric], z = d[M.zs], j = d[M.jrn];
    return name + ": zero-shot " + f(z[0], M.dec) + " " + M.unit + " (95% CI " + f(z[1], M.dec) + " to " + f(z[2], M.dec) + ")" +
      "; with JRN " + f(j[0], M.dec) + " " + M.unit + " (95% CI " + f(j[1], M.dec) + " to " + f(j[2], M.dec) + ")";
  }
  function showTip(name, x, y) {
    var d = DATA[name], M = METRICS[state.metric];
    while (tip.firstChild) tip.removeChild(tip.firstChild);
    var h = document.createElement("div"); h.className = "tt-name"; h.textContent = name + (d.note ? " " + d.note : ""); tip.appendChild(h);
    [["zs", "Zero-shot", d[M.zs]], ["jrn", "With JRN", d[M.jrn]]].forEach(function (r) {
      var row = document.createElement("div"); row.className = "tt-row";
      var key = document.createElement("span"); key.className = "tt-key" + (r[0] === "jrn" ? " ring" : "");
      if (r[0] === "jrn") key.style.borderColor = colorOf(d.fam); else key.style.background = colorOf(d.fam);
      var val = document.createElement("span"); val.className = "tt-val"; val.textContent = f(r[2][0], M.dec) + " " + M.unit;
      var lab = document.createElement("span"); lab.className = "tt-lab"; lab.textContent = r[1];
      var ci = document.createElement("span"); ci.className = "tt-ci"; ci.textContent = "95% CI " + f(r[2][1], M.dec) + " to " + f(r[2][2], M.dec);
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
    var W = Math.max(300, host.clientWidth), small = W < 560, M = METRICS[state.metric];
    var labelW = small ? 124 : 176, rightPad = small ? 46 : 64;
    var top = M.band ? 30 : 12, rowH = small ? 32 : 36, grpH = 26, gap = 8, axisH = 46;
    var rows = [], y = top;
    GROUPS.forEach(function (g, gi) {
      rows.push({ type: "group", label: g.label, y: y + 17 }); y += grpH;
      g.items.forEach(function (n) { rows.push({ type: "row", name: n, y: y + rowH / 2 }); y += rowH; });
      if (gi < GROUPS.length - 1) y += gap;
    });
    var plotBottom = y + 4, H = plotBottom + axisH, x0 = labelW, x1 = W - rightPad;
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
        var gt = el("text", { x: 0, y: r.y, "font-size": 10.5, "font-weight": 700, "letter-spacing": "0.08em", style: "fill: var(--muted)" }, svg);
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
      vt.textContent = f(z[0], M.dec);
      var hit = el("rect", { x: -6, y: cy - rowH / 2, width: W + 6, height: rowH, style: "fill: transparent" }, g);
      function on(e) { hl.style.opacity = 1; var b = g.getBoundingClientRect(); showTip(r.name, e && e.clientX != null ? e.clientX : b.left + sx(z[2]), e && e.clientY != null ? e.clientY : b.top + rowH / 2); }
      function off() { hl.style.opacity = 0; hideTip(); }
      hit.addEventListener("pointermove", on); hit.addEventListener("pointerleave", off);
      g.addEventListener("focus", function () { on(null); }); g.addEventListener("blur", off);
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
  document.querySelectorAll(".seg button").forEach(function (b) { b.addEventListener("click", function () { setMetric(b.dataset.metric); }); });
  var jt = document.getElementById("jrn-toggle");
  if (jt) jt.addEventListener("change", function () {
    state.jrn = jt.checked;
    var lj = document.getElementById("legend-jrn"); if (lj) lj.hidden = !state.jrn;
    setMetric(state.metric);
  });
  if (host) {
    var raf = 0, lastW = 0;
    if ("ResizeObserver" in window) {
      new ResizeObserver(function () { var w = host.clientWidth; if (w === lastW) return; lastW = w; cancelAnimationFrame(raf); raf = requestAnimationFrame(render); }).observe(host);
    }
    setMetric("3d");
  }
  window.addEventListener("scroll", hideTip, { passive: true });

  /* ---------- copy BibTeX ---------- */
  var copyBtn = document.querySelector(".copy-btn");
  if (copyBtn) copyBtn.addEventListener("click", function () {
    var text = document.getElementById("bibtex").textContent, label = copyBtn.querySelector("span");
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
