(function () {
  "use strict";

  // ── State ──
  let allGames = [];
  let filtered = [];

  // ── DOM ──
  const $search = document.getElementById("search");
  const $clear = document.getElementById("clearSearch");
  const $rating = document.getElementById("ratingFilter");
  const $year = document.getElementById("yearFilter");
  const $sort = document.getElementById("sortBy");
  const $list = document.getElementById("gameList");
  const $count = document.getElementById("resultsCount");
  const $stats = document.getElementById("stats");
  const $empty = document.getElementById("emptyState");
  const $reset = document.getElementById("resetFilters");

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

  function formatRating(pct) {
    return pct && pct > 0 ? pct.toFixed(1) + "%" : "—";
  }

  // ── Render ──
  function render() {
    if (filtered.length === 0) {
      $list.innerHTML = "";
      $empty.hidden = false;
      $count.textContent = "0 games";
      return;
    }

    $empty.hidden = true;
    $count.textContent = `${filtered.length} game${filtered.length !== 1 ? "s" : ""}`;

    // Use DocumentFragment for performance
    const frag = document.createDocumentFragment();

    filtered.forEach((g) => {
      const a = document.createElement("a");
      a.className = "game-card";
      a.href = g["Steam Store URL"] || "#";
      a.target = "_blank";
      a.rel = "noopener noreferrer";

      const badgeClass = ratingClass(g["Review Summary"]);

      a.innerHTML = `
        <div class="card-header">
          <div class="game-name">${escapeHtml(g.Name)}</div>
          <span class="rating-badge ${badgeClass}">${escapeHtml(g["Review Summary"] || "No reviews")}</span>
        </div>
        <div class="card-meta">
          <span class="meta-item"><strong>${formatYear(g["Release Year"])}</strong></span>
          <span class="meta-item">${formatRating(g["Steam Review %"])} positive</span>
        </div>
        <div class="developer">${escapeHtml(g.Developer || "Unknown")}</div>
      `;

      frag.appendChild(a);
    });

    $list.innerHTML = "";
    $list.appendChild(frag);
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ── Filter + Sort ──
  function applyFilters() {
    const q = $search.value.trim().toLowerCase();
    const rating = $rating.value;
    const year = $year.value;
    const sort = $sort.value;

    filtered = allGames.filter((g) => {
      // Search
      if (q) {
        const name = (g.Name || "").toLowerCase();
        const dev = (g.Developer || "").toLowerCase();
        if (!name.includes(q) && !dev.includes(q)) return false;
      }

      // Rating
      if (rating !== "all") {
        if ((g["Review Summary"] || "No user reviews") !== rating) return false;
      }

      // Year
      if (year !== "all") {
        if (String(g["Release Year"]) !== year) return false;
      }

      return true;
    });

    // Sort
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
        case "rating-desc":
          return (b["Steam Review %"] || 0) - (a["Steam Review %"] || 0);
        case "rating":
          return (a["Steam Review %"] || 0) - (b["Steam Review %"] || 0);
        default:
          return 0;
      }
    });

    render();
  }

  // ── Populate year filter ──
  function populateYears() {
    const years = [...new Set(allGames.map((g) => g["Release Year"]).filter((y) => y > 0))]
      .sort((a, b) => b - a);

    years.forEach((y) => {
      const opt = document.createElement("option");
      opt.value = y;
      opt.textContent = y;
      $year.appendChild(opt);
    });
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

  $rating.addEventListener("change", applyFilters);
  $year.addEventListener("change", applyFilters);
  $sort.addEventListener("change", applyFilters);

  $reset.addEventListener("click", () => {
    $search.value = "";
    $clear.classList.remove("visible");
    $rating.value = "all";
    $year.value = "all";
    $sort.value = "name";
    applyFilters();
  });

  // ── Init ──
  async function init() {
    // Show skeletons
    $list.innerHTML = Array(6).fill('<div class="skeleton"></div>').join("");

    try {
      const res = await fetch("games.json");
      if (!res.ok) throw new Error("Failed to load games.json");
      allGames = await res.json();

      $stats.textContent = `${allGames.length} games`;
      populateYears();
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
