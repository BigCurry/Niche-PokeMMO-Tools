/* =============================================================
   Utilities & Config
   ============================================================= */
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

/* =============================================================
   Link Dropdown
   ============================================================= */
const linkToggle = document.getElementById("linkToggle");
const linkDropdown = document.getElementById("linkDropdown");

linkToggle.addEventListener("click", () => {
  linkDropdown.classList.toggle("open");
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".linkMenu")) {
    linkDropdown.classList.remove("open");
  }
});

/* =============================================================
   Tool URLs
   ============================================================= */

const toolRoutes = {
  aboutPage: "about",
  encounterTool: "encounter-data",
  colorTextTool: "color-text",
  moveChecker: "move-checker",
  videoFrameTool: "frame-extractor",
  poryBackground: "background",
  pokedexTool: "dex"
};

// reverse map
const routeToTool = Object.fromEntries(
  Object.entries(toolRoutes).map(([k, v]) => [v, k])
);

function getRoute() {
  const hash = window.location.hash.replace("#", "");
  const path = window.location.pathname;

  // prefer hash if present (better for GitHub Pages / static hosting)
  const raw = hash || path;

  const parts = raw.split("/").filter(Boolean);

  // supports:
  // /tools/encounter-data
  // encounter-data
  // #/tools/encounter-data
  const last = parts[parts.length - 1];

  return last || "about";
}

function navigateToTool(toolId, push = true) {
  const route = toolRoutes[toolId] || "about";

  if (push) {
    window.location.hash = `/tools/${route}`;
  }

  showTool(toolId);
}

function initRouter() {
  const route = getRoute();
  const tool = routeToTool[route] || "aboutPage";

  showTool(tool);
}

/* =============================================================
   Other Globals
   ============================================================= */
function initToolsSwitcher() {
  $("#toolList").addEventListener("click", async (e) => {
    const tool = e.target.dataset.tool;
    if (!tool) return;

    navigateToTool(tool);
  });

  window.addEventListener("popstate", () => {
    const route = getRoute();
    const tool = routeToTool[route] || "aboutPage";
    showTool(tool);
  });

  window.addEventListener("hashchange", () => {
    const route = getRoute();
    const tool = routeToTool[route] || "aboutPage";
    showTool(tool);
  });
}

function showTool(tool) {
  document.dispatchEvent(new Event("about:unmount"));

  $$(".toolSection").forEach(s => s.style.display = "none");
  document.getElementById(tool).style.display = "block";

  $$(".tool-list__item").forEach(li => li.classList.remove("active"));
  document.querySelector(`[data-tool="${tool}"]`)?.classList.add("active");

  const bgSections = ["encounterTool", "colorTextTool", "poryBackground", "moveChecker", "videoFrameTool", "aboutPage", "pokedexTool"];

  if (bgSections.includes(tool)) {
    PoryBackground.show();
    document.body.classList.add("pory-active");
  } else {
    PoryBackground.hide();
    document.body.classList.remove("pory-active");
  }

  document.body.classList.toggle("pory-full", tool === "poryBackground");
}

function initThemeToggle(){
  const darkToggle=$("#darkToggle");

  if(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    document.body.classList.add("dark");
  }

  const updateBtn = () =>
    darkToggle.textContent = document.body.classList.contains("dark") ? "🌙" : "☀️";

  updateBtn();

  darkToggle.addEventListener("click",()=>{
    document.body.classList.toggle("dark");
    updateBtn();
    PoryBackground.updateBgColor();
  });
}

function initAboutPage() {

  const originalParents = new Map();
  let mounted = false;

  function mountTools() {
    if (mounted) return;
    mounted = true;

    $$(".about-tool-slot").forEach(slot => {
      const toolId = slot.dataset.tool;
      const toolEl = document.getElementById(toolId);

      if (!toolEl) return;

      if (!originalParents.has(toolId)) {
        originalParents.set(toolId, toolEl.parentElement);
      }

      slot.appendChild(toolEl);
      toolEl.style.display = "block";
    });
  }

  function unmountTools() {
    if (!mounted) return;
    mounted = false;

    originalParents.forEach((parent, toolId) => {
      const toolEl = document.getElementById(toolId);
      if (!toolEl) return;

      parent.appendChild(toolEl);
      toolEl.style.display = "none";
    });
  }

  // 🔥 LISTEN FOR GLOBAL UNMOUNT SIGNAL
  document.addEventListener("about:unmount", unmountTools);

  // Sidebar clicks
  $("#toolList").addEventListener("click", (e) => {
    const tool = e.target.dataset.tool;
    if (!tool) return;

    if (tool === "aboutPage") {
      mountTools();
    }
  });

  // First load
  const activeTool = document.querySelector(".tool-list__item.active")?.dataset.tool;

  if (activeTool === "aboutPage") {
    mountTools();
  }

  // Jump buttons
  $$(".jumpTool").forEach(btn => {
    btn.addEventListener("click", () => {
      const tool = btn.dataset.tool;

      unmountTools();

      $$(".toolSection").forEach(s => s.style.display = "none");
      document.getElementById(tool).style.display = "block";

      $$(".tool-list__item").forEach(li => li.classList.remove("active"));
      document.querySelector(`[data-tool="${tool}"]`).classList.add("active");
    });
  });
}

/* Sidebar drawer */
const sidebar = $("#sidebar");
const drawerOverlay = $("#drawerOverlay");

$("#menuBtn").addEventListener("click",()=>{
  sidebar.classList.add("open");
  drawerOverlay.classList.add("open");
});

drawerOverlay.addEventListener("click",()=>{
  sidebar.classList.remove("open");
  drawerOverlay.classList.remove("open");
});

/* =============================================================
   Color Text Generator (Refactored)
   ============================================================= */
const ColorTextTool = (() => {

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

  const AppState = { dragging: null };
  let touchDraggingRow = null;

  let lineContainerEl, previewEl, formattedOutputEl, copyOutputBtnEl, templateEl;

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
        .map(r =>
          r.textInput.value.trim()
            ? `[${r.dataset.color}] ${r.textInput.value}`
            : ""
        )
        .filter(Boolean)
        .join("");

      formattedOutputEl.textContent = formatted;
    }
  };

  const Lines = {
    getRows() {
      return Array.from(lineContainerEl.querySelectorAll(".lineRow"));
    },

    add(text = "", color = CONFIG.defaultColor) {
      const clone = templateEl.content.cloneNode(true);
      const wrapper = clone.querySelector(".lineRow");

      wrapper.dataset.color = color;

      const textInput = wrapper.querySelector(".lineText");
      const pickrButton = wrapper.querySelector(".pickrButton");
      const removeBtn = wrapper.querySelector(".removeBtn");
      const dragHandle = wrapper.querySelector(".dragHandle");

      textInput.value = text;
      wrapper.textInput = textInput;

      textInput.addEventListener("input", render);

      removeBtn.addEventListener("click", () => {
        wrapper.remove();
        render();
      });

      /* Drag (desktop) */
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

      /* Drag (touch) */
      dragHandle.addEventListener("pointerdown", (e) => {
        if (e.pointerType !== "touch") return;

        e.preventDefault();
        wrapper.classList.add("dragging");
        touchDraggingRow = wrapper;

        dragHandle.setPointerCapture(e.pointerId);
      });

      lineContainerEl.appendChild(wrapper);

      const pickr = Pickr.create({
        ...CONFIG.pickr,
        el: pickrButton,
        default: color
      });

      pickr.on("change", (c) => {
        wrapper.dataset.color = c.toHEXA().toString();
        pickr.applyColor();
        render();
      });

      render();
    },

    reset() {
      lineContainerEl.innerHTML = "";
      this.add();
    }
  };

  function initDragSort() {
    lineContainerEl.addEventListener("dragover", (e) => {
      e.preventDefault();

      const dragging = AppState.dragging;
      if (!dragging) return;

      const rows = Lines.getRows().filter(r => r !== dragging);

      const next = rows.find(r =>
        e.clientY < r.getBoundingClientRect().top + r.getBoundingClientRect().height / 2
      );

      lineContainerEl.insertBefore(dragging, next || null);
      render();
    });

    lineContainerEl.addEventListener("pointermove", (e) => {
      if (!touchDraggingRow) return;

      const rows = Lines.getRows().filter(r => r !== touchDraggingRow);

      for (const row of rows) {
        const rect = row.getBoundingClientRect();
        if (e.clientY < rect.top + rect.height / 2) {
          lineContainerEl.insertBefore(touchDraggingRow, row);
          return;
        }
      }

      lineContainerEl.appendChild(touchDraggingRow);
    });

    lineContainerEl.addEventListener("pointerup", () => {
      if (!touchDraggingRow) return;

      touchDraggingRow.classList.remove("dragging");
      touchDraggingRow = null;
      render();
    });
  }

  function render() {
    Preview.update();
    Preview.updateFormatted();
  }

  function handleCopyOutput() {
    navigator.clipboard.writeText(formattedOutputEl.textContent)
      .then(() => showCopyStatus("Saved ✅", true))
      .catch(() => showCopyStatus("Failed ❌", false));
  }

  function showCopyStatus(msg, ok = true) {
    const prev = document.getElementById("copyStatus");
    if (prev) prev.remove();

    const span = document.createElement("span");
    span.id = "copyStatus";
    span.className = `copyStatus ${ok ? "copyStatus--ok" : "copyStatus--fail"}`;
    span.textContent = msg;

    copyOutputBtnEl.insertAdjacentElement("afterend", span);

    setTimeout(() => {
      span.style.opacity = "0";
      setTimeout(() => span.remove(), 500);
    }, 2000);
  }

  async function load() {
    // Wait for Pickr
    await new Promise(resolve => {
      const check = () => window.Pickr ? resolve() : requestAnimationFrame(check);
      check();
    });

    // Cache DOM
    lineContainerEl = $("#lineContainer");
    previewEl = $("#preview");
    formattedOutputEl = $("#formattedOutput");
    copyOutputBtnEl = $("#copyOutputBtn");
    templateEl = $("#lineTemplate");

    initDragSort();

    $("#addLineBtn").addEventListener("click", () => Lines.add());
    $("#resetBtn").addEventListener("click", () => Lines.reset());
    copyOutputBtnEl.addEventListener("click", handleCopyOutput);

    Lines.add();
  }

  return { load };

})();

/* =============================================================
   Move Checker
   ============================================================= */
const MoveChecker = (()=>{
  let pokedex=[], moveIndex={}, allMoves=[];
  const METHOD_LABELS={"TM??":"TM","level":"Level","TUTOR":"Tutor","EGG":"Egg","special":"Special","evolve":"Evolve"};

  async function load(){
    try{
      const res=await fetch("./monsters.json");
      if(!res.ok) throw new Error("Failed to load monsters.json");
      pokedex=await res.json();
      indexMoves();
      buildMoveList();
      populateTypes();
    }catch(err){console.error("Move Checker failed:",err);}
  }

  function indexMoves(){
    moveIndex={};
    pokedex.forEach(mon=>{
      mon.moves.forEach(mv=>{
        const key=mv.name.toLowerCase();
        if(!moveIndex[key]) moveIndex[key]=[];
        moveIndex[key].push({...mv,id:mon.id,name:mon.name,types:mon.types||[]});
      });
    });
  }

  function buildMoveList(){allMoves=[...new Set(pokedex.flatMap(m=>m.moves.map(x=>x.name)))].sort();}

  function populateTypes(){
    const set=new Set();
    pokedex.forEach(m=>m.types?.forEach(t=>set.add(t)));
    const sel=$("#typeFilter");
    [...set].sort().forEach(t=>{
      const o=document.createElement("option"); o.value=t; o.textContent=t; sel.appendChild(o);
    });
  }

  /* ===========================================================
     Filters
     =========================================================== */
  const filters = {};
  const triState=["none","include","exclude"]; // none->include->exclude->none

  //$("#").addEventListener("click",()=>{$("#filtersPanel").style.display=($("#filtersPanel").style.display==="none"?"block":"none");});
  $("#filtersBtn").onclick = () => {
      $("#filtersPanel").classList.toggle("collapsed");
  };
  $("#clearFilters").addEventListener("click",()=>{
    $("#moveFilters").querySelectorAll("label").forEach(l=>{
      l.dataset.state="none";
      l.querySelector(".filter-box").textContent="◯";
    });
    $("#typeFilter").value="";
    update();
  });

  // Tri-state click handler
  $("#moveFilters").querySelectorAll("label").forEach(label=>{
    label.dataset.state="none";
    label.addEventListener("click",()=>{
      const curr=label.dataset.state;
      const idx=(triState.indexOf(curr)+1)%triState.length;
      label.dataset.state=triState[idx];
      label.querySelector(".filter-box").textContent=triState[idx]==="none"?"◯":triState[idx]==="include"?"✔":"✖";
      update();
    });
  });

  /* ===========================================================
     Search + Autocomplete
     =========================================================== */
  const moveSearch=$("#moveSearch");
  const autocompleteEl=$("#autocomplete");
  const results=$("#results");
  const typeFilter=$("#typeFilter");

  let activeIndex=-1;
  moveSearch.addEventListener("input",(e)=>{activeIndex=-1;autocomplete(e.target.value); update();});
  moveSearch.addEventListener("keydown",(e)=>{
    const items=Array.from(autocompleteEl.children);
    if(e.key==="ArrowDown"){activeIndex=(activeIndex+1)%items.length; highlight(items); e.preventDefault();}
    else if(e.key==="ArrowUp"){activeIndex=(activeIndex-1+items.length)%items.length; highlight(items); e.preventDefault();}
    else if(e.key==="Enter"){if(items[activeIndex]){moveSearch.value=items[activeIndex].textContent; autocompleteEl.innerHTML=""; update();} e.preventDefault();}
  });

  function highlight(items){
    items.forEach((it,i)=>it.classList.toggle("active",i===activeIndex));
  }

  function autocomplete(q){
    autocompleteEl.innerHTML="";
    if(!q) return;
    allMoves.filter(m=>m.toLowerCase().includes(q.toLowerCase())).slice(0,15)
      .forEach(m=>{
        const div=document.createElement("div");
        div.textContent=m;
        div.addEventListener("click",()=>{moveSearch.value=m; autocompleteEl.innerHTML=""; update();});
        autocompleteEl.appendChild(div);
      });
  }

  /* ===========================================================
     Main update
     =========================================================== */
  function update(){
    const move=moveSearch.value.trim().toLowerCase();
    results.innerHTML="";
    if(!moveIndex[move]) return;

    let list=moveIndex[move];

    const included=[],excluded=[];
    $("#moveFilters").querySelectorAll("label").forEach(l=>{
      const f=l.dataset.filter;
      if(l.dataset.state==="include") included.push(f);
      else if(l.dataset.state==="exclude") excluded.push(f);
    });
    const type=typeFilter.value;

    list=list.filter(e=>{
      if(included.length && !included.includes(e.type)) return false;
      if(excluded.length && excluded.includes(e.type)) return false;
      if(type && !e.types.some(t => t === type)) return false;
      return true;
    });

    const grouped={};
    list.forEach(e=>{
      const key=`${e.name}|${e.id}`;
      if(!grouped[key]) grouped[key]=[];
      grouped[key].push(e);
    });

    Object.values(grouped).forEach(entries=>{
      if(!entries.length) return;
      const first=entries[0];
      const spritePath=`sprites/pokemon/${first.id}.png`;
      const methodsHtml=entries.map(e=>`${METHOD_LABELS[e.type] || e.type}${e.level? " "+e.level : ""}`).join(", ");
      const typesHtml=(first.types||[]).join(", ");

      const div=document.createElement("div");
      div.className="pokemon-result";
      div.innerHTML=`
        <img src="${spritePath}" alt="${first.name}" onerror="this.onerror=null;this.src='sprites/pokemon/0.png';">
        <div>
          <strong>${first.name}</strong><br>
          <span class="method">${methodsHtml}</span><br>
          <span class="type">${typesHtml}</span>
        </div>`;
      results.appendChild(div);
    });
  }

  return { load };
})();

/* =============================================================
   Encounter Info Tool
   ============================================================= */

const EncounterTool = (() => {
  let data = [];
  let searchMode = "pokemon";
  let sort = { key: null, dir: 1 };
  let optimizedMode = true;

  const SEASON_MAP = {
    SEASON0: "Spring",
    SEASON1: "Summer",
    SEASON2: "Fall",
    SEASON3: "Winter"
  };

  const TIME_MAP = {
    MORNING: "Morning",
    DAY: "Day",
    NIGHT: "Night"
  };

  const filters = {
    rarity: {},
    region: {},
    season: {},
    time: {}
  };

  const columnsDefault = {
    pokemon: true, 
    level: true, 
    region: true, 
    route: true,

    type: true, 
    rarity: true, 
    moves: true,
    exp: true, 
    horde: false,

    ev_total: true,
    ev_hp: false,
    ev_attack: false,
    ev_defense: false,
    ev_sp_attack: false,
    ev_sp_defense: false,
    ev_speed: false
  };

  let columns = { ...columnsDefault };

  const COLUMN_PRESETS = {
    default: {
      label: "Default",
      columns: {...columnsDefault}
    },

    exp_farming: {
      label: "EXP",
      columns: {
        pokemon: true,
        level: true,
        region: true,
        route: true,
        rarity: true,
        exp: true,
        horde: true,

        type: false,
        moves: false,

        ev_total: false,
        ev_hp: false,
        ev_attack: false,
        ev_defense: false,
        ev_sp_attack: false,
        ev_sp_defense: false,
        ev_speed: false
      }
    },

    ev_training: {
      label: "EVs",
      columns: {
        pokemon: true,
        level: true,
        region: true,
        route: true,

        ev_total: true,
        ev_hp: true,
        ev_attack: true,
        ev_defense: true,
        ev_sp_attack: true,
        ev_sp_defense: true,
        ev_speed: true,

        exp: false,
        horde: false,
        rarity: false,
        type: false,
        moves: false
      }
    }
  };

  const USER_PRESETS_KEY = "encounter_column_presets";

  let cachedRows = [];
  let visibleRows = [];
  const ROW_HEIGHT = 60; // Approximate row height for virtualization

  async function load() {
    data = await (await fetch("./monsters.json")).json();
    buildFilters();
    buildColumnFilters();
    buildColumnPresetUI()
    buildCachedRows();
    bind();
    update();
  }

  function bind() {
    $("#optimizedToggle").addEventListener("change", e => {
      optimizedMode = e.target.checked;
      update();
    });

    $("#encounterTable thead").addEventListener("click", (e) => {
      const th = e.target.closest("th");
      if (!th || !th.dataset.col) return;
      const key = th.dataset.col;
      if (sort.key === key) sort.dir *= -1;
      else { sort.key = key; sort.dir = -1; }
      updateSortIcons();
      update();
    });

    $("#encounterTable thead").addEventListener("click", e => {
      const close = e.target.closest(".col-close");
      if (!close) return;

      const col = close.dataset.col;

      // Protected columns
      if (["pokemon"].includes(col)) return;

      columns[col] = false;
      toggleColumn(col);

      // Sync checkbox UI
      syncColumnCheckbox(col);

      e.stopPropagation();
    });

    $("#encounterSearch").oninput = debounce(update, 150);

    $("#encounterToggle").onclick = e => {
      if (!e.target.dataset.mode) return;
      searchMode = e.target.dataset.mode;
      $("#encounterToggle").dataset.mode = searchMode;
      $$("#encounterToggle span").forEach(s =>
        s.classList.toggle("active", s.dataset.mode === searchMode)
      );
      update();
    };

    $("#encounterFiltersBtn").onclick = () => {
      $("#encounterFilters").classList.toggle("collapsed");
    };

    // Virtual scroll
    const wrapper = $("#encounterTableWrapper");
    wrapper.addEventListener("scroll", () => {
      if (optimizedMode) renderVisibleRows();
    });
  }

  function buildFilters() {
    const rarity = new Set(), region = new Set(), seasons = new Set(), times = new Set();
    data.forEach(mon => mon.locations?.forEach(loc => {
      rarity.add(loc.rarity);
      region.add(loc.region_name);
      const p = parseSeasonTime(loc.location);
      p.seasons.forEach(s => seasons.add(s));
      p.times.forEach(t => times.add(t));
    }));
    tri("#rarityFilters", rarity, "rarity");
    tri("#regionFilters", region, "region");
    tri("#seasonFilters", [...seasons].map(s => SEASON_MAP[s] || s), "season");
    tri("#timeFilters", [...times].map(t => TIME_MAP[t] || t), "time");
  }

  function tri(el, vals, key) {
    vals.forEach(v => {
      filters[key][v] = "none";
      const l = document.createElement("label");
      l.innerHTML = `<span class="filter-box">◯</span> ${v}`;
      l.onclick = () => {
        filters[key][v] =
          filters[key][v] === "none" ? "include" :
          filters[key][v] === "include" ? "exclude" : "none";
        l.querySelector("span").textContent =
          filters[key][v] === "none" ? "◯" :
          filters[key][v] === "include" ? "✔" : "✖";
        update();
      };
      $(el).appendChild(l);
    });
  }

  function buildColumnFilters() {
    const box = $("#columnFilters");
    box.innerHTML = "";

    Object.keys(columns).forEach(c => {
      const l = document.createElement("label");
      l.innerHTML = `
        <input type="checkbox" data-col="${c}" ${columns[c] ? "checked" : ""}>
        ${c}
      `;

      const input = l.querySelector("input");
      input.onchange = e => {
        columns[c] = e.target.checked;
        toggleColumn(c);
      };

      box.appendChild(l);
    });
  }

  function toggleColumn(c) {
    const display = columns[c] ? "" : "none";
    $$(`#encounterTable [data-col="${c}"]`)
      .forEach(el => el.style.display = display);
  }

  function syncColumnCheckbox(col) {
    const cb = $(`#columnFilters input[data-col="${col}"]`);
    if (cb) cb.checked = columns[col];
  }


  function updateSortIcons() {
    $$("#encounterTable th").forEach(th => {
      const icon = th.querySelector(".sort-icon");
      if (!icon) return;
      icon.textContent = th.dataset.col === sort.key ? (sort.dir === -1 ? "▲" : "▼") : "";
    });
  }

  function calcExp(base, lvl, monID) {
    const equation = Math.ceil((base * lvl / 7))
    const mysteryTerm = 1.25;
    const mysteryIDs = [10, 16, 19, 43, 52, 54, 56, 58, 63, 66, 69, 79, 111, 118, 161, 187, 191, 193, 504, 506, 509, 517, 519];

    if (mysteryIDs.includes(monID) === true) {
      return Math.ceil((equation * mysteryTerm));
    } else {
      return equation;
    }
  }

  function getMoves(mon, lvl) {
    return mon.moves?.filter(m => m.level <= lvl).map(m => m.name).slice(-4).join(", ") || "—";
  }

  function parseSeasonTime(str) {
    const out = {
      seasons: new Set(),
      times: new Set(),
      clean: str
    };

    const match = str.match(/\(([^)]+)\)$/);
    if (!match) return out;

    match[1].split("/").forEach(t => {
      const token = t.trim().toUpperCase();

      if (token.startsWith("SEASON")) {
        out.seasons.add(token);
      } else if (["MORNING", "DAY", "NIGHT"].includes(token)) {
        out.times.add(token);
      }
    });

    out.clean = str.replace(/\s*\([^)]+\)$/, "");
    return out;
  }



  function buildCachedRows() {
    cachedRows = [];
    data.forEach(mon => mon.locations?.forEach(loc => {
      const parsed = parseSeasonTime(loc.location);
      const exp = calcExp(mon.yields.exp, loc.min_level, mon.id);
      const isHorde = loc.rarity?.toLowerCase() === "horde";
      const evs = {
        hp: mon.yields.ev_hp,
        attack: mon.yields.ev_attack,
        defense: mon.yields.ev_defense,
        sp_attack: mon.yields.ev_sp_attack,
        sp_defense: mon.yields.ev_sp_defense,
        speed: mon.yields.ev_speed
      };
      const evTotal = evs.hp + evs.attack + evs.defense + evs.sp_attack + evs.sp_defense + evs.speed;


      cachedRows.push({
        pokemon: mon,
        pokemonLower: mon.name.toLowerCase(),
        loc,
        parsed,
        seasonTokens: [...parsed.seasons].map(s => SEASON_MAP[s] || s).map(s => s.toUpperCase()),
        timeTokens: [...parsed.times].map(t => TIME_MAP[t] || t).map(t => t.toUpperCase()),
        exp,
        horde: isHorde ? `${exp * 3} / ${exp * 5}` : "—",
        moves: getMoves(mon, loc.max_level),
        evs,
        evTotal
      });
    }));
  }

  function update() {
    const q = $("#encounterSearch").value.toLowerCase();

    visibleRows = cachedRows.filter(r => {
      if (searchMode === "pokemon" && !r.pokemonLower.includes(q)) return false;
      if (searchMode === "location" && !r.loc.location.toLowerCase().includes(q)) return false;

      // Season filter
      // SEASON FILTER (include > exclude)
      const includedSeasons = Object.entries(filters.season)
        .filter(([, v]) => v === "include")
        .map(([k]) => k.toUpperCase());

      const excludedSeasons = Object.entries(filters.season)
        .filter(([, v]) => v === "exclude")
        .map(([k]) => k.toUpperCase());

      if (includedSeasons.length) {
        // Include takes priority: show row if it contains ANY included season
        if (!r.seasonTokens.some(s => includedSeasons.includes(s))) return false;
      } else if (excludedSeasons.length) {
        // Exclude only if no includes exist
        // Show row if it contains ANY season that is NOT excluded
        if (r.seasonTokens.every(s => excludedSeasons.includes(s))) return false;
      }

      // TIME FILTER (include > exclude)
      const includedTimes = Object.entries(filters.time)
        .filter(([, v]) => v === "include")
        .map(([k]) => k.toUpperCase());

      const excludedTimes = Object.entries(filters.time)
        .filter(([, v]) => v === "exclude")
        .map(([k]) => k.toUpperCase());

      if (includedTimes.length) {
        // Include takes priority
        // Row is shown if it contains any included time
        if (!r.timeTokens.some(t => includedTimes.includes(t))) return false;
      } else if (excludedTimes.length) {
        // Only exclude tokens if no include exists
        // Row is shown if it contains ANY token that is NOT excluded
        if (r.timeTokens.every(t => excludedTimes.includes(t))) return false;
      }




      const includedRarity = Object.entries(filters.rarity).filter(([,v]) => v === "include").map(([k]) => k);
      const excludedRarity = Object.entries(filters.rarity).filter(([,v]) => v === "exclude").map(([k]) => k);
      if (includedRarity.length && !includedRarity.includes(r.loc.rarity)) return false;
      if (excludedRarity.includes(r.loc.rarity)) return false;

      const includedRegion = Object.entries(filters.region).filter(([,v]) => v === "include").map(([k]) => k);
      const excludedRegion = Object.entries(filters.region).filter(([,v]) => v === "exclude").map(([k]) => k);
      if (includedRegion.length && !includedRegion.includes(r.loc.region_name)) return false;
      if (excludedRegion.includes(r.loc.region_name)) return false;

      return true;
    });

    if (sort.key) {
      visibleRows.sort((a, b) => {
        let va, vb;
        switch (sort.key) {
          case "pokemon": va = a.pokemon.name; vb = b.pokemon.name; break;
          case "region": va = a.loc.region_name; vb = b.loc.region_name; break;
          case "route": va = a.loc.location; vb = b.loc.location; break;
          case "type": va = a.loc.type; vb = b.loc.type; break;
          case "rarity": va = a.loc.rarity; vb = b.loc.rarity; break;
          case "exp": va = a.exp; vb = b.exp; break;
          case "horde": va = a.loc.is_horde ? a.exp : 0; vb = b.loc.is_horde ? b.exp : 0; break;
          case "ev_total": va = a.evTotal; vb = b.evTotal; break;
          case "ev_hp": va = a.evs.hp; vb = b.evs.hp; break;
          case "ev_attack": va = a.evs.attack; vb = b.evs.attack; break;
          case "ev_defense": va = a.evs.defense; vb = b.evs.defense; break;
          case "ev_sp_attack": va = a.evs.sp_attack; vb = b.evs.sp_attack; break;
          case "ev_sp_defense": va = a.evs.sp_defense; vb = b.evs.sp_defense; break;
          case "ev_speed": va = a.evs.speed; vb = b.evs.speed; break;
          default: return 0;
        }
        return typeof va === "number" ? (va - vb) * sort.dir : va.localeCompare(vb) * sort.dir;
      });
    }

    updateSortIcons();

    if (optimizedMode) {
      renderVisibleRows();
    } else {
      renderAllRows();
    }

  }

  function clearEncounterFilters() {
    // Reset tri-state filters
    Object.values(filters).forEach(group => {
      Object.keys(group).forEach(k => group[k] = "none");
    });

    $$("#encounterFilters .filter-box").forEach(box => {
      box.textContent = "◯";
    });

    // Reset columns to DEFAULTS (important)
    Object.assign(columns, columnsDefault);

    // Sync UI + DOM
    Object.keys(columns).forEach(c => {
      toggleColumn(c);
      syncColumnCheckbox(c);
    });

    $("#encounterSearch").value = "";

    sort.key = null;
    sort.dir = 1;
    updateSortIcons();
  }

  function renderVisibleRows() {
    const tbody = $("#encounterTable tbody");
    const wrapper = $("#encounterTableWrapper");

    const scrollTop = wrapper.scrollTop;
    const viewportHeight = wrapper.clientHeight;

    const start = Math.floor(scrollTop / ROW_HEIGHT);
    const visibleCount = Math.ceil(viewportHeight / ROW_HEIGHT) + 6;
    const end = Math.min(start + visibleCount, visibleRows.length);

    const topPadding = start * ROW_HEIGHT - ROW_HEIGHT;
    const bottomPadding = (visibleRows.length - end) * ROW_HEIGHT;

    const frag = document.createDocumentFragment();

    // Top spacer
    if (topPadding > 0) {
      const spacer = document.createElement("tr");
      spacer.style.height = `${topPadding}px`;
      spacer.innerHTML = `<td colspan="9"></td>`;
      frag.appendChild(spacer);
    }

    // Visible rows
    for (let i = start; i < end; i++) {
      const r = visibleRows[i];
      const seasonLabel = r.seasonTokens.map(s => s[0] + s.slice(1).toLowerCase()).join("/");
      const timeLabel = r.timeTokens.map(t => t[0] + t.slice(1).toLowerCase()).join("/");

      const suffix = (seasonLabel || timeLabel)
        ? ` (${[seasonLabel, timeLabel].filter(Boolean).join(" / ")})`
        : "";


      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td data-col="pokemon">
          <div class="pokemon-cell">
            <img src="sprites/pokemon/0.png"
                data-src="sprites/pokemon/${r.pokemon.id}.png"
                alt="${r.pokemon.name}">
            <span>${r.pokemon.name}</span>
          </div>
        </td>
        <td data-col="level">${r.loc.min_level} - ${r.loc.max_level}</td>
        <td data-col="region">${r.loc.region_name}</td>
        <td data-col="route">${r.parsed.clean}${suffix}</td>
        <td data-col="type">${r.loc.type}</td>
        <td data-col="rarity">${r.loc.rarity}</td>
        <td data-col="moves">${r.moves}</td>
        <td data-col="exp">${r.exp}</td>
        <td data-col="horde">${r.horde}</td>
        <td data-col="ev_total">${r.evTotal || "—"}</td>
        <td data-col="ev_hp">${r.evs.hp || "—"}</td>
        <td data-col="ev_attack">${r.evs.attack || "—"}</td>
        <td data-col="ev_defense">${r.evs.defense || "—"}</td>
        <td data-col="ev_sp_attack">${r.evs.sp_attack || "—"}</td>
        <td data-col="ev_sp_defense">${r.evs.sp_defense || "—"}</td>
        <td data-col="ev_speed">${r.evs.speed || "—"}</td>
      `;
      frag.appendChild(tr);
    }

    // Bottom spacer
    if (bottomPadding > 0) {
      const spacer = document.createElement("tr");
      spacer.style.height = `${bottomPadding}px`;
      spacer.innerHTML = `<td colspan="9"></td>`;
      frag.appendChild(spacer);
    }

    tbody.replaceChildren(frag);

    // Lazy-load sprites
    tbody.querySelectorAll("img[data-src]").forEach(img => {
      img.src = img.dataset.src;
      img.onerror = () => img.src = "sprites/pokemon/0.png";
      img.removeAttribute("data-src");
    });

    Object.keys(columns).forEach(toggleColumn);
  }

  function renderAllRows() {
    const tbody = $("#encounterTable tbody");
    const frag = document.createDocumentFragment();

    visibleRows.forEach(r => {
      const seasonLabel = r.seasonTokens.map(s => s[0] + s.slice(1).toLowerCase()).join("/");
      const timeLabel = r.timeTokens.map(t => t[0] + t.slice(1).toLowerCase()).join("/");

      const suffix = (seasonLabel || timeLabel)
        ? ` (${[seasonLabel, timeLabel].filter(Boolean).join(" / ")})`
        : "";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td data-col="pokemon">
          <div class="pokemon-cell">
            <img src="sprites/pokemon/${r.pokemon.id}.png"
                onerror="this.onerror=null;this.src='sprites/pokemon/0.png';">
            <span>${r.pokemon.name}</span>
          </div>
        </td>
        <td data-col="level">${r.loc.min_level} - ${r.loc.max_level}</td>
        <td data-col="region">${r.loc.region_name}</td>
        <td data-col="route">${r.parsed.clean}${suffix}</td>
        <td data-col="type">${r.loc.type}</td>
        <td data-col="rarity">${r.loc.rarity}</td>
        <td data-col="moves">${r.moves}</td>
        <td data-col="exp">${r.exp}</td>
        <td data-col="horde">${r.horde}</td>
        <td data-col="ev_total">${r.evTotal || "—"}</td>
        <td data-col="ev_hp">${r.evs.hp || "—"}</td>
        <td data-col="ev_attack">${r.evs.attack || "—"}</td>
        <td data-col="ev_defense">${r.evs.defense || "—"}</td>
        <td data-col="ev_sp_attack">${r.evs.sp_attack || "—"}</td>
        <td data-col="ev_sp_defense">${r.evs.sp_defense || "—"}</td>
        <td data-col="ev_speed">${r.evs.speed || "—"}</td>
      `;
      frag.appendChild(tr);
    });

    tbody.replaceChildren(frag);
    Object.keys(columns).forEach(toggleColumn);
  }


  function debounce(fn, delay = 150) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  $("#clearEncounterFilters").addEventListener("click",()=>{
    clearEncounterFilters();
    update();
  });

  // Preset stuff
  function loadUserPresets() {
    try {
      return JSON.parse(localStorage.getItem(USER_PRESETS_KEY)) || {};
    } catch {
      return {};
    }
  }

  function saveUserPresets(presets) {
    localStorage.setItem(USER_PRESETS_KEY, JSON.stringify(presets));
  }

  function applyColumnPreset(presetColumns) {
    Object.keys(columns).forEach(col => {
      columns[col] = !!presetColumns[col];
      toggleColumn(col);
      syncColumnCheckbox(col);
    });
  }

  function buildColumnPresetUI() {
    const select = $("#columnPresetSelect");
    select.innerHTML = "";

    // Built-in presets
    Object.entries(COLUMN_PRESETS).forEach(([key, p]) => {
      const opt = document.createElement("option");
      opt.value = `builtin:${key}`;
      opt.textContent = p.label;
      select.appendChild(opt);
    });

    // User presets
    const userPresets = loadUserPresets();
    Object.keys(userPresets).forEach(name => {
      const opt = document.createElement("option");
      opt.value = `user:${name}`;
      opt.textContent = name;
      select.appendChild(opt);
    });
  }

  $("#columnPresetSelect").addEventListener("change", e => {
    const val = e.target.value;
    if (!val) return;

    const [type, key] = val.split(":");

    if (type === "builtin") {
      applyColumnPreset(COLUMN_PRESETS[key].columns);
    }

    if (type === "user") {
      const presets = loadUserPresets();
      applyColumnPreset(presets[key]);
    }
  });

  $("#saveColumnPreset").addEventListener("click", () => {
    const name = prompt("Preset name?");
    if (!name) return;

    const presets = loadUserPresets();
    presets[name] = { ...columns };

    saveUserPresets(presets);
    buildColumnPresetUI();
  });

  $("#deleteColumnPreset").addEventListener("click", () => {
    const select = $("#columnPresetSelect");
    const val = select.value;
    if (!val?.startsWith("user:")) return;

    const name = val.slice(5);
    const presets = loadUserPresets();
    delete presets[name];

    saveUserPresets(presets);
    buildColumnPresetUI();
  });

  return { load };
})();

/* =============================================================
   Video Frame Extractor Tool
   ============================================================= */

const VideoFrameTool = (() => {
  let worker;
  let video, canvas, ctx;
  let savedCount = 0;
  let zip = null;

  let roi = { x: 100, y: 100, w: 200, h: 100 };
  let isDragging = false;
  let startX, startY;

  function init() {
    video = document.createElement("video");
    video.muted = true;

    canvas = document.getElementById("hiddenCanvas");
    ctx = canvas.getContext("2d");

    const slider = document.getElementById("diffThreshold");
    const output = document.getElementById("thresholdValue");

    slider.addEventListener("input", () => {
      output.textContent = slider.value;
    });

    setupROISelector();

    document
      .getElementById("processVideoBtn")
      .addEventListener("click", processVideo);

    document
      .getElementById("videoInput")
      .addEventListener("change", handleVideoLoad);

  }

  function setupROISelector() {

    function getScaledCoords(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    }

    function startDrag(clientX, clientY) {
      isDragging = true;
      const pos = getScaledCoords(clientX, clientY);
      startX = pos.x;
      startY = pos.y;
    }

    function moveDrag(clientX, clientY) {
      if (!isDragging) return;
      const pos = getScaledCoords(clientX, clientY);

      roi.x = Math.min(startX, pos.x);
      roi.y = Math.min(startY, pos.y);
      roi.w = Math.abs(pos.x - startX);
      roi.h = Math.abs(pos.y - startY);

      drawOverlay();
    }

    function endDrag() {
      isDragging = false;
    }

    // Mouse events
    canvas.addEventListener("mousedown", e => startDrag(e.clientX, e.clientY));
    canvas.addEventListener("mousemove", e => moveDrag(e.clientX, e.clientY));
    canvas.addEventListener("mouseup", endDrag);
    canvas.addEventListener("mouseleave", endDrag);

    // Touch events
    canvas.addEventListener("touchstart", e => {
      if (e.touches.length === 1) {
        const t = e.touches[0];
        startDrag(t.clientX, t.clientY);
        e.preventDefault();
      }
    }, { passive: false });

    canvas.addEventListener("touchmove", e => {
      if (e.touches.length === 1) {
        const t = e.touches[0];
        moveDrag(t.clientX, t.clientY);
        e.preventDefault();
      }
    }, { passive: false });

    canvas.addEventListener("touchend", e => endDrag(), { passive: false });
    canvas.addEventListener("touchcancel", e => endDrag(), { passive: false });
  }

  function drawOverlay() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0);

    ctx.strokeStyle = "red";
    ctx.lineWidth = 3;
    ctx.strokeRect(roi.x, roi.y, roi.w, roi.h);
  }


  function getThreshold() {
    return +document.getElementById("diffThreshold").value;
  }

  async function processVideo() {
    const file = document.getElementById("videoInput").files[0];
    if (!file) return alert("Select a video first.");

    zip = new JSZip();
    savedCount = 0;

    video.src = URL.createObjectURL(file);
    video.load();

    await new Promise(resolve => {
      video.onloadedmetadata = resolve;
    });

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Create worker
    worker = new Worker("frameWorker.js");

    const offscreen = new OffscreenCanvas(
      video.videoWidth,
      video.videoHeight
    );

    worker.postMessage({
      type: "init",
      canvas: offscreen
    }, [offscreen]);

    worker.onmessage = handleWorkerResult;

    video.pause();

    await processAllFrames();

    finishZip();
  }



  function handleVideoLoad(e) {
    const file = e.target.files[0];
    if (!file) return;

    video.src = URL.createObjectURL(file);
    video.load();

    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      video.currentTime = 0;
    };

    video.onseeked = () => {
      ctx.drawImage(video, 0, 0);
    };
  }

function handleWorkerResult(e) {
    const { score, frameNum, time, blob } = e.data;

    const progressEl = document.getElementById("progressWindow");

    const line =
        `Frame ${frameNum} | ` +
        `Time ${time.toFixed(3)}s | ` +
        `Diff ${score.toFixed(2)}`;

    const p = document.createElement("div");
    p.textContent = line;

    progressEl.appendChild(p);
    progressEl.scrollTop = progressEl.scrollHeight;

    if (blob) {
        // Save directly from worker blob
        zip.file(
            `frame_${String(savedCount).padStart(5, "0")}.png`,
            blob
        );
        savedCount++;
        p.style.color = "pink";
    }
}


async function processAllFrames() {
    const fps = 60;
    const frameDuration = 1 / fps;

    let currentTime = 0;
    let frameNum = 0;

    const progressEl = document.getElementById("progressWindow");
    progressEl.textContent = "";

    savedCount = 0;

    while (currentTime < video.duration) {
        // Seek to frame
        await seekTo(currentTime);

        // Draw frame to main canvas
        ctx.drawImage(video, 0, 0);

        // Create transferable ImageBitmap for worker
        const bitmap = await createImageBitmap(canvas);

        // Post to worker
        worker.postMessage({
            type: "process",
            bitmap,
            roi,
            threshold: getThreshold(),
            frameNum,
            time: currentTime
        }, [bitmap]);

        frameNum++;
        currentTime += frameDuration;
    }
}


  function seekTo(time) {
    return new Promise(resolve => {
      video.currentTime = time;
      video.onseeked = resolve;
    });
  }

  async function finishZip() {
    const blob = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "unique_frames.zip";
    link.click();

    document.getElementById("frameStatus").textContent =
      `Done. Saved ${savedCount} frames.`;
  }

  return { init };
})();

/* =============================================================
   Pory-Inspired Background
   ============================================================= */

const PoryBackground = (() => {

  let canvas, ctx;
  let particlesByLayer = [];
  let width, height;
  let animationId;
  let initialized = false;
  let running = false;
  let bgColor = "#ffffff";
  let glowCanvas, glowCtx;
  let viewWidth, viewHeight;
  let scaleX = 1;
  let scaleY = 1;
  let PARTICLE_COUNT;
  let resizeTimeoutParticles;

  const SYMBOLS = "~!@#$%^&*()_+`1234567890-=qwertyuiopQWERTYUIOP[]\{}|asdfghjkl;ASDFGHJKL:zxcvbnm,./ZXCVBNM<>?ζᨂᑊᦖꗌ⥉ᐐⓌ⢋ﯳꞼꅑⱝඳⅷủꐭꌎ୮ጤӝ⻬ⶱڮꝋ⊉ᝡଋᝉꑭ෦Ẻ⸈ⰸ䷚ꚛᵔꅓ㈮⨾㊼ꕖꖸｒ⩯⠔ℷ⿆⦓┇ꀦᱵ㍩ڤᗌᒬ";
  const speedFactor = 0.5;
  const frequencyOfImages = 0.05;
  const MAX_DIMENSIONS = 2000;
  const GLOW_COUNT = 10;
  const PoryImages = [];
  const IMAGE_PATH = "scrolling bg art/";
  const IMAGE_COUNT = 8;

  const LAYERS = [
    { color: "#00e5ff", speedMultiplier: 2, sizeMultiplier: 1.5 },
    { color: "#ff00fb", speedMultiplier: 2, sizeMultiplier: 1.3 },
    { color: "#00e5ffaa", speedMultiplier: 1, sizeMultiplier: 1 },
    { color: "#ff00fba9", speedMultiplier: 1, sizeMultiplier: 1 },
    { color: "#00e5ff52", speedMultiplier: 0.6, sizeMultiplier: 0.8 },
    { color: "#ff00fb48", speedMultiplier: 0.6, sizeMultiplier: 0.8 },
  ];

  LAYERS.forEach(layer => {
    // Precompute a fixed font size for the layer
    layer.cachedFont = `${12 * layer.sizeMultiplier}px monospace`;
  });   

  async function loadPoryImages() {
    if (PoryImages.length) return;

    const promises = [];
    let index = 1;
    let loading = true

    while (true) {
      const src = `${IMAGE_PATH}art${index}.png`;

      const img = new Image();

      const p = new Promise((resolve) => {
        img.onload = () => resolve({ success: true, img });
        img.onerror = () => resolve({ success: false });
      });

      img.src = src;
      promises.push(p);

      index++;

      // Stop condition (IMPORTANT)
      if (index >= IMAGE_COUNT) break; // set a max OR track via manifest
    }

    console.log(index);
    const results = await Promise.all(promises);

    for (const r of results) {
      if (r.success) PoryImages.push(r.img);
    }
  }

  class Particle {
    constructor(layerIndex) {
      this.layer = LAYERS[layerIndex];
      if (PoryImages.length > 0 && Math.random() < frequencyOfImages) {
        this.isImage = true;
        this.img = PoryImages[Math.floor(Math.random() * PoryImages.length)];
        this.size = 64 + Math.random() * 90;
      } else {
        this.isImage = false;
        this.staticChar = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
        this.char = this.staticChar;
        this.isGlitching = false;
        this.glitchDuration = 0;
        this.glitchCooldown = Math.floor(Math.random() * 50) + 50;
        this.size = 12;
      }
      this.reset(true);
    }

    reset(initial = false) {
      this.x = Math.random() * viewWidth / scaleX;
      this.y = initial 
        ? Math.random() * viewHeight / scaleY 
        : -50;
      this.speed = 0.5 + Math.random() * 0.5;

      if (!this.isImage) {
        this.char = this.staticChar;
        this.isGlitching = false;
        this.glitchDuration = 0;
        this.glitchCooldown = Math.floor(Math.random() * 200) + 100;
      }
    }

    update() {
      this.y += this.speed * this.layer.speedMultiplier * speedFactor;
      if (this.y > (viewHeight / scaleY) + 50) this.reset(false);

      if (!this.isImage) {
        if (this.isGlitching) {
          this.char = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
          this.glitchDuration--;
          if (this.glitchDuration <= 0) {
            this.isGlitching = false;
            this.char = this.staticChar;
            this.glitchCooldown = Math.floor(Math.random() * 300) + 100;
          }
        } else {
          this.glitchCooldown--;
          if (this.glitchCooldown <= 0) {
            this.isGlitching = true;
            this.glitchDuration = Math.floor(Math.random() * 100) + 5;
          }
        }
      }
    }

    draw() {
      if (this.isImage && this.img && this.img.complete) {
        ctx.drawImage(this.img, this.x, this.y, this.size, this.size);
      } else {
        ctx.fillStyle = this.layer.color;
        ctx.fillText(this.char, this.x, this.y);
      }
    }
  }


  function createCanvas() {
    canvas = document.createElement("canvas");
    canvas.id = "poryCanvas";

    canvas.style.position = "fixed";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.width = "100vw";
    canvas.style.height = "100vh";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "0";
    canvas.style.display = "none"; // hidden by default

    document.body.appendChild(canvas);

    ctx = canvas.getContext("2d");
    resize();
  }

  function createGlowBlobs() {
    if (!glowCanvas) {
      glowCanvas = document.createElement("canvas");
      glowCtx = glowCanvas.getContext("2d");
    } else {
      
    }

    glowCanvas.width = width/2;
    glowCanvas.height = height/2;
    glowCtx.clearRect(0, 0, glowCanvas.width, glowCanvas.height);


    for (let i = 0; i < GLOW_COUNT; i++) {
      const x = Math.random() * glowCanvas.width;
      const y = Math.random() * glowCanvas.height;
      const radius = Math.max(glowCanvas.width, glowCanvas.height) * (0.25 + Math.random() * 0.35);
      const colors = [
        "rgba(0, 221, 255, 0.05)",
        "rgba(221, 0, 255, 0.05)",
        "rgba(34,211,238,0.1)",
        "rgba(217,70,239,0.1)",
        "rgba(34,211,238,0.2)",
        "rgba(217,70,239,0.2)",
      ];

      const gradient = glowCtx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, colors[Math.floor(Math.random() * colors.length)]);
      gradient.addColorStop(0.1, colors[Math.floor(Math.random() * colors.length)]);
      gradient.addColorStop(0.2, colors[Math.floor(Math.random() * colors.length)]);
      gradient.addColorStop(0.3, colors[Math.floor(Math.random() * colors.length)]);
      gradient.addColorStop(0.4, colors[Math.floor(Math.random() * colors.length)]);
      gradient.addColorStop(0.5, colors[Math.floor(Math.random() * colors.length)]);
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      glowCtx.fillStyle = gradient;
      glowCtx.fillRect(0, 0, glowCanvas.width, glowCanvas.height);
    }
  }

  function resize() {
    viewWidth = window.innerWidth;
    viewHeight = window.innerHeight;

    const scale = Math.min(
      1,
      MAX_DIMENSIONS / Math.max(viewWidth, viewHeight)
    );

    width = canvas.width = Math.floor(viewWidth * scale);
    height = canvas.height = Math.floor(viewHeight * scale);

    scaleX = viewWidth / width;
    scaleY = viewHeight / height;

    PARTICLE_COUNT = Math.floor(Math.max(viewWidth, viewHeight) / 15);
  }

  function createParticles() {
    particlesByLayer = LAYERS.map(() => []);

    for (let i = 0; i < PARTICLE_COUNT; i++) {

      const layerIndex = Math.floor(Math.random() * LAYERS.length);
      const p = new Particle(layerIndex);

      particlesByLayer[layerIndex].push(p);
    }
  }

  function updateBgColor() {
    bgColor = getComputedStyle(document.getElementById("poryBackground"))
      .getPropertyValue("--porybg")
      .trim();
  }

  function render() {
    if (!running) return;

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    if (glowCanvas) ctx.drawImage(glowCanvas, 0, 0, width, height);

    for (let i = 0; i < LAYERS.length; i++) {

      const layer = LAYERS[i];
      const particles = particlesByLayer[i];

      ctx.fillStyle = layer.color;
      ctx.font = layer.cachedFont;

      for (const p of particles) {

        p.update();

        if (p.isImage && p.img && p.img.complete) {
          ctx.drawImage(p.img, p.x, p.y, p.size, p.size);
        } else {
          ctx.fillText(p.char, p.x, p.y);
        }
      }
    }

    animationId = requestAnimationFrame(render);
  }

  async function setup() {
    if (initialized) return;
    initialized = true;

    await loadPoryImages();
    updateBgColor();
    createCanvas();
    createParticles();
    createGlowBlobs();

    window.addEventListener("resize", () => {

      clearTimeout(resizeTimeoutParticles);

      resizeTimeoutParticles = setTimeout(() => {
        resize();
        createParticles();
        createGlowBlobs();
      }, 200);

    });

    show();
  }

  function show() {
    if (!canvas) return;

    canvas.style.display = "block";

    if (!running) {
      running = true;
      render();
    }
  }

  function hide() {
    if (!canvas) return;

    canvas.style.display = "none";
    running = false;
    cancelAnimationFrame(animationId);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) hide();
    else show();
  });

  return { setup, show, hide, updateBgColor };

})();

/* =============================================================
   Pokedex Tool
   ============================================================= */
const PokedexTool = (() => {

  /* =============================================================
     STATE
  ============================================================= */

  let data = [];
  let compat = [];
  let filtered = [];

  let grid, modal, modalBody;

  let searchInput;
  let ALL_MOVES = [];
  let ALL_ABILITIES = [];
  let ALL_LOCATIONS = [];
  let ALL_POKEMON = [];

  let LOCATION_DATA = [];
  let ABILITY_DATA = [];
  let MOVE_DATA = {};

  let viewport; // top of initMapControls scope
  /* =============================================================
     const
  ============================================================= */

  const filters = {
    types: [],
    eggGroups: [],
    ability: "",
    moves: ["", "", "", ""],
    location: "",
    stats: {
      hp: 0,
      attack: 0,
      defense: 0,
      sp_attack: 0,
      sp_defense: 0,
      speed: 0
    },
    lockedStats: new Set()
  };

  filters.lockedStats = new Set();


  const MAX_BASE_ID = 649;

  // ✅ manually allow specific IDs ≥ 650 (non-forms, special cases)
  const ID_OVERRIDE = new Set([
    1052
  ]);
  /* =============================================================
     INIT
  ============================================================= */

  async function load() {
    cacheDOM();
    await loadData();
    preprocessData();
    buildAutocompletePools();
    initAdvancedFilters();
    initMapControls()
    bindEvents();
    preloadImages();
    applyFilters();
  }

  function cacheDOM() {
    grid = $("#pokedexGrid");
    modal = $("#pokedexModal");
    modalBody = $("#modalBody");
    searchInput = $("#pokedexSearch");
  }

  async function loadData() {
    const [monRes, compatRes, locRes, abilityRes, moveRes] = await Promise.all([
      fetch("./monsters.json"),
      fetch("./dex_compatibility.json"),
      fetch("./locations.json"),
      fetch("./abilities.json"),
      fetch("./moves.json") // ✅ NEW
    ]);

    data = await monRes.json();
    compat = await compatRes.json();
    LOCATION_DATA = await locRes.json();
    ABILITY_DATA = await abilityRes.json();
    MOVE_DATA = await moveRes.json(); // ✅ NEW
  }


  /* =============================================================
     EVENTS
  ============================================================= */

  function bindEvents() {
    searchInput.addEventListener("input", applyFilters);

    $("#toggleFilters").onclick = () => {
      $("#dexfiltersPanel").classList.toggle("collapsed");
    };

    $("#closeModal").onclick = closeModal;

    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });

    document.querySelectorAll(".reset-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        resetFilter(btn.dataset.reset);
      });
    });

    $("#resetAllBtn").onclick = () => {
      ["types","egg","location","moves","ability","stats"]
        .forEach(resetFilter);
    };
  }

  /* =============================================================
     FILTERING
  ============================================================= */

  function applyFilters() {
    const q = searchInput.value.toLowerCase();

    filtered = data.filter(mon => {

      // 🔥 HARD FILTER FIRST (this is the key fix)
      if (!isEligible(mon)) return false;

      // 🔍 search
      const passesSearch = !q || mon.name.toLowerCase().includes(q);
      if (!passesSearch) return false;

      // 🔥 NO MORE showForms restriction — variants always allowed

      // 🔧 filters
      if (!matchTypes(mon)) return false;
      if (!matchEgg(mon)) return false;
      if (!matchAbility(mon)) return false;
      if (!matchMoves(mon)) return false;
      if (!matchLocation(mon)) return false;
      if (!matchStats(mon)) return false;

      return true;
    });

    renderGrid();
    updateResetButtons();
  }

  function matchTypes(mon) {
    if (!filters.types.length) return true;

    return filters.types.every(t => mon.types?.includes(t));
  }

  function matchLocation(mon) {
    if (!filters.location) return true;

    const { name, region } = filters.location;

    return mon._locations.some(loc =>
      loc.name === name && loc.region === region
    );
  }

  function matchEgg(mon) {
    if (!filters.eggGroups.length) return true;

    return filters.eggGroups.some(e => mon.egg_groups?.includes(e));
  }

  function matchAbility(mon) {
    if (!filters.ability) return true;

    return [...mon._abilities].some(a =>
      a.toLowerCase().includes(filters.ability)
    );
  }

  function matchStats(mon) {
    const stats = mon.stats || {};
    const bst = Object.values(stats).reduce((a,b)=>a+b,0);

    return Object.entries(filters.stats).every(([k, min]) => {
      if (!min) return true;

      if (k === "bst") return bst >= min;
      return (stats[k] || 0) >= min;
    });
  }

  function matchMoves(mon) {
    const activeMoves = filters.moves.filter(Boolean);
    if (!activeMoves.length) return true;

    return activeMoves.every(m =>
      [...mon._moveSet].some(move => move.includes(m))
    );
  }

  function preprocessData() {
    data.forEach(mon => {
      mon._moveSet = new Set((mon.moves || []).map(m => m.name.toLowerCase()));
      mon._abilities = new Set((mon.abilities || []).map(a => a.name));
      mon._locations = (mon.locations || []).map(l => ({
        name: (l.location || "").toLowerCase(),
        region: (l.region_name || "").toLowerCase()
      }));
    });
  }

  function initAdvancedFilters() {
    buildTypePills();
    buildEggPills();
    buildMoveInputs();
    buildAbilityAutocomplete();
    buildMapRegions()
    buildLocationFilter();
    buildStatSliders();
    enhancePokemonSearch();
  }

  function buildTypePills() {
    const container = $("#typePills");
    const types = [...new Set(data.flatMap(m => m.types || []))].sort();

    container.innerHTML = types.map(t => `
      <div class="pill pill-type-${t.toLowerCase()}" data-type="${t}">
        ${t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()}
      </div>
    `).join("");

    container.querySelectorAll(".pill").forEach(pill => {
      pill.onclick = () => {
        const type = pill.dataset.type;

        if (filters.types.includes(type)) {
          filters.types = filters.types.filter(t => t !== type);
          pill.classList.remove("active");
        } else {
          if (filters.types.length >= 2) return;
          filters.types.push(type);
          pill.classList.add("active");
        }

        applyFilters();
      };
    });
  }

  function buildEggPills() {
    const container = $("#eggPills");
    const eggs = [...new Set(data.flatMap(m => m.egg_groups || []))].sort();

    container.innerHTML = eggs.map(e => `
      <div class="pill egg-group-pill-color" data-egg="${e}">${e.replace(/\b\w/g, c => c.toUpperCase())}</div>
    `).join("");

    container.querySelectorAll(".pill").forEach(pill => {
      pill.onclick = () => {
        const egg = pill.dataset.egg;

        if (filters.eggGroups.includes(egg)) {
          filters.eggGroups = filters.eggGroups.filter(e => e !== egg);
          pill.classList.remove("active");
        } else {
          if (filters.eggGroups.length >= 2) return;
          filters.eggGroups.push(egg);
          pill.classList.add("active");
        }

        applyFilters();
      };
    });
  }

  function buildMoveInputs() {
    const inputs = document.querySelectorAll(".moves-grid .dex-input");

    inputs.forEach(input => {
      const slot = Number(input.dataset.slot);

      attachAutocomplete(input, ALL_MOVES, (value) => {
        filters.moves[slot] = value.toLowerCase();
        renderMoveInfo(); // ✅ NEW
        applyFilters();
      });

      input.addEventListener("input", () => {
        filters.moves[slot] = input.value.toLowerCase();
        renderMoveInfo(); // ✅ NEW
        applyFilters();
      });
    });
  }

  function normalizeMoveName(name) {
    return name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-");
  }

  const MOVE_CLASS_SVGS = {
    physical: `
      <svg viewBox="0 0 100 100" class="move-class-svg physical">
        <polygon fill="#e74c3c" points="
          50,5 58,28 82,18 72,40 95,50 72,60
          82,82 58,72 50,95 42,72 18,82 28,60
          5,50 28,40 18,18 42,28
        "/>
      </svg>
    `,
    special: `
      <svg viewBox="0 0 100 100" class="move-class-svg special">
        <defs>
          <mask id="ringMask">
            <rect width="100" height="100" fill="white"/>
            <circle cx="50" cy="50" r="40" fill="white"/>
            <circle cx="50" cy="50" r="32" fill="black"/>
            <circle cx="50" cy="50" r="24" fill="white"/>
            <circle cx="50" cy="50" r="16" fill="black"/>
            <circle cx="50" cy="50" r="8" fill="white"/>
          </mask>
        </defs>
        <circle cx="50" cy="50" r="40" fill="#3498db" mask="url(#ringMask)"/>
      </svg>
    `,
    status: `
      <svg viewBox="0 0 100 100" class="move-class-svg status">
        <defs>
          <mask id="yinMask">
            <rect width="100" height="100" fill="white"/>
            <path d="
              M50 10
              A40 40 0 0 1 50 90
              A20 20 0 0 0 50 50
              A20 20 0 0 1 50 10
            " fill="black"/>
          </mask>
        </defs>
        <circle cx="50" cy="50" r="45" fill="#fff" mask="url(#yinMask)"/>
      </svg>
    `
  };
  
  function renderMoveInfo() {
    const container = $("#moveInfoContainer");

    const activeMoves = filters.moves.filter(Boolean);

    if (!activeMoves.length) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = activeMoves.map(name => {
      const key = normalizeMoveName(name);
      const move = MOVE_DATA[key];

      if (!move) return "";

      const info = move.info || {};
      const price = move.Price || {};

      return `
        <div class="move-box">

          <div class="move-header">

            <div class="move-title">
              ${formatMoveName(key)}
            </div>

            <div class="move-header-right">

              ${info.type ? `
                <span class="move-type-width type-badge type-${info.type}">
                  ${info.type.charAt(0).toUpperCase() + info.type.slice(1).toLowerCase()}
                </span>
              ` : ""}

              ${info.damage_class ? `
                <div class="move-class-icon" title="${info.damage_class}">
                  ${MOVE_CLASS_SVGS[info.damage_class]}
                </div>
              ` : ""}

            </div>

          </div>

          <div class="move-info-grid">
            ${info.power ? `<div><b>Power:</b> ${info.power}</div>` : ""}
            ${info.pp ? `<div><b>PP:</b> ${info.pp}</div>` : ""}
            ${info.accuracy ? `<div><b>Accuracy:</b> ${info.accuracy}</div>` : ""}
            ${info.priority ? `<div><b>Priority:</b> ${info.priority}</div>` : ""}
            ${info.short_effect ? `
              <div class="move-effect">
                ${info.short_effect.replace("$effect_chance", info.effect_chance ?? "")}
              </div>
            ` : ""}

          </div>

          <div class="move-price">
            ${price.yen ? `<span>¥ ${price.yen}</span>` : ""}
            ${price.bp ? `<span>${price.bp} BP</span>` : ""}
            ${price.hs ? `<span>${price.hs} HS</span>` : ""}
          </div>

          <div class="move-icons">
            ${move.TM ? `<span class="icon tm">📀</span>` : ""}
            ${move.Vendor ? `<span class="icon vendor">🏪</span>` : ""}
            ${(move.modifiers || [])
              .filter(Boolean)
              .map(m => `<span class="icon mod">${m}</span>`)
              .join("")}
          </div>

        </div>
      `;
    }).join("");
  }

  function buildAbilityAutocomplete() {
    const input = $("#filterAbility");

    attachAutocomplete(input, ALL_ABILITIES, (value) => {
      filters.ability = value.toLowerCase();
      renderAbilityInfo(value); // ✅ NEW
      applyFilters();
    });

    input.addEventListener("input", () => {
      filters.ability = input.value.toLowerCase();
      renderAbilityInfo(input.value); // ✅ NEW
      applyFilters();
    });
  }

  function renderAbilityInfo(name) {
    const container = $("#abilityInfo");

    const key = name
      .toLowerCase()
      .replace(/\s+/g, "-"); // ✅ normalize

    const ability = ABILITY_DATA[key];

    if (!ability) {
      container.classList.add("hidden");
      container.innerHTML = "";
      return;
    }

    const battle = ability.effect?.battle;
    const overworld = ability.effect?.overworld;

    container.innerHTML = `
      <div class="ability-box">
        <div class="ability-title">Effects</div>

        <div class="ability-section ability-section-overworld">
          <div class="ability-subtitle ability-subtitle-overworld">Overworld</div>
          <div class="ability-text">
            ${overworld || "No effect"}
          </div>
        </div>

        <div class="ability-section ability-section-battle">
          <div class="ability-subtitle ability-subtitle-battle">Battle</div>
          <div class="ability-text">
            ${battle || "No effect"}
          </div>
        </div>
      </div>
    `;

    container.classList.remove("hidden");
  }

  function buildLocationFilter() {
    const input = $("#filterLocation");
    const dropdown = $("#locationDropdown");
    /* ---------------------------
      AUTOCOMPLETE DROPDOWN
    --------------------------- */
    input.addEventListener("input", () => {
      const q = input.value.toLowerCase();

      const matches = LOCATION_DATA.filter(l => {
        const name = l.name.toLowerCase();
        const region = l.region.toLowerCase();
        return name.includes(q) || region.includes(q);
      }).slice(0, 10);

      dropdown.innerHTML = matches.map(l => `
        <div class="dropdown-item" 
            data-name="${l.name}" 
            data-region="${l.region}">
          ${l.name} (${l.region})
        </div>
      `).join("");

      dropdown.classList.toggle("hidden", !matches.length);
    });

    dropdown.addEventListener("click", (e) => {
      const item = e.target.closest(".dropdown-item");
      if (!item) return;

      const name = item.dataset.name;
      const region = item.dataset.region;
      
      selectLocation(name);
      dropdown.classList.add("hidden");
    });

  }

  function selectLocation(name) {
    const loc = LOCATION_DATA.find(l => l.name === name);
    if (!loc) return;

    $("#filterLocation").value = `${loc.name} (${loc.region})`;

    filters.location = {
      name: loc.name.toLowerCase(),
      region: loc.region.toLowerCase()
    };

    placePinFromRegion(loc);
    applyFilters();
  }

  function buildMapRegions() {
    const container = document.getElementById("mapRegions");
    container.innerHTML = "";

    LOCATION_DATA.forEach(loc => {
      let el;

      if (loc.shape === "polygon") {
        el = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        el.setAttribute("points", loc.points);
      }

      el.classList.add("map-region");
      el.dataset.name = loc.name;

      el.addEventListener("click", () => {
        selectLocation(loc.name);
      });

      container.appendChild(el);
    });
  }

  function initMapControls() {
    const svg = document.getElementById("mapSvg");
    viewport = document.getElementById("mapViewport");

    let scale = 1;
    let x = 0;
    let y = 0;
    let isDragging = false;
    let startX, startY;

    let lastDist = 0;
    let lastMid = null;

    function update() {
      ({ x, y } = clamp(x, y, scale));
      svg.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
      svg.style.transformOrigin = "0 0";
    }

    /* ZOOM */
    viewport.addEventListener("wheel", (e) => {
      e.preventDefault();

      const zoomIntensity = 0.1;
      const delta = e.deltaY < 0 ? 1 : -1;

      const rect = viewport.getBoundingClientRect();

      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const oldScale = scale;
      const newScale = Math.max(1, Math.min(4, scale + delta * zoomIntensity));

      // world position BEFORE zoom
      const worldX = (mx - x) / oldScale;
      const worldY = (my - y) / oldScale;

      // apply zoom
      scale = newScale;

      // compute new pan
      let newX = mx - worldX * scale;
      let newY = my - worldY * scale;

      // 🔥 ALWAYS clamp AFTER computing new position
      ({ x: newX, y: newY } = clamp(newX, newY, scale));

      x = newX;
      y = newY;

      update();
    });

    /* PAN */
    viewport.addEventListener("mousedown", (e) => {
      isDragging = true;
      startX = e.clientX - x;
      startY = e.clientY - y;
      viewport.style.cursor = "grabbing";
    });

    window.addEventListener("mousemove", (e) => {
      if (!isDragging) return;

      x = e.clientX - startX;
      y = e.clientY - startY;

      update();
    });

    window.addEventListener("mouseup", () => {
      isDragging = false;
      viewport.style.cursor = "grab";
    });

    viewport.addEventListener("touchstart", (e) => {
      if (e.touches.length === 2) {
        lastDist = getTouchDistance(e);
        lastMid = getTouchMidpoint(e);
      }
    }, { passive: false });

    viewport.addEventListener("touchmove", (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();

        const newDist = getTouchDistance(e);
        const newMid = getTouchMidpoint(e);

        const zoomFactor = newDist / lastDist;
        const newScale = Math.max(1, Math.min(4, scale * zoomFactor));

        const rect = viewport.getBoundingClientRect();
        const mx = newMid.x - rect.left;
        const my = newMid.y - rect.top;

        const worldX = (mx - x) / scale;
        const worldY = (my - y) / scale;

        lastDist = newDist;
        lastMid = newMid;

        scale = newScale;

        let newX = mx - worldX * scale;
        let newY = my - worldY * scale;

        ({ x: newX, y: newY } = clamp(newX, newY, scale));

        x = newX;
        y = newY;

        update();
      }
    }, { passive: false });

    viewport.addEventListener("touchend", () => {
      lastDist = 0;
      lastMid = null;
    });

    initMapDevTools()
  }

  function getTouchDistance(e) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    return Math.hypot(dx, dy);
  }

  function getTouchMidpoint(e) {
    return {
      x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
      y: (e.touches[0].clientY + e.touches[1].clientY) / 2
    };
  }

  function clamp(x, y, scale) {
    const rect = viewport.getBoundingClientRect();

    // ✅ CONSTANT world size (from viewBox)
    const worldWidth = 1662;
    const worldHeight = 1174;

    // ✅ Convert SVG units → screen pixels ONCE
    const baseScaleX = rect.width / worldWidth;
    const baseScaleY = rect.height / worldHeight;

    // since preserveAspectRatio="none", both scale independently
    const scaledWidth = worldWidth * baseScaleX * scale;
    const scaledHeight = worldHeight * baseScaleY * scale;

    let minX, maxX, minY, maxY;

    // X axis
    if (scaledWidth <= rect.width) {
      minX = maxX = (rect.width - scaledWidth) / 2;
    } else {
      minX = rect.width - scaledWidth;
      maxX = 0;
    }

    // Y axis
    if (scaledHeight <= rect.height) {
      minY = maxY = (rect.height - scaledHeight) / 2;
    } else {
      minY = rect.height - scaledHeight;
      maxY = 0;
    }

    return {
      x: Math.min(maxX, Math.max(minX, x)),
      y: Math.min(maxY, Math.max(minY, y))
    };
  }

  function placePinFromRegion(loc) {
    const points = loc.points.split(" ").map(p => p.split(",").map(Number));

    // simple centroid
    const cx = points.reduce((sum, p) => sum + p[0], 0) / points.length;
    const cy = points.reduce((sum, p) => sum + p[1], 0) / points.length;

    const pin = document.getElementById("mapPin");
    pin.setAttribute("cx", cx);
    pin.setAttribute("cy", cy);
    pin.classList.remove("hidden");
  }

  function initMapDevTools() {
    const svg = document.getElementById("mapSvg");

    let devMode = false;
    let drawing = false;
    let currentPoints = [];

    let polygons = [...LOCATION_DATA]; // preload existing

    /* -------------------------
      UI: COPY BUTTON
    ------------------------- */
    const copyBtn = document.createElement("button");
    copyBtn.textContent = "Copy JSON";
    Object.assign(copyBtn.style, {
      position: "fixed",
      bottom: "20px",
      right: "20px",
      zIndex: 9999,
      padding: "8px 12px",
      background: "#00c8ff",
      border: "none",
      borderRadius: "6px",
      cursor: "pointer",
      display: "none"
    });

    document.body.appendChild(copyBtn);

    copyBtn.onclick = () => {
      const json = JSON.stringify(polygons, null, 2);
      navigator.clipboard.writeText(json);
      copyBtn.textContent = "Copied!";
      setTimeout(() => copyBtn.textContent = "Copy JSON", 1000);
    };

    /* -------------------------
      KEY CONTROLS
    ------------------------- */
    window.addEventListener("keydown", (e) => {
      if (e.key.toLowerCase() === "d") {
        devMode = !devMode;
        copyBtn.style.display = devMode ? "block" : "none";
        console.log("DEV MODE:", devMode);
      }

      if (!devMode) return;

      if (e.key.toLowerCase() === "p") {
        if (!drawing) {
          // START DRAWING
          drawing = true;
          currentPoints = [];
          console.log("Polygon start");
        } else {
          // FINISH DRAWING
          drawing = false;
          openPolygonForm(currentPoints);
        }
      }
    });

    /* -------------------------
      CLICK HANDLER
    ------------------------- */
    svg.addEventListener("click", (e) => {
      if (!devMode || !drawing) return;

      const pt = getSVGPoint(svg, e.clientX, e.clientY);

      currentPoints.push([pt.x, pt.y]);

      drawTempPoint(pt);
      drawTempPolygon(currentPoints);
    });

    /* -------------------------
      SVG POINT CONVERSION
    ------------------------- */
    function getSVGPoint(svg, clientX, clientY) {
      const pt = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;

      return pt.matrixTransform(svg.getScreenCTM().inverse());
    }

    /* -------------------------
      TEMP DRAWING
    ------------------------- */
    let tempPoly = null;

    function drawTempPoint(pt) {
      const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      c.setAttribute("cx", pt.x);
      c.setAttribute("cy", pt.y);
      c.setAttribute("r", 4);
      c.setAttribute("fill", "red");
      svg.appendChild(c);
    }

    function drawTempPolygon(points) {
      if (tempPoly) tempPoly.remove();

      tempPoly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      tempPoly.setAttribute(
        "points",
        points.map(p => p.join(",")).join(" ")
      );
      tempPoly.setAttribute("fill", "rgba(255,0,0,0.2)");
      tempPoly.setAttribute("stroke", "red");

      svg.appendChild(tempPoly);
    }

    /* -------------------------
      FORM UI
    ------------------------- */
    function openPolygonForm(points) {
      const modal = document.createElement("div");

      Object.assign(modal.style, {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        background: "#222",
        padding: "20px",
        zIndex: 10000,
        borderRadius: "10px"
      });

      modal.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:10px;">
          <input id="polyName" placeholder="Location name">
          <input id="polyRegion" placeholder="Region">
          <button id="savePoly">Save</button>
        </div>
      `;

      document.body.appendChild(modal);

      modal.querySelector("#savePoly").onclick = () => {
        const name = modal.querySelector("#polyName").value;
        const region = modal.querySelector("#polyRegion").value;

        const polygon = {
          name,
          region,
          shape: "polygon",
          points: points.map(p => p.join(",")).join(" ")
        };

        polygons.push(polygon);

        console.log("Saved:", polygon);

        modal.remove();
        clearTemp();
      };
    }

    function clearTemp() {
      currentPoints = [];
      if (tempPoly) tempPoly.remove();
    }
  }

  function buildStatSliders() {
    const container = $("#statFilters");

    container.innerHTML = `
      <div class="stat-wrapper">

        ${STAT_KEYS.map(stat => `
          <div class="stat-row-filter">

            <button class="lock-btn" data-stat="${stat}">
              🔓
            </button>

            <span class="stat-label">
              ${STAT_LABELS[stat] || stat.toUpperCase()}
            </span>

            <input 
              type="range" 
              min="0" 
              max="${MAX_STATS[stat]}" 
              value="0" 
              data-stat="${stat}"
            >

            <input 
              class="dex-input stat-input"
              type="number" 
              min="0" 
              max="${MAX_STATS[stat]}" 
              value="0" 
              data-stat="${stat}"
            >

          </div>
        `).join("")}

      </div>
    `;

    container.querySelectorAll("input").forEach(i =>
      i.addEventListener("input", onStatInput)
    );

    container.querySelectorAll(".lock-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const stat = btn.dataset.stat;
        const row = btn.closest(".stat-row-filter");

        if (filters.lockedStats.has(stat)) {
          filters.lockedStats.delete(stat);
          btn.textContent = "🔓";
          
          row.classList.remove("locked-row");
          btn.classList.remove("active");
        } else {
          filters.lockedStats.add(stat);
          btn.textContent = "🔒";

          row.classList.add("locked-row");
          btn.classList.add("active");
        }
      });
    });
  }

  function onStatInput(e) {
    const stat = e.target.dataset.stat;
    let value = Number(e.target.value);

    if (filters.lockedStats.has(stat)) return;

    filters.stats[stat] = value;

    normalizeStats(stat);

    syncInputs();
    applyFilters();
  }

  function normalizeStats(changedStat = null) {
    const stats = filters.stats;

    const keys = STAT_KEYS.filter(k => !filters.lockedStats.has(k));

    // locked stats are frozen
    const lockedTotal = STAT_KEYS
      .filter(k => filters.lockedStats.has(k))
      .reduce((s, k) => s + stats[k], 0);

    let freeTotal = keys.reduce((s, k) => s + stats[k], 0);

    let maxFree = MAX_BST - lockedTotal;

    // if over budget → reduce evenly
    if (freeTotal > maxFree) {
      let overflow = freeTotal - maxFree;

      while (overflow > 0) {
        for (const k of keys) {
          if (overflow === 0) break;

          if (stats[k] > 0) {
            stats[k]--;
            overflow--;
          }
        }
      }
    }

    // enforce per-stat caps
    for (const k of STAT_KEYS) {
      stats[k] = Math.max(0, Math.min(MAX_STATS[k], stats[k]));
    }
  }

  function syncInputs() {
    document.querySelectorAll(".stat-row-filter input").forEach(input => {
      const stat = input.dataset.stat;
      input.value = filters.stats[stat];
    });
  }

  function formatMoveName(key) {
    return key
      .replace(/-/g, " ")
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  function buildAutocompletePools() {
    const moves = new Set();
    const abilities = new Set();
    const locations = new Set();
    const pokemon = new Set();

    data.forEach(mon => {
      pokemon.add(mon.name);

      (mon.abilities || []).forEach(a => abilities.add(a.name));
      (mon.locations || []).forEach(l => locations.add(l.location));
    });

    // 🔥 use MOVE_DATA instead of mon.moves
    Object.keys(MOVE_DATA).forEach(key => {
      moves.add(formatMoveName(key));
    });

    ALL_MOVES = [...moves].sort();
    ALL_ABILITIES = [...abilities].sort();
    ALL_LOCATIONS = [...locations].sort();
    ALL_POKEMON = [...pokemon].sort();
  }

  function attachAutocomplete(input, dataList, onSelect) {
    const wrapper = document.createElement("div");
    wrapper.className = "autocomplete-wrapper";

    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const dropdown = document.createElement("div");
    dropdown.className = "autocomplete-dropdown hidden";
    wrapper.appendChild(dropdown);

    let currentFocus = -1;

    input.addEventListener("input", () => {
      const val = input.value.toLowerCase();

      dropdown.innerHTML = "";
      currentFocus = -1;

      if (!val) {
        dropdown.classList.add("hidden");
        return;
      }

      const matches = dataList
        .filter(item => item.toLowerCase().includes(val))
        .slice(0, 50);

      if (!matches.length) {
        dropdown.classList.add("hidden");
        return;
      }

      matches.forEach(item => {
        const div = document.createElement("div");
        div.className = "autocomplete-item";
        div.textContent = item;

        div.onclick = () => {
          input.value = item;
          dropdown.classList.add("hidden");
          onSelect(item);
        };

        dropdown.appendChild(div);
      });

      dropdown.classList.remove("hidden");
    });

    input.addEventListener("keydown", (e) => {
      const items = dropdown.querySelectorAll(".autocomplete-item");

      if (e.key === "ArrowDown") {
        currentFocus++;
        highlight(items);
      } else if (e.key === "ArrowUp") {
        currentFocus--;
        highlight(items);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (items[currentFocus]) items[currentFocus].click();
      }
    });

    function highlight(items) {
      items.forEach(i => i.classList.remove("active"));

      if (currentFocus >= items.length) currentFocus = 0;
      if (currentFocus < 0) currentFocus = items.length - 1;

      if (items[currentFocus]) {
        items[currentFocus].classList.add("active");
      }
    }

    document.addEventListener("click", (e) => {
      if (!wrapper.contains(e.target)) {
        dropdown.classList.add("hidden");
      }
    });
  }

  function resetFilter(type) {
    switch (type) {
      case "types":
        filters.types = [];
        $$("#typePills .pill").forEach(p => p.classList.remove("active"));
        break;

      case "egg":
        filters.eggGroups = [];
        $$("#eggPills .pill").forEach(p => p.classList.remove("active"));
        break;

      case "location":
        filters.location = "";
        $("#filterLocation").value = "";
        $("#mapPin")?.classList.add("hidden");
        break;

      case "moves":
        filters.moves = ["", "", "", ""];
        document.querySelectorAll(".moves-grid input").forEach(i => i.value = "");
        $("#moveInfoContainer").innerHTML = "";
        break;

      case "ability":
        filters.ability = "";
        $("#filterAbility").value = "";
        $("#abilityInfo").classList.add("hidden");
        break;

      case "stats":
        filters.stats = {
          hp: 0, attack: 0, defense: 0,
          sp_attack: 0, sp_defense: 0, speed: 0
        };
        filters.lockedStats.clear();

        document.querySelectorAll(".stat-input").forEach(i => i.value = 0);
        document.querySelectorAll('input[type="range"]').forEach(i => i.value = 0);
        document.querySelectorAll(".lock-btn").forEach(b => {
          b.textContent = "🔓";
          b.classList.remove("active");
        });
        break;
    }

    applyFilters();
    updateResetButtons();
  }

  function isFilterActive(type) {
    switch (type) {
      case "types": return filters.types.length > 0;
      case "egg": return filters.eggGroups.length > 0;
      case "location": return !!filters.location;
      case "moves": return filters.moves.some(Boolean);
      case "ability": return !!filters.ability;
      case "stats":
        return Object.values(filters.stats).some(v => v > 0)
          || filters.lockedStats.size > 0;
    }
  }

  function updateResetButtons() {
    let anyActive = false;

    document.querySelectorAll(".reset-btn").forEach(btn => {
      const active = isFilterActive(btn.dataset.reset);

      btn.classList.toggle("hidden", !active);

      if (active) anyActive = true;
    });

    $("#resetAllBtn").classList.toggle("hidden", !anyActive);
  }


  /* =============================================================
     GRID
  ============================================================= */

  function enhancePokemonSearch() {
    attachAutocomplete(searchInput, ALL_POKEMON, (value) => {
      searchInput.value = value;
      applyFilters();
    });
  }

  function renderGrid() {
    grid.innerHTML = "";
    const frag = document.createDocumentFragment();

    filtered.forEach(mon => {
      const card = createCard(mon);
      frag.appendChild(card);
    });

    grid.appendChild(frag);
  }

  function createCard(mon) {
    const card = document.createElement("div");
    card.className = "poke-card";

    const base = getBaseForm(mon);
    const baseId = String(base.id).padStart(3, "0");

    const isVariant = mon.id !== base.id;

    card.innerHTML = `
      <div class="poke-card-inner ${isVariant ? "variant" : ""}">
        <img src="pory pokedex images/pokedex_webp/Pokedex_${baseId}.webp">
        
        ${isVariant ? `<div class="variant-badge">Variant</div>` : ""}

        <div class="sr-only">${mon.name}</div>
      </div>
    `;

    const img = card.querySelector("img");
    applyImageFallback(img, base.id, baseId);

    card.onclick = () => openModal(card, mon);

    return card;
  }

  /* Processing IDs above 649 */
  function isBasePokemon(mon) {
    return mon.id <= MAX_BASE_ID;
  }

  function isAllowedOverride(mon) {
    return ID_OVERRIDE.has(mon.id);
  }

  function isVariant(mon) {
    return data.some(base =>
      base.id <= MAX_BASE_ID &&
      base.forms?.some(f => f.id === mon.id)
    );
  }

  function isEligible(mon) {
    return (
      mon.id <= MAX_BASE_ID ||   // base Pokémon
      isVariant(mon) ||          // ALL variants always allowed
      isAllowedOverride(mon)     // manual overrides
    );
  }

  // 🔥 find base form (assumes forms array exists)
  function getBaseForm(mon) {
    if (mon.id <= MAX_BASE_ID) return mon;

    // find a Pokémon that lists this as a form
    return data.find(base =>
      base.forms?.some(f => f.id === mon.id)
    ) || mon;
  }

  /* =============================================================
     IMAGE HANDLING
  ============================================================= */

  function applyImageFallback(img, monId, paddedId) {
    img.onerror = function () {
      if (!this.dataset.fallback) {
        this.dataset.fallback = 1;
        this.src = `pory pokedex images/pokedex_png/Pokedex_${paddedId}.png`;
      } else if (this.dataset.fallback == 1) {
        this.dataset.fallback = 2;
        this.src = `sprites/pokemon/${monId}.png`;
      } else if (this.dataset.fallback == 2) {
        this.dataset.fallback = 3;
        this.src = `pory pokedex images/pokedex_png/Pokedex_000.png`;
      } else {
        this.onerror = null;
      }
    };
  }


  /* =============================================================
     MODAL
  ============================================================= */

  function openModal(card, mon) {
    animateCardToModal(card);
    setTimeout(() => showModal(mon), 250);
  }

  function animateCardToModal(card) {
    const rect = card.getBoundingClientRect();
    const clone = card.cloneNode(true);

    Object.assign(clone.style, {
      position: "fixed",
      left: rect.left + "px",
      top: rect.top + "px",
      width: rect.width + "px",
      height: rect.height + "px",
      zIndex: 1000
    });

    document.body.appendChild(clone);

    requestAnimationFrame(() => {
      clone.style.transition = "all 0.5s ease";
      clone.style.left = "50%";
      clone.style.top = "50%";
      clone.style.transform = "translate(-50%, -50%) scale(3)";
      clone.style.opacity = "0";
    });

    setTimeout(() => clone.remove(), 250);
  }

  function showModal(mon) {
    modal.classList.remove("hidden");
    modalBody.innerHTML = buildModal(mon);

    initTabs();
    initFormsDropdown(mon);
    bindEvolutionClicks();
  }

  function closeModal() {
    modal.classList.add("hidden");
  }

  function switchForm(id) {
    const mon = data.find(m => m.id === id);
    if (!mon) return;

    updateModal(mon);
  }

  function updateModal(mon) {
    updateHeader(mon);
    updateImage(mon);
    updateSections(mon);
    bindEvolutionClicks();
  }


  /* =============================================================
     MODAL BUILDERS
  ============================================================= */

  function buildModal(mon) {
    const hasForms = mon.forms?.length > 1;

    return `
      <div class="pokedex-layout">

        ${buildLeftPanel(mon, hasForms)}
        ${buildRightPanel(mon)}

      </div>
    `;
  }

  function buildLeftPanel(mon, hasForms) {
    return `
      <div class="pokedex-left">

        <div class="pokedex-header">
          <div id="pokedexName" class="pokedex-name">
            ${mon.name} ${hasForms ? "▼" : ""}
          </div>
          <div id="formsDropdown" class="forms-grid hidden"></div>
        </div>

        <img id="mainImage"
          class="pokedex-modal-image-main"
          src="${getAnimatedSprite(mon.id)}"
          onerror="this.src='sprites/pokemon/0.png'">

        <div id="stats">
          ${buildStats(mon)}
        </div>

      </div>
    `;
  }

  function buildRightPanel(mon) {
    return `
      <div class="pokedex-right">

        <div class="tabs">
          <div class="tab active" data-tab="summary">Summary</div>
          <div class="tab" data-tab="evolutions">Evolutions</div>
          <div class="tab" data-tab="moves">Moves</div>
          <div class="tab" data-tab="locations">Locations</div>
        </div>

        <div id="summary" class="tab-content active">
          ${buildSummary(mon)}
        </div>

        <div class="tab-content" id="evolutions">
          ${buildEvolutions(mon)}
        </div>

        <div id="moves" class="tab-content">
          ${buildMoves(mon)}
        </div>

        <div id="locations" class="tab-content">
          ${buildLocations(mon)}
        </div>

      </div>
    `;
  }

  /* =============================================================
    TABS
  ============================================================= */

  function initTabs() {
    const tabs = $$(".tab");
    const contents = $$(".tab-content");

    tabs.forEach(tab => {
      tab.onclick = () => {
        // remove active states
        tabs.forEach(t => t.classList.remove("active"));
        contents.forEach(c => c.classList.remove("active"));

        // activate clicked tab
        tab.classList.add("active");

        const target = document.getElementById(tab.dataset.tab);
        if (target) target.classList.add("active");
      };
    });
  }

  /* =============================================================
     MODAL UPDATES
  ============================================================= */

  function updateHeader(mon) {
    const el = $("#pokedexName");
    const hasForms = mon.forms?.length > 1;
    el.textContent = mon.name + (hasForms ? " ▼" : "");
  }

  function updateImage(mon) {
    const img = $("#mainImage");
    img.src = getAnimatedSprite(mon.id);
    img.onerror = () => img.src = `sprites/pokemon/${mon.id}.png`;
  }

  function updateSections(mon) {
    $("#stats").innerHTML = buildStats(mon);
    $("#summary").innerHTML = buildSummary(mon);
    $("#moves").innerHTML = buildMoves(mon);
    $("#locations").innerHTML = buildLocations(mon);
    $("#evolutions").innerHTML = buildEvolutions(mon);
    bindEvolutionClicks();
  }


  /* =============================================================
     DATA HELPERS
  ============================================================= */

  function getPokeApiId(id) {
    return compat[id - 1]?.PokeAPI_id || id;
  }

  function getAnimatedSprite(id) {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${getPokeApiId(id)}.gif`;
  }


  /* =============================================================
     STATS
  ============================================================= */

  const STAT_KEYS = ["hp","attack","defense","sp_attack","sp_defense","speed"];

  const STAT_LABELS = {
    hp: "HP", attack: "Atk", defense: "Def",
    speed: "Spe", sp_attack: "SpA", sp_defense: "SpD"
  };
  
  const MAX_STATS = {
    hp: 255, attack: 180, defense: 230,
    speed: 180, sp_attack: 180, sp_defense: 230
  };

  const MAX_BST = 720;

  function buildStats(mon) {
    const stats = mon.stats || {};
    const rows = Object.entries(stats).map(([k, v]) => buildStatRow(k, v)).join("");

    const bst = Object.values(stats).reduce((a, b) => a + (b || 0), 0);
    return rows + buildBSTRow(bst);
  }

  function buildStatRow(key, val) {
    const max = MAX_STATS[key] || 100;
    const percent = Math.min((val / max) * 100, 100);

    return `
      <div class="stat-row">
        <div class="stat-name">${STAT_LABELS[key] || key}</div>
        <div class="stat-bar">
          <div class="stat-fill" style="width:${percent}%;background:${getStatColor(val, max)}"></div>
        </div>
        <div class="stat-value">${val}</div>
      </div>
    `;
  }

  function buildBSTRow(bst) {
    const percent = Math.min((bst / MAX_BST) * 100, 100);

    return `
      <div class="stat-row bst-row">
        <div class="stat-name">Total</div>
        <div class="stat-bar">
          <div class="stat-fill" style="width:${percent}%;background:${getStatColor(bst, MAX_BST)}"></div>
        </div>
        <div class="stat-value">${bst}</div>
      </div>
    `;
  }

  function getStatColor(stat, max) {
    const ratio = stat / max;
    if (ratio < 0.2) return "#ff0000";
    if (ratio < 0.4) return "#ff6f00";
    if (ratio < 0.6) return "#ffff00";
    if (ratio < 0.8) return "#bfff00";
    return "#1aff00";
  }


  /* =============================================================
     SUMMARY 
  ============================================================= */

  function buildSummary(mon) {
  const abilities = (mon.abilities || [])
    .map(a => a.name)
    .filter(a => a && a !== "--");

  const uniqueAbilities = [...new Set(abilities)];

  const held = (mon.held_items || [])
    .map(i => i.name || i)
    .filter(Boolean);

  return `
    <div><b>Types:</b> ${buildTypeBadges(mon.types)}</div>
    <div><b>Height:</b> ${mon.height}</div>
    <div><b>Weight:</b> ${mon.weight}</div>
    <div><b>Abilities:</b> ${uniqueAbilities.join(", ") || "None"}</div>
    <div><b>Held Items:</b> ${held.join(", ") || "None"}</div>

    <h3>Type Effectiveness</h3>
    ${buildTypeChart(mon)}
  `;
}

  function buildTypeBadges(types = []) {
    return [...new Set(types)].map(t =>
      `<span class="type-badge type-${t.toLowerCase()}">${t}</span>`
    ).join("");
  }

  function getUniqueAbilities(mon) {
    return [...new Set((mon.abilities || [])
      .map(a => a.name)
      .filter(a => a && a !== "--"))];
  }

  function getHeldItems(mon) {
    return (mon.held_items || []).map(i => i.name || i).filter(Boolean);
  }

  function buildTypeChart(mon) {
    const effects = getTypeEffectiveness(mon.types);
    const { weak, resist, immune } = categorizeEffectiveness(effects);

    return `
      <div class="type-chart">

        <div><b>Weaknesses:</b> ${buildTypeBadges(weak) || "None"}</div>
        <div><b>Resistances:</b> ${buildTypeBadges(resist) || "None"}</div>
        <div><b>Immunities:</b> ${buildTypeBadges(immune) || "None"}</div>

      </div>
    `;
  }

  const TYPE_CHART = {
    normal: { fighting: 2, ghost: 0 },

    fire: {
      water: 2, ground: 2, rock: 2,
      fire: 0.5, grass: 0.5, ice: 0.5, bug: 0.5, steel: 0.5, fairy: 0.5
    },

    water: {
      electric: 2, grass: 2,
      fire: 0.5, water: 0.5, ice: 0.5, steel: 0.5
    },

    grass: {
      fire: 2, ice: 2, poison: 2, flying: 2, bug: 2,
      water: 0.5, electric: 0.5, grass: 0.5, ground: 0.5
    },

    electric: {
      ground: 2,
      electric: 0.5, flying: 0.5, steel: 0.5
    },

    // 👉 fill out the rest gradually (you can expand later)
  };

  function getTypeEffectiveness(types = []) {
    const result = {};

    Object.keys(TYPE_CHART).forEach(attackingType => {
      let multiplier = 1;

      types.forEach(defType => {
        const chart = TYPE_CHART[defType.toLowerCase()] || {};
        multiplier *= chart[attackingType] || 1;
      });

      result[attackingType] = multiplier;
    });

    return result;
  }

  function categorizeEffectiveness(effects) {
    const weak = [];
    const resist = [];
    const immune = [];

    Object.entries(effects).forEach(([type, val]) => {
      if (val === 0) immune.push(type);
      else if (val > 1) weak.push(type);
      else if (val < 1) resist.push(type);
    });

    return { weak, resist, immune };
  }
  /* =============================================================
     EVOLUTION TREE
  ============================================================= */

  function buildEvolutions(mon) {
    const tree = buildEvolutionTree();
    const root = findEvolutionRoot(mon, tree);
    if (!root) return "<div>No evolutions</div>";

    return `<div class="evo-tree">${renderEvolutionNode(root, mon.id)}</div>`;
  }

  function buildEvolutionTree() {
    const map = new Map();

    data.forEach(m => map.set(m.id, { mon: m, children: [] }));

    data.forEach(m => {
      m.evolutions?.forEach(e => {
        map.get(m.id)?.children.push({
          node: map.get(e.id),
          method: e
        });
      });
    });

    return map;
  }

  function findEvolutionRoot(mon, tree) {
    let current = mon;

    while (true) {
      const parent = [...tree.values()].find(n =>
        n.children.some(c => c.node.mon.id === current.id)
      );

      if (!parent) break;
      current = parent.mon;
    }

    return tree.get(current.id);
  }

  function renderEvolutionNode(node, currentId) {
    return `
      <div class="evo-branch">
        <div class="evo-node ${node.mon.id === currentId ? "active" : ""}" data-id="${node.mon.id}">
          <img src="sprites/pokemon/${node.mon.id}.png">
          <div>${node.mon.name}</div>
        </div>

        ${node.children.length ? `
          <div class="evo-children">
            ${node.children.map(c => `
              <div class="evo-child">
                ${buildEvolutionArrow(c.method)}
                ${renderEvolutionNode(c.node, currentId)}
              </div>
            `).join("")}
          </div>
        ` : ""}
      </div>
    `;
  }

  function buildEvolutionArrow(method) {
    return `
      <div class="evo-arrow" title="${formatEvolutionMethod(method)}">
        <div>${getEvolutionIcon(method)}</div>
        <svg width="24" height="24" viewBox="0 0 24 24">
          <path d="M12 5v10M7 12l5 5 5-5"
            stroke="currentColor" stroke-width="2" fill="none"/>
        </svg>
        <div class="evo-method-label">${formatEvolutionMethod(method)}</div>
      </div>
    `;
  }

  function bindEvolutionClicks() {
    modalBody.querySelectorAll(".evo-node").forEach(el => {
      el.onclick = () => switchForm(Number(el.dataset.id));
    });
  }

  function getEvolutionIcon(e) {
    const t = e?.type?.toLowerCase() || "";
    if (t.includes("stone")) return "🪨";
    if (t.includes("trade")) return "🔁";
    if (t.includes("friendship")) return "❤️";
    if (t.includes("level")) return "⬆️";
    return "✨";
  }

  function formatEvolutionMethod(e) {
    if (!e) return "";
    if (e.type === "LEVEL") return `Lv ${e.val}`;
    if (e.type === "ITEM") return `Use ${e.val}`;
    if (e.type === "TRADE") return "Trade";
    if (e.type === "FRIENDSHIP") return "Friendship";
    return `${e.type} ${e.val || ""}`;
  }

  /* =============================================================
    MOVES
  ============================================================= */

  function buildMoves(mon) {
    const grouped = {};

    (mon.moves || []).forEach(m => {
      if (!grouped[m.type]) grouped[m.type] = [];
      grouped[m.type].push(m);
    });

    return Object.entries(grouped).map(([type, moves]) => `
      <div class="move-group">
        <h4>${type}</h4>
        ${moves.map(m => `
          <div>${m.name}${m.level ? " (Lv " + m.level + ")" : ""}</div>
        `).join("")}
      </div>
    `).join("");
  }


  /* =============================================================
    LOCATIONS
  ============================================================= */

  function buildLocations(mon) {
    return (mon.locations || [])
      .map(l => `
        <div class="location-row">
          ${l.region_name} - ${l.location}
        </div>
      `)
      .join("") || "<div>No locations</div>";
  }

  /* =============================================================
     FORMS
  ============================================================= */

  function initFormsDropdown(mon) {
    if (!mon.forms || mon.forms.length <= 1) return;

    const nameEl = $("#pokedexName");
    const dropdown = $("#formsDropdown");

    nameEl.onclick = () => dropdown.classList.toggle("hidden");

    dropdown.innerHTML = mon.forms.map(f => `
      <div class="form-option" data-id="${f.id}">
        <img src="sprites/pokemon/${f.id}.png">
        <div>${f.name}</div>
      </div>
    `).join("");

    dropdown.querySelectorAll(".form-option").forEach(el => {
      el.onclick = (e) => {
        e.stopPropagation();
        switchForm(Number(el.dataset.id));
      };
    });
  }


  /* =============================================================
     PRELOAD
  ============================================================= */

  function preloadImages() {
    let i = 0;

    function next() {
      if (i >= data.length) return;
      new Image().src = `sprites/pokemon/${data[i++].id}.png`;
      setTimeout(next, 10);
    }

    next();
  }


  /* =============================================================
     PUBLIC API
  ============================================================= */

  return { load, switchForm };

})();

/* =============================================================
   Initialization
   ============================================================= */
document.addEventListener("DOMContentLoaded", async () => {

  initToolsSwitcher();
  initRouter()
  initThemeToggle();
  initAboutPage()

  MoveChecker.load();
  EncounterTool.load();
  VideoFrameTool.init();
  PoryBackground.setup();
  ColorTextTool.load();
  PokedexTool.load();

  document.body.classList.add("pory-active");
});
