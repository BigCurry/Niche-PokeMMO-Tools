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

    lineContainerEl.appendChild(wrapper);

    const pickr = Pickr.create({...CONFIG.pickr, el:pickrButton, default: color});
    pickr.on("change",(c)=>{
      wrapper.dataset.color = c.toHEXA().toString();
      render();
    });

    render();
  },
  reset() { lineContainerEl.innerHTML=""; this.add(); }
};

function render(){Preview.update(); Preview.updateFormatted();}

function initDragSort(){
  lineContainerEl.addEventListener("dragover",(e)=>{
    e.preventDefault();
    const dragging = AppState.dragging;
    if(!dragging) return;
    const rows = Lines.getRows().filter(r=>r!==dragging);
    const next = rows.find(r=>e.clientY < r.getBoundingClientRect().top + r.getBoundingClientRect().height/2);
    lineContainerEl.insertBefore(dragging, next||null);
    render();
  });
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
});
