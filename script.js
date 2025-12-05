/* -------------------------
   WAIT FOR PICKR TO LOAD & DOM READY
-------------------------- */
function waitForPickr() {
  return new Promise(resolve => {
    if (window.Pickr) return resolve();
    const check = setInterval(() => {
      if (window.Pickr) {
        clearInterval(check);
        resolve();
      }
    }, 20);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  waitForPickr().then(() => {

/* -------------------------
   DOM References
-------------------------- */
const lineContainer = document.getElementById("lineContainer");
const addLineBtn = document.getElementById("addLineBtn");
const resetBtn = document.getElementById("resetBtn");
const previewDiv = document.getElementById("preview");
const darkToggle = document.getElementById("darkToggle");
const toolList = document.getElementById("toolList");

const formattedOutputPre = document.getElementById('formattedOutput');
const copyOutputBtn = document.getElementById('copyOutputBtn');

/* -------------------------
   Helper Functions
-------------------------- */
const createElement = (tag, options = {}) => {
  const el = document.createElement(tag);
  Object.entries(options).forEach(([key, val]) => {
    if (key === 'text') el.textContent = val;
    else if (key === 'class') el.className = val;
    else if (['type','value','placeholder','draggable'].includes(key)) el[key] = val;
    else if (key.startsWith('on')) el.addEventListener(key.substring(2), val);
  });
  return el;
};

/* -------------------------
   Preview & Formatted Output
-------------------------- */
function updatePreview() {
  previewDiv.innerHTML = '';
  [...lineContainer.children].forEach(row => {
    const text = row.querySelector('.lineText').value;
    if (!text) return;
    const color = row.dataset.color || "#ffffff";
    const span = createElement('span', { text });
    span.style.color = color;
    previewDiv.appendChild(span);
  });
  updateFormattedOutput();
}

function updateFormattedOutput() {
  const formattedText = [...lineContainer.children]
    .map(row => {
      const text = row.querySelector('.lineText').value.trim();
      const color = row.dataset.color || "#ffffff";
      return text ? `[${color}] ${text}` : '';
    })
    .filter(Boolean)
    .join('');
  formattedOutputPre.textContent = formattedText;
}

/* -------------------------
   Add Line (with Pickr)
-------------------------- */
function addLine(textValue = '', colorValue = '#ffffff') {
  const wrapper = createElement('div', { class: 'lineRow' });
  wrapper.dataset.color = colorValue;

  // Drag handle
  const handle = createElement('span', { class: 'dragHandle', text: '⋮⋮', draggable: true });
  handle.addEventListener('dragstart', e => {
    wrapper.classList.add('dragging');
    draggingEl = wrapper;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
  });
  handle.addEventListener('dragend', () => {
    wrapper.classList.remove('dragging');
    draggingEl = null;
  });

  // Text input
  const textInput = createElement('input', {
    type: 'text',
    placeholder: 'Enter text',
    value: textValue,
    class: 'lineText',
    oninput: updatePreview
  });

  // Pickr toggle button
  const pickrBtn = createElement('button', { text: '🎨', class: 'pickrButton' });

  // Remove button
  const removeBtn = createElement('button', {
    text: '❌',
    onclick: () => { wrapper.remove(); updatePreview(); }
  });

  wrapper.append(handle, textInput, pickrBtn, removeBtn);
  lineContainer.appendChild(wrapper);

  // Initialize Pickr
  const pickr = Pickr.create({
    el: pickrBtn,
    theme: 'classic',
    default: colorValue,
    components: {
      preview: true,
      opacity: false,
      hue: true,
      interaction: {
        hex: true,
        input: true,
        save: false
      }
    }
  });

  // Apply color live, mimicking Save button
  pickr.on('change', color => {
    const hex = color.toHEXA().toString();
    wrapper.dataset.color = hex;
    updatePreview();
    pickr.applyColor(false); // updates toggle button
  });

  updatePreview();
}

/* -------------------------
   Reset
-------------------------- */
function resetLines() {
  lineContainer.innerHTML = '';
  addLine();
}

/* -------------------------
   Copy formatted output
-------------------------- */
copyOutputBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(formattedOutputPre.textContent)
    .then(() => showCopyStatus('Saved ✅'))
    .catch(() => showCopyStatus('Failed ❌'));
});

// Helper function for temporary status
function showCopyStatus(message) {
  let existing = document.getElementById('copyStatus');
  if (existing) existing.remove();

  const status = createElement('span', { text: message, class: 'copyStatus' });
  status.id = 'copyStatus';
  copyOutputBtn.insertAdjacentElement('afterend', status);

  setTimeout(() => {
    status.style.transition = 'opacity 0.5s';
    status.style.opacity = '0';
    setTimeout(() => status.remove(), 500);
  }, 2000);
}

/* -------------------------
   Tool Switching
-------------------------- */
toolList.addEventListener('click', e => {
  if (!e.target.dataset.tool) return;
  document.querySelectorAll('.toolSection').forEach(s => s.style.display = 'none');
  document.getElementById(e.target.dataset.tool).style.display = 'block';
});

/* -------------------------
   Dark Mode
-------------------------- */
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
if (prefersDark) document.body.classList.add('dark');
darkToggle.textContent = document.body.classList.contains('dark') ? '☀️ Light Mode' : '🌙 Dark Mode';
darkToggle.addEventListener('click', () => {
  document.body.classList.toggle('dark');
  darkToggle.textContent = document.body.classList.contains('dark') ? '☀️ Light Mode' : '🌙 Dark Mode';
});

/* -------------------------
   Drag-and-Drop
-------------------------- */
let draggingEl = null;
lineContainer.addEventListener('dragover', e => {
  e.preventDefault();
  if (!draggingEl) return;

  const afterElement = [...lineContainer.querySelectorAll('.lineRow:not(.dragging)')]
    .reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = e.clientY - box.top - box.height / 2;
      return (offset < 0 && offset > closest.offset) ? { offset, element: child } : closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;

  if (!afterElement) lineContainer.appendChild(draggingEl);
  else afterElement.insertAdjacentElement('beforebegin', draggingEl);

  updatePreview();
});

/* -------------------------
   Initialize first line & buttons
-------------------------- */
addLine();
addLineBtn.addEventListener('click', () => addLine());
resetBtn.addEventListener('click', resetLines);

}); // END waitForPickr & DOMContentLoaded
})