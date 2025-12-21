/**
 * script.js — Modern single-file refactor for Color Text Generator
 * 
 * - Uses a <template> for row markup
 * - requestAnimationFrame-based waiting for Pickr
 * - Central config
 * - Cached selectors and cached element properties on row wrappers
 * - Unified render() pipeline
 * - Simplified drag & drop
 *
 * Notes:
 * - Keep this file as one module-style file; it's organized into sections.
 * - Type-style annotations are provided via JSDoc for clarity.
 */

/* =============================================================
   Utilities & Config
   ============================================================= */

/**
 * Waits until window.Pickr exists using requestAnimationFrame
 * @returns {Promise<void>}
 */
function waitForPickr() {
  return new Promise(resolve => {
    const check = () => (window.Pickr ? resolve() : requestAnimationFrame(check));
    check();
  });
}

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

/**
 * App configuration
 * @type {{ defaultColor: string, pickr: object }}
 */
const CONFIG = {
  defaultColor: "#00ffffff",
  pickr: {
    theme: "classic",
    components: {
      preview: true,
      opacity: false,
      hue: true,
      interaction: { hex: false, input: true, save: false }
    }
  }
};

/* =============================================================
   App State & Cached DOM references
   ============================================================= */

const AppState = {
  dragging: null,
};

let lineContainerEl, previewEl, formattedOutputEl, copyOutputBtnEl;
let templateEl;

/* =============================================================
   Render pipeline
   ============================================================= */

/**
 * Re-render both the preview and the formatted output
 */
function render() {
  Preview.update();
  Preview.updateFormatted();
}

/* =============================================================
   Preview manager
   ============================================================= */
const Preview = {
  update() {
    previewEl.innerHTML = "";
    Lines.getRows().forEach(row => {
      const text = row.textInput.value;
      if (!text) return;
      const span = document.createElement("span");
      span.textContent = text;
      span.style.color = row.dataset.color || CONFIG.defaultColor;
      previewEl.appendChild(span);
    });
  },

  updateFormatted() {
    const formatted = Lines.getRows()
      .map(row => {
        const text = row.textInput.value.trim();
        if (!text) return "";
        return `[${row.dataset.color}] ${text}`;
      })
      .filter(Boolean)
      .join("");
    formattedOutputEl.textContent = formatted;
  }
};

/* =============================================================
   Lines manager: create rows from template, init Pickr, caching
   ============================================================= */
const Lines = {
  /**
   * Get live row elements as array
   * @returns {HTMLElement[]}
   */
  getRows() {
    return Array.from(lineContainerEl.querySelectorAll(".lineRow"));
  },

  /**
   * Add a new line row (clones template), sets up cached refs and Pickr
   * @param {string} text
   * @param {string} color
   */
  add(text = "", color = CONFIG.defaultColor) {
    const clone = templateEl.content.cloneNode(true);
    const wrapper = clone.querySelector(".lineRow");

    // set initial dataset color
    wrapper.dataset.color = color;

    // find and cache elements
    const textInput = wrapper.querySelector(".lineText");
    const pickrButton = wrapper.querySelector(".pickrButton");
    const removeBtn = wrapper.querySelector(".removeBtn");
    const dragHandle = wrapper.querySelector(".dragHandle");

    // initial values
    textInput.value = text;

    // cache for fast access
    wrapper.textInput = textInput;
    wrapper.pickrButton = pickrButton;

    // event listeners
    textInput.addEventListener("input", render);

    removeBtn.addEventListener("click", () => {
      wrapper.remove();
      render();
    });

    dragHandle.addEventListener("dragstart", (e) => {
      wrapper.classList.add("dragging");
      AppState.dragging = wrapper;
      e.dataTransfer.setData("text/plain", "");
      e.dataTransfer.effectAllowed = "move";
    });
    dragHandle.addEventListener("dragend", () => {
      wrapper.classList.remove("dragging");
      AppState.dragging = null;
    });

    // append to container
    lineContainerEl.appendChild(wrapper);

    // initialize pickr
    const pickr = Pickr.create({
      el: pickrButton,
      default: color,
      ...CONFIG.pickr
    });

    // apply color on change (live)
    pickr.on("change", (c) => {
      const hex = c.toHEXA().toString();
      wrapper.dataset.color = hex;
      // use Pickr's internal applyColor to update button UI (if available)
      if (typeof pickr.applyColor === "function") {
        pickr.applyColor(false);
      }
      render();
    });

    render();
  },

  /**
   * Reset to single default line
   */
  reset() {
    lineContainerEl.innerHTML = "";
    this.add();
  }
};

/* =============================================================
   Drag-and-drop: simplified dragover handling
   ============================================================= */

function initDragSort() {
  lineContainerEl.addEventListener("dragover", (e) => {
    e.preventDefault();
    const dragging = AppState.dragging;
    if (!dragging) return;

    const rows = Lines.getRows().filter(r => r !== dragging);
    // Find first row where mouse is above its midpoint
    const next = rows.find(r => {
      const rect = r.getBoundingClientRect();
      return e.clientY < (rect.top + rect.height / 2);
    });

    lineContainerEl.insertBefore(dragging, next || null);
    render();
  });
}

/* =============================================================
   Tools, theme, and copy handlers
   ============================================================= */

function initToolsSwitcher() {
  $("#toolList").addEventListener("click", (e) => {
    const tool = e.target.dataset.tool;
    if (!tool) return;
    $$(".toolSection").forEach(s => s.style.display = "none");
    document.getElementById(tool).style.display = "block";

    // update active state in list
    $$(".tool-list__item, .tool-list__item").forEach(li => li.classList.remove("active"));
    e.target.classList.add("active");
  });
}

/**
 * Copy formatted output, show temporary status
 */
function handleCopyOutput() {
  navigator.clipboard.writeText(formattedOutputEl.textContent)
    .then(() => showCopyStatus("Saved ✅", true))
    .catch(() => showCopyStatus("Failed ❌", false));
}

/**
 * Show temporary copy status badge next to the copy button
 * @param {string} msg
 * @param {boolean} ok
 */
function showCopyStatus(msg, ok = true) {
  // remove any existing
  const prev = document.getElementById("copyStatus");
  if (prev) prev.remove();

  const span = document.createElement("span");
  span.id = "copyStatus";
  span.className = `copyStatus ${ok ? "copyStatus--ok" : "copyStatus--fail"}`;
  span.textContent = msg;
  copyOutputBtnEl.insertAdjacentElement("afterend", span);

  // fade out and remove
  setTimeout(() => {
    span.style.opacity = "0";
    setTimeout(() => span.remove(), 500);
  }, 2000);
}

/* Theme toggle */
function initThemeToggle() {
  const darkToggle = $("#darkToggle");
  // respect preference on load
  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    document.body.classList.add("dark");
  }
  const updateButton = () => {
    darkToggle.textContent = document.body.classList.contains("dark") ? "☀️ Light Mode" : "🌙 Dark  Mode";
  };
  updateButton();
  darkToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    updateButton();
  });
}

/* =============================================================
   Initialization
   ============================================================= */

document.addEventListener("DOMContentLoaded", async () => {
  await waitForPickr();

  // cache DOM refs
  lineContainerEl = $("#lineContainer");
  previewEl = $("#preview");
  formattedOutputEl = $("#formattedOutput");
  copyOutputBtnEl = $("#copyOutputBtn");
  templateEl = $("#lineTemplate");

  // init UI features
  initToolsSwitcher();
  initThemeToggle();
  initDragSort();

  // bind primary controls
  $("#addLineBtn").addEventListener("click", () => Lines.add());
  $("#resetBtn").addEventListener("click", () => Lines.reset());
  copyOutputBtnEl.addEventListener("click", handleCopyOutput);

  // start with a single line
  Lines.add();
});

/* ================= MOVE CHECKER MODULE ================= */

const MoveChecker = (() => {
  let pokedex = [];
  let moveIndex = {};
  let allMoves = [];

  const METHOD_LABELS = {
    "TM??": "TM",
    "level": "Level",
    "TUTOR": "Tutor",
    "EGG": "Egg"
  };

  async function load() {
    try {
      const res = await fetch("./monsters.json");
      if (!res.ok) throw new Error("Failed to load monsters.json");
      pokedex = await res.json();
      indexMoves();
      buildMoveList();
      populateTypes();
    } catch (err) {
      console.error("Move Checker failed to load data:", err);
    }
  }

  function indexMoves() {
    moveIndex = {};
    pokedex.forEach(mon => {
      mon.moves.forEach(mv => {
        const key = mv.name.toLowerCase();
        if (!moveIndex[key]) moveIndex[key] = [];
        moveIndex[key].push({
          id: mon.id,
          name: mon.name,
          type: mv.type,
          level: mv.level,
          types: mon.types || []
        });
      });
    });
  }

  function buildMoveList() {
    allMoves = [...new Set(pokedex.flatMap(m => m.moves.map(x => x.name)))].sort();
  }

  function populateTypes() {
    const set = new Set();
    pokedex.forEach(m => m.types?.forEach(t => set.add(t)));
    const sel = document.getElementById("typeFilter");
    [...set].sort().forEach(t => {
      const o = document.createElement("option");
      o.value = t;
      o.textContent = t;
      sel.appendChild(o);
    });
  }

  function update() {
      const move = moveSearch.value.trim().toLowerCase();
      const resultsEl = results;
      resultsEl.innerHTML = "";

      if (!moveIndex[move]) return;

      let list = moveIndex[move];

      const includes = [...document.querySelectorAll(".mc-include:checked")].map(c => c.value);
      const type = typeFilter.value;

      // Filter
      list = list.filter(e => {
          if (includes.length && !includes.includes(e.type)) return false;
          if (type && !e.types.includes(type)) return false;
          return true;
      });

      // Group by name + ID (handles forms properly)
      const grouped = {};
      list.forEach(e => {
          const key = `${e.name}|${e.id}`;
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(e);
      });

      // Render
      Object.values(grouped).forEach(entries => {
          if (!entries.length) return;

          const first = entries[0];
          const pokemonId = String(first.id)
          const spritePath = `sprites/pokemon/${pokemonId}.png`;

          const methodsHtml = entries
              .map(e => `${METHOD_LABELS[e.type] || e.type}${e.level ? " " + e.level : ""}`)
              .join(", ");

          const div = document.createElement("div");
          div.className = "pokemon-result";
          div.style.display = "flex";
          div.style.alignItems = "center";
          div.style.gap = "10px";

          div.innerHTML = `
              <img
                  src="${spritePath}"
                  alt="${first.name}"
                  width="96px"
                  height="96px"
                  onerror="this.onerror=null; this.src='sprites/pokemon/0.png';"
              >
              <div>
                  <strong>${first.name}</strong><br>
                  <span class="method">${methodsHtml}</span>
              </div>
          `;

          resultsEl.appendChild(div);
      });
  }


  function autocomplete(q) {
    autocompleteEl.innerHTML = "";
    if (!q) return;

    allMoves.filter(m => m.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 15)
      .forEach(m => {
        const d = document.createElement("div");
        d.textContent = m;
        d.onclick = () => {
          moveSearch.value = m;
          autocompleteEl.innerHTML = "";
          update();
        };
        autocompleteEl.appendChild(d);
      });
  }

  const moveSearch = document.getElementById("moveSearch");
  const autocompleteEl = document.getElementById("autocomplete");
  const results = document.getElementById("results");
  const typeFilter = document.getElementById("typeFilter");

  moveSearch.addEventListener("input", e => {
    autocomplete(e.target.value);
    update();
  });

  document.addEventListener("change", e => {
    if (e.target.closest("#moveChecker")) update();
  });

  return { load };
})();

/* Init Move Checker after DOM load */
document.addEventListener("DOMContentLoaded", () => {
  MoveChecker.load();
});
