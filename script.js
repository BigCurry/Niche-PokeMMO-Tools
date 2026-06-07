/* =============================================================
   Utilities & Config
   ============================================================= */
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const ENABLE_MAP_POINT_EDITOR = false;

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

function getRouteData() {
  const hash = window.location.hash.replace(/^#/, "");
  const parts = hash.split("/").filter(Boolean);

  return {
    section: parts[0] || "",
    tool: parts[1] || "about",
    param: parts[2] || null
  };
}

async function handleRoute() {
  const { tool, param } = getRouteData();

  if (tool === "dex") {
    showTool(param ? "pokedexModal" : "pokedexTool");
    await handleDexRoute(param);
    return;
  }

  const toolId = routeToTool[tool] || "aboutPage";
  showTool(toolId);
}

async function handleDexRoute(param) {
  // wait until dex tool finished loading
  await PokedexTool.ready;

  // normal dex page
  if (!param) {
    PokedexTool.closeFromRouter();
    return;
  }

  // try modal deep-link
  const success = PokedexTool.openFromSlug(param);

  // invalid slug -> fallback to dex home
  if (!success) {
    window.location.hash = "/tools/dex";
  }
}

function navigateToTool(toolId, push = true) {
  const route = toolRoutes[toolId] || "about";

  if (push) {
    window.location.hash = `/tools/${route}`;
  }

  showTool(toolId);
}

function initRouter() {
  handleRoute();
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

  window.addEventListener("hashchange", handleRoute);
  window.addEventListener("popstate", handleRoute);
}

function showTool(tool) {
  document.dispatchEvent(new Event("about:unmount"));

  $$(".toolSection").forEach(s => s.style.display = "none");
  document.getElementById(tool).style.display = "block";

  if (tool === "aboutPage") {
    document.dispatchEvent(new Event("about:mount"));
  }

  $$(".tool-list__item").forEach(li => li.classList.remove("active"));
  const activeTool = tool === "pokedexModal" ? "pokedexTool" : tool;
  document.querySelector(`[data-tool="${activeTool}"]`)?.classList.add("active");

  const bgSections = ["encounterTool", "colorTextTool", "poryBackground", "moveChecker", "videoFrameTool", "aboutPage", "pokedexTool", "pokedexModal"];

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
  document.addEventListener("about:mount", mountTools);

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
      navigateToTool(btn.dataset.tool);
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
      l.className = "encounter-filter-pill";
      l.innerHTML = `<span class="filter-box">◯</span> ${v}`;
      l.onclick = () => {
        filters[key][v] =
          filters[key][v] === "none" ? "include" :
          filters[key][v] === "include" ? "exclude" : "none";
        l.querySelector("span").textContent =
          filters[key][v] === "none" ? "◯" :
          filters[key][v] === "include" ? "✔" : "✖";
        l.classList.toggle("include", filters[key][v] === "include");
        l.classList.toggle("exclude", filters[key][v] === "exclude");
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
      l.className = "encounter-column-pill";
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
    $$("#encounterFilters .encounter-filter-pill").forEach(label => {
      label.classList.remove("include", "exclude");
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

  let readyResolve;
  const ready = new Promise(r => readyResolve = r);

  let data = [];
  let compat = [];
  let filtered = [];

  let grid, modal, modalBody;
  let summaryEvoResizeObserver = null;
  let summaryEvoLayoutFrame = 0;
  let summaryEvoCleanup = [];

  let searchInput;
  let browserFindHighlightedCard = null;
  let ALL_MOVES = [];
  let ALL_ABILITIES = [];
  let ALL_LOCATIONS = [];
  let ALL_POKEMON = [];

  let LOCATION_DATA = [];
  let ABILITY_DATA = [];
  let MOVE_DATA = {};
  let MOVE_DATA_BY_ID = new Map();
  let BREEDING_CHAINS = {};
  let breedingChainVariantTimer = null;
  let breedingChainVariantPausedUntil = 0;
  let pokemonById = new Map();
  let evolutionParentById = new Map();
  let evolutionFamilyRootById = new Map();

  let viewport;
  let mapSvgEl;
  let mapZoomSlider;
  let mapZoomValue;
  let mapRegionSelect;
  let mapViewportToggleButton;
  let mapScale = 1;
  let mapX = 0;
  let mapY = 0;
  let mapSuppressLocationClickUntil = 0;
  let modalLocationMapState = null;
  let modalLocationMapCleanup = null;
  let modalLocationMapToggleButton;

  const MAP_WORLD_WIDTH = 1662;
  const MAP_WORLD_HEIGHT = 1174;
  const MAP_MIN_SCALE = 1;
  const MAP_MAX_SCALE = 6;
  const MAP_REGION_VIEWPORTS = {
    Hoenn: { from: { x: 553.92, y: 34.05 }, to: { x: 1005.49, y: 277.89 } },
    Johto: { from: { x: 1180.33, y: 439.45 }, to: { x: 1614.03, y: 671.92 } },
    Kanto: { from: { x: 520.36, y: 844.31 }, to: { x: 1029.02, y: 1162.37 } },
    Sinnoh: { from: { x: 30.1, y: 369.6 }, to: { x: 442, y: 699.4 } },
    Unova: { from: { x: 595.75, y: 382.58 }, to: { x: 1052.02, y: 715.16 } }
  };
  /* =============================================================
     const
  ============================================================= */
  const TYPE_CHART = {
      normal: { fighting: 2, ghost: 0 },

      fire: {
        water: 2, ground: 2, rock: 2,
        fire: 0.5, grass: 0.5, ice: 0.5, bug: 0.5, steel: 0.5
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

      ice: {
        fire: 2, fighting: 2, rock: 2, steel: 2,
        ice: 0.5
      },

      fighting: {
        flying: 2, psychic: 2,
        bug: 0.5, rock: 0.5, dark: 0.5
      },

      poison: {
        ground: 2, psychic: 2,
        grass: 0.5, fighting: 0.5, poison: 0.5, bug: 0.5
      },

      ground: {
        water: 2, grass: 2, ice: 2,
        poison: 0.5, rock: 0.5, electric: 0
      },

      flying: {
        electric: 2, ice: 2, rock: 2,
        grass: 0.5, fighting: 0.5, bug: 0.5, ground: 0
      },

      psychic: {
        bug: 2, ghost: 2, dark: 2,
        fighting: 0.5, psychic: 0.5
      },

      bug: {
        fire: 2, flying: 2, rock: 2,
        grass: 0.5, fighting: 0.5, ground: 0.5
      },

      rock: {
        water: 2, grass: 2, fighting: 2, ground: 2, steel: 2,
        normal: 0.5, fire: 0.5, poison: 0.5, flying: 0.5
      },

      ghost: {
        ghost: 2, dark: 2,
        poison: 0.5, bug: 0.5, normal: 0, fighting: 0
      },

      dragon: {
        ice: 2, dragon: 2,
        fire: 0.5, water: 0.5, grass: 0.5, electric: 0.5
      },

      dark: {
        fighting: 2, bug: 2,
        ghost: 0.5, dark: 0.5, psychic: 0
      },

      steel: {
        fire: 2, fighting: 2, ground: 2,
        normal: 0.5, grass: 0.5, ice: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 0.5, ghost: 0.5, dragon: 0.5, dark: 0.5, steel: 0.5, poison: 0
      }
  };
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

  const BODY_MOVE_KEYS = new Set([
    "low-kick",
    "grass-knot",
    "heavy-slam",
    "heat-crash",
    "sky-drop",
    "autotomize"
  ]);

  const BODY_WEIGHT_ABILITIES = new Set([
    "Heavy Metal",
    "Light Metal"
  ]);

  const BREEDING_VARIANT_INTERVAL_MS = 1500;
  const BREEDING_VARIANT_MANUAL_PAUSE_MS = 10000;
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

    readyResolve();
  }

  function cacheDOM() {
    grid = $("#pokedexGrid");
    modal = $("#pokedexModal");
    modalBody = $("#modalBody");
    searchInput = $("#pokedexSearch");
  }

  async function loadData() {
    const [monRes, compatRes, locRes, abilityRes, moveRes, chainRes] = await Promise.all([
      fetch("./monsters.json"),
      fetch("./dex_compatibility.json"),
      fetch("./locations.json"),
      fetch("./abilities.json"),
      fetch("./moves.json"),
      fetch("./breeding_chains.json")
    ]);

    data = await monRes.json();
    compat = await compatRes.json();
    LOCATION_DATA = await locRes.json();
    ABILITY_DATA = await abilityRes.json();
    MOVE_DATA = await moveRes.json();
    MOVE_DATA_BY_ID = new Map(
      Object.values(MOVE_DATA)
        .filter(move => move?.id)
        .map(move => [move.id, move])
    );
    BREEDING_CHAINS = await chainRes.json();
  }


  /* =============================================================
     EVENTS
  ============================================================= */

  function bindEvents() {
    searchInput.addEventListener("input", applyFilters);
    document.addEventListener("selectionchange", syncBrowserFindHighlight);

    $("#toggleFilters").onclick = () => {
      $("#dexfiltersPanel").classList.toggle("collapsed");
    };

    $("#closeModal").onclick = closeModal;

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

    filtered = groupByBase(filtered);

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
    pokemonById = new Map(data.map(mon => [mon.id, mon]));
    evolutionParentById = new Map();
    evolutionFamilyRootById = new Map();

    data.forEach(mon => {
      (mon.evolutions || []).forEach(evolution => {
        evolutionParentById.set(evolution.id, mon.id);
      });
    });

    data.forEach(mon => {
      evolutionFamilyRootById.set(mon.id, getEvolutionFamilyRootId(mon.id));

      (mon.forms || []).forEach(form => {
        if (typeof form.id === "number") {
          evolutionFamilyRootById.set(form.id, getEvolutionFamilyRootId(mon.id));
        }
      });
    });

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
    buildMapRegionSelect();
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
  
  function renderMoveInfo() {
    const container = $("#moveInfoContainer");

    const activeMoves = filters.moves.filter(Boolean);

    if (!activeMoves.length) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = activeMoves.map(name => buildMoveInfoBox(name)).join("");
    bindBodyMoveTools(container);
    bindBreedingChainVariationCycling(container);
  }

  function getMoveData(move) {
    if (!move) return null;

    if (typeof move === "object") {
      if (move.id && MOVE_DATA_BY_ID.has(move.id)) return MOVE_DATA_BY_ID.get(move.id);
      if (move.name) return getMoveData(move.name);
      return null;
    }

    const normalized = normalizeMoveName(move);
    const camelSplit = move
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      .toLowerCase();

    return MOVE_DATA[normalized] || MOVE_DATA[normalizeMoveName(camelSplit)] || null;
  }

  function buildMoveInfoBox(move, options = {}) {
    const dataEntry = getMoveData(move);

    if (!dataEntry) {
      const fallbackName = typeof move === "object" ? move.name : move;
      return `
        <div class="move-box">
          <div class="move-title">${fallbackName || "Move"}</div>
          <div class="move-effect">No move details found.</div>
        </div>
      `;
    }

    const info = dataEntry.info || {};
    const price = dataEntry.Price || {};
    const displayName = formatMoveName(dataEntry.name || normalizeMoveName(typeof move === "object" ? move.name : move));

    return `
      <div class="move-box${options.compact ? " move-box--compact" : ""}">
        <div class="move-header">
          <div class="move-title">${displayName}</div>

          <div class="move-header-right">
            ${options.removable ? `
              <button type="button"
                class="modal-move-remove"
                data-index="${options.index}"
                aria-label="Remove ${displayName} from selected moves">
                &times;
              </button>
            ` : ""}

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
          ${dataEntry.TM ? `<span class="icon tm">TM</span>` : ""}
          ${dataEntry.Vendor ? `<span class="icon vendor">Vendor</span>` : ""}
          ${(dataEntry.modifiers || [])
            .filter(Boolean)
            .map(m => `<span class="icon mod">${m}</span>`)
            .join("")}
        </div>

        ${buildBodyMoveTool(dataEntry, options.contextMon)}

        ${buildEggMoveBreedingChains(options.contextMon, move)}
      </div>
    `;
  }

  function buildBodyMoveTool(move, contextMon = null) {
    const key = move?.name;
    if (!BODY_MOVE_KEYS.has(key)) return "";

    if (key === "heavy-slam" || key === "heat-crash") {
      const attackers = getMoveLearners(key);
      const selectedAttacker = contextMon && canLearnMove(contextMon, key)
        ? contextMon
        : attackers[0];
      const selectedTarget = data.find(mon => isEligible(mon) && mon.weight > 0 && mon.id !== selectedAttacker?.id)
        || data.find(mon => isEligible(mon) && mon.weight > 0)
        || data[0];

      return `
        <div class="body-move-tool" data-move="${key}">
          <div class="body-move-tool-title">Body interaction</div>
          <div class="body-move-select-grid">
            <label>
              <span>Attacker</span>
              <select class="body-move-attacker">
                ${buildPokemonOptions(attackers, selectedAttacker?.id)}
              </select>
            </label>
            <label>
              <span>Target</span>
              <select class="body-move-target">
                ${buildPokemonOptions(getBodyEligiblePokemon(), selectedTarget?.id)}
              </select>
            </label>
          </div>
          <div class="body-move-result">
            ${renderBodyMoveResult(key, selectedTarget, selectedAttacker)}
          </div>
        </div>
      `;
    }

    const selectedMon = contextMon || data.find(mon => isEligible(mon) && mon.weight > 0) || data[0];

    return `
      <div class="body-move-tool" data-move="${key}">
        <div class="body-move-tool-head">
          <div class="body-move-tool-title">Body interaction</div>
          <select class="body-move-target">
            ${buildPokemonOptions(getBodyEligiblePokemon(), selectedMon?.id)}
          </select>
        </div>
        <div class="body-move-result">
          ${renderBodyMoveResult(key, selectedMon, contextMon)}
        </div>
      </div>
    `;
  }

  function bindBodyMoveTools(root = document) {
    root.querySelectorAll(".body-move-tool").forEach(tool => {
      const targetSelect = tool.querySelector(".body-move-target");
      const attackerSelect = tool.querySelector(".body-move-attacker");
      const result = tool.querySelector(".body-move-result");
      if (!targetSelect || !result || targetSelect.dataset.bound) return;

      const render = () => {
        const selectedTarget = data.find(mon => mon.id === Number(targetSelect.value));
        const selectedAttacker = attackerSelect
          ? data.find(mon => mon.id === Number(attackerSelect.value))
          : null;
        result.innerHTML = renderBodyMoveResult(tool.dataset.move, selectedTarget, selectedAttacker);
      };

      targetSelect.dataset.bound = "true";
      targetSelect.addEventListener("change", render);

      if (attackerSelect) {
        attackerSelect.dataset.bound = "true";
        attackerSelect.addEventListener("change", render);
      }
    });
  }

  function renderBodyMoveResult(moveKey, selectedMon, userMon = null) {
    if (!selectedMon) return "Select a Pokemon.";

    const selectedWeight = getWeightKg(selectedMon);
    const selectedBaseWeight = getWeightKg(selectedMon);
    const selectedHeight = getHeightM(selectedMon);
    const variants = getWeightVariants(selectedMon);

    if (moveKey === "low-kick" || moveKey === "grass-knot") {
      return `
        <div><b>${selectedMon.name}</b>: ${formatKg(selectedWeight)} base weight</div>
        <div>Power against this target: <b>${getWeightTierPower(selectedWeight)}</b></div>
        ${variants.map(v => `<div>${v.label}: ${formatKg(v.weight)} gives <b>${getWeightTierPower(v.weight)}</b> power.</div>`).join("")}
      `;
    }

    if (moveKey === "heavy-slam" || moveKey === "heat-crash") {
      if (userMon) {
        const userWeight = getWeightKg(userMon);
        return `
          <div><b>${userMon.name}</b> into <b>${selectedMon.name}</b></div>
          <div>${formatKg(userWeight)} vs ${formatKg(selectedWeight)}: <b>${getWeightRatioPower(userWeight, selectedWeight)} power</b></div>
          ${getWeightVariants(userMon).map(v => `<div>${v.label} user weight: ${formatKg(v.weight)} gives <b>${getWeightRatioPower(v.weight, selectedWeight)}</b> power.</div>`).join("")}
          ${variants.map(v => `<div>${v.label} target weight: ${formatKg(v.weight)} gives <b>${getWeightRatioPower(userWeight, v.weight)}</b> power.</div>`).join("")}
        `;
      }

      return `
        <div><b>${selectedMon.name}</b>: ${formatKg(selectedWeight)} target weight</div>
        <div>Attacker weight needed: ${formatKg(selectedWeight * 2)} / ${formatKg(selectedWeight * 3)} / ${formatKg(selectedWeight * 4)} / ${formatKg(selectedWeight * 5)} for 60/80/100/120 power.</div>
      `;
    }

    if (moveKey === "sky-drop") {
      return `
        <div><b>${selectedMon.name}</b>: ${formatKg(selectedWeight)}, ${formatMeters(selectedHeight)}</div>
        <div>Sky Drop: <b>${getSkyDropResult(selectedMon)}</b></div>
      `;
    }

    if (moveKey === "autotomize") {
      return `
        <div><b>${selectedMon.name}</b>: ${formatKg(selectedBaseWeight)} base weight</div>
        <div>After Autotomize: <b>${formatKg(selectedBaseWeight / 2)}</b> in this tool's current move data model.</div>
      `;
    }

    return "";
  }

  function buildEggMoveBreedingChains(mon, move) {
    if (!mon || !move || move.type !== "EGG") return "";

    const chainSourceMon = move._eggMoveSourceMonName || getEvolutionFamilyRootMon(mon)?.name || mon.name;
    const rawChains = getBreedingChains(chainSourceMon, move.id);
    const chains = prepareBreedingChainDisplay(rawChains);

    if (!chains.length) {
      return `
        <div class="move-breeding-section">
          <div class="move-breeding-title">Breeding Chains</div>
          <div class="move-breeding-empty">No breeding chains available.</div>
        </div>
      `;
    }

    return `
      <div class="move-breeding-section">
        <div class="move-breeding-title">
          Breeding Chains
          <span class="move-breeding-count">(${chains.length})</span>
        </div>

        <div class="move-breeding-list">
          ${chains.map((chain, index) => buildBreedingChainCard(chain, index)).join("")}
        </div>
      </div>
    `;
  }

  function buildBreedingChainCard(chain, index) {
    const steps = Array.isArray(chain)
      ? chain
      : getBreedingChainSteps({ merged: chain });

    if (!steps.length) return "";

    return `
      <div class="breeding-chain-card">
        <div class="breeding-chain-title">
          Chain ${index + 1}
        </div>

        <div class="breeding-chain-flow">
          ${steps.map((step, stepIndex) => `
            ${buildBreedingChainStep(step)}

            ${stepIndex < steps.length - 1 ? `
              <div class="breeding-chain-arrow">→</div>
            ` : ""}
          `).join("")}
        </div>
      </div>
    `;
  }

  function buildBreedingChainStep(step) {
    const variants = Array.isArray(step?.variants) ? step.variants : null;

    if (variants?.length) {
      const label = variants.map(variant => formatMoveName(variant.name)).join(" / ");

      return `
        <div class="breeding-chain-step breeding-chain-step--variants"
          data-breeding-variant-step
          title="${label}">
          <button type="button"
            class="breeding-chain-variant-control breeding-chain-variant-control--prev"
            data-breeding-variant-control="prev"
            aria-label="Previous variation">
            &lt;
          </button>
          <button type="button"
            class="breeding-chain-variant-control breeding-chain-variant-control--next"
            data-breeding-variant-control="next"
            aria-label="Next variation">
            &gt;
          </button>
          ${variants.map((variant, index) => `
            <div class="breeding-chain-variant${index === 0 ? " active" : ""}">
              ${buildBreedingChainVariantContent(variant)}
            </div>
          `).join("")}
        </div>
      `;
    }

    return `
      <div class="breeding-chain-step">
        ${buildBreedingChainVariantContent(step)}
      </div>
    `;
  }

  function buildBreedingChainVariantContent(step) {
    return `
      <img class="chain-img"
        src="sprites/pokemon/${step.id}.png"
        alt="${step.name}"
        onerror="this.onerror=function(){this.onerror=null;this.src='sprites/pokemon/0.png';};this.src='sprites/pokemon/Unused/${step.id}.png';">

      <div class="breeding-chain-mon">
        ${formatMoveName(step.name)}
      </div>

      <div class="breeding-chain-method">
        ${formatBreedingMethod(step.method)}
      </div>
    `;
  }

  function getBreedingChains(monName, moveId) {
    if (!monName || !moveId) {
      console.error("No monName or moveId to find breeding chains");
      return [];
    }

    const monChains = BREEDING_CHAINS?.[String(monName).toLowerCase()];

    if (!Array.isArray(monChains)) {
      console.error("No breeding chains found for:", monName);
      return [];
    }

    for (const entry of monChains) {
      const move = entry?.egg_moves?.find(
        m => Number(m.move_id) === Number(moveId)
      );

      if (move?.chains?.length) {
        return move.chains;
      }
    }

    return [];
  }

  function mergeBreedingChains(chains) {
    if (!Array.isArray(chains)) return [];

    const merged = new Map();

    for (const chain of chains) {
      const root = Object.values(chain)?.[0];
      if (!root?.donor) continue;

      // clone so we don't mutate original data
      const normalized = structuredClone(root);

      // remove donor level from signature generation
      const donorMethodType = normalized.donor.method?.type || "";

      // keep track of donor levels separately
      const donorLevel =
        donorMethodType === "level"
          ? Number(normalized.donor.method?.val)
          : null;

      // signature ignores donor level
      const signatureRoot = structuredClone(normalized);

      if (signatureRoot.donor?.method) {
        signatureRoot.donor.method.val = null;
      }

      const signature = JSON.stringify(signatureRoot);

      if (!merged.has(signature)) {
        // initialize
        if (donorMethodType === "level") {
          normalized.donor.method.val = donorLevel != null
            ? [donorLevel]
            : [];
        }

        merged.set(signature, normalized);
        continue;
      }

      // merge donor levels
      const existing = merged.get(signature);

      if (
        donorMethodType === "level" &&
        donorLevel != null
      ) {
        const levels = existing.donor.method.val;

        if (!levels.includes(donorLevel)) {
          levels.push(donorLevel);
          levels.sort((a, b) => a - b);
        }
      }
    }

    return [...merged.values()];
  }

  function prepareBreedingChainDisplay(chains) {
    if (!Array.isArray(chains)) return [];

    const directGroups = new Map();

    chains.forEach((chain, index) => {
      const steps = getBreedingChainSteps(chain);
      if (steps.length !== 2) return;

      const donor = steps[0];
      const receiver = steps[1];
      const key = `${getBreedingEvolutionFamilyIdentity(donor)}>${getBreedingStepIdentity(receiver)}`;

      if (!directGroups.has(key)) {
        directGroups.set(key, []);
      }

      directGroups.get(key).push({ chain, index, steps });
    });

    const consumedDirectIndices = new Set();
    const directDisplays = [];

    for (const group of directGroups.values()) {
      if (group.length <= 1) continue;

      const variants = [];
      const variantsByPokemon = new Map();

      for (const entry of group) {
        const variant = entry.steps[0];
        const identity = getBreedingStepIdentity(variant);

        if (!variantsByPokemon.has(identity)) {
          variantsByPokemon.set(identity, { ...variant, method: structuredClone(variant.method) });
          continue;
        }

        mergeBreedingStepMethods(variantsByPokemon.get(identity), variant);
      }

      variants.push(...variantsByPokemon.values());

      if (variants.length <= 1 || !areSameEvolutionFamilyBreedingVariants(variants)) continue;

      group.forEach(entry => consumedDirectIndices.add(entry.index));

      directDisplays.push({
        order: Math.min(...group.map(entry => entry.index)),
        steps: [
          { variants },
          { ...group[0].steps[1] }
        ]
      });
    }

    const remainingChains = chains.filter((_, index) => !consumedDirectIndices.has(index));
    const remainingDisplays = groupBreedingChainVariations(mergeBreedingChains(remainingChains))
      .map((steps, index) => ({
        order: chains.length + index,
        steps
      }));

    return [
      ...directDisplays,
      ...remainingDisplays
    ]
      .sort((a, b) => a.order - b.order)
      .map(display => display.steps);
  }

  function groupBreedingChainVariations(chains) {
    if (!Array.isArray(chains)) return [];

    const chainSteps = chains
      .map(chain => getBreedingChainSteps({ merged: chain }))
      .filter(steps => steps.length);

    const groupedBySignature = new Map();
    const assigned = new Set();

    chainSteps.forEach((steps, chainIndex) => {
      for (let variantIndex = 0; variantIndex < steps.length - 1; variantIndex++) {
        const signature = steps
          .map((step, index) => index === variantIndex
            ? getBreedingVariantSignatureToken(step, steps.length)
            : getBreedingStepIdentity(step))
          .join(">");
        const key = `${steps.length}|${variantIndex}|${signature}`;

        if (!groupedBySignature.has(key)) {
          groupedBySignature.set(key, {
            variantIndex,
            chainIndices: []
          });
        }

        groupedBySignature.get(key).chainIndices.push(chainIndex);
      }
    });

    const groups = [...groupedBySignature.values()]
      .filter(group => group.chainIndices.length > 1)
      .sort((a, b) => b.chainIndices.length - a.chainIndices.length);

    const groupedDisplays = new Map();

    for (const group of groups) {
      const availableIndices = group.chainIndices.filter(index => !assigned.has(index));
      if (availableIndices.length <= 1) continue;

      const baseSteps = chainSteps[availableIndices[0]].map(step => ({ ...step }));
      const variants = [];
      const seenVariants = new Set();

      for (const chainIndex of availableIndices) {
        const variant = chainSteps[chainIndex][group.variantIndex];
        const identity = getBreedingVariantIdentity(variant);

        if (seenVariants.has(identity)) continue;

        seenVariants.add(identity);
        variants.push({ ...variant });
      }

      if (variants.length <= 1) continue;
      if (baseSteps.length === 2 && !areSameEvolutionFamilyBreedingVariants(variants)) continue;

      availableIndices.forEach(index => assigned.add(index));

      baseSteps[group.variantIndex] = {
        variants
      };
      groupedDisplays.set(Math.min(...availableIndices), baseSteps);
    }

    const displayChains = [];

    chainSteps.forEach((steps, index) => {
      if (groupedDisplays.has(index)) {
        displayChains.push(groupedDisplays.get(index));
      } else if (!assigned.has(index)) {
        displayChains.push(steps);
      }
    });

    return displayChains;
  }

  function getBreedingStepIdentity(step) {
    return `${step?.id ?? ""}|${step?.name ?? ""}`;
  }

  function getBreedingVariantSignatureToken(step, chainLength) {
    if (chainLength === 2) {
      return `family:${getBreedingEvolutionFamilyIdentity(step)}`;
    }

    return "*";
  }

  function getBreedingSpeciesIdentity(step) {
    return String(step?.name || "").trim().toLowerCase();
  }

  function getBreedingEvolutionFamilyIdentity(step) {
    const id = Number(step?.id);

    if (Number.isFinite(id) && evolutionFamilyRootById.has(id)) {
      return `id:${evolutionFamilyRootById.get(id)}`;
    }

    return `name:${getBreedingSpeciesIdentity(step)}`;
  }

  function getBreedingVariantIdentity(step) {
    return `${getBreedingStepIdentity(step)}|${JSON.stringify(step?.method || {})}`;
  }

  function areSameEvolutionFamilyBreedingVariants(variants) {
    const families = new Set(variants.map(getBreedingEvolutionFamilyIdentity));
    return families.size === 1;
  }

  function mergeBreedingStepMethods(target, source) {
    const targetMethod = target?.method;
    const sourceMethod = source?.method;

    if (!targetMethod || !sourceMethod) return;
    if (targetMethod.type !== sourceMethod.type) return;

    if (targetMethod.type === "level") {
      const levels = [
        ...(Array.isArray(targetMethod.val) ? targetMethod.val : [targetMethod.val]),
        ...(Array.isArray(sourceMethod.val) ? sourceMethod.val : [sourceMethod.val])
      ]
        .map(Number)
        .filter(Number.isFinite);

      targetMethod.val = [...new Set(levels)].sort((a, b) => a - b);
    }
  }

  function getEvolutionFamilyRootId(monId) {
    let current = monId;
    const seen = new Set();

    while (evolutionParentById.has(current) && !seen.has(current)) {
      seen.add(current);
      current = evolutionParentById.get(current);
    }

    return current;
  }

  function bindBreedingChainVariationCycling(root = document) {
    const variantSteps = root.querySelectorAll("[data-breeding-variant-step]");

    root.querySelectorAll("[data-breeding-variant-control]").forEach(button => {
      if (button.dataset.bound) return;

      button.dataset.bound = "true";
      button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();

        const step = button.closest("[data-breeding-variant-step]");
        const direction = button.dataset.breedingVariantControl === "prev" ? -1 : 1;

        breedingChainVariantPausedUntil = Date.now() + BREEDING_VARIANT_MANUAL_PAUSE_MS;
        cycleBreedingVariantStep(step, direction);
      });
    });

    if (!variantSteps.length && !document.querySelector("[data-breeding-variant-step]")) {
      clearInterval(breedingChainVariantTimer);
      breedingChainVariantTimer = null;
      return;
    }

    if (breedingChainVariantTimer) return;

    breedingChainVariantTimer = setInterval(() => {
      const steps = document.querySelectorAll("[data-breeding-variant-step]");

      if (!steps.length) {
        clearInterval(breedingChainVariantTimer);
        breedingChainVariantTimer = null;
        breedingChainVariantPausedUntil = 0;
        return;
      }

      if (Date.now() < breedingChainVariantPausedUntil) return;

      steps.forEach(step => {
        cycleBreedingVariantStep(step, 1);
      });
    }, BREEDING_VARIANT_INTERVAL_MS);
  }

  function cycleBreedingVariantStep(step, direction) {
    if (!step) return;

    const variants = [...step.querySelectorAll(".breeding-chain-variant")];
    if (variants.length <= 1) return;

    const activeIndex = Math.max(0, variants.findIndex(variant => variant.classList.contains("active")));
    const nextIndex = (activeIndex + direction + variants.length) % variants.length;

    variants[activeIndex]?.classList.remove("active");
    variants[nextIndex].classList.add("active");
  }

  function formatBreedingMethod(method) {
    if (!method) return "Unknown";

    switch (method.type) {
      case "level": {
        const levels = Array.isArray(method.val)
          ? method.val
          : [method.val];

        return `Level ${levels.join(", ")}`;
      }

      case "breed":
        return "Breed";

      case "tm":
        return `TM ${method.val || ""}`.trim();

      case "tutor":
        return "Tutor";

      default:
        return capitalize(method.type || "Unknown");
    }
  }

  function getBreedingChainSteps(chain) {
    if (!chain || typeof chain !== "object") return [];

    const root = Object.values(chain)[0];
    if (!root) return [];

    const ordered = [];

    // donor first
    if (root.donor) {
      ordered.push({
        role: "donor",
        ...root.donor
      });
    }

    // then intermediary receivers
    // then receiver_final last
    Object.keys(root)
      .filter(key => key.startsWith("receiver"))
      .sort((a, b) => {
        if (a === "receiver_final") return 1;
        if (b === "receiver_final") return -1;

        const aNum = Number(a.split("_")[1] || 0);
        const bNum = Number(b.split("_")[1] || 0);

        return aNum - bNum;
      })
      .forEach(key => {
        ordered.push({
          role: key,
          ...root[key]
        });
      });

    return ordered;
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

      // dedupe by name + region
      const unique = new Map();

      LOCATION_DATA.forEach(loc => {
        const name = loc.name.toLowerCase();
        const region = loc.region.toLowerCase();

        if (
          name.includes(q) ||
          region.includes(q)
        ) {
          const key = `${name}__${region}`;

          if (!unique.has(key)) {
            unique.set(key, loc);
          }
        }
      });

      const matches = [...unique.values()].slice(0, 10);

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
      
      selectLocation(name, region);
      dropdown.classList.add("hidden");
    });

  }

  function selectLocation(name, region) {
    if (!name || !region) return;

    // ALL matching locations
    const matches = LOCATION_DATA.filter(l =>
      l.name === name &&
      l.region === region
    );

    if (!matches.length) return;

    $("#filterLocation").value = `${name} (${region})`;

    syncMapRegionSelect(region);

    filters.location = {
      name: name.toLowerCase(),
      region: region.toLowerCase()
    };

    highlightLocations(matches);
    zoomMapToLocations(matches);

    applyFilters();
  }

  function buildMapRegionSelect() {
    mapRegionSelect = document.getElementById("mapRegionSelect");
    if (!mapRegionSelect) return;

    const regions = [...new Set(LOCATION_DATA.map(loc => loc.region).filter(Boolean))].sort();
    mapRegionSelect.innerHTML = `
      <option value="">All regions</option>
      ${regions.map(region => `<option value="${region}">${region}</option>`).join("")}
    `;

    mapRegionSelect.addEventListener("change", () => {
      if (mapRegionSelect.value) {
        zoomMapToRegion(mapRegionSelect.value);
      } else {
        setMapZoomPercent(0);
      }
    });
  }

  function syncMapRegionSelect(region) {
    mapRegionSelect = mapRegionSelect || document.getElementById("mapRegionSelect");
    if (!mapRegionSelect) return;
    mapRegionSelect.value = region || "";
  }

  function refreshMainMapViewport() {
    if (!viewport || viewport.classList.contains("hidden")) return;

    const selectedLocation = filters.location?.name && filters.location?.region
      ? LOCATION_DATA.filter(loc =>
          loc.name.toLowerCase() === filters.location.name &&
          loc.region.toLowerCase() === filters.location.region
        )
      : [];

    if (selectedLocation.length) {
      zoomMapToLocations(selectedLocation);
      return;
    }

    if (mapRegionSelect?.value) {
      zoomMapToRegion(mapRegionSelect.value);
      return;
    }

    setMapZoomPercent(0);
  }

  function getViewportFitScale(rect, bounds, paddingRatio = 0.08) {
    const baseScaleX = rect.width / MAP_WORLD_WIDTH;
    const baseScaleY = rect.height / MAP_WORLD_HEIGHT;
    const padding = Math.min(rect.width, rect.height) * paddingRatio;
    const regionWidth = Math.max(1, bounds.maxX - bounds.minX) * baseScaleX;
    const regionHeight = Math.max(1, bounds.maxY - bounds.minY) * baseScaleY;
    const availableWidth = Math.max(1, rect.width - padding * 2);
    const availableHeight = Math.max(1, rect.height - padding * 2);
    const fitScale = Math.min(
      availableWidth / regionWidth,
      availableHeight / regionHeight
    );

    return { baseScaleX, baseScaleY, fitScale };
  }

  function applyViewportRegionFit(svg, rect, bounds, paddingRatio = 0.08) {
    if (!svg || !rect || !bounds) return null;

    const { baseScaleX, baseScaleY, fitScale } = getViewportFitScale(rect, bounds, paddingRatio);
    const scale = getFiniteMapScale(fitScale);
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const x = rect.width / 2 - centerX * baseScaleX * scale;
    const y = rect.height / 2 - centerY * baseScaleY * scale;

    svg.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    svg.style.transformOrigin = "0 0";

    return { baseScaleX, baseScaleY, scale, x, y };
  }

  function clearLocationHighlights() {
    document.querySelectorAll(".map-region.active-location")
      .forEach(el => el.classList.remove("active-location"));
  }

  function highlightLocations(locations) {
    clearLocationHighlights();

    locations.forEach(loc => {
      document.querySelectorAll(".map-region").forEach(el => {
        if (
          el.dataset.name === loc.name &&
          el.dataset.region === loc.region
        ) {
          el.classList.add("active-location");
        }
      });
    });
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

      if (!el) return;

      el.classList.add("map-region");
      el.dataset.name = loc.name;
      el.dataset.region = loc.region;

      el.addEventListener("click", (e) => {

        // EDIT MODE
        if (
          ENABLE_MAP_POINT_EDITOR &&
          document.getElementById("mapViewport")
            ?.classList.contains("map-editor-editing")
        ) {

          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();

          window.__beginPolygonEdit?.(loc, el);

          return;
        }

        // NORMAL CLICK
        if (Date.now() < mapSuppressLocationClickUntil) {
          return;
        }

        selectLocation(loc.name, loc.region);
      });

      container.appendChild(el);
    });
  }

  function initMapControls() {
    const svg = document.getElementById("mapSvg");
    viewport = document.getElementById("mapViewport");
    mapSvgEl = svg;
    mapZoomSlider = document.getElementById("mapZoomSlider");
    mapZoomValue = document.getElementById("mapZoomValue");
    mapRegionSelect = document.getElementById("mapRegionSelect");
    mapViewportToggleButton = document.getElementById("mapViewportToggle");
    const mapViewportCollapseButton = document.getElementById("mapViewportCollapse");
    initDraggableMapControls(viewport, viewport.querySelector(".map-controls"));

    const setMapVisibility = (isVisible) => {
      if (!viewport || !mapViewportToggleButton) return;
      viewport.classList.toggle("hidden", !isVisible);
      mapViewportToggleButton.classList.toggle("hidden", isVisible);
      mapViewportToggleButton.setAttribute("aria-expanded", String(isVisible));

      if (isVisible) {
        refreshMainMapViewport();
      }
    };

    mapViewportToggleButton?.addEventListener("click", () => setMapVisibility(true));
    mapViewportCollapseButton?.addEventListener("click", () => setMapVisibility(false));

    let isDragging = false;
    let startX, startY;
    let dragStartClientX = 0;
    let dragStartClientY = 0;

    let lastDist = 0;
    let lastMid = null;

    function update() {
      updateMapTransform();
    }

    mapZoomSlider?.addEventListener("input", () => {
      setMapZoomPercent(Number(mapZoomSlider.value));
      if (Number(mapZoomSlider.value) === 0) syncMapRegionSelect("");
    });

    /* ZOOM */
    viewport.addEventListener("wheel", (e) => {
      e.preventDefault();

      const zoomIntensity = 0.1;
      const delta = e.deltaY < 0 ? 1 : -1;

      const rect = viewport.getBoundingClientRect();

      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      mapScale = getFiniteMapScale(mapScale);
      const oldScale = mapScale;
      const newScale = getFiniteMapScale(mapScale + delta * zoomIntensity);

      // world position BEFORE zoom
      const worldX = (mx - mapX) / oldScale;
      const worldY = (my - mapY) / oldScale;

      // apply zoom
      mapScale = newScale;

      // compute new pan
      let newX = mx - worldX * mapScale;
      let newY = my - worldY * mapScale;

      // 🔥 ALWAYS clamp AFTER computing new position
      ({ x: newX, y: newY } = clamp(newX, newY, mapScale));

      mapX = newX;
      mapY = newY;

      update();
    });

    /* PAN */
    viewport.addEventListener("mousedown", (e) => {
      if (e.target.closest(".map-controls, .map-viewport-collapse")) return;
      isDragging = true;
      viewport.classList.add("map-is-panning");
      dragStartClientX = e.clientX;
      dragStartClientY = e.clientY;
      startX = e.clientX - mapX;
      startY = e.clientY - mapY;
      viewport.style.cursor = "grabbing";
    });

    window.addEventListener("mousemove", (e) => {
      if (!isDragging) return;

      if (Math.hypot(e.clientX - dragStartClientX, e.clientY - dragStartClientY) > 5) {
        mapSuppressLocationClickUntil = Date.now() + 350;
      }

      mapX = e.clientX - startX;
      mapY = e.clientY - startY;

      update();
    });

    window.addEventListener("mouseup", () => {
      isDragging = false;
      viewport.classList.remove("map-is-panning");
      viewport.style.cursor = "grab";
    });

    viewport.addEventListener("touchstart", (e) => {
      if (e.target.closest(".map-controls, .map-viewport-collapse")) return;
      if (e.touches.length === 2) {
        isDragging = false;
        mapSuppressLocationClickUntil = Date.now() + 350;
        lastDist = getTouchDistance(e);
        lastMid = getTouchMidpoint(e);
      } else if (e.touches.length === 1) {
        isDragging = true;
        viewport.classList.add("map-is-panning");
        dragStartClientX = e.touches[0].clientX;
        dragStartClientY = e.touches[0].clientY;
        startX = e.touches[0].clientX - mapX;
        startY = e.touches[0].clientY - mapY;
      }
    }, { passive: false });

    viewport.addEventListener("touchmove", (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();

        const newDist = getTouchDistance(e);
        const newMid = getTouchMidpoint(e);

        mapScale = getFiniteMapScale(mapScale);
        const zoomFactor = lastDist ? newDist / lastDist : 1;
        const newScale = getFiniteMapScale(mapScale * zoomFactor);

        const rect = viewport.getBoundingClientRect();
        const mx = newMid.x - rect.left;
        const my = newMid.y - rect.top;

        const worldX = (mx - mapX) / mapScale;
        const worldY = (my - mapY) / mapScale;

        lastDist = newDist;
        lastMid = newMid;

        mapScale = newScale;

        let newX = mx - worldX * mapScale;
        let newY = my - worldY * mapScale;

        ({ x: newX, y: newY } = clamp(newX, newY, mapScale));

        mapX = newX;
        mapY = newY;

        update();
      } else if (e.touches.length === 1 && isDragging) {
        e.preventDefault();
        if (Math.hypot(e.touches[0].clientX - dragStartClientX, e.touches[0].clientY - dragStartClientY) > 5) {
          mapSuppressLocationClickUntil = Date.now() + 350;
        }
        mapX = e.touches[0].clientX - startX;
        mapY = e.touches[0].clientY - startY;
        update();
      }
    }, { passive: false });

    viewport.addEventListener("touchend", () => {
      isDragging = false;
      viewport.classList.remove("map-is-panning");
      lastDist = 0;
      lastMid = null;
    });

    update();
    initMapDevTools()
  }

  function updateMapTransform() {
    if (!mapSvgEl || !viewport) return;

    mapScale = getFiniteMapScale(mapScale);
    ({ x: mapX, y: mapY } = clamp(mapX, mapY, mapScale));
    mapSvgEl.style.transform = `translate(${mapX}px, ${mapY}px) scale(${mapScale})`;
    mapSvgEl.style.transformOrigin = "0 0";
    syncMapZoomControls();
  }

  function syncMapZoomControls() {
    const zoomPercent = Math.round((mapScale - MAP_MIN_SCALE) * 100);

    if (mapZoomSlider && Number(mapZoomSlider.value) !== zoomPercent) {
      mapZoomSlider.value = zoomPercent;
    }

    if (mapZoomValue) {
      mapZoomValue.value = `${zoomPercent}%`;
      mapZoomValue.textContent = `${zoomPercent}%`;
    }
  }

  function setMapZoomPercent(percent) {
    const nextScale = MAP_MIN_SCALE + Math.max(0, Math.min(500, percent)) / 100;
    zoomMapToScale(nextScale);
  }

  function zoomMapToScale(nextScale, focusPoint = null) {
    if (!viewport) return;

    const rect = viewport.getBoundingClientRect();
    if (!hasUsableRect(rect)) return;
    const mx = focusPoint ? focusPoint.clientX - rect.left : rect.width / 2;
    const my = focusPoint ? focusPoint.clientY - rect.top : rect.height / 2;
    const clampedScale = getFiniteMapScale(nextScale);

    mapScale = getFiniteMapScale(mapScale);
    const worldX = (mx - mapX) / mapScale;
    const worldY = (my - mapY) / mapScale;

    mapScale = clampedScale;
    mapX = mx - worldX * mapScale;
    mapY = my - worldY * mapScale;

    updateMapTransform();
  }

  function zoomMapToRegion(region) {
    if (!viewport || !region) return;

    const bounds = getFixedMapRegionBounds(region);
    if (!bounds) return;

    const rect = viewport.getBoundingClientRect();
    if (!hasUsableRect(rect)) return;
    const fit = applyViewportRegionFit(mapSvgEl, rect, bounds, 0.08);
    if (!fit) return;
    mapScale = fit.scale;
    mapX = fit.x;
    mapY = fit.y;

    syncMapRegionSelect(region);
    updateMapTransform();
  }

  function zoomMapToLocations(locations) {
    if (!viewport || !locations?.length) return;

    const bounds = getLocationsBounds(locations);
    if (!bounds) return;

    const rect = viewport.getBoundingClientRect();
    if (!hasUsableRect(rect)) return;

    const baseScaleX = rect.width / MAP_WORLD_WIDTH;
    const baseScaleY = rect.height / MAP_WORLD_HEIGHT;

    const padding = Math.min(rect.width, rect.height) * 0.15;

    const width = Math.max(1, bounds.maxX - bounds.minX) * baseScaleX;
    const height = Math.max(1, bounds.maxY - bounds.minY) * baseScaleY;

    const fitScale = Math.min(
      (rect.width - padding * 2) / width,
      (rect.height - padding * 2) / height
    );

    mapScale = getFiniteMapScale(fitScale);

    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    mapX = rect.width / 2 - centerX * baseScaleX * mapScale;
    mapY = rect.height / 2 - centerY * baseScaleY * mapScale;

    updateMapTransform();
  }

  function getFixedMapRegionBounds(region) {
    const viewport = MAP_REGION_VIEWPORTS[region];
    if (!viewport) return null;

    return {
      minX: Math.min(viewport.from.x, viewport.to.x),
      maxX: Math.max(viewport.from.x, viewport.to.x),
      minY: Math.min(viewport.from.y, viewport.to.y),
      maxY: Math.max(viewport.from.y, viewport.to.y)
    };
  }

  function getMapRegionBounds(region) {
    const regionLocations = LOCATION_DATA.filter(loc => loc.region === region && loc.points);
    if (!regionLocations.length) return null;

    return regionLocations.reduce((bounds, loc) => {
      parseMapPoints(loc.points).forEach(([px, py]) => {
        bounds.minX = Math.min(bounds.minX, px);
        bounds.maxX = Math.max(bounds.maxX, px);
        bounds.minY = Math.min(bounds.minY, py);
        bounds.maxY = Math.max(bounds.maxY, py);
      });
      return bounds;
    }, {
      minX: Infinity,
      maxX: -Infinity,
      minY: Infinity,
      maxY: -Infinity
    });
  }

  function getLocationsBounds(locations) {
    const allPoints = [];

    locations.forEach(loc => {
      parseMapPoints(loc.points || "")
        .forEach(point => allPoints.push(point));
    });

    if (!allPoints.length) return null;

    return allPoints.reduce((bounds, [px, py]) => {
      bounds.minX = Math.min(bounds.minX, px);
      bounds.maxX = Math.max(bounds.maxX, px);
      bounds.minY = Math.min(bounds.minY, py);
      bounds.maxY = Math.max(bounds.maxY, py);

      return bounds;
    }, {
      minX: Infinity,
      maxX: -Infinity,
      minY: Infinity,
      maxY: -Infinity
    });
  }

  function getMapLocationCenter(loc) {
    const points = parseMapPoints(loc.points || "");
    if (!points.length) return null;

    return {
      x: points.reduce((sum, p) => sum + p[0], 0) / points.length,
      y: points.reduce((sum, p) => sum + p[1], 0) / points.length
    };
  }

  function parseMapPoints(points) {
    return points
      .trim()
      .split(/\s+/)
      .map(point => point.split(",").map(Number))
      .filter(([px, py]) => Number.isFinite(px) && Number.isFinite(py));
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

  function hasUsableRect(rect) {
    return rect && rect.width > 0 && rect.height > 0;
  }

  function getFiniteMapScale(scale) {
    return Number.isFinite(scale)
      ? Math.max(MAP_MIN_SCALE, Math.min(MAP_MAX_SCALE, scale))
      : MAP_MIN_SCALE;
  }

  function clamp(x, y, scale) {
    const rect = viewport.getBoundingClientRect();
    if (!hasUsableRect(rect)) return { x: 0, y: 0 };

    // ✅ CONSTANT world size (from viewBox)
    const worldWidth = MAP_WORLD_WIDTH;
    const worldHeight = MAP_WORLD_HEIGHT;

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
    const center = getMapLocationCenter(loc);
    if (!center) return;

    const pin = document.getElementById("mapPin");
    pin.setAttribute("cx", center.x);
    pin.setAttribute("cy", center.y);
    pin.classList.remove("hidden");
  }

  function initDraggableMapControls(mapViewport, controls, cleanup = null) {
    if (!mapViewport || !controls) return;

    const handle = controls.querySelector(".map-controls-handle");
    const dragTarget = handle || controls;
    let dragging = false;
    let pointerId = null;
    let offsetX = 0;
    let offsetY = 0;

    const clampControls = (x, y) => {
      const viewportRect = mapViewport.getBoundingClientRect();
      const controlsRect = controls.getBoundingClientRect();
      const maxX = Math.max(0, viewportRect.width - controlsRect.width - 8);
      const maxY = Math.max(0, viewportRect.height - controlsRect.height - 8);

      return {
        x: Math.min(maxX, Math.max(8, x)),
        y: Math.min(maxY, Math.max(8, y))
      };
    };

    const moveTo = (clientX, clientY) => {
      const viewportRect = mapViewport.getBoundingClientRect();
      const next = clampControls(clientX - viewportRect.left - offsetX, clientY - viewportRect.top - offsetY);
      controls.style.left = `${next.x}px`;
      controls.style.top = `${next.y}px`;
      controls.style.right = "auto";
    };

    const onPointerDown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragging = true;
      pointerId = e.pointerId;
      controls.classList.add("map-controls-dragging");
      const controlsRect = controls.getBoundingClientRect();
      offsetX = e.clientX - controlsRect.left;
      offsetY = e.clientY - controlsRect.top;
      dragTarget.setPointerCapture?.(pointerId);
    };

    const onPointerMove = (e) => {
      if (!dragging || e.pointerId !== pointerId) return;
      e.preventDefault();
      moveTo(e.clientX, e.clientY);
    };

    const onPointerUp = (e) => {
      if (!dragging || e.pointerId !== pointerId) return;
      dragging = false;
      controls.classList.remove("map-controls-dragging");
      dragTarget.releasePointerCapture?.(pointerId);
      pointerId = null;
    };

    const stopControlEvent = (e) => e.stopPropagation();
    const reclampOnResize = () => {
      const currentLeft = Number.parseFloat(controls.style.left || "8");
      const currentTop = Number.parseFloat(controls.style.top || "8");
      const next = clampControls(currentLeft, currentTop);
      controls.style.left = `${next.x}px`;
      controls.style.top = `${next.y}px`;
    };

    controls.addEventListener("mousedown", stopControlEvent);
    controls.addEventListener("touchstart", stopControlEvent, { passive: false });
    controls.addEventListener("wheel", stopControlEvent);
    dragTarget.addEventListener("pointerdown", onPointerDown);
    dragTarget.addEventListener("pointermove", onPointerMove);
    dragTarget.addEventListener("pointerup", onPointerUp);
    dragTarget.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("resize", reclampOnResize);

    const cleanupFns = [
      () => controls.removeEventListener("mousedown", stopControlEvent),
      () => controls.removeEventListener("touchstart", stopControlEvent),
      () => controls.removeEventListener("wheel", stopControlEvent),
      () => dragTarget.removeEventListener("pointerdown", onPointerDown),
      () => dragTarget.removeEventListener("pointermove", onPointerMove),
      () => dragTarget.removeEventListener("pointerup", onPointerUp),
      () => dragTarget.removeEventListener("pointercancel", onPointerUp),
      () => window.removeEventListener("resize", reclampOnResize)
    ];

    if (cleanup) cleanup.push(...cleanupFns);
  }

  function initMapDevTools() {
    if (!ENABLE_MAP_POINT_EDITOR) return;

    const svg = document.getElementById("mapSvg");
    const viewport = document.getElementById("mapViewport");
    const regions = document.getElementById("mapRegions");

    let drawing = false;
    let currentPoints = [];
    let tempLayer = null;
    let statusText = null;
    let editingPolygon = null;
    let editingPoints = [];
    let dragPointIndex = -1;
    let editLayer = null;

    const polygons = LOCATION_DATA;

    const toolbar = document.createElement("div");
    toolbar.className = "map-editor-toolbar";
    toolbar.innerHTML = `
      <button type="button" class="btn btn--panel" data-action="draw">Add Points</button>
      <button type="button" class="btn btn--panel" data-action="edit">Edit Location</button>
      <button type="button" class="btn btn--panel" data-action="done" disabled>Done</button>
      <button type="button" class="btn btn--panel" data-action="cancel" disabled>Cancel</button>
      <button type="button" class="btn btn--panel" data-action="copy">Copy JSON</button>
      <span class="map-editor-status">Idle</span>
    `;
    viewport.appendChild(toolbar);

    const drawBtn = toolbar.querySelector('[data-action="draw"]');
    const editBtn = toolbar.querySelector('[data-action="edit"]');
    const doneBtn = toolbar.querySelector('[data-action="done"]');
    const cancelBtn = toolbar.querySelector('[data-action="cancel"]');
    const copyToolbarBtn = toolbar.querySelector('[data-action="copy"]');
    statusText = toolbar.querySelector(".map-editor-status");

    toolbar.addEventListener("click", (e) => {
      const action = e.target.closest("button")?.dataset.action;
      if (!action) return;

      if (action === "draw") {
        startDrawing();
      } else if (action === "edit") {
        startEditMode();
      } else if (action === "done") {
        if (editingPolygon) {
          finishEditing();
        } else {
          finishDrawing();
        }
      } else if (action === "cancel") {
        cancelEditing();
      } else if (action === "copy") {
        copyLocationsJson(copyToolbarBtn);
      }
    });

    viewport.addEventListener("mousedown", (e) => {
      if (!drawing || e.target.closest(".map-editor-toolbar")) return;
      e.preventDefault();
      e.stopPropagation();
    }, true);

    svg.addEventListener("click", (e) => {
      if (!drawing || e.target.closest(".map-editor-toolbar")) return;

      e.preventDefault();
      e.stopImmediatePropagation();
      const pt = getSVGPoint(svg, e.clientX, e.clientY);

      currentPoints.push([pt.x, pt.y]);
      drawTempShape();
      updateEditorState();
    }, true);

    svg.addEventListener("mousedown", (e) => {
      const point = e.target.closest(".map-editor-edit-point");

      if (!point || !editingPolygon) return;

      e.preventDefault();
      e.stopPropagation();

      dragPointIndex = Number(point.dataset.index);
    }, true);

    window.addEventListener("mousemove", (e) => {
      if (dragPointIndex === -1 || !editingPolygon) return;

      const pt = getSVGPoint(svg, e.clientX, e.clientY);

      editingPoints[dragPointIndex] = [pt.x, pt.y];

      drawEditHandles();
    });

    window.addEventListener("mouseup", () => {
      dragPointIndex = -1;
    });

    function startDrawing() {
      drawing = true;
      currentPoints = [];
      ensureTempLayer();
      tempLayer.replaceChildren();
      viewport.classList.add("map-editor-drawing");
      updateEditorState();
    }

    function finishDrawing() {
      if (currentPoints.length < 3) {
        statusText.textContent = "Add at least 3 points";
        return;
      }

      drawing = false;
      viewport.classList.remove("map-editor-drawing");
      updateEditorState();
      openPolygonForm([...currentPoints]);
    }

    function cancelDrawing() {
      drawing = false;
      viewport.classList.remove("map-editor-drawing");
      clearTemp();
      updateEditorState();
    }
    function startEditMode() {
      drawing = false;
      editingPolygon = null;
      editingPoints = [];
      viewport.classList.add("map-editor-editing");

      statusText.textContent = "Click a polygon to edit";
    }

    function beginPolygonEdit(loc, el) {
      editingPolygon = {
        data: loc,
        element: el
      };

      editingPoints = parseMapPoints(loc.points);

      ensureEditLayer();
      drawEditHandles();

      doneBtn.disabled = false;
      cancelBtn.disabled = false;

      statusText.textContent =
        `Editing ${loc.name}`;
    }

    window.__beginPolygonEdit = beginPolygonEdit;

    function finishEditing() {
      if (!editingPolygon) return;

      const newPoints = pointsToString(editingPoints);

      editingPolygon.data.points = newPoints;
      editingPolygon.element.setAttribute("points", newPoints);

      clearEditLayer();

      editingPolygon = null;
      editingPoints = [];

      viewport.classList.remove("map-editor-editing");

      updateEditorState();
    }

    function cancelEditing() {
      drawing = false;

      clearTemp();
      clearEditLayer();

      editingPolygon = null;
      editingPoints = [];

      viewport.classList.remove("map-editor-editing");
      viewport.classList.remove("map-editor-drawing");

      updateEditorState();
    }

    async function copyLocationsJson(button) {
      const previousText = button.textContent;
      const json = JSON.stringify(polygons, null, 2);

      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(json);
        } else {
          fallbackCopyText(json);
        }
        button.textContent = "Copied";
      } catch (err) {
        try {
          fallbackCopyText(json);
          button.textContent = "Copied";
        } catch (fallbackErr) {
          console.warn("Clipboard write failed.", err, fallbackErr);
          button.textContent = "Copy failed";
        }
      }

      setTimeout(() => {
        button.textContent = previousText;
      }, 1200);
    }

    function fallbackCopyText(text) {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.className = "map-editor-copy-buffer";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      if (!copied) throw new Error("Copy command was rejected.");
    }

    function updateEditorState() {
      drawBtn.disabled = drawing || !!editingPolygon;
      editBtn.disabled = drawing || !!editingPolygon;
      doneBtn.disabled = !drawing && !editingPolygon;
      cancelBtn.disabled = !drawing && !editingPolygon;
      if (editingPolygon) {
        statusText.textContent =
          `Editing ${editingPolygon.data.name}`;
      } else if (drawing) {
        statusText.textContent =
          `${currentPoints.length} point${currentPoints.length === 1 ? "" : "s"} selected`;
      } else {
        statusText.textContent = "Idle";
      }
    }

    function getSVGPoint(svgEl, clientX, clientY) {
      const pt = svgEl.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;

      return pt.matrixTransform(svgEl.getScreenCTM().inverse());
    }

    function ensureTempLayer() {
      if (tempLayer) return;
      tempLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
      tempLayer.classList.add("map-editor-temp-layer");
      svg.appendChild(tempLayer);
    }

    function ensureEditLayer() {
      if (editLayer) return;

      editLayer = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "g"
      );

      editLayer.classList.add("map-editor-edit-layer");

      svg.appendChild(editLayer);
    }

    function clearEditLayer() {
      editLayer?.replaceChildren();
    }

    function drawEditHandles() {
      if (!editingPolygon) return;

      clearEditLayer();

      const poly = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "polygon"
      );

      poly.setAttribute(
        "points",
        pointsToString(editingPoints)
      );

      poly.classList.add("map-editor-temp-polygon");

      editLayer.appendChild(poly);

      editingPoints.forEach(([x, y], index) => {
        const point = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "circle"
        );

        point.setAttribute("cx", x);
        point.setAttribute("cy", y);
        point.setAttribute("r", 1);

        point.classList.add("map-editor-edit-point");
        point.dataset.index = index;

        editLayer.appendChild(point);
      });
    }

    function drawTempShape() {
      ensureTempLayer();
      tempLayer.replaceChildren();

      if (currentPoints.length > 1) {
        const tempPoly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        tempPoly.setAttribute("points", pointsToString(currentPoints));
        tempPoly.classList.add("map-editor-temp-polygon");
        tempLayer.appendChild(tempPoly);
      }

      currentPoints.forEach(([x, y], index) => {
        const point = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        point.setAttribute("cx", x);
        point.setAttribute("cy", y);
        point.setAttribute("r", 2);
        point.classList.add("map-editor-point");
        point.dataset.index = index + 1;
        tempLayer.appendChild(point);
      });
    }

    function openPolygonForm(points) {
      const modal = document.createElement("div");
      modal.className = "map-editor-modal";

      modal.innerHTML = `
        <form class="map-editor-modal-panel">
          <div class="map-editor-modal-title">New Location</div>
          <label>
            <span>Location Name</span>
            <input id="polyName" class="dex-input" autocomplete="off" required>
          </label>
          <label>
            <span>Region</span>
            <input id="polyRegion" class="dex-input" autocomplete="off" required>
          </label>
          <div class="map-editor-modal-actions">
            <button type="button" class="btn btn--secondary" data-action="discard">Discard</button>
            <button type="submit" class="btn">Save</button>
          </div>
        </form>
      `;

      document.body.appendChild(modal);
      modal.querySelector("#polyName").focus();

      modal.querySelector('[data-action="discard"]').addEventListener("click", () => {
        modal.remove();
        clearTemp();
        updateEditorState();
      });

      modal.querySelector("form").addEventListener("submit", (e) => {
        e.preventDefault();
        const name = modal.querySelector("#polyName").value.trim();
        const region = modal.querySelector("#polyRegion").value.trim();
        if (!name || !region) return;

        const polygon = {
          name,
          region,
          shape: "polygon",
          points: pointsToString(points)
        };

        polygons.push(polygon);
        addMapRegionElement(polygon);
        selectLocation(polygon.name, polygon.region);

        modal.remove();
        clearTemp();
        updateEditorState();
      });
    }

    function addMapRegionElement(loc) {
      const el = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      el.setAttribute("points", loc.points);
      el.classList.add("map-region");
      el.dataset.name = loc.name;
      el.dataset.region = loc.region;
      el.addEventListener("click", (e) => {
        if (editingPolygon !== null ||
            viewport.classList.contains("map-editor-editing")) {

          e.preventDefault();
          e.stopPropagation();

          beginPolygonEdit(loc, el);
          return;
        }

        if (Date.now() < mapSuppressLocationClickUntil) return;

        selectLocation(loc.name, loc.region);
      });
      regions.appendChild(el);
    }

    function pointsToString(points) {
      return points.map(([x, y]) => `${x},${y}`).join(" ");
    }

    function clearTemp() {
      currentPoints = [];
      tempLayer?.replaceChildren();
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
        syncMapRegionSelect("");
        setMapZoomPercent(0);
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
    browserFindHighlightedCard = null;
    const frag = document.createDocumentFragment();

    filtered.forEach(mon => {
      const card = createCard(mon);
      frag.appendChild(card);
    });

    grid.appendChild(frag);
  }

  function syncBrowserFindHighlight() {
    const selection = document.getSelection();
    const selectedNode = selection?.rangeCount ? selection.anchorNode : null;
    const selectedText = selection?.toString().trim();
    const card = selectedText && selectedNode?.parentElement
      ? selectedNode.parentElement.closest(".poke-card")
      : null;

    if (card === browserFindHighlightedCard) return;

    browserFindHighlightedCard?.classList.remove("find-highlight");
    browserFindHighlightedCard = grid?.contains(card) ? card : null;
    browserFindHighlightedCard?.classList.add("find-highlight");
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
        
        ${isVariant ? `<div class="variant-badge">Form: ${buildVariantTypeBadges(mon.types)}</div>` : ""}

        <div class="sr-only">${mon.name}</div>
      </div>
    `;

    const img = card.querySelector("img");
    applyImageFallback(img, base.id, baseId);

    card.onclick = () => openModal(card, mon);

    return card;
  }

  function buildVariantTypeBadges(types = []) {
    return [...new Set(types)].map(t =>
      `<span class="type-badge-variant type-${t.toLowerCase()}">${t}</span>`
    ).join("");
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

  function groupByBase(list) {
    const map = new Map();

    list.forEach(mon => {
      const base = getBaseForm(mon);
      const baseId = base.id;

      if (!map.has(baseId)) {
        map.set(baseId, {
          base: null,
          variants: []
        });
      }

      const entry = map.get(baseId);

      if (mon.id === baseId) {
        entry.base = mon;
      } else {
        entry.variants.push(mon);
      }
    });

    // 🔥 Flatten into ordered list
    const result = [];

    [...map.entries()]
      .sort((a, b) => a[0] - b[0]) // sort by base ID
      .forEach(([_, group]) => {
        if (group.base) {
          result.push(group.base);
        }

        // optional: sort variants (by ID or name)
        group.variants.sort((a, b) => a.id - b.id);

        result.push(...group.variants);
      });

    return result;
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
    setTimeout(() => updateURL(mon), 250);
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
    disconnectSummaryEvolutionTree();
    cleanupModalLocationMap();
    modalBody.innerHTML = buildModal(mon);

    initTabs();
    initFormsList(mon); // ✅ new
    bindEvolutionClicks();
    bindSummaryAbilities();
    bindModalMoves(mon);
    bindModalLocations(mon);
    bindBodySummaryTools();
    initSummaryEvolutionTree();
  }

  function closeModal() {
    navigateToTool("pokedexTool");
  }

  function switchForm(id) {
    const mon = data.find(m => m.id === id);
    if (!mon) return;

    updateURL(mon);
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

function buildLeftPanel(mon) {
  const forms = getAlternateForms(mon);
  const held = getHeldItems(mon);

  return `
    <div class="pokedex-left">

      <div class="pokedex-name">
        ${mon.name}
      </div>

      <div class="pokedex-image-container">
        <img id="mainImage"
            class="pokedex-modal-image-main"
            src="${getAnimatedSprite(mon.id)}"
            onerror="this.src='sprites/pokemon/0.png'">

        <div class="pokedex-image-footer">
          <div class="pokedex-modal-image-types">
              ${buildTypeBadges(mon.types)}
          </div>

          <div class="item-list pokedex-modal-item-list">
            <img src="sprites/assets/held-item.png" alt="" style="padding-right: 4px;">
              ${held.length
                ? held.map(i => `
                  <button class="held-chip" data-item="${i}">
                    <img src="sprites/items/${i}.png" alt="${i}">
                  </button>
                `).join("")
                : `<span>None<span>`}
          </div>
        </div>
      </div>

      ${forms.length ? `
        <div class="forms-list">
          ${forms.map(f => `
            <button type="button" class="form-btn" data-id="${f.id}" aria-label="Open ${f.name}">
              <img src="sprites/pokemon/${f.id}.png" onerror="this.onerror=null; this.src='sprites/pokemon/0.png';">
              <span class="form-name">${f.name}</span>
            </button>
          `).join("")}
        </div>
      ` : ""}

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
          <div class="tab" data-tab="moves">Moves</div>
          <div class="tab" data-tab="locations">Locations</div>
        </div>

        <div id="summary" class="tab-content active">
          ${buildSummary(mon)}
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

        if (tab.dataset.tab === "summary") {
          initSummaryEvolutionTree();
        } else {
          disconnectSummaryEvolutionTree();
        }

        if (tab.dataset.tab === "moves") {
          $("#modalMoveSearch")?.focus();
        }

        if (tab.dataset.tab === "locations") {
          $("#modalLocationSearch")?.focus();
          refreshModalLocationMapViewport();
        }
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
    disconnectSummaryEvolutionTree();
    $("#stats").innerHTML = buildStats(mon);
    $("#summary").innerHTML = buildSummary(mon);
    $("#moves").innerHTML = buildMoves(mon);
    $("#locations").innerHTML = buildLocations(mon);
    $("#evolutions").innerHTML = buildEvolutions(mon);
    bindEvolutionClicks();
    bindSummaryAbilities();
    bindModalMoves(mon);
    bindModalLocations(mon);
    bindBodySummaryTools();
    initSummaryEvolutionTree();
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
  const abilities = getUniqueAbilities(mon);
  const held = getHeldItems(mon);
  const evolutionMarkup = buildHorizontalEvolution(mon);

  return `
    <div class="summary-grid">

      <!-- TYPES -->
      <div class="summary-card">
        <h3>Typing Chart</h3>

        ${buildTypeChart(mon)}
      </div>


      <!-- ABILITIES -->
      <div class="summary-card">
        <h3>Abilities</h3>

        <div class="ability-list">
          ${abilities.length
            ? abilities.map(a => `
              <button class="summary-chip ability-chip"
                data-ability="${a}">
                ${a}
              </button>
            `).join("")
            : "None"}
        </div>

        <div id="summaryAbilityInfo"></div>
      </div>

      ${buildBodySummary(mon)}

      ${evolutionMarkup ? `
        <div class="summary-card summary-evo-card">
          <h3>Evolutions</h3>

          ${evolutionMarkup}
        </div>
      ` : ""}

    </div>
  `;
}

  function buildBodySummary(mon) {
    const baseWeight = getWeightKg(mon);
    const height = getHeightM(mon);
    const weightVariants = getWeightVariants(mon);
    const lowKickPower = getWeightTierPower(baseWeight);
    const crashLearners = getBodyCrashLearners();
    const defaultCrashAttacker = crashLearners.find(attacker => attacker.id !== mon.id) || crashLearners[0];
    const crashPower = defaultCrashAttacker
      ? getWeightRatioPower(getWeightKg(defaultCrashAttacker), baseWeight)
      : null;

    return `
      <div class="summary-card body-summary-card">
        <h3>Body</h3>

        <div class="body-measure-grid">
          <div class="body-measure">
            <span>Height</span>
            <b>${formatMeters(height)}</b>
          </div>
          <div class="body-measure">
            <span>Weight</span>
            <b>${formatKg(baseWeight)}
            ${weightVariants.length ? `
                ${weightVariants.map(v => `/ ${formatKg(v.weight)}`).join(" · ")}
            ` : ""}</b>
          </div>
        </div>

        <div class="body-mechanics">
          <div>
            <b>Sky Drop:</b>
            ${getSkyDropResult(mon)}
          </div>
          <div>
            <b>Grass Knot:</b>
            ${lowKickPower} power
          </div>
          <div>
            <b>Low Kick:</b>
            ${lowKickPower} power
          </div>
          <div class="body-summary-matchup" data-target-id="${mon.id}">
            <b>Heat Crash / Heavy Slam:</b> Against
            <select class="body-summary-attacker">
              ${buildPokemonOptions(crashLearners, defaultCrashAttacker?.id)}
            </select>
            <span class="body-summary-result">
              ${defaultCrashAttacker ? `damages at <b>${crashPower}</b> power` : "no eligible attackers found"}
            </span>
          </div>
        </div>
      </div>
    `;
  }

  function bindBodySummaryTools() {
    modalBody.querySelectorAll(".body-summary-matchup").forEach(tool => {
      const select = tool.querySelector(".body-summary-attacker");
      const result = tool.querySelector(".body-summary-result");
      if (!select || !result || select.dataset.bound) return;

      select.dataset.bound = "true";
      select.addEventListener("change", () => {
        const attacker = data.find(mon => mon.id === Number(select.value));
        const target = data.find(mon => mon.id === Number(tool.dataset.targetId));
        const power = attacker && target
          ? getWeightRatioPower(getWeightKg(attacker), getWeightKg(target))
          : null;
        result.textContent = power ? `damages at ${power} base power` : "no eligible attackers found";
      });
    });
  }

  function getWeightKg(mon) {
    return (Number(mon?.weight) || 0) / 10;
  }

  function getHeightM(mon) {
    return (Number(mon?.height) || 0) / 10;
  }

  function getWeightVariants(mon) {
    const weight = getWeightKg(mon);
    const abilities = getUniqueAbilities(mon);
    const variants = [];

    if (abilities.includes("Heavy Metal")) variants.push({ label: "Heavy Metal", weight: weight * 2 });
    if (abilities.includes("Light Metal")) variants.push({ label: "Light Metal", weight: weight / 2 });

    return variants;
  }

  function getSkyDropResult(mon) {
    const tooHeavy = getWeightKg(mon) >= 200;
    const isFlying = (mon.types || []).some(type => type.toLowerCase() === "flying");

    return tooHeavy || isFlying ? "No effect" : "Full damage";
  }

  function getBodyEligiblePokemon() {
    return data.filter(mon => isEligible(mon) && mon.weight > 0);
  }

  function canLearnMove(mon, moveKey) {
    return (mon.moves || []).some(move => normalizeMoveName(move.name) === moveKey);
  }

  function getMoveLearners(moveKey) {
    return getBodyEligiblePokemon().filter(mon => canLearnMove(mon, moveKey));
  }

  function getBodyCrashLearners() {
    const seen = new Set();

    return ["heat-crash", "heavy-slam"].flatMap(key => getMoveLearners(key))
      .filter(mon => {
        if (seen.has(mon.id)) return false;
        seen.add(mon.id);
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function buildPokemonOptions(pokemon, selectedId) {
    return pokemon.map(mon => `
      <option value="${mon.id}" ${selectedId === mon.id ? "selected" : ""}>
        ${mon.name}
      </option>
    `).join("");
  }

  function getWeightTierPower(weightKg) {
    if (weightKg <= 10) return 20;
    if (weightKg <= 25) return 40;
    if (weightKg <= 50) return 60;
    if (weightKg <= 100) return 80;
    if (weightKg <= 200) return 100;
    return 120;
  }

  function getWeightRatioPower(userWeightKg, targetWeightKg) {
    if (!targetWeightKg) return 120;

    const ratio = userWeightKg / targetWeightKg;
    if (ratio >= 5) return 120;
    if (ratio >= 4) return 100;
    if (ratio >= 3) return 80;
    if (ratio >= 2) return 60;
    return 40;
  }

  function formatKg(kg) {
    return `${formatCompactNumber(kg)} kg`;
  }

  function formatMeters(meters) {
    return `${formatCompactNumber(meters)} m`;
  }

  function formatCompactNumber(value) {
    if (!Number.isFinite(value)) return "0";
    return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
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
    return (mon.held_items || []).map(i => i.id || i).filter(Boolean);
  }

function buildTypeChart(mon) {
  const effects = getTypeEffectiveness(mon.types);
  const { weak4x, weak2x, resist2x, resist4x, immune } = categorizeEffectiveness(effects);

  // Helper to wrap badges in a flex container if they exist
  const wrapBadges = (badgesHtml) => {
    return badgesHtml ? `<div class="type-chart-table-badge-wrappers">${badgesHtml}</div>` : "None";
  };

  return `
    <table class="type-chart-table">
      <tbody>
        <tr class="row-weakness">
          <td rowspan="2" class="category-header"><b>Weaknesses</b></td>
          <td><b>4x</b></td>
          <td>${wrapBadges(buildTypeBadges(weak4x))}</td>
        </tr>
        <tr class="row-weakness">
          <td><b>2x</b></td>
          <td>${wrapBadges(buildTypeBadges(weak2x))}</td>
        </tr>

        <tr class="row-resistance">
          <td rowspan="2" class="category-header"><b>Resistances</b></td>
          <td><b>0.5x</b></td>
          <td>${wrapBadges(buildTypeBadges(resist2x))}</td>
        </tr>
        <tr class="row-resistance">
          <td><b>0.25x</b></td>
          <td>${wrapBadges(buildTypeBadges(resist4x))}</td>
        </tr>

        <tr class="row-immunity">
          <td><b>Immunities</b></td>
          <td><b>0x</b></td>
          <td>${wrapBadges(buildTypeBadges(immune))}</td>
        </tr>
      </tbody>
    </table>
  `;
}

  function getTypeEffectiveness(types = []) {
    const result = {};

    Object.keys(TYPE_CHART).forEach(attackingType => {
      let multiplier = 1;

      types.forEach(defType => {
        const chart = TYPE_CHART[defType.toLowerCase()] || {};
        multiplier *= chart[attackingType] ?? 1;
      });

      result[attackingType] = multiplier;
    });

    return result;
  }

  function categorizeEffectiveness(effects) {
    const weak4x = [];
    const weak2x = [];
    const resist2x = []; // 0.5x
    const resist4x = []; // 0.25x
    const immune = [];

    Object.entries(effects).forEach(([type, val]) => {
      const capitalizedType = capitalize(type);

      if (val === 0) {
        immune.push(capitalizedType);
      } else if (val === 4) {
        weak4x.push(capitalizedType);
      } else if (val === 2) {
        weak2x.push(capitalizedType);
      } else if (val === 0.5) {
        resist2x.push(capitalizedType);
      } else if (val === 0.25) {
        resist4x.push(capitalizedType);
      }
    });

    return { weak4x, weak2x, resist2x, resist4x, immune };
  }

  function bindSummaryAbilities() {
    modalBody.querySelectorAll(".ability-chip").forEach(btn => {
      btn.onclick = () => {
        renderInlineAbilityInfo(btn.dataset.ability);
      };
    });
  }

  function renderInlineAbilityInfo(name) {
    const key = name.toLowerCase().replace(/\s+/g, "-");
    const ability = ABILITY_DATA[key];

    const box = $("#summaryAbilityInfo");
    if (!box || !ability) return;

    box.innerHTML = `
      <div class="ability-inline-box">
        <div><b>Battle:</b> ${ability.effect?.battle || "None"}</div>
        <div><b>Overworld:</b> ${ability.effect?.overworld || "None"}</div>
      </div>
    `;
  }
  /* =============================================================
     EVOLUTION TREE
  ============================================================= */

function getHorizontalEvolutionPaths(mon) {
  const tree = buildEvolutionTree();
  const root = findEvolutionRoot(mon, tree);

  if (!root) return [];

  return collectEvolutionPaths(root).filter(path => path.length > 1);
}

function collectEvolutionPaths(node, method = null) {
  if (!node) return [];

  const current = {
    mon: node.mon,
    method
  };

  if (!node.children.length) {
    return [[current]];
  }

  return node.children.flatMap(child =>
    collectEvolutionPaths(child.node, child.method).map(path => [current, ...path])
  );
}

function getHorizontalEvolutionChain(mon) {
  const tree = buildEvolutionTree();
  const root = findEvolutionRoot(mon, tree);

  if (!root) return null;

  const chain = flattenEvolutionChain(root);
  return chain.length > 1 ? chain : null;
}

function flattenEvolutionChain(root) {
  const result = [];

  function walk(node, method = null) {
    result.push({
      mon: node.mon,
      method
    });

    if (node.children[0]) {
      walk(node.children[0].node, node.children[0].method);
    }
  }

  walk(root);
  return result;
}

function buildHorizontalEvolution(mon) {
  const tree = buildEvolutionTree();
  const root = findEvolutionRoot(mon, tree);

  if (!root || !hasEvolutionDescendants(root)) return "";

  return `
    <div class="summary-evo-tree">
      <div class="summary-evo-scale">
        <svg class="summary-evo-lines" aria-hidden="true" focusable="false"></svg>
        <div class="summary-evo-root">
          ${renderSummaryEvolutionBranch(root, mon.id)}
        </div>
      </div>
    </div>
  `;
}

function hasEvolutionDescendants(node) {
  return Boolean(node?.children?.length);
}

function renderSummaryEvolutionBranch(node, currentId, incomingMethod = null) {
  return `
    <div class="summary-evo-branch" data-node-id="${node.mon.id}">
      <div class="evo-node ${node.mon.id === currentId ? "active" : ""}" data-id="${node.mon.id}">
        ${incomingMethod ? `
          <div class="evo-cond">
            ${formatEvolutionMethod(incomingMethod)}
          </div>
        ` : ""}
        <img src="sprites/pokemon/${node.mon.id}.png" alt="${node.mon.name}">
        <div>${node.mon.name}</div>
      </div>

      ${node.children.length ? `
        <div class="summary-evo-children${node.children.length > 1 ? " summary-evo-children--branching" : ""}">
          ${node.children.map(child => renderSummaryEvolutionBranch(child.node, currentId, child.method)).join("")}
        </div>
      ` : ""}
    </div>
  `;
}

function initSummaryEvolutionTree() {
  disconnectSummaryEvolutionTree();

  const tree = modalBody?.querySelector(".summary-evo-tree");
  if (!tree) return;

  const card = tree.closest(".summary-evo-card") || tree;
  const root = tree.querySelector(".summary-evo-root");
  if (!root) return;

  const layout = () => {
    if (summaryEvoLayoutFrame) cancelAnimationFrame(summaryEvoLayoutFrame);

    summaryEvoLayoutFrame = requestAnimationFrame(() => {
      summaryEvoLayoutFrame = 0;
      if (!tree.isConnected) return;
      layoutSummaryEvolutionTree(tree);
    });
  };

  layout();

  if (document.readyState !== "complete") {
    const handleWindowLoad = () => layout();
    window.addEventListener("load", handleWindowLoad, { once: true });
    summaryEvoCleanup.push(() => {
      window.removeEventListener("load", handleWindowLoad);
    });
  }

  tree.querySelectorAll("img").forEach(img => {
    if (img.complete) return;

    const handleImageReady = () => layout();
    img.addEventListener("load", handleImageReady, { once: true });
    img.addEventListener("error", handleImageReady, { once: true });

    summaryEvoCleanup.push(() => {
      img.removeEventListener("load", handleImageReady);
      img.removeEventListener("error", handleImageReady);
    });
  });

  if (typeof ResizeObserver === "function") {
    summaryEvoResizeObserver = new ResizeObserver(layout);
    summaryEvoResizeObserver.observe(card);
    summaryEvoResizeObserver.observe(root);
  }
}

function disconnectSummaryEvolutionTree() {
  if (summaryEvoLayoutFrame) {
    cancelAnimationFrame(summaryEvoLayoutFrame);
    summaryEvoLayoutFrame = 0;
  }

  if (summaryEvoResizeObserver) {
    summaryEvoResizeObserver.disconnect();
    summaryEvoResizeObserver = null;
  }

  summaryEvoCleanup.forEach(cleanup => cleanup());
  summaryEvoCleanup = [];
}

function layoutSummaryEvolutionTree(tree) {
  const scale = tree.querySelector(".summary-evo-scale");
  const root = tree.querySelector(".summary-evo-root");
  const svg = tree.querySelector(".summary-evo-lines");
  if (!scale || !root || !svg) return;

  const contentPadding = {
    top: 8,
    right: 8,
    bottom: 20,
    left: 8
  };

  tree.style.height = "";
  scale.style.transform = "none";
  scale.style.width = "";
  scale.style.height = "";
  root.style.transform = "none";

  const contentWidth = Math.ceil(root.scrollWidth) + contentPadding.left + contentPadding.right;
  const contentHeight = Math.ceil(root.scrollHeight) + contentPadding.top + contentPadding.bottom;

  if (!contentWidth || !contentHeight) return;

  scale.style.width = `${contentWidth}px`;
  scale.style.height = `${contentHeight}px`;
  root.style.transform = `translate(${contentPadding.left}px, ${contentPadding.top}px)`;

  svg.setAttribute("width", String(contentWidth));
  svg.setAttribute("height", String(contentHeight));
  svg.setAttribute("viewBox", `0 0 ${contentWidth} ${contentHeight}`);

  drawSummaryEvolutionConnectors(scale, root, svg);

  const treeStyles = getComputedStyle(tree);
  const availableWidth =
    tree.clientWidth
    - parseFloat(treeStyles.paddingLeft || "0")
    - parseFloat(treeStyles.paddingRight || "0");

  const scaleFactor = availableWidth > 0
    ? Math.min(1, availableWidth / contentWidth)
    : 1;

  scale.style.transform = `scale(${scaleFactor})`;
  tree.style.height = `${Math.ceil(contentHeight * scaleFactor)}px`;
}

function drawSummaryEvolutionConnectors(scale, root, svg) {
  const defs = `
    <defs>
      <marker id="summaryEvoArrowhead" viewBox="0 0 10 10" refX="9" refY="15"
        markerWidth="4" markerHeight="4" orient="auto-start-reverse">
        <path d="M0 0L10 5L0 10Z"></path>
      </marker>
    </defs>
  `;

  const scaleRect = scale.getBoundingClientRect();
  const paths = [];

  root.querySelectorAll(".summary-evo-branch").forEach(branch => {
    const parentNode = getDirectBranchNode(branch);
    const childBranches = getDirectChildBranches(branch);

    if (!parentNode || !childBranches.length) return;

    const parentRect = parentNode.getBoundingClientRect();
    const startX = parentRect.left + parentRect.width / 2 - scaleRect.left;
    const startY = parentRect.bottom - scaleRect.top;

    childBranches.forEach(childBranch => {
      const childNode = getDirectBranchNode(childBranch);
      if (!childNode) return;

      const childRect = childNode.getBoundingClientRect();
      const endX = childRect.left + childRect.width / 2 - scaleRect.left;
      const endY = childRect.top - scaleRect.top;
      const curve = Math.max(12, (endY - startY) * 0.3);

      paths.push(`
        <path class="summary-evo-line"
          d="M ${startX} ${startY} C ${startX} ${startY + curve}, ${endX} ${endY - curve}, ${endX} ${endY}"
          marker-end=""></path>
      `);
    });
  });

  svg.innerHTML = defs + paths.join("");
}

function getDirectBranchNode(branch) {
  return Array.from(branch.children).find(el => el.classList.contains("evo-node")) || null;
}

function getDirectChildBranches(branch) {
  const children = Array.from(branch.children)
    .find(el => el.classList.contains("summary-evo-children"));

  if (!children) return [];

  return Array.from(children.children)
    .filter(el => el.classList.contains("summary-evo-branch"));
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
    if (e.type === "ITEM") return `Use ${e.item_name || e.val}`;
    if (e.type === "ITEM_MALE") return `Male + ${e.item_name || e.val}`;
    if (e.type === "ITEM_FEMALE") return `Female + ${e.item_name || e.val}`;
    if (e.type === "TRADE") return "Trade";
    if (e.type === "FRIENDSHIP") return "Friendship";
    if (e.type === "HAPPINESS_DAY") return "Friendship (Day)";
    if (e.type === "HAPPINESS_NIGHT") return "Friendship (Night)";
    if (e.type === "LEVEL_LOCATION_2") return "Level at Moss Rock";
    if (e.type === "LEVEL_LOCATION_3") return "Level at Ice Rock";
    if (e.type === "ATK_LESS_THAN_DEF") return `ATK < DEF at Lv ${e.val}`;
    if (e.type === "ATK_GREATER_THAN_DEF") return `ATK > DEF at Lv ${e.val}`;
    if (e.type === "ATK_EQUAL_TO_DEF") return `ATK = DEF at Lv ${e.val}`;
    return `${e.type} ${e.val || ""}`;
  }

  /* =============================================================
    MOVES
  ============================================================= */

  function buildMoves(mon) {
    const moves = getModalMoves(mon);
    const methods = getMoveMethods(moves);

    if (!moves.length) return "<div>No moves</div>";

    return `
      <div class="modal-moves">
        <div class="modal-moves-toolbar">
          <input id="modalMoveSearch" class="dex-input modal-move-search" placeholder="Search moves...">
          <div class="modal-move-methods">
            <button type="button" class="modal-move-method active" data-method="all">All</button>
            ${methods.map(method => `
              <button type="button" class="modal-move-method" data-method="${method}">
                ${formatMoveMethod(method)}
              </button>
            `).join("")}
          </div>
        </div>

        <div class="modal-moves-body">
          <div class="modal-move-list" role="list">
            ${moves.map((move, index) => buildModalMoveRow(move, index)).join("")}
            <div class="modal-move-empty hidden">No matching moves</div>
          </div>

          <div id="modalMoveInfo" class="modal-move-info"></div>
        </div>
      </div>
    `;
  }

  function compareLearnsetMoves(a, b) {
    const typeCompare = getMoveMethodOrder(a.type) - getMoveMethodOrder(b.type);
    if (typeCompare) return typeCompare;

    const levelCompare = (a.level || 0) - (b.level || 0);
    if (levelCompare) return levelCompare;

    return a.name.localeCompare(b.name);
  }

  function getMoveMethodOrder(type = "") {
    const order = ["level", "EVOLVE", "PREVO", "TM??", "TUTOR", "EGG", "SPECIAL"];
    const index = order.indexOf(type);
    return index === -1 ? order.length : index;
  }

  function formatMoveMethod(type = "") {
    const labels = {
      level: "Level",
      "TM??": "TM",
      TUTOR: "Tutor",
      EGG: "Egg",
      EVOLVE: "Evolve",
      PREVO: "Pre-evo",
      SPECIAL: "Special"
    };

    return labels[type] || formatMoveName(String(type).toLowerCase());
  }

  function getMoveMethods(moves) {
    return [...new Set(moves.map(move => move.type).filter(Boolean))]
      .sort((a, b) => getMoveMethodOrder(a) - getMoveMethodOrder(b));
  }

  function getModalMoves(mon) {
    if (!mon) return [];

    const moves = (mon.moves || []).map(move => ({ ...move }));
    const seenEggMoves = new Set(
      moves
        .filter(move => move.type === "EGG")
        .map(move => getLearnsetMoveKey(move))
    );

    const familyRoot = getEvolutionFamilyRootMon(mon);

    if (familyRoot && familyRoot.id !== mon.id) {
      (familyRoot.moves || [])
        .filter(move => move.type === "EGG")
        .forEach(move => {
          const key = getLearnsetMoveKey(move);
          if (seenEggMoves.has(key)) return;

          seenEggMoves.add(key);
          moves.push({
            ...move,
            _eggMoveSourceMonName: familyRoot.name
          });
        });
    }

    return moves.sort(compareLearnsetMoves);
  }

  function getLearnsetMoveKey(move) {
    return String(move?.id || normalizeMoveName(move?.name || ""));
  }

  function getEvolutionFamilyRootMon(mon) {
    const rootId = evolutionFamilyRootById.get(mon.id);
    return pokemonById.get(rootId) || mon;
  }

  function buildModalMoveRow(move, index) {
    const dataEntry = getMoveData(move);
    const info = dataEntry?.info || {};

    return `
      <button type="button"
        class="modal-move-row"
        data-index="${index}"
        data-method="${move.type || ""}"
        data-name="${move.name.toLowerCase()}">
        <span class="modal-move-name">${move.name}</span>
        <span class="modal-move-meta">
          ${info.type ? `<span class="type-badge move-type-width type-${info.type}">${capitalize(info.type)}</span>` : ""}
          <span class="modal-move-learn">${formatModalMoveLearnMethod(move)}</span>
        </span>
      </button>
    `;
  }

  function formatModalMoveLearnMethod(move) {
    if (move.type === "level") return move.level ? `Level ${move.level}` : "Level";
    return formatMoveMethod(move.type);
  }

  function bindModalMoves(mon) {
    const container = $("#moves");
    const search = $("#modalMoveSearch");
    const info = $("#modalMoveInfo");
    if (!container || !search || !info) return;

    const moves = getModalMoves(mon);
    let activeMethod = "all";

    const rows = [...container.querySelectorAll(".modal-move-row")];
    const methodButtons = [...container.querySelectorAll(".modal-move-method")];
    const emptyState = container.querySelector(".modal-move-empty");
    const selectedIndices = new Set();

    const renderSelectedMoveInfo = () => {
      const selectedMoves = [...selectedIndices]
        .sort((a, b) => a - b)
        .map(index => moves[index])
        .filter(Boolean);

      info.innerHTML = selectedMoves.length
        ? [...selectedIndices]
          .sort((a, b) => a - b)
          .map(index => buildMoveInfoBox(moves[index], { removable: true, index, contextMon: mon }))
          .join("")
        : `<div class="modal-move-info-empty">Select one or more moves to compare details.</div>`;

      bindBodyMoveTools(info);
      bindBreedingChainVariationCycling(info);
    };

    const toggleMove = (row) => {
      const index = Number(row.dataset.index);
      const isSelected = selectedIndices.has(index);

      if (isSelected) {
        selectedIndices.delete(index);
        row.classList.remove("active");
      } else {
        selectedIndices.add(index);
        row.classList.add("active");
      }

      renderSelectedMoveInfo();
    };

    const applyModalMoveFilters = () => {
      const q = search.value.trim().toLowerCase();
      let firstVisible = null;

      rows.forEach(row => {
        const matchesMethod = activeMethod === "all" || row.dataset.method === activeMethod;
        const matchesSearch = !q || row.dataset.name.includes(q);
        const visible = matchesMethod && matchesSearch;

        row.classList.toggle("hidden", !visible);
        if (visible && !firstVisible) firstVisible = row;
      });

      emptyState?.classList.toggle("hidden", Boolean(firstVisible));
    };

    rows.forEach(row => {
      row.addEventListener("click", () => toggleMove(row));
    });

    methodButtons.forEach(button => {
      button.addEventListener("click", () => {
        activeMethod = button.dataset.method;
        methodButtons.forEach(item => item.classList.toggle("active", item === button));
        applyModalMoveFilters();
      });
    });

    info.addEventListener("click", (e) => {
      const removeButton = e.target.closest(".modal-move-remove");
      if (!removeButton) return;

      const index = Number(removeButton.dataset.index);
      selectedIndices.delete(index);
      rows[index]?.classList.remove("active");
      renderSelectedMoveInfo();
    });

    search.addEventListener("input", applyModalMoveFilters);
    renderSelectedMoveInfo();
  }

  /* =============================================================
    LOCATIONS
  ============================================================= */

  function buildLocations(mon) {
    const encounters = getModalLocationEncounters(mon);
    const regions = getModalLocationFilterValues(encounters, encounter => encounter.region);
    const rarities = getModalLocationFilterValues(encounters, encounter => encounter.rarities);
    const seasons = sortModalLocationFilterValues(
      getModalLocationFilterValues(encounters, encounter => encounter.seasons),
      "season"
    );
    const times = sortModalLocationFilterValues(
      getModalLocationFilterValues(encounters, encounter => encounter.times),
      "time"
    );

    if (!encounters.length) return "<div>No locations</div>";

    return `
      <div class="modal-locations">
        <div class="modal-location-filter-box">
          <div class="modal-moves-toolbar modal-location-toolbar">
            <input id="modalLocationSearch" class="dex-input modal-move-search" placeholder="Search locations...">
            <button type="button" id="modalLocationFiltersBtn" class="btn btn--gradient modal-location-filters-btn">
              <svg width="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
              </svg>
              <label style="font-size: 14px;">Filters</label>
            </button>
          </div>

          <div id="modalLocationFiltersPanel" class="dex-filters-panel modal-location-filters-panel collapsed">
            <div class="modal-location-filters-grid">
              <div class="dex-filter-group">
                <div class="dex-filter-group-label">
                  <label>Region</label>
                </div>
                <div class="mc-filters encounter-filter-pills">
                  ${regions.map(region => `
                    <button type="button" class="encounter-filter-pill modal-location-filter" data-filter="region" data-value="${region}">
                      <span class="filter-box">◯</span> ${region}
                    </button>
                  `).join("")}
                </div>
              </div>

              <div class="dex-filter-group">
                <div class="dex-filter-group-label">
                  <label>Rarity</label>
                </div>
                <div class="mc-filters encounter-filter-pills">
                  ${rarities.map(rarity => `
                    <button type="button" class="encounter-filter-pill modal-location-filter" data-filter="rarity" data-value="${rarity}">
                      <span class="filter-box">◯</span> ${rarity}
                    </button>
                  `).join("")}
                </div>
              </div>

              <div class="dex-filter-group">
                <div class="dex-filter-group-label">
                  <label>Season</label>
                </div>
                <div class="mc-filters encounter-filter-pills">
                  ${seasons.map(season => `
                    <button type="button" class="encounter-filter-pill modal-location-filter" data-filter="season" data-value="${season}">
                      <span class="filter-box">◯</span> ${season}
                    </button>
                  `).join("")}
                </div>
              </div>

              <div class="dex-filter-group">
                <div class="dex-filter-group-label">
                  <label>Time of Day</label>
                </div>
                <div class="mc-filters encounter-filter-pills">
                  ${times.map(time => `
                    <button type="button" class="encounter-filter-pill modal-location-filter" data-filter="time" data-value="${time}">
                      <span class="filter-box">◯</span> ${time}
                    </button>
                  `).join("")}
                </div>
              </div>
            </div>

            <div class="modal-location-map-shell">
              <button type="button" id="modalLocationMapToggle" class="map-toggle-button map-viewport-toggle modal-location-map-toggle" aria-controls="modalLocationMapViewport" aria-expanded="false">
                <span class="sr-only">Open map</span>
                
                <span class="map-toggle-icon">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18 20.75H12C11.8011 20.75 11.6103 20.671 11.4697 20.5303C11.329 20.3897 11.25 20.1989 11.25 20C11.25 19.8011 11.329 19.6103 11.4697 19.4697C11.6103 19.329 11.8011 19.25 12 19.25H18C18.3315 19.25 18.6495 19.1183 18.8839 18.8839C19.1183 18.6495 19.25 18.3315 19.25 18V6C19.25 5.66848 19.1183 5.35054 18.8839 5.11612C18.6495 4.8817 18.3315 4.75 18 4.75H6C5.66848 4.75 5.35054 4.8817 5.11612 5.11612C4.8817 5.35054 4.75 5.66848 4.75 6V12C4.75 12.1989 4.67098 12.3897 4.53033 12.5303C4.38968 12.671 4.19891 12.75 4 12.75C3.80109 12.75 3.61032 12.671 3.46967 12.5303C3.32902 12.3897 3.25 12.1989 3.25 12V6C3.25 5.27065 3.53973 4.57118 4.05546 4.05546C4.57118 3.53973 5.27065 3.25 6 3.25H18C18.7293 3.25 19.4288 3.53973 19.9445 4.05546C20.4603 4.57118 20.75 5.27065 20.75 6V18C20.75 18.7293 20.4603 19.4288 19.9445 19.9445C19.4288 20.4603 18.7293 20.75 18 20.75Z" fill="currentColor"/>
                    <path d="M16 12.75C15.8019 12.7474 15.6126 12.6676 15.4725 12.5275C15.3324 12.3874 15.2526 12.1981 15.25 12V8.75H12C11.8011 8.75 11.6103 8.67098 11.4697 8.53033C11.329 8.38968 11.25 8.19891 11.25 8C11.25 7.80109 11.329 7.61032 11.4697 7.46967C11.6103 7.32902 11.8011 7.25 12 7.25H16C16.1981 7.25259 16.3874 7.33244 16.5275 7.47253C16.6676 7.61263 16.7474 7.80189 16.75 8V12C16.7474 12.1981 16.6676 12.3874 16.5275 12.5275C16.3874 12.6676 16.1981 12.7474 16 12.75Z" fill="currentColor"/>
                    <path d="M11.5 13.25C11.3071 13.2352 11.1276 13.1455 11 13C10.877 12.8625 10.809 12.6845 10.809 12.5C10.809 12.3155 10.877 12.1375 11 12L15.5 7.5C15.6422 7.36752 15.8302 7.29539 16.0245 7.29882C16.2188 7.30225 16.4042 7.38096 16.5416 7.51838C16.679 7.65579 16.7578 7.84117 16.7612 8.03548C16.7646 8.22978 16.6925 8.41782 16.56 8.56L12 13C11.8724 13.1455 11.6929 13.2352 11.5 13.25Z" fill="currentColor"/>
                    <path d="M8 20.75H5C4.53668 20.7474 4.09309 20.5622 3.76546 20.2345C3.43784 19.9069 3.25263 19.4633 3.25 19V16C3.25263 15.5367 3.43784 15.0931 3.76546 14.7655C4.09309 14.4378 4.53668 14.2526 5 14.25H8C8.46332 14.2526 8.90691 14.4378 9.23454 14.7655C9.56216 15.0931 9.74738 15.5367 9.75 16V19C9.74738 19.4633 9.56216 19.9069 9.23454 20.2345C8.90691 20.5622 8.46332 20.7474 8 20.75ZM5 15.75C4.9337 15.75 4.87011 15.7763 4.82322 15.8232C4.77634 15.8701 4.75 15.9337 4.75 16V19C4.75 19.0663 4.77634 19.1299 4.82322 19.1768C4.87011 19.2237 4.9337 19.25 5 19.25H8C8.0663 19.25 8.12989 19.2237 8.17678 19.1768C8.22366 19.1299 8.25 19.0663 8.25 19V16C8.25 15.9337 8.22366 15.8701 8.17678 15.8232C8.12989 15.7763 8.0663 15.75 8 15.75H5Z" fill="currentColor"/>
                  </svg>
                </span>
              </button>
              <div class="map-viewport modal-location-map-viewport hidden" id="modalLocationMapViewport">
                <div class="map-controls modal-location-map-controls">
                  <button type="button" class="map-controls-handle" aria-label="Move map controls" title="Move controls">::</button>
                  <select id="modalLocationMapRegionSelect" class="dex-input map-region-select" aria-label="Location map region">
                    <option value="">All regions</option>
                    ${regions.map(region => `<option value="${region}">${region}</option>`).join("")}
                  </select>
                  <label class="map-zoom-control">
                    <span>Zoom</span>
                    <input id="modalLocationMapZoomSlider" type="range" min="0" max="500" step="1" value="0">
                    <output id="modalLocationMapZoomValue" for="modalLocationMapZoomSlider">0%</output>
                  </label>
                </div>
                <svg id="modalLocationMapSvg" viewBox="0 0 1662 1174" preserveAspectRatio="none">
                  <image href="maps/World Map.png" x="0" y="0" width="1662" height="1174"/>
                  <g id="modalLocationMapRegions"></g>
                  <g id="modalLocationMapPins"></g>
                </svg>
                <button type="button" id="modalLocationMapCollapse" class="map-viewport-collapse" aria-label="Hide map" title="Hide map">
                    <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M18 3.25H6C5.27065 3.25 4.57118 3.53973 4.05546 4.05546C3.53973 4.57118 3.25 5.27065 3.25 6V12C3.25 12.1989 3.32902 12.3897 3.46967 12.5303C3.61032 12.671 3.80109 12.75 4 12.75C4.19891 12.75 4.38968 12.671 4.53033 12.5303C4.67098 12.3897 4.75 12.1989 4.75 12V6C4.75 5.66848 4.8817 5.35054 5.11612 5.11612C5.35054 4.8817 5.66848 4.75 6 4.75H18C18.3315 4.75 18.6495 4.8817 18.8839 5.11612C19.1183 5.35054 19.25 5.66848 19.25 6V18C19.25 18.3315 19.1183 18.6495 18.8839 18.8839C18.6495 19.1183 18.3315 19.25 18 19.25H12C11.8011 19.25 11.6103 19.329 11.4697 19.4697C11.329 19.6103 11.25 19.8011 11.25 20C11.25 20.1989 11.329 20.3897 11.4697 20.5303C11.6103 20.671 11.8011 20.75 12 20.75H18C18.7293 20.75 19.4288 20.4603 19.9445 19.9445C20.4603 19.4288 20.75 18.7293 20.75 18V6C20.75 5.27065 20.4603 4.57118 19.9445 4.05546C19.4288 3.53973 18.7293 3.25 18 3.25Z" fill="currentColor"/>
                      <path d="M11.21 13.19C11.3017 13.2291 11.4003 13.2495 11.5 13.25H15.5C15.6989 13.25 15.8897 13.171 16.0303 13.0304C16.171 12.8897 16.25 12.6989 16.25 12.5C16.25 12.3011 16.171 12.1104 16.0303 11.9697C15.8897 11.829 15.6989 11.75 15.5 11.75H13.31L16.53 8.53003C16.6625 8.38785 16.7346 8.19981 16.7312 8.00551C16.7277 7.81121 16.649 7.62582 16.5116 7.48841C16.3742 7.35099 16.1888 7.27228 15.9945 7.26885C15.8002 7.26543 15.6122 7.33755 15.47 7.47003L12.25 10.69V8.50003C12.25 8.30112 12.171 8.11035 12.0303 7.9697C11.8897 7.82905 11.6989 7.75003 11.5 7.75003C11.3011 7.75003 11.1103 7.82905 10.9697 7.9697C10.829 8.11035 10.75 8.30112 10.75 8.50003V12.5C10.7505 12.5997 10.7709 12.6983 10.81 12.79C10.8457 12.8806 10.8996 12.9628 10.9684 13.0316C11.0373 13.1004 11.1195 13.1543 11.21 13.19Z" fill="currentColor"/>
                      <path d="M8 14.25H5C4.53668 14.2526 4.09309 14.4378 3.76546 14.7655C3.43784 15.0931 3.25263 15.5367 3.25 16V19C3.25263 19.4633 3.43784 19.9069 3.76546 20.2345C4.09309 20.5622 4.53668 20.7474 5 20.75H8C8.46332 20.7474 8.90691 20.5622 9.23454 20.2345C9.56216 19.9069 9.74738 19.4633 9.75 19V16C9.74738 15.5367 9.56216 15.0931 9.23454 14.7655C8.90691 14.4378 8.46332 14.2526 8 14.25ZM8.25 19C8.25 19.0663 8.22366 19.1299 8.17678 19.1768C8.12989 19.2237 8.0663 19.25 8 19.25H5C4.9337 19.25 4.87011 19.2237 4.82322 19.1768C4.77634 19.1299 4.75 19.0663 4.75 19V16C4.75 15.9337 4.77634 15.8701 4.82322 15.8232C4.87011 15.7763 4.9337 15.75 5 15.75H8C8.0663 15.75 8.12989 15.7763 8.17678 15.8232C8.22366 15.8701 8.25 15.9337 8.25 16V19Z" fill="currentColor"/>
                    </svg>
                </button>
              </div>
            </div>

            <button id="modalLocationClearFilters" class="btn btn--tertiary modal-location-clear-filters">Clear Filters</button>
          </div>
        </div>

        <div class="modal-moves-body">
          <div class="modal-move-list modal-location-list" role="list">
            ${encounters.map((encounter, index) => buildModalLocationRow(encounter, index)).join("")}
            <div class="modal-move-empty modal-location-empty hidden">No matching locations</div>
          </div>

          <div id="modalLocationInfo" class="modal-move-info modal-location-info"></div>
        </div>
      </div>
    `;
  }

  function getModalLocationEncounters(mon) {
    return groupModalLocationEncounters(getRawModalLocationEncounters(mon))
      .sort(compareModalLocationEncounters);
  }

  function getRawModalLocationEncounters(mon) {
    return (mon.locations || [])
      .map(loc => {
        const parsed = parseModalLocationSeasonTime(loc.location || "");
        const evs = getModalLocationEvs(mon);
        const evTotal = Object.values(evs).reduce((sum, val) => sum + val, 0);
        const exp = calcModalLocationExp(mon.yields?.exp || 0, loc.min_level || 0, mon.id);
        const isHorde = String(loc.rarity || "").toLowerCase() === "horde";

        return {
          mon,
          loc,
          parsed,
          seasonLabels: [...parsed.seasons].map(formatEncounterSeasonToken),
          timeLabels: [...parsed.times].map(formatEncounterTimeToken),
          exp,
          horde: isHorde ? `${exp * 3} / ${exp * 5}` : "",
          evs,
          evTotal,
          moves: getEncounterMovesForLevel(mon, loc.max_level)
        };
      });
  }

  function groupModalLocationEncounters(encounters) {
    const groups = new Map();

    encounters.forEach(encounter => {
      const key = getModalLocationGroupKey(encounter);
      const group = groups.get(key);

      if (group) {
        group.variants.push(encounter);
        return;
      }

      groups.set(key, {
        ...encounter,
        variants: [encounter]
      });
    });

    return [...groups.values()].map(group => {
      group.variants.sort(compareModalLocationVariants);
      group.region = group.loc.region_name || "";
      group.location = group.parsed.clean || "";
      group.locationLabel = getLocationDisplayLabel(group);
      group.seasons = getUniqueModalLocationLabels(group.variants, variant => variant.seasonLabels);
      group.times = getUniqueModalLocationLabels(group.variants, variant => variant.timeLabels);
      group.rarities = [...new Set(group.variants.map(variant => variant.loc.rarity).filter(Boolean))];
      group.types = [...new Set(group.variants.map(variant => variant.loc.type).filter(Boolean))];
      group.minLevel = getModalLocationMinLevel(group.variants);
      group.maxLevel = getModalLocationMaxLevel(group.variants);
      return group;
    });
  }

  function getModalLocationGroupKey(encounter) {
    return [
      encounter.loc.region_name || "",
      encounter.parsed.clean || ""
    ].map(value => String(value).toLowerCase()).join("|");
  }

  function getLocationDisplayLabel(encounter) {
    const location = encounter.parsed.clean || "Unknown Location";
    const tags = [
      ...(encounter.seasons || encounter.seasonLabels || []),
      ...(encounter.times || encounter.timeLabels || [])
    ];
    const uniqueTags = [...new Set(tags)];
    return uniqueTags.length ? `${location} (${uniqueTags.join(" / ")})` : location;
  }

  function getUniqueModalLocationLabels(items, getter) {
    const seen = new Set();
    const labels = [];

    items.forEach(item => {
      getter(item).forEach(label => {
        if (seen.has(label)) return;
        seen.add(label);
        labels.push(label);
      });
    });

    return labels;
  }

  function compareModalLocationVariants(a, b) {
    return (a.loc.type || "").localeCompare(b.loc.type || "")
      || (a.loc.rarity || "").localeCompare(b.loc.rarity || "")
      || getModalLocationTimingSortValue(a).localeCompare(getModalLocationTimingSortValue(b))
      || (a.loc.min_level || 0) - (b.loc.min_level || 0)
      || (a.loc.max_level || 0) - (b.loc.max_level || 0);
  }

  function getModalLocationMinLevel(variants) {
    const levels = variants.map(variant => Number(variant.loc.min_level)).filter(Number.isFinite);
    return levels.length ? Math.min(...levels) : "";
  }

  function getModalLocationMaxLevel(variants) {
    const levels = variants.map(variant => Number(variant.loc.max_level)).filter(Number.isFinite);
    return levels.length ? Math.max(...levels) : "";
  }

  function getUniformModalLocationValue(variants, getter) {
    const values = [...new Set(variants.map(getter))];
    return values.length === 1 ? values[0] : "See variations below";
  }

  function getModalLocationTimingSortValue(encounter) {
    const seasonOrder = ["Spring", "Summer", "Fall", "Winter"];
    const timeOrder = ["Morning", "Day", "Night"];
    const seasonIndexes = encounter.seasonLabels.map(label => seasonOrder.indexOf(label)).filter(index => index >= 0);
    const timeIndexes = encounter.timeLabels.map(label => timeOrder.indexOf(label)).filter(index => index >= 0);
    const season = seasonIndexes.length ? Math.min(...seasonIndexes) : 99;
    const time = timeIndexes.length ? Math.min(...timeIndexes) : 99;

    return `${String(season).padStart(2, "0")}:${String(time).padStart(2, "0")}:${getModalLocationTimingLabel(encounter)}`;
  }

  function compareModalLocationEncounters(a, b) {
    return (a.loc.region_name || "").localeCompare(b.loc.region_name || "")
      || a.parsed.clean.localeCompare(b.parsed.clean);
  }

  function getModalLocationFilterValues(encounters, getter) {
    return [...new Set(encounters.flatMap(item => {
      const value = getter(item);
      if (Array.isArray(value)) return value.filter(Boolean);
      return value ? [value] : [];
    }))]
      .sort((a, b) => String(a).localeCompare(String(b)));
  }

  function sortModalLocationFilterValues(values, kind) {
    const order = kind === "season"
      ? ["Spring", "Summer", "Fall", "Winter"]
      : kind === "time"
        ? ["Morning", "Day", "Night"]
        : null;

    return [...values].sort((a, b) => {
      if (!order) return String(a).localeCompare(String(b));

      const ai = order.indexOf(a);
      const bi = order.indexOf(b);

      if (ai === -1 && bi === -1) return String(a).localeCompare(String(b));
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi || String(a).localeCompare(String(b));
    });
  }

  function buildModalLocationRow(encounter, index) {
    const variantCount = encounter.variants?.length || 1;
    const regionName = encounter.region || encounter.loc.region_name || "Unknown Region";
    const regionImage = `maps/${encodeURI(regionName)}.png`;

    return `
      <button type="button"
        class="modal-move-row modal-location-row"
        data-index="${index}"
        data-region="${regionName}"
        data-rarity="${(encounter.rarities || [encounter.loc.rarity || ""]).filter(Boolean).join("|")}"
        data-season="${(encounter.seasons || []).join("|")}"
        data-time="${(encounter.times || []).join("|")}"
        data-name="${[regionName, encounter.location].filter(Boolean).join(" ").toLowerCase()}">
        <span class="modal-location-row-region">
          <img src="${regionImage}" alt="${regionName}" loading="lazy">
        </span>
        <span class="modal-move-name">${encounter.parsed.clean || encounter.locationLabel || "Unknown Location"}</span>
        ${variantCount > 1 ? `<span class="modal-location-variation-badge" aria-label="${variantCount} variations">${variantCount}</span>` : ""}
      </button>
    `;
  }

  function bindModalLocations(mon) {
    cleanupModalLocationMap();

    const container = $("#locations");
    const search = $("#modalLocationSearch");
    const info = $("#modalLocationInfo");
    const filtersBtn = $("#modalLocationFiltersBtn");
    const filtersPanel = $("#modalLocationFiltersPanel");
    const clearFiltersBtn = $("#modalLocationClearFilters");
    if (!container || !search || !info || !filtersBtn || !filtersPanel || !clearFiltersBtn) return;

    const encounters = getModalLocationEncounters(mon);
    const rows = [...container.querySelectorAll(".modal-location-row")];
    const emptyState = container.querySelector(".modal-location-empty");
    const filterGroups = {
      region: [...container.querySelectorAll('.modal-location-filter[data-filter="region"]')],
      rarity: [...container.querySelectorAll('.modal-location-filter[data-filter="rarity"]')],
      season: [...container.querySelectorAll('.modal-location-filter[data-filter="season"]')],
      time: [...container.querySelectorAll('.modal-location-filter[data-filter="time"]')]
    };
    const filterState = {
      region: Object.create(null),
      rarity: Object.create(null),
      season: Object.create(null),
      time: Object.create(null)
    };
    let selectedIndex = -1;
    let applyLocationFilters = () => {};

    const renderSelectedLocationInfo = () => {
      const encounter = encounters[selectedIndex];
      info.innerHTML = encounter
        ? buildModalLocationInfo(encounter)
        : `<div class="modal-move-info-empty">Select a location to inspect encounter details.</div>`;
      if (encounter) renderModalLocationInfoMap(encounter);
    };

    const setFilterButtonState = (button, state) => {
      const box = button.querySelector(".filter-box");
      button.dataset.state = state;
      button.classList.toggle("include", state === "include");
      button.classList.toggle("exclude", state === "exclude");
      if (box) {
        box.textContent = state === "none" ? "◯" : state === "include" ? "✔" : "✖";
      }
    };

    const setFilterGroupState = (group, value, state) => {
      if (!filterState[group]) return;
      filterState[group][value] = state;
      filterGroups[group]
        ?.filter(button => button.dataset.value === value)
        .forEach(button => setFilterButtonState(button, state));
    };

    const resetFilterGroup = (group) => {
      Object.keys(filterState[group] || {}).forEach(value => {
        filterState[group][value] = "none";
      });
      filterGroups[group]?.forEach(button => setFilterButtonState(button, "none"));
    };

    const getFilterValues = (group, state) => Object.entries(filterState[group] || {})
      .filter(([, value]) => value === state)
      .map(([value]) => value);

    const rowMatchesFilterGroup = (values, group) => {
      const included = getFilterValues(group, "include");
      const excluded = getFilterValues(group, "exclude");

      if (included.length && !values.some(value => included.includes(value))) return false;
      if (excluded.length && values.every(value => excluded.includes(value))) return false;
      return true;
    };

    const clearSelection = () => {
      selectedIndex = -1;
      rows.forEach(row => row.classList.remove("active"));
      modalLocationMapState?.regions?.querySelectorAll(".selected-location").forEach(el => {
        el.classList.remove("selected-location");
      });
      modalLocationMapState?.pins?.querySelectorAll(".selected-location").forEach(el => {
        el.classList.remove("selected-location");
      });
      renderSelectedLocationInfo();
    };

    const syncModalLocationRegion = (region, { zoom = true } = {}) => {
      const nextRegion = region || "all";
      search.value = "";
      resetFilterGroup("region");
      if (nextRegion !== "all") {
        setFilterGroupState("region", nextRegion, "include");
      }

      if (state.regionSelect) {
        state.regionSelect.value = nextRegion === "all" ? "" : nextRegion;
      }

      if (zoom) {
        if (nextRegion === "all") {
          zoomScopedMapToLocations(state, state.renderedLocations);
        } else {
          zoomScopedMapToRegion(state, nextRegion);
        }
      }

      applyLocationFilters();
    };

    const selectRow = (index, options = {}) => {
      selectedIndex = index;
      rows.forEach(row => row.classList.toggle("active", Number(row.dataset.index) === selectedIndex));
      rows[selectedIndex]?.scrollIntoView({ block: "nearest" });
      selectModalLocationMapEncounter(encounters[selectedIndex], options);
      renderSelectedLocationInfo();
    };

    const clearLocationFiltersForMapSelection = () => {
      search.value = "";
      Object.keys(filterState).forEach(resetFilterGroup);
      if (modalLocationMapState?.regionSelect) modalLocationMapState.regionSelect.value = "";
      if (modalLocationMapState?.zoomSlider) modalLocationMapState.zoomSlider.value = "0";
      applyLocationFilters();
    };

    applyLocationFilters = () => {
      const q = search.value.trim().toLowerCase();
      const visibleEncounterIndices = [];

      rows.forEach(row => {
        const matchesSearch = !q || row.dataset.name.includes(q);
        const rowSeasons = row.dataset.season ? row.dataset.season.split("|").filter(Boolean) : [];
        const rowTimes = row.dataset.time ? row.dataset.time.split("|").filter(Boolean) : [];
        const visible = matchesSearch
          && rowMatchesFilterGroup([row.dataset.region].filter(Boolean), "region")
          && rowMatchesFilterGroup([row.dataset.rarity].filter(Boolean), "rarity")
          && rowMatchesFilterGroup(rowSeasons, "season")
          && rowMatchesFilterGroup(rowTimes, "time");

        row.classList.toggle("hidden", !visible);
        if (visible) visibleEncounterIndices.push(Number(row.dataset.index));
      });

      const selectedRow = selectedIndex >= 0 ? rows.find(row => Number(row.dataset.index) === selectedIndex) : null;
      if (selectedRow && selectedRow.classList.contains("hidden")) {
        clearSelection();
      }

      syncModalLocationMapResults(modalLocationMapState, visibleEncounterIndices);
      refreshModalLocationMapViewport();

      emptyState?.classList.toggle("hidden", rows.some(row => !row.classList.contains("hidden")));
    };

    filtersBtn.addEventListener("click", () => {
      filtersPanel.classList.toggle("collapsed");
    });

    clearFiltersBtn.addEventListener("click", () => {
      search.value = "";
      Object.keys(filterState).forEach(resetFilterGroup);
      if (modalLocationMapState?.regionSelect) modalLocationMapState.regionSelect.value = "";
      if (modalLocationMapState?.zoomSlider) modalLocationMapState.zoomSlider.value = "0";
      applyLocationFilters();
    });

    container.querySelectorAll(".modal-location-filter").forEach(button => {
      const group = button.dataset.filter;
      const value = button.dataset.value;
      if (!group || !value) return;

      filterState[group][value] = "none";
      setFilterButtonState(button, "none");

      button.addEventListener("click", () => {
        const current = filterState[group][value] || "none";
        const next = current === "none" ? "include" : current === "include" ? "exclude" : "none";
        setFilterGroupState(group, value, next);
        applyLocationFilters();
      });
    });

    modalLocationMapCleanup = initModalLocationMap(encounters, index => {
      clearLocationFiltersForMapSelection();
      selectRow(index, { syncRegion: false });
    });

    rows.forEach(row => {
      row.addEventListener("click", () => selectRow(Number(row.dataset.index)));
    });

    search.addEventListener("input", applyLocationFilters);
    applyLocationFilters();
    renderSelectedLocationInfo();
    if (selectedIndex >= 0) {
      selectModalLocationMapEncounter(encounters[selectedIndex], { overview: true, syncRegion: false });
    }
  }

  function cleanupModalLocationMap() {
    modalLocationMapCleanup?.();
    modalLocationMapCleanup = null;
    modalLocationMapState = null;
  }

  function syncModalLocationMapResults(state, visibleEncounterIndices = []) {
    if (!state) return;

    const visibleLocationKeys = new Set();

    visibleEncounterIndices.forEach(index => {
      const locations = state.locationsByEncounterIndex.get(index) || [];
      locations.forEach(loc => visibleLocationKeys.add(getMapLocationKey(loc)));
    });

    state.renderedLocations = LOCATION_DATA.filter(loc =>
      loc.points && visibleLocationKeys.has(getMapLocationKey(loc))
    );

    state.locationElementsByKey.forEach(({ region, pin }, key) => {
      const visible = visibleLocationKeys.has(key);
      region?.classList.toggle("hidden", !visible);
      pin?.classList.toggle("hidden", !visible);
    });

    if (state.regionSelect?.value) {
      const regionVisible = state.renderedLocations.some(loc => loc.region === state.regionSelect.value);
      if (!regionVisible) {
        state.regionSelect.value = "";
      }
    }
  }

  function refreshModalLocationMapViewport() {
    const state = modalLocationMapState;
    if (!state) return;

    requestAnimationFrame(() => {
      if (modalLocationMapState !== state) return;

      if (state.regionSelect?.value) {
        zoomScopedMapToRegion(state, state.regionSelect.value);
        return;
      }

      const selectedPins = state.pins
        ? [...state.pins.querySelectorAll(".modal-location-map-pin.selected-location")]
        : [];
      const selectedKeys = new Set(selectedPins.map(pin => getMapLocationKey(pin.dataset)));
      const selectedLocations = state.renderedLocations.filter(loc => selectedKeys.has(getMapLocationKey(loc)));

      if (selectedLocations.length) {
        zoomScopedMapToLocations(state, selectedLocations);
      } else {
        zoomScopedMapToLocations(state, state.renderedLocations);
      }
    });
  }

  function initModalLocationMap(encounters, onSelectEncounter) {
    const state = {
      viewport: $("#modalLocationMapViewport"),
      svg: $("#modalLocationMapSvg"),
      regions: $("#modalLocationMapRegions"),
      pins: $("#modalLocationMapPins"),
      controls: $("#modalLocationMapViewport .map-controls"),
      regionSelect: $("#modalLocationMapRegionSelect"),
      zoomSlider: $("#modalLocationMapZoomSlider"),
      zoomValue: $("#modalLocationMapZoomValue"),
      scale: MAP_MIN_SCALE,
      x: 0,
      y: 0,
      suppressClickUntil: 0,
      encounterByLocationKey: new Map(),
      locationsByEncounterIndex: new Map(),
      locationElementsByKey: new Map(),
      renderedLocations: [],
      cleanup: []
    };

    if (!state.viewport || !state.svg || !state.regions) return null;

    modalLocationMapState = state;
    modalLocationMapToggleButton = $("#modalLocationMapToggle");
    const modalLocationMapCollapseButton = $("#modalLocationMapCollapse");
    initDraggableMapControls(state.viewport, state.controls, state.cleanup);
    buildModalLocationMapRegions(state, encounters, onSelectEncounter);

    const setMapVisibility = (isVisible) => {
      if (!state.viewport || !modalLocationMapToggleButton) return;
      state.viewport.classList.toggle("hidden", !isVisible);
      modalLocationMapToggleButton.classList.toggle("hidden", isVisible);
      modalLocationMapToggleButton.setAttribute("aria-expanded", String(isVisible));

      if (isVisible) {
        refreshModalLocationMapViewport();
      }
    };

    const onOpenClick = () => setMapVisibility(true);
    const onCloseClick = () => setMapVisibility(false);

    modalLocationMapToggleButton?.addEventListener("click", onOpenClick);
    modalLocationMapCollapseButton?.addEventListener("click", onCloseClick);
    if (modalLocationMapToggleButton) {
      state.cleanup.push(() => modalLocationMapToggleButton.removeEventListener("click", onOpenClick));
    }
    if (modalLocationMapCollapseButton) {
      state.cleanup.push(() => modalLocationMapCollapseButton.removeEventListener("click", onCloseClick));
    }

    const update = () => updateScopedMapTransform(state);

    const onZoomInput = () => {
      setScopedMapZoomPercent(state, Number(state.zoomSlider.value));
      if (Number(state.zoomSlider.value) === 0 && state.regionSelect) state.regionSelect.value = "";
    };
    state.zoomSlider?.addEventListener("input", onZoomInput);
    if (state.zoomSlider) state.cleanup.push(() => state.zoomSlider.removeEventListener("input", onZoomInput));

    const onRegionChange = () => {
      if (state.regionSelect.value) {
        zoomScopedMapToRegion(state, state.regionSelect.value);
      } else {
        zoomScopedMapToLocations(state, state.renderedLocations);
      }
    };
    state.regionSelect?.addEventListener("change", onRegionChange);
    if (state.regionSelect) state.cleanup.push(() => state.regionSelect.removeEventListener("change", onRegionChange));

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let dragStartClientX = 0;
    let dragStartClientY = 0;
    let lastDist = 0;

    const onWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1 : -1;
      zoomScopedMapToScale(state, state.scale + delta * 0.1, e);
    };

    const onMouseDown = (e) => {
      if (e.target.closest(".map-controls, .map-viewport-collapse")) return;
      isDragging = true;
      state.viewport.classList.add("map-is-panning");
      dragStartClientX = e.clientX;
      dragStartClientY = e.clientY;
      startX = e.clientX - state.x;
      startY = e.clientY - state.y;
      state.viewport.style.cursor = "grabbing";
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;

      if (Math.hypot(e.clientX - dragStartClientX, e.clientY - dragStartClientY) > 5) {
        state.suppressClickUntil = Date.now() + 350;
      }

      state.x = e.clientX - startX;
      state.y = e.clientY - startY;
      update();
    };

    const onMouseUp = () => {
      isDragging = false;
      state.viewport.classList.remove("map-is-panning");
      state.viewport.style.cursor = "grab";
    };

    const onTouchStart = (e) => {
      if (e.target.closest(".map-controls, .map-viewport-collapse")) return;
      if (e.touches.length === 2) {
        isDragging = false;
        state.suppressClickUntil = Date.now() + 350;
        lastDist = getTouchDistance(e);
      } else if (e.touches.length === 1) {
        isDragging = true;
        state.viewport.classList.add("map-is-panning");
        dragStartClientX = e.touches[0].clientX;
        dragStartClientY = e.touches[0].clientY;
        startX = e.touches[0].clientX - state.x;
        startY = e.touches[0].clientY - state.y;
      }
    };

    const onTouchMove = (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const newDist = getTouchDistance(e);
        const zoomFactor = lastDist ? newDist / lastDist : 1;
        const rect = state.viewport.getBoundingClientRect();
        const mid = getTouchMidpoint(e);

        lastDist = newDist;
        zoomScopedMapToScale(state, state.scale * zoomFactor, {
          clientX: mid.x,
          clientY: mid.y,
          preventDefault() {}
        });
      } else if (e.touches.length === 1 && isDragging) {
        e.preventDefault();
        if (Math.hypot(e.touches[0].clientX - dragStartClientX, e.touches[0].clientY - dragStartClientY) > 5) {
          state.suppressClickUntil = Date.now() + 350;
        }
        state.x = e.touches[0].clientX - startX;
        state.y = e.touches[0].clientY - startY;
        update();
      }
    };

    const onTouchEnd = () => {
      isDragging = false;
      state.viewport.classList.remove("map-is-panning");
      lastDist = 0;
    };

    state.viewport.addEventListener("wheel", onWheel, { passive: false });
    state.viewport.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    state.viewport.addEventListener("touchstart", onTouchStart, { passive: false });
    state.viewport.addEventListener("touchmove", onTouchMove, { passive: false });
    state.viewport.addEventListener("touchend", onTouchEnd);

    state.cleanup.push(
      () => state.viewport.removeEventListener("wheel", onWheel),
      () => state.viewport.removeEventListener("mousedown", onMouseDown),
      () => window.removeEventListener("mousemove", onMouseMove),
      () => window.removeEventListener("mouseup", onMouseUp),
      () => state.viewport.removeEventListener("touchstart", onTouchStart),
      () => state.viewport.removeEventListener("touchmove", onTouchMove),
      () => state.viewport.removeEventListener("touchend", onTouchEnd)
    );

    update();

    requestAnimationFrame(() => {
      if (modalLocationMapState === state) zoomScopedMapToLocations(state, state.renderedLocations);
    });

    return () => {
      state.cleanup.forEach(cleanup => cleanup());
      if (modalLocationMapState === state) modalLocationMapState = null;
    };
  }

  function buildModalLocationMapRegions(state, encounters, onSelectEncounter) {
    state.regions.innerHTML = "";
    if (state.pins) state.pins.innerHTML = "";
    state.locationElementsByKey.clear();

    encounters.forEach((encounter, index) => {
      const mapLocations = getModalLocationMapLocations(encounter);
      state.locationsByEncounterIndex.set(index, mapLocations);

      mapLocations.forEach(loc => {
        const key = getMapLocationKey(loc);
        if (!state.encounterByLocationKey.has(key)) {
          state.encounterByLocationKey.set(key, index);
        }
      });
    });

    const renderedKeys = new Set();
    state.renderedLocations = [];

    LOCATION_DATA.forEach(loc => {
      const key = getMapLocationKey(loc);
      if (!state.encounterByLocationKey.has(key) || renderedKeys.has(key)) return;
      renderedKeys.add(key);
      state.renderedLocations.push(loc);

      if (loc.shape !== "polygon" || !loc.points) return;

      const el = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      el.setAttribute("points", loc.points);
      el.classList.add("map-region", "modal-location-map-region", "active-location");
      el.dataset.name = loc.name;
      el.dataset.region = loc.region;

      el.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (Date.now() < state.suppressClickUntil) return;

        const selectedIndex = state.encounterByLocationKey.get(key);
        if (Number.isInteger(selectedIndex)) onSelectEncounter(selectedIndex);
      });

      state.regions.appendChild(el);

      const pin = buildModalLocationMapPin(loc);
      if (pin && state.pins) {
        pin.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (Date.now() < state.suppressClickUntil) return;

          const selectedIndex = state.encounterByLocationKey.get(key);
          if (Number.isInteger(selectedIndex)) onSelectEncounter(selectedIndex);
        });
        state.pins.appendChild(pin);
      }

      state.locationElementsByKey.set(key, { region: el, pin });
    });

    syncModalLocationMapResults(state, encounters.map((_, index) => index));
  }

  function buildModalLocationMapPin(loc) {
    const center = getMapLocationCenter(loc);
    if (!center) return null;

    const pinGroup = createMapPinElement(center, "modal-location-map-pin");
    if (!pinGroup) return null;
    pinGroup.dataset.name = loc.name;
    pinGroup.dataset.region = loc.region;

    return pinGroup;
}

  function selectModalLocationMapEncounter(encounter, options = {}) {
    const state = modalLocationMapState;
    if (!state || !encounter) return;

    const index = state.locationsByEncounterIndex
      ? [...state.locationsByEncounterIndex.entries()].find(([, locations]) => {
          const keys = new Set(getModalLocationMapLocations(encounter).map(getMapLocationKey));
          return locations.some(loc => keys.has(getMapLocationKey(loc)));
        })?.[0]
      : null;
    const locations = Number.isInteger(index)
      ? state.locationsByEncounterIndex.get(index)
      : getModalLocationMapLocations(encounter);
    const selectedKeys = new Set(locations.map(getMapLocationKey));

    state.regions.querySelectorAll(".modal-location-map-region").forEach(el => {
      const key = getMapLocationKey(el.dataset);
      el.classList.toggle("selected-location", selectedKeys.has(key));
    });
    state.pins?.querySelectorAll(".modal-location-map-pin").forEach(el => {
      const key = getMapLocationKey(el.dataset);
      el.classList.toggle("selected-location", selectedKeys.has(key));
    });

    if (options.overview) {
      zoomScopedMapToLocations(state, state.renderedLocations);
    } else if (locations.length) {
      zoomScopedMapToLocations(state, locations);
    }

    if (state.regionSelect && options.syncRegion !== false) {
      state.regionSelect.value = locations.length === 1 ? locations[0].region : "";
    }
  }

  function getModalLocationMapLocations(encounter) {
    if (!encounter) return [];

    const region = normalizeLocationMapText(encounter.loc.region_name);
    const name = normalizeLocationMapText(encounter.parsed.clean);

    return LOCATION_DATA.filter(loc =>
      normalizeLocationMapText(loc.region) === region &&
      normalizeLocationMapText(loc.name) === name &&
      loc.points
    );
  }

  function getMapLocationKey(loc) {
    return `${normalizeLocationMapText(loc.region)}|${normalizeLocationMapText(loc.name)}`;
  }

  function normalizeLocationMapText(value) {
    return String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
  }

  function updateScopedMapTransform(state) {
    if (!state.svg || !state.viewport) return;

    state.scale = getFiniteMapScale(state.scale);
    ({ x: state.x, y: state.y } = clampScopedMap(state, state.x, state.y, state.scale));
    state.svg.style.transform = `translate(${state.x}px, ${state.y}px) scale(${state.scale})`;
    state.svg.style.transformOrigin = "0 0";
    syncScopedMapZoomControls(state);
  }

  function syncScopedMapZoomControls(state) {
    const zoomPercent = Math.round((state.scale - MAP_MIN_SCALE) * 100);

    if (state.zoomSlider && Number(state.zoomSlider.value) !== zoomPercent) {
      state.zoomSlider.value = zoomPercent;
    }

    if (state.zoomValue) {
      state.zoomValue.value = `${zoomPercent}%`;
      state.zoomValue.textContent = `${zoomPercent}%`;
    }
  }

  function setScopedMapZoomPercent(state, percent) {
    const nextScale = MAP_MIN_SCALE + Math.max(0, Math.min(500, percent)) / 100;
    zoomScopedMapToScale(state, nextScale);
  }

  function zoomScopedMapToScale(state, nextScale, focusPoint = null) {
    if (!state.viewport) return;

    const rect = state.viewport.getBoundingClientRect();
    if (!hasUsableRect(rect)) return;
    const mx = focusPoint ? focusPoint.clientX - rect.left : rect.width / 2;
    const my = focusPoint ? focusPoint.clientY - rect.top : rect.height / 2;
    const clampedScale = getFiniteMapScale(nextScale);
    state.scale = getFiniteMapScale(state.scale);
    const worldX = (mx - state.x) / state.scale;
    const worldY = (my - state.y) / state.scale;

    state.scale = clampedScale;
    state.x = mx - worldX * state.scale;
    state.y = my - worldY * state.scale;

    updateScopedMapTransform(state);
  }

  function zoomScopedMapToRegion(state, region) {
    if (!state.viewport || !region) return;

    const bounds = getFixedMapRegionBounds(region);
    if (!bounds) return;

    const rect = state.viewport.getBoundingClientRect();
    if (!hasUsableRect(rect)) return;
    const fit = applyViewportRegionFit(state.svg, rect, bounds, 0.08);
    if (!fit) return;
    state.scale = fit.scale;
    state.x = fit.x;
    state.y = fit.y;

    updateScopedMapTransform(state);
  }

  function zoomScopedMapToLocations(state, locations) {
    if (!state.viewport || !locations?.length) return;

    const bounds = getLocationsBounds(locations);
    if (!bounds) return;

    const rect = state.viewport.getBoundingClientRect();
    if (!hasUsableRect(rect)) return;
    const baseScaleX = rect.width / MAP_WORLD_WIDTH;
    const baseScaleY = rect.height / MAP_WORLD_HEIGHT;
    const padding = Math.min(rect.width, rect.height) * 0.15;
    const width = Math.max(1, bounds.maxX - bounds.minX) * baseScaleX;
    const height = Math.max(1, bounds.maxY - bounds.minY) * baseScaleY;
    const fitScale = Math.min(
      (rect.width - padding * 2) / width,
      (rect.height - padding * 2) / height
    );
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    state.scale = getFiniteMapScale(fitScale);
    state.x = rect.width / 2 - centerX * baseScaleX * state.scale;
    state.y = rect.height / 2 - centerY * baseScaleY * state.scale;

    updateScopedMapTransform(state);
  }

  function clampScopedMap(state, x, y, scale) {
    const rect = state.viewport.getBoundingClientRect();
    if (!hasUsableRect(rect)) return { x: 0, y: 0 };
    const baseScaleX = rect.width / MAP_WORLD_WIDTH;
    const baseScaleY = rect.height / MAP_WORLD_HEIGHT;
    const scaledWidth = MAP_WORLD_WIDTH * baseScaleX * scale;
    const scaledHeight = MAP_WORLD_HEIGHT * baseScaleY * scale;
    const minX = scaledWidth <= rect.width ? (rect.width - scaledWidth) / 2 : rect.width - scaledWidth;
    const maxX = scaledWidth <= rect.width ? minX : 0;
    const minY = scaledHeight <= rect.height ? (rect.height - scaledHeight) / 2 : rect.height - scaledHeight;
    const maxY = scaledHeight <= rect.height ? minY : 0;

    return {
      x: Math.min(maxX, Math.max(minX, x)),
      y: Math.min(maxY, Math.max(minY, y))
    };
  }

  function buildModalLocationInfo(encounter) {
    const variants = encounter.variants || [encounter];
    const hasVariations = variants.length > 1;
    const variationTitle = hasVariations ? "Encounter Variations" : "Encounter Details";
    const tableRows = buildModalLocationVariationRows(variants);

    return `
      <div class="move-box modal-location-detail">
        <div class="move-header">
          <div class="move-title">${encounter.parsed.clean || encounter.locationLabel || "Unknown Location"}</div>
          <div class="move-header-right">
            ${encounter.rarities?.length ? `<span class="icon mod">${encounter.rarities.join(" / ")}</span>` : ""}
          </div>
        </div>

        <div class="modal-location-subsection">
          <div class="modal-location-subtitle">Region Map</div>
          <div class="modal-location-info-map-viewport">
            <svg class="modal-location-info-map-svg" viewBox="0 0 1662 1174" preserveAspectRatio="none">
              <image href="maps/World Map.png" x="0" y="0" width="1662" height="1174"/>
              <g class="modal-location-info-map-pins"></g>
            </svg>
          </div>
        </div>

        <div class="modal-location-subsection">
          <div class="modal-location-subtitle">${variationTitle}</div>
          <div class="modal-location-variations-table-wrap">
            <table class="modal-location-variations-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Rarity</th>
                  <th>Levels</th>
                  <th>Timing</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  function renderModalLocationInfoMap(encounter) {
    const info = $("#modalLocationInfo");
    const viewport = info?.querySelector(".modal-location-info-map-viewport");
    const svg = info?.querySelector(".modal-location-info-map-svg");
    if (!viewport || !svg || !encounter?.loc?.region_name) return;

    const locations = getModalLocationMapLocations(encounter);
    const selectedLocation = locations[0];
    const pinCenter = selectedLocation ? getMapLocationCenter(selectedLocation) : null;
    const bounds = getFixedMapRegionBounds(encounter.loc.region_name);
    if (!bounds || !pinCenter) return;

    const rect = viewport.getBoundingClientRect();
    if (!hasUsableRect(rect)) return;

    const fit = applyViewportRegionFit(svg, rect, bounds, 0.10);
    if (!fit) return;

    const pinsLayer = viewport.querySelector(".modal-location-info-map-pins");
    if (!pinsLayer) return;

    pinsLayer.innerHTML = "";
    const pin = createMapPinElement(pinCenter, ["modal-location-map-pin", "modal-location-info-map-pin"]);
    if (pin) pinsLayer.appendChild(pin);
  }

  function createMapPinElement(center, classNames = ["modal-location-map-pin"]) {
    if (!center) return null;

    const pinGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const classes = Array.isArray(classNames)
      ? classNames
      : String(classNames || "").split(/\s+/).filter(Boolean);
    pinGroup.classList.add(...classes);

    const pinPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const pathData = `
        M ${center.x} ${center.y}
        C ${center.x - 12} ${center.y - 14} ${center.x - 14} ${center.y - 22} ${center.x - 14} ${center.y - 28}
        A 14 14 0 1 1 ${center.x + 14} ${center.y - 28}
        C ${center.x + 14} ${center.y - 22} ${center.x + 12} ${center.y - 14} ${center.x} ${center.y}
        Z
    `.replace(/\s+/g, " ").trim();

    pinPath.setAttribute("d", pathData);

    const pinCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    pinCircle.setAttribute("cx", center.x);
    pinCircle.setAttribute("cy", center.y - 28);
    pinCircle.setAttribute("r", "5.5");
    pinCircle.setAttribute("fill", "#ffffff");

    pinGroup.appendChild(pinPath);
    pinGroup.appendChild(pinCircle);

    return pinGroup;
  }

  function buildModalLocationVariation(variant) {
    const timing = getModalLocationTimingLabel(variant) || "Any time";

    return `
      <div class="modal-location-variation">
        <div class="modal-location-variation-time">${timing}</div>
        <div class="modal-location-variation-meta">
          <span>Lv ${variant.loc.min_level || "?"}-${variant.loc.max_level || "?"}</span>
          <span>EXP ${variant.exp || "Unknown"}</span>
          ${variant.horde ? `<span>Horde ${variant.horde}</span>` : ""}
          ${variant.moves ? `<span>${variant.moves}</span>` : ""}
        </div>
      </div>
    `;
  }

  function getModalLocationEvs(mon) {
    const yields = mon.yields || {};

    return {
      hp: yields.ev_hp || 0,
      attack: yields.ev_attack || 0,
      defense: yields.ev_defense || 0,
      sp_attack: yields.ev_sp_attack || 0,
      sp_defense: yields.ev_sp_defense || 0,
      speed: yields.ev_speed || 0
    };
  }

  function calcModalLocationExp(base, lvl, monID) {
    const mysteryTerm = 1.25;
    const mysteryIDs = [10, 16, 19, 43, 52, 54, 56, 58, 63, 66, 69, 79, 111, 118, 161, 187, 191, 193, 504, 506, 509, 517, 519];
    const exp = Math.ceil((base * lvl / 7));

    return mysteryIDs.includes(monID)
      ? Math.ceil(exp * mysteryTerm)
      : exp;
  }

  function getEncounterMovesForLevel(mon, lvl) {
    return (mon.moves || [])
      .filter(move => move.type === "level" && Number(move.level) <= Number(lvl))
      .sort((a, b) => (a.level || 0) - (b.level || 0))
      .map(move => move.name)
      .slice(-4)
      .join(", ");
  }

  function parseModalLocationSeasonTime(str) {
    const out = {
      seasons: new Set(),
      times: new Set(),
      clean: str
    };
    const match = String(str).match(/\(([^)]+)\)$/);

    if (!match) return out;

    match[1].split("/").forEach(token => {
      const normalized = token.trim().toUpperCase();

      if (normalized.startsWith("SEASON")) {
        out.seasons.add(normalized);
      } else if (["MORNING", "DAY", "NIGHT"].includes(normalized)) {
        out.times.add(normalized);
      }
    });

    out.clean = String(str).replace(/\s*\([^)]+\)$/, "");
    return out;
  }

  function formatEncounterSeasonToken(token) {
    return {
      SEASON0: "Spring",
      SEASON1: "Summer",
      SEASON2: "Fall",
      SEASON3: "Winter"
    }[token] || token;
  }

  function formatEncounterTimeToken(token) {
    return {
      MORNING: "Morning",
      DAY: "Day",
      NIGHT: "Night"
    }[token] || token;
  }

  function getModalLocationTimingLabel(encounter) {
    return [
      ...(encounter.seasonLabels || encounter.seasons || []),
      ...(encounter.timeLabels || encounter.times || [])
    ].join(" / ");
  }

  function getModalLocationLevelRangeLabel(variants) {
    const mins = variants.map(variant => Number(variant.loc.min_level)).filter(Number.isFinite);
    const maxs = variants.map(variant => Number(variant.loc.max_level)).filter(Number.isFinite);
    const min = mins.length ? Math.min(...mins) : "?";
    const max = maxs.length ? Math.max(...maxs) : "?";
    return `Lv ${min}-${max}`;
  }

  function buildModalLocationVariationRows(variants) {
    const rows = variants.map(variant => ({
      type: variant.loc.type || "Unknown",
      rarity: variant.loc.rarity || "Unknown",
      levels: `Lv ${variant.loc.min_level || "?"}-${variant.loc.max_level || "?"}`,
      timing: getModalLocationTimingLabel(variant) || "Any time",
      notes: getModalLocationVariationNotes(variant)
    }));
    
    const typeSpans = computeModalLocationRowspans(rows, row => row.type);
    const raritySpans = computeModalLocationRowspans(rows, row => row.rarity);
    const levelsSpans = computeModalLocationRowspans(rows, row => row.levels);
    const timingSpans = computeModalLocationRowspans(rows, row => row.timing);
    const notesSpans = computeModalLocationRowspans(rows, row => row.notes);

    return rows.map((row, index) => `
      <tr>
        ${typeSpans.has(index) ? `<td rowspan="${typeSpans.get(index)}"><img src="sprites/assets/${row.type}.webp" alt="${row.type}" class="pokedex-modal-location-variation-type-img" onerror="this.onerror=null;this.src='sprites/pokemon/0.png';"></td>` : ""}
        ${raritySpans.has(index) ? `<td rowspan="${raritySpans.get(index)}">${row.rarity}</td>` : ""}
        ${levelsSpans.has(index) ? `<td rowspan="${levelsSpans.get(index)}">${row.levels}</td>` : ""}
        ${timingSpans.has(index) ? `<td rowspan="${timingSpans.get(index)}">${renderTimingAndSeasonIcons(row.timing)}</td>` : ""}
        ${notesSpans.has(index) ? `<td rowspan="${notesSpans.get(index)}">${row.notes}</td>` : ""}
      </tr>
    `).join("");
  }

  const TIMING_ICONS = {
    "day": `<svg fill="currentColor" class="timing-icon" viewBox="0 0 240 240" version="1.1" xmlns="http://www.w3.org/2000/svg"><g><path d="M58.57,25.81c-2.13-3.67-0.87-8.38,2.8-10.51c3.67-2.13,8.38-0.88,10.51,2.8l9.88,17.1c2.13,3.67,0.87,8.38-2.8,10.51 c-3.67,2.13-8.38,0.88-10.51-2.8L58.57,25.81L58.57,25.81z M120,51.17c19.01,0,36.21,7.7,48.67,20.16 C181.12,83.79,188.83,101,188.83,120c0,19.01-7.7,36.21-20.16,48.67c-12.46,12.46-29.66,20.16-48.67,20.16 c-19.01,0-36.21-7.7-48.67-20.16C58.88,156.21,51.17,139.01,51.17,120c0-19.01,7.7-36.21,20.16-48.67 C83.79,58.88,101,51.17,120,51.17L120,51.17z M158.27,81.73c-9.79-9.79-23.32-15.85-38.27-15.85c-14.95,0-28.48,6.06-38.27,15.85 c-9.79,9.79-15.85,23.32-15.85,38.27c0,14.95,6.06,28.48,15.85,38.27c9.79,9.79,23.32,15.85,38.27,15.85 c14.95,0,28.48-6.06,38.27-15.85c9.79-9.79,15.85-23.32,15.85-38.27C174.12,105.05,168.06,91.52,158.27,81.73L158.27,81.73z M113.88,7.71c0-4.26,3.45-7.71,7.71-7.71c4.26,0,7.71,3.45,7.71,7.71v19.75c0,4.26-3.45,7.71-7.71,7.71 c-4.26,0-7.71-3.45-7.71-7.71V7.71L113.88,7.71z M170.87,19.72c2.11-3.67,6.8-4.94,10.48-2.83c3.67,2.11,4.94,6.8,2.83,10.48 l-9.88,17.1c-2.11,3.67-6.8,4.94-10.48,2.83c-3.67-2.11-4.94-6.8-2.83-10.48L170.87,19.72L170.87,19.72z M214.19,58.57 c3.67-2.13,8.38-0.87,10.51,2.8c2.13,3.67,0.88,8.38-2.8,10.51l-17.1,9.88c-3.67,2.13-8.38,0.87-10.51-2.8 c-2.13-3.67-0.88-8.38,2.8-10.51L214.19,58.57L214.19,58.57z M232.29,113.88c4.26,0,7.71,3.45,7.71,7.71 c0,4.26-3.45,7.71-7.71,7.71h-19.75c-4.26,0-7.71-3.45-7.71-7.71c0-4.26,3.45-7.71,7.71-7.71H232.29L232.29,113.88z M220.28,170.87 c3.67,2.11,4.94,6.8,2.83,10.48c-2.11,3.67-6.8,4.94-10.48,2.83l-17.1-9.88c-3.67-2.11-4.94-6.8-2.83-10.48 c2.11-3.67,6.8-4.94,10.48-2.83L220.28,170.87L220.28,170.87z M181.43,214.19c2.13,3.67,0.87,8.38-2.8,10.51 c-3.67,2.13-8.38,0.88-10.51-2.8l-9.88-17.1c-2.13-3.67-0.87-8.38,2.8-10.51c3.67-2.13,8.38-0.88,10.51,2.8L181.43,214.19 L181.43,214.19z M126.12,232.29c0,4.26-3.45,7.71-7.71,7.71c-4.26,0-7.71-3.45-7.71-7.71v-19.75c0-4.26,3.45-7.71,7.71-7.71 c4.26,0,7.71,3.45,7.71,7.71V232.29L126.12,232.29z M69.13,220.28c-2.11,3.67-6.8,4.94-10.48,2.83c-3.67-2.11-4.94-6.8-2.83-10.48 l9.88-17.1c2.11-3.67,6.8-4.94,10.48-2.83c3.67,2.11,4.94,6.8,2.83,10.48L69.13,220.28L69.13,220.28z M25.81,181.43 c-3.67,2.13-8.38,0.87-10.51-2.8c-2.13-3.67-0.88-8.38,2.8-10.51l17.1-9.88c3.67-2.13,8.38-0.87,10.51,2.8 c2.13,3.67,0.88,8.38-2.8,10.51L25.81,181.43L25.81,181.43z M7.71,126.12c-4.26,0-7.71-3.45-7.71-7.71c0-4.26,3.45-7.71,7.71-7.71 h19.75c4.26,0,7.71,3.45,7.71,7.71c0,4.26-3.45,7.71-7.71,7.71H7.71L7.71,126.12z M19.72,69.13c-3.67-2.11-4.94-6.8-2.83-10.48 c2.11-3.67,6.8-4.94,10.48-2.83l17.1,9.88c3.67,2.11,4.94,6.8,2.83,10.48c-2.11,3.67-6.8,4.94-10.48,2.83L19.72,69.13L19.72,69.13z"/></g></svg>`,

    "morning": `<svg fill="currentColor" class="timing-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M23,16a1,1,0,0,1-1,1H2a1,1,0,0,1,0-2H22A1,1,0,0,1,23,16Zm-5,5a1,1,0,0,0,0-2H6a1,1,0,0,0,0,2ZM7,12a1,1,0,0,0,2,0,3,3,0,0,1,6,0,1,1,0,0,0,2,0A5,5,0,0,0,7,12Zm4-7a1,1,0,0,0,2,0V4a1,1,0,0,0-2,0Zm7,7a1,1,0,0,0,1,1h1a1,1,0,0,0,0-2H19A1,1,0,0,0,18,12ZM4,11a1,1,0,0,0,0,2H5a1,1,0,0,0,0-2ZM5.636,5.636a1,1,0,0,0,0,1.414l.707.707A1,1,0,0,0,7.757,6.343L7.05,5.636A1,1,0,0,0,5.636,5.636Zm11.314,0-.707.707a1,1,0,1,0,1.414,1.414l.707-.707A1,1,0,1,0,16.95,5.636Z"/></svg>`,

    "night": `<svg class="timing-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14.5739 1.11056L13.7826 2.69316C13.7632 2.73186 13.7319 2.76325 13.6932 2.7826L12.1106 3.5739C11.9631 3.64761 11.9631 3.85797 12.1106 3.93167L13.6932 4.72297C13.7319 4.74233 13.7632 4.77371 13.7826 4.81241L14.5739 6.39502C14.6476 6.54243 14.858 6.54243 14.9317 6.39502L15.723 4.81241C15.7423 4.77371 15.7737 4.74232 15.8124 4.72297L17.395 3.93167C17.5424 3.85797 17.5424 3.64761 17.395 3.5739L15.8124 2.7826C15.7737 2.76325 15.7423 2.73186 15.723 2.69316L14.9317 1.11056C14.858 0.963147 14.6476 0.963148 14.5739 1.11056Z" fill="currentColor"/><path d="M19.2419 5.07223L18.4633 7.40815C18.4434 7.46787 18.3965 7.51474 18.3368 7.53464L16.0009 8.31328C15.8185 8.37406 15.8185 8.63198 16.0009 8.69276L18.3368 9.4714C18.3965 9.4913 18.4434 9.53817 18.4633 9.59789L19.2419 11.9338C19.3027 12.1161 19.5606 12.1161 19.6214 11.9338L20.4 9.59789C20.42 9.53817 20.4668 9.4913 20.5265 9.4714L22.8625 8.69276C23.0448 8.63198 23.0448 8.37406 22.8625 8.31328L20.5265 7.53464C20.4668 7.51474 20.42 7.46787 20.4 7.40815L19.6214 5.07223C19.5606 4.88989 19.3027 4.88989 19.2419 5.07223Z" fill="currentColor"/><path fill-rule="evenodd" clip-rule="evenodd" d="M10.4075 13.6642C13.2348 16.4915 17.6517 16.7363 20.6641 14.3703C20.7014 14.341 20.7385 14.3113 20.7754 14.2812C20.9148 14.1674 21.051 14.0479 21.1837 13.9226C21.2376 13.8718 21.2909 13.8201 21.3436 13.7674C21.8557 13.2552 22.9064 13.5578 22.7517 14.2653C22.6983 14.5098 22.6365 14.7517 22.5667 14.9905C22.5253 15.1321 22.4811 15.2727 22.4341 15.4122C22.4213 15.4502 22.4082 15.4883 22.395 15.5262C20.8977 19.8142 16.7886 23.0003 12 23.0003C5.92487 23.0003 1 18.0754 1 12.0003C1 7.13315 4.29086 2.98258 8.66889 1.54252L8.72248 1.52504C8.8185 1.49401 8.91503 1.46428 9.01205 1.43587C9.26959 1.36046 9.5306 1.29438 9.79466 1.23801C10.5379 1.07934 10.8418 2.19074 10.3043 2.72815C10.251 2.78147 10.1987 2.83539 10.1473 2.88989C10.0456 2.99777 9.94766 3.10794 9.8535 3.22023C9.83286 3.24485 9.8124 3.26957 9.79212 3.29439C7.32966 6.30844 7.54457 10.8012 10.4075 13.6642ZM8.99331 15.0784C11.7248 17.8099 15.6724 18.6299 19.0872 17.4693C17.4281 19.6024 14.85 21.0003 12 21.0003C7.02944 21.0003 3 16.9709 3 12.0003C3 9.09163 4.45653 6.47161 6.66058 4.81846C5.41569 8.27071 6.2174 12.3025 8.99331 15.0784Z" fill="currentColor"/></svg>`
  };

  function getModalLocationVariationNotes(variant) {
    const notes = [];
    const exp = calcModalLocationExp(variant.mon.yields?.exp || 0, variant.loc.min_level || 0, variant.mon.id);
    const moves = getEncounterMovesForLevel(variant.mon, variant.loc.max_level);

    if (Number.isFinite(exp)) notes.push(`EXP ${exp}`);
    if (moves) notes.push(moves);
    return notes.join(" | ") || " ";
  }

  function computeModalLocationRowspans(rows, getValue) {
    const spans = new Map();
    let index = 0;

    while (index < rows.length) {
      const value = getValue(rows[index]);
      let end = index + 1;
      while (end < rows.length && getValue(rows[end]) === value) end += 1;
      spans.set(index, end - index);
      index = end;
    }

    return spans;
  }

  function getModalLocationRowTimingLabel(encounter) {
    const variants = encounter.variants || [encounter];

    if (variants.length <= 1) return getModalLocationTimingLabel(encounter);

    const seasons = encounter.seasons || encounter.seasonLabels || [];
    const times = encounter.times || encounter.timeLabels || [];
    const hasSeasons = seasons.length > 1;
    const hasTimes = times.length > 1;

    if (hasSeasons && hasTimes) return "Season / time variants";
    if (hasSeasons) return "Seasonal variants";
    if (hasTimes) return "Time variants";

    return getModalLocationTimingLabel(encounter);
  }

  function renderTimingAndSeasonIcons(label) {
    if (!label) return "Any time";

    const lowerLabel = label.toLowerCase();
    let renderedElements = [];

    // 1. Process Season PNGs
    const seasons = ["spring", "summer", "autumn", "fall", "winter"];
    seasons.forEach(season => {
      if (lowerLabel.includes(season)) {
        // Normalize 'fall' to your asset name preference if needed (e.g., using autumn)
        const assetName = season === "fall" ? "autumn" : season;
        renderedElements.push(
          `<img src="sprites/assets/${assetName}.png" alt="${season}" class="season-icon season-icon-${season}" onerror="this.style.display='none';">`
        );
      }
    });

    // 2. Process Timing SVGs
    if (lowerLabel.includes("morning")) renderedElements.push(TIMING_ICONS.morning);
    if (lowerLabel.includes("day"))     renderedElements.push(TIMING_ICONS.day);
    if (lowerLabel.includes("night"))   renderedElements.push(TIMING_ICONS.night);

    // If matches were found, return the group of icons.
    // Otherwise, fallback gracefully to structural strings (e.g., "Time variants", "Any time")
    return renderedElements.length > 0 ? renderedElements.join(" ") : label;
  }

  function formatStatLabel(stat) {
    return {
      hp: "HP",
      attack: "Atk",
      defense: "Def",
      sp_attack: "SpA",
      sp_defense: "SpD",
      speed: "Spe"
    }[stat] || stat;
  }

  function getAlternateForms(mon) {
    const base = getBaseForm(mon);
    const forms = Array.isArray(base.forms) ? base.forms : [];

    if (forms.length <= 1) return [];

    const seen = new Set();

    return forms.filter(form => {
      if (!form || typeof form.id !== "number") return false;
      if (form.id === mon.id) return false;

      const key = `${form.id}:${form.name || ""}`;
      if (seen.has(key)) return false;
      seen.add(key);

      return true;
    });
  }

  /* =============================================================
     FORMS
  ============================================================= */

function initFormsList() {
  modalBody.querySelectorAll(".form-btn").forEach(btn => {
    btn.onclick = () => {
      const id = Number(btn.dataset.id);
      switchForm(id);
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
     MISC
  ============================================================= */

  function openFromRoute(id) {
    const mon = data.find(m => m.id === id);
    if (!mon) return;

    showModal(mon);
  }

  function closeFromRouter() {
    disconnectSummaryEvolutionTree();
    cleanupModalLocationMap();
    if (!modalBody) modalBody = $("#modalBody");
  }

  function openFromSlug(slug) {
    if (!modalBody) modalBody = $("#modalBody");

    if (!slug || !data.length) return false;
    if (!slug) return false;

    const match = slug.match(/^(.*)_(\d+)$/);
    if (!match) return false;

    const urlName = match[1].toLowerCase().trim();

    const id = Number(match[2]);

    const mon = data.find(m => m.id === id);

    if (!mon) return false;

    // require BOTH correct id and matching name
    if (slugifyMonName(mon.name) !== urlName) return false;

    showModal(mon);
    return true;
  }

  function slugifyMonName(name) {
    return name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^\w-]/g, "");
  }

  function updateURL(mon) {
    const slug = slugifyMonName(mon.name);

    const target = `/tools/dex/${slug}_${mon.id}`;

    if (window.location.hash !== `#${target}`) {
      window.location.hash = target;
    }
  }

  function capitalize(word) {
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  }
  /* =============================================================
     PUBLIC API
  ============================================================= */

  return { load, ready, switchForm , openFromSlug, closeFromRouter};

})();

/* =============================================================
   Initialization
   ============================================================= */
document.addEventListener("DOMContentLoaded", async () => {

  initToolsSwitcher();
  initThemeToggle();
  initAboutPage()
  initRouter()

  PoryBackground.setup();
  document.body.classList.add("pory-active");

  MoveChecker.load();
  EncounterTool.load();
  VideoFrameTool.init();
  ColorTextTool.load();
  await PokedexTool.load();


});
