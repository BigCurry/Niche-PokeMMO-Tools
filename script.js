/* =============================================================
   Utilities & Config
   ============================================================= */
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

/* =============================================================
   Color Text Generator (unchanged)
   ============================================================= */
function waitForPickr() {
  return new Promise(resolve => {
    const check = () => (window.Pickr ? resolve() : requestAnimationFrame(check));
    check();
  });
}

const CONFIG = {
  defaultColor: "#00ffffff",
  pickr: {
    theme: "classic",
    components: { preview:true, opacity:false, hue:true, interaction:{hex:false,input:true,save:false} }
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
      .map(r => r.textInput.value.trim() ? `[${r.dataset.color}] ${r.textInput.value}` : "")
      .filter(Boolean)
      .join("");
    formattedOutputEl.textContent = formatted;
  }
};

const Lines = {
  getRows() { return Array.from(lineContainerEl.querySelectorAll(".lineRow")); },
  add(text="", color=CONFIG.defaultColor) {
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
    removeBtn.addEventListener("click",()=>{wrapper.remove(); render();});

    dragHandle.addEventListener("dragstart",(e)=>{
      wrapper.classList.add("dragging");
      AppState.dragging = wrapper;
      e.dataTransfer.setData("text/plain","");
      e.dataTransfer.effectAllowed="move";
    });
    dragHandle.addEventListener("dragend",()=>{wrapper.classList.remove("dragging"); AppState.dragging=null;});

    dragHandle.addEventListener("pointerdown",(e)=>{
      if(e.pointerType !== "touch") return;

      e.preventDefault();
      wrapper.classList.add("dragging");
      initDragSort.setTouchDragging(wrapper);

      dragHandle.setPointerCapture(e.pointerId);
    });

    lineContainerEl.appendChild(wrapper);

    const pickr = Pickr.create({...CONFIG.pickr, el:pickrButton, default: color});
    pickr.on("change",(c)=>{
      wrapper.dataset.color = c.toHEXA().toString();
      pickr.applyColor();
      render();
    });
    
    render();
  },
  reset() { lineContainerEl.innerHTML=""; this.add(); }
};

function render(){Preview.update(); Preview.updateFormatted();}

function initDragSort(){
  /* ===== Desktop drag (unchanged) ===== */
  lineContainerEl.addEventListener("dragover",(e)=>{
    e.preventDefault();
    const dragging = AppState.dragging;
    if(!dragging) return;

    const rows = Lines.getRows().filter(r=>r!==dragging);
    const next = rows.find(r =>
      e.clientY < r.getBoundingClientRect().top + r.getBoundingClientRect().height / 2
    );

    lineContainerEl.insertBefore(dragging, next || null);
    render();
  });

  /* ===== Mobile / touch drag ===== */
  let touchDraggingRow = null;

  lineContainerEl.addEventListener("pointermove",(e)=>{
    if(!touchDraggingRow) return;

    const rows = Lines.getRows().filter(r=>r!==touchDraggingRow);
    for(const row of rows){
      const rect = row.getBoundingClientRect();
      if(e.clientY < rect.top + rect.height / 2){
        lineContainerEl.insertBefore(touchDraggingRow, row);
        return;
      }
    }
    lineContainerEl.appendChild(touchDraggingRow);
  });

  lineContainerEl.addEventListener("pointerup",()=>{
    if(!touchDraggingRow) return;
    touchDraggingRow.classList.remove("dragging");
    touchDraggingRow = null;
    render();
  });

  /* expose setter for Lines.add */
  initDragSort.setTouchDragging = (row)=>{
    touchDraggingRow = row;
  };
}


function initToolsSwitcher(){
  $("#toolList").addEventListener("click",(e)=>{
    const tool = e.target.dataset.tool;
    if(!tool) return;
    $$(".toolSection").forEach(s=>s.style.display="none");
    document.getElementById(tool).style.display="block";
    $$(".tool-list__item").forEach(li=>li.classList.remove("active"));
    e.target.classList.add("active");
  });
}

function handleCopyOutput(){
  navigator.clipboard.writeText(formattedOutputEl.textContent)
    .then(()=>showCopyStatus("Saved ✅",true))
    .catch(()=>showCopyStatus("Failed ❌",false));
}

function showCopyStatus(msg,ok=true){
  const prev=$("#copyStatus"); if(prev) prev.remove();
  const span=document.createElement("span");
  span.id="copyStatus";
  span.className=`copyStatus ${ok?"copyStatus--ok":"copyStatus--fail"}`;
  span.textContent=msg;
  copyOutputBtnEl.insertAdjacentElement("afterend",span);
  setTimeout(()=>{span.style.opacity="0"; setTimeout(()=>span.remove(),500)},2000);
}

function initThemeToggle(){
  const darkToggle=$("#darkToggle");
  if(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) document.body.classList.add("dark");
  const updateBtn = ()=>darkToggle.textContent = document.body.classList.contains("dark")?"🌙":"☀️";
  updateBtn();
  darkToggle.addEventListener("click",()=>{document.body.classList.toggle("dark"); updateBtn();});
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

  $("#filtersBtn").addEventListener("click",()=>{$("#filtersPanel").style.display=($("#filtersPanel").style.display==="none"?"block":"none");});
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
  let optimizedMode = false;

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

  const columns = {
    pokemon: true, level: true, region: true, route: true,
    type: true, rarity: true, moves: true,
    exp: true, horde: true
  };

  let cachedRows = [];
  let visibleRows = [];
  const ROW_HEIGHT = 52; // Approximate row height for virtualization

  async function load() {
    data = await (await fetch("./monsters.json")).json();
    buildFilters();
    buildColumnFilters();
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

    $("#encounterFiltersBtn").onclick = () =>
      $("#encounterFilters").style.display =
        $("#encounterFilters").style.display === "none" ? "block" : "none";

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
    Object.keys(columns).forEach(c => {
      const l = document.createElement("label");
      l.innerHTML = `<input type="checkbox" checked> ${c}`;
      l.querySelector("input").onchange = e => {
        columns[c] = e.target.checked;
        toggleColumn(c);
      };
      box.appendChild(l);
    });
  }

  function toggleColumn(c) {
    const display = columns[c] ? "" : "none";
    $$(`[data-col="${c}"]`).forEach(el => el.style.display = display);
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

      cachedRows.push({
        pokemon: mon,
        pokemonLower: mon.name.toLowerCase(),
        loc,
        parsed,
        seasonTokens: [...parsed.seasons].map(s => SEASON_MAP[s] || s).map(s => s.toUpperCase()),
        timeTokens: [...parsed.times].map(t => TIME_MAP[t] || t).map(t => t.toUpperCase()),
        exp,
        horde: isHorde ? `${exp * 3} / ${exp * 5}` : "—",
        moves: getMoves(mon, loc.max_level)
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

    // Reset filter UI icons
    $$("#encounterFilters .filter-box").forEach(box => {
      box.textContent = "◯";
    });

    // Reset columns
    Object.keys(columns).forEach(c => {
      columns[c] = true;
    });

    $$("#columnFilters input[type=checkbox]").forEach(cb => {
      cb.checked = true;
    });

    // Reset search
    $("#encounterSearch").value = "";

    // Reset sort
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

    const topPadding = start * ROW_HEIGHT;
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
      const suffix = (r.parsedSeasons || r.parsedTimes)
        ? ` (${[r.parsedSeasons, r.parsedTimes].filter(Boolean).join(" / ")})`
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

  return { load };
})();




/* =============================================================
   Initialization
   ============================================================= */
document.addEventListener("DOMContentLoaded", async ()=>{
  await waitForPickr();
  lineContainerEl=$("#lineContainer");
  previewEl=$("#preview");
  formattedOutputEl=$("#formattedOutput");
  copyOutputBtnEl=$("#copyOutputBtn");
  templateEl=$("#lineTemplate");

  initToolsSwitcher();
  initThemeToggle();
  initDragSort();

  $("#addLineBtn").addEventListener("click",()=>Lines.add());
  $("#resetBtn").addEventListener("click",()=>Lines.reset());
  copyOutputBtnEl.addEventListener("click",handleCopyOutput);

  Lines.add();

  MoveChecker.load();

  EncounterTool.load();

});
