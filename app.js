(function () {
  "use strict";

  // ── State ──
  let allGames = [];
  let filtered = [];
  let currentPlatform = "All";

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
    KR: "🇰🇷",
    CN: "🇨🇳",
    TW: "🇹🇼",
    BR: "🇧🇷",
    RU: "🇷🇺",
    ASIA: "🌏"
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

  // ── Helpers ──
  function ratingClass(summary) {
    if (!summary) return "no-reviews";
    const s = summary.toLowerCase();
    if (s.includes("overwhelmingly")) return "overwhelming";
    if (s.includes("very positive")) return "very-positive";
    if (s.includes("mostly positive")) return "mostly-positive";
    if (s.includes("mixed")) return "mixed";
    if (s.includes("negative")) return "mostly-negative";
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
    // Explicit physical platforms
    if (p === "PC (Physical)") return true;
    if (p === "PC (Steam)") return false;
    // Everything else (consoles) is treated as physical
    return true;
  }

  function regionDisplay(region) {
    if (!region || region === "WW") return "";
    const flag = REGION_FLAGS[region] || "🏳️";
    return `<span class="region"><span class="region-flag">${flag}</span> ${region}</span>`;
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ── Platform tabs ──
  function buildPlatformTabs() {
    const platformsInData = [...new Set(allGames.map((g) => g.Platform || "Unknown"))];

    const ordered = PLATFORM_ORDER.filter((p) => p === "All" || platformsInData.includes(p));
    const extras = platformsInData
      .filter((p) => !PLATFORM_ORDER.includes(p))
      .sort((a, b) => a.localeCompare(b));

    const tabs = [...ordered, ...extras];

    $tabs.innerHTML = "";
    tabs.forEach((platform) => {
      const btn = document.createElement("button");
      btn.className = "platform-tab" + (platform === currentPlatform ? " active" : "");
      btn.textContent = platform;
      btn.dataset.platform = platform;
      btn.addEventListener("click", () => {
        currentPlatform = platform;
        document.querySelectorAll(".platform-tab").forEach((t) => t.classList.remove("active"));
        btn.classList.add("active");
        applyFilters();
      });
      $tabs.appendChild(btn);
    });

    // Allow mouse wheel to scroll tabs horizontally on desktop
    $tabs.addEventListener("wheel", (e) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        $tabs.scrollLeft += e.deltaY;
      }
    }, { passive: false });
  }

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
      const a = document.createElement("a");
      a.className = "game-card";

      if (g.Link) {
        a.href = g.Link;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
      } else {
        a.href = "#";
        a.addEventListener("click", (e) => e.preventDefault());
        a.style.cursor = "default";
      }

      const badgeClass = ratingClass(g["Review Summary"]);
      const regionHtml = regionDisplay(g.Region);
      const platformLabel = g.Platform
        ? `<span class="meta-item">${escapeHtml(g.Platform)}</span>`
        : "";

      const noteHtml = g.Note
        ? `<div class="game-note">${escapeHtml(g.Note)}</div>`
        : "";

      a.innerHTML = `
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

      frag.appendChild(a);
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
      .replace(/[^a-z0-9\s]/g, " ")   // punctuation → space
      .replace(/\s+/g, " ")
      .trim();
  }

  function applyFilters() {
    const q = $search.value.trim().toLowerCase();
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

      if (q) {
        const nq = normalizeSearch(q);
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

    filtered.sort((a, b) => {
      switch (sort) {
        case "name":
          return (a.Name || "").localeCompare(b.Name || "");
        case "name-desc":
          return (b.Name || "").localeCompare(a.Name || "");
        case "year-desc":
          return (b["Release Year"] || 0) - (a["Release Year"] || 0);
        case "year":
          return (a["Release Year"] || 0) - (b["Release Year"] || 0);
        case "score-desc":
          return (b.Score || 0) - (a.Score || 0);
        case "score":
          return (a.Score || 0) - (b.Score || 0);
        default:
          return 0;
      }
    });

    render();
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
  function exportCSV() {
    if (!filtered.length) {
      alert("Nothing to export");
      return;
    }

    const headers = ["Name", "Platform", "Region", "Release Year", "Score", "Review Summary", "Developer", "Link", "ProductID", "Note"];
    const rows = filtered.map((g) =>
      headers.map((h) => {
        let val = g[h] ?? "";
        // Escape quotes and wrap if needed
        val = String(val).replace(/"/g, '""');
        if (val.includes(",") || val.includes('"') || val.includes("\n")) {
          val = `"${val}"`;
        }
        return val;
      }).join(",")
    );

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    const platformSlug = currentPlatform === "All" ? "all" : currentPlatform.toLowerCase().replace(/\s+/g, "-");
    a.href = url;
    a.download = `games-library-${platformSlug}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
    $search.value = "";
    $clear.classList.remove("visible");
    $media.value = "both";
    $region.value = "all";
    $rating.value = "all";
    $year.value = "all";
    $sort.value = "name";
    currentPlatform = "All";
    document.querySelectorAll(".platform-tab").forEach((t) => {
      t.classList.toggle("active", t.dataset.platform === "All");
    });
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
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }


  // ── Theme ──
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    $theme.textContent = theme === "light" ? "☀" : "☾";
    // Update browser chrome color
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === "light" ? "#f4f5f7" : "#0f0f13";
    localStorage.setItem("theme", theme);
  }

  function initTheme() {
    const saved = localStorage.getItem("theme");
    const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    applyTheme(saved || (prefersLight ? "light" : "dark"));
  }

  $theme.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    applyTheme(current === "dark" ? "light" : "dark");
  });

  // ── Init ──
  async function init() {
    initTheme();
    $list.innerHTML = Array(6).fill('<div class="skeleton"></div>').join("");

    try {
      const res = await fetch("games.json");
      if (!res.ok) throw new Error("Failed to load games.json");
      allGames = await res.json();

      $stats.textContent = `${allGames.length} games`;
      buildPlatformTabs();
      populateYears();
      populateRegions();
      applyFilters();
    } catch (err) {
      $list.innerHTML = "";
      $count.textContent = "Error loading data";
      console.error(err);
      alert("Could not load games.json. Make sure it is in the same folder as index.html");
    }
  }

  init();
})();
