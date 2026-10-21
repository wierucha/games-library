(function () {
  "use strict";

  // ── State ──
  let allGames = [];
  let filtered = [];
  let currentPlatform = "All";
  let platformCounts = {};

  const PLATFORM_ORDER = [
    "All",
    "PlayStation 1",
    "PlayStation 2",
    "PlayStation 3",
    "PlayStation 4",
    "PlayStation 5",
    "PSP",
    "PS Vita",
    "Nintendo DS",
    "Nintendo 3DS",
    "Nintendo Switch",
    "NES",
    "Famiclone",
    "Sega Master System",
    "Commodore 64",
    "Wii",
    "Wii U",
    "Xbox",
    "Xbox 360",
    "Xbox One",
    "Xbox Series X|S",
    "PC (Physical)",
    "PC (Steam)"
  ];

  // Region → flag emoji
  const REGION_FLAGS = {
    WW: "🌍",
    US: "🇺🇸",
    EU: "🇪🇺",
    JP: "🇯🇵",
    PAL: "🇪🇺",
    AU: "🇦🇺",
    UK: "🇬🇧",
    DE: "🇩🇪",
    FR: "🇫🇷",
    ES: "🇪🇸",
    IT: "🇮🇹",
    PL: "🇵🇱",
    KR: "🇰🇷",
    CN: "🇨🇳",
    TW: "🇹🇼",
    BR: "🇧🇷",
    RU: "🇷🇺",
    ASIA: "🌏"
  };

  // Filter defaults (used for reset + URL hash)
  const DEFAULTS = {
    q: "",
    media: "both",
    region: "all",
    rating: "all",
    year: "all",
    sort: "name"
  };

  // ── DOM ──
  const $search = document.getElementById("search");
  const $clear = document.getElementById("clearSearch");
  const $media = document.getElementById("mediaFilter");
  const $region = document.getElementById("regionFilter");
  const $rating = document.getElementById("ratingFilter");
  const $year = document.getElementById("yearFilter");
  const $sort = document.getElementById("sortBy");
  const $list = document.getElementById("gameList");
  const $count = document.getElementById("resultsCount");
  const $stats = document.getElementById("stats");
  const $empty = document.getElementById("emptyState");
  const $reset = document.getElementById("resetFilters");
  const $tabs = document.getElementById("platformTabs");
  const $export = document.getElementById("exportBtn");
  const $theme = document.getElementById("themeToggle");

  const reducedMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── Safe storage (Safari private mode etc. can throw) ──
  function storageGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* ignore */ }
  }

  // ── Helpers ──
  function ratingClass(summary) {
    if (!summary) return "no-reviews";
    const s = summary.toLowerCase();
    // Check negative first: "Overwhelmingly Negative" must not match "overwhelmingly"
    if (s.includes("negative")) return "mostly-negative";
    if (s.includes("overwhelmingly")) return "overwhelming";
    if (s.includes("very positive")) return "very-positive";
    if (s.includes("mostly positive")) return "mostly-positive";
    if (s.includes("mixed")) return "mixed";
    return "no-reviews";
  }

  function formatYear(y) {
    return y && y > 0 ? y : "—";
  }

  function formatScore(score) {
    if (!score || score <= 0) return "—";
    return Number.isInteger(score) ? score : score.toFixed(1);
  }

  // Physical vs Digital detection
  function isPhysical(game) {
    const p = game.Platform || "";
    if (p === "PC (Physical)") return true;
    if (p === "PC (Steam)") return false;
    // Everything else (consoles) is treated as physical
    return true;
  }

  function regionDisplay(region) {
    if (!region || region === "WW") return "";
    const flag = REGION_FLAGS[region] || "🏳️";
    return `<span class="region"><span class="region-flag">${flag}</span> ${escapeHtml(region)}</span>`;
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Only allow http(s) links
  function safeUrl(url) {
    if (!url) return "";
    try {
      const u = new URL(url, location.href);
      return u.protocol === "http:" || u.protocol === "https:" ? u.href : "";
    } catch (e) {
      return "";
    }
  }

  // ── Platform tabs ──
  function buildPlatformTabs() {
    platformCounts = {};
    allGames.forEach((g) => {
      const p = g.Platform || "Unknown";
      platformCounts[p] = (platformCounts[p] || 0) + 1;
    });

    const platformsInData = Object.keys(platformCounts);
    const ordered = PLATFORM_ORDER.filter((p) => p === "All" || platformsInData.includes(p));
    const extras = platformsInData
      .filter((p) => !PLATFORM_ORDER.includes(p))
      .sort((a, b) => a.localeCompare(b));

    const tabs = [...ordered, ...extras];

    $tabs.innerHTML = "";
    tabs.forEach((platform) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "platform-tab";
      btn.dataset.platform = platform;

      btn.textContent = platform;

      btn.addEventListener("click", () => {
        currentPlatform = platform;
        syncTabs();
        applyFilters();
      });
      $tabs.appendChild(btn);
    });

    syncTabs();
  }

  function syncTabs() {
    document.querySelectorAll(".platform-tab").forEach((t) => {
      const active = t.dataset.platform === currentPlatform;
      t.classList.toggle("active", active);
      t.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  // Mouse wheel scrolls tabs horizontally on desktop – but only when it
  // is a pure vertical wheel, the strip overflows, and it isn't at an edge
  // (so the page can still scroll normally).
  $tabs.addEventListener(
    "wheel",
    (e) => {
      if (e.deltaX !== 0 || e.deltaY === 0) return;
      if ($tabs.scrollWidth <= $tabs.clientWidth) return;
      const atStart = $tabs.scrollLeft <= 0 && e.deltaY < 0;
      const atEnd =
        $tabs.scrollLeft + $tabs.clientWidth >= $tabs.scrollWidth - 1 && e.deltaY > 0;
      if (atStart || atEnd) return;
      e.preventDefault();
      $tabs.scrollLeft += e.deltaY;
    },
    { passive: false }
  );

  // ── Render cards ──
  function render() {
    if (filtered.length === 0) {
      $list.innerHTML = "";
      $empty.hidden = false;
      $count.textContent = "0 games";
      return;
    }

    $empty.hidden = true;
    $count.textContent = `${filtered.length} game${filtered.length !== 1 ? "s" : ""}`;

    const frag = document.createDocumentFragment();

    filtered.forEach((g) => {
      const href = safeUrl(g.Link);
      let card;

      if (href) {
        card = document.createElement("a");
        card.href = href;
        card.target = "_blank";
        card.rel = "noopener noreferrer";
      } else {
        card = document.createElement("div");
        card.classList.add("no-link");
      }
      card.classList.add("game-card");

      const badgeClass = ratingClass(g["Review Summary"]);
      const regionHtml = regionDisplay(g.Region);
      const platformLabel = g.Platform
        ? `<span class="meta-item">${escapeHtml(g.Platform)}</span>`
        : "";

      const noteHtml = g.Note
        ? `<div class="game-note">${escapeHtml(g.Note)}</div>`
        : "";

      card.innerHTML = `
        <div class="card-header">
          <div class="game-name">${escapeHtml(g.Name)}${regionHtml}</div>
          <span class="rating-badge ${badgeClass}">${escapeHtml(g["Review Summary"] || "No reviews")}</span>
        </div>
        <div class="card-meta">
          <span class="meta-item"><strong>${formatYear(g["Release Year"])}</strong></span>
          <span class="meta-item">${formatScore(g.Score)}</span>
          ${platformLabel}
        </div>
        <div class="developer">${escapeHtml(g.Developer || "Unknown")}</div>
        ${noteHtml}
      `;

      frag.appendChild(card);
    });

    $list.innerHTML = "";
    $list.appendChild(frag);
  }

  // ── Filter + Sort ──
  function normalizeSearch(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // strip diacritics
      .replace(/ł/g, "l")              // ł has no combining decomposition
      .replace(/[^a-z0-9\s]/g, " ")    // punctuation → space
      .replace(/\s+/g, " ")
      .trim();
  }

  // Sort helper: missing values (0 / undefined) always go last
  function byNumber(key, dir) {
    return (a, b) => {
      const av = a[key] > 0 ? a[key] : null;
      const bv = b[key] > 0 ? b[key] : null;
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return dir === "desc" ? bv - av : av - bv;
    };
  }

  function byName(dir) {
    return (a, b) => {
      const r = (a.Name || "").localeCompare(b.Name || "");
      return dir === "desc" ? -r : r;
    };
  }

  function applyFilters() {
    const nq = normalizeSearch($search.value);
    const media = $media.value;
    const region = $region.value;
    const rating = $rating.value;
    const year = $year.value;
    const sort = $sort.value;

    filtered = allGames.filter((g) => {
      if (currentPlatform !== "All") {
        if ((g.Platform || "Unknown") !== currentPlatform) return false;
      }

      // Physical / Digital filter
      if (media === "physical" && !isPhysical(g)) return false;
      if (media === "digital" && isPhysical(g)) return false;

      // Region filter
      if (region !== "all") {
        if ((g.Region || "WW") !== region) return false;
      }

      if (nq) {
        const name = normalizeSearch(g.Name);
        const dev = normalizeSearch(g.Developer);
        const note = normalizeSearch(g.Note);
        if (!name.includes(nq) && !dev.includes(nq) && !note.includes(nq)) return false;
      }

      if (rating !== "all") {
        if ((g["Review Summary"] || "No user reviews") !== rating) return false;
      }

      if (year !== "all") {
        if (String(g["Release Year"]) !== year) return false;
      }

      return true;
    });

    const primary = {
      name: byName("asc"),
      "name-desc": byName("desc"),
      "year-desc": byNumber("Release Year", "desc"),
      year: byNumber("Release Year", "asc"),
      "score-desc": byNumber("Score", "desc"),
      score: byNumber("Score", "asc")
    }[sort];

    const tieBreak = byName("asc");
    filtered.sort((a, b) => (primary ? primary(a, b) : 0) || tieBreak(a, b));

    render();
    saveStateToHash();
  }

  // ── URL hash state (shareable / survives refresh) ──
  function currentState() {
    return {
      p: currentPlatform,
      q: $search.value.trim(),
      media: $media.value,
      region: $region.value,
      rating: $rating.value,
      year: $year.value,
      sort: $sort.value
    };
  }

  function saveStateToHash() {
    const st = currentState();
    const params = new URLSearchParams();
    if (st.p !== "All") params.set("p", st.p);
    Object.keys(DEFAULTS).forEach((k) => {
      if (st[k] !== DEFAULTS[k]) params.set(k, st[k]);
    });
    const hash = params.toString();
    const url = location.pathname + location.search + (hash ? "#" + hash : "");
    try {
      history.replaceState(null, "", url);
    } catch (e) { /* ignore */ }
  }

  function setSelectIfValid($el, value) {
    if (value == null) return;
    const ok = Array.from($el.options).some((o) => o.value === value);
    if (ok) $el.value = value;
  }

  function loadStateFromHash() {
    const params = new URLSearchParams(location.hash.replace(/^#/, ""));

    const p = params.get("p");
    if (p && platformCounts[p]) currentPlatform = p;

    const q = params.get("q");
    if (q) {
      $search.value = q;
      $clear.classList.add("visible");
    }

    setSelectIfValid($media, params.get("media"));
    setSelectIfValid($region, params.get("region"));
    setSelectIfValid($rating, params.get("rating"));
    setSelectIfValid($year, params.get("year"));
    setSelectIfValid($sort, params.get("sort"));
  }

  // ── Populate year filter ──
  function populateYears() {
    while ($year.options.length > 1) $year.remove(1);

    const years = [...new Set(allGames.map((g) => g["Release Year"]).filter((y) => y > 0))]
      .sort((a, b) => b - a);

    years.forEach((y) => {
      const opt = document.createElement("option");
      opt.value = y;
      opt.textContent = y;
      $year.appendChild(opt);
    });
  }

  // ── Populate region filter (only regions that exist) ──
  function populateRegions() {
    while ($region.options.length > 1) $region.remove(1);

    const regions = [...new Set(allGames.map((g) => g.Region || "WW"))]
      .sort((a, b) => a.localeCompare(b));

    regions.forEach((r) => {
      const opt = document.createElement("option");
      opt.value = r;
      const flag = REGION_FLAGS[r] || "";
      opt.textContent = flag ? `${flag} ${r}` : r;
      $region.appendChild(opt);
    });
  }

  // ── Export current view as CSV ──
  function csvCell(val) {
    let v = String(val ?? "");
    // Neutralise spreadsheet formula injection
    if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
    v = v.replace(/"/g, '""');
    if (/[",\r\n]/.test(v)) v = `"${v}"`;
    return v;
  }

  function exportCSV() {
    if (!filtered.length) {
      alert("Nothing to export");
      return;
    }

    const headers = ["Name", "Platform", "Region", "Release Year", "Score", "Review Summary", "Developer", "Link", "ProductID", "Note"];
    const rows = filtered.map((g) => headers.map((h) => csvCell(g[h])).join(","));

    // BOM so Excel reads UTF-8 (Polish characters etc.) correctly
    const csv = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    const platformSlug = currentPlatform === "All"
      ? "all"
      : currentPlatform.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    a.href = url;
    a.download = `games-library-${platformSlug}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ── Events ──
  let debounce;
  $search.addEventListener("input", () => {
    $clear.classList.toggle("visible", $search.value.length > 0);
    clearTimeout(debounce);
    debounce = setTimeout(applyFilters, 120);
  });

  $clear.addEventListener("click", () => {
    $search.value = "";
    $clear.classList.remove("visible");
    applyFilters();
    $search.focus();
  });

  $media.addEventListener("change", applyFilters);
  $region.addEventListener("change", applyFilters);
  $rating.addEventListener("change", applyFilters);
  $year.addEventListener("change", applyFilters);
  $sort.addEventListener("change", applyFilters);

  $reset.addEventListener("click", () => {
    $search.value = DEFAULTS.q;
    $clear.classList.remove("visible");
    $media.value = DEFAULTS.media;
    $region.value = DEFAULTS.region;
    $rating.value = DEFAULTS.rating;
    $year.value = DEFAULTS.year;
    $sort.value = DEFAULTS.sort;
    currentPlatform = "All";
    syncTabs();
    applyFilters();
  });

  $export.addEventListener("click", exportCSV);

  // ── Keyboard: / focuses search ──
  document.addEventListener("keydown", (e) => {
    if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (document.activeElement && document.activeElement.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    e.preventDefault();
    $search.focus();
    $search.select();
  });

  // ── Jump to top ──
  const $scrollTop = document.getElementById("scrollTop");
  if ($scrollTop) {
    window.addEventListener("scroll", () => {
      $scrollTop.hidden = window.scrollY < 400;
    }, { passive: true });
    $scrollTop.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
    });
  }

  // ── Theme ──
  // `persist` is false when the theme comes from the OS preference, so the
  // app keeps following the system until the user toggles it manually.
  function applyTheme(theme, persist) {
    document.documentElement.setAttribute("data-theme", theme);
    // Icon shows the theme you will switch to
    $theme.textContent = theme === "light" ? "☾" : "☀";
    $theme.title = theme === "light" ? "Switch to dark theme" : "Switch to light theme";
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === "light" ? "#f4f5f7" : "#0f0f13";
    if (persist) storageSet("theme", theme);
  }

  function systemTheme() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function initTheme() {
    const saved = storageGet("theme");
    if (saved === "dark" || saved === "light") applyTheme(saved, false);
    else applyTheme(systemTheme(), false);
  }

  $theme.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    applyTheme(current === "dark" ? "light" : "dark", true);
  });

  // Follow OS changes while the user hasn't chosen a theme explicitly
  if (window.matchMedia) {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const saved = storageGet("theme");
      if (saved !== "dark" && saved !== "light") applyTheme(systemTheme(), false);
    };
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  // ── Error state with retry ──
  function showError(err) {
    $empty.hidden = true;
    $count.textContent = "Error loading data";
    $list.innerHTML = "";

    const box = document.createElement("div");
    box.className = "error-state";
    box.setAttribute("role", "alert");

    const p = document.createElement("p");
    p.textContent = "Could not load games.json";
    const detail = document.createElement("p");
    detail.className = "error-detail";
    detail.textContent = "Make sure it is in the same folder as index.html.";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn";
    btn.textContent = "Retry";
    btn.addEventListener("click", init);

    box.append(p, detail, btn);
    $list.appendChild(box);
    console.error(err);
  }

  // ── Init ──
  async function init() {
    $count.textContent = "Loading…";
    $list.innerHTML = Array(6).fill('<div class="skeleton"></div>').join("");

    try {
      const res = await fetch("games.json");
      if (!res.ok) throw new Error("Failed to load games.json (" + res.status + ")");
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("games.json is not an array");
      allGames = data;

      $stats.textContent = `${allGames.length} games`;
      buildPlatformTabs();
      populateYears();
      populateRegions();
      loadStateFromHash();
      syncTabs();
      applyFilters();

      // Bring the active tab into view (e.g. restored from URL)
      const active = $tabs.querySelector(".platform-tab.active");
      if (active && currentPlatform !== "All" && active.scrollIntoView) {
        active.scrollIntoView({ block: "nearest", inline: "center" });
      }
    } catch (err) {
      showError(err);
    }
  }

  initTheme();
  init();
})();
