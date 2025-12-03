function switchTool(id) {
  document.querySelectorAll('.toolSection').forEach(sec => sec.style.display='none');
  document.getElementById(id).style.display='block';
}

function generateMultiColorText() {
  const text = document.getElementById('inputText').value.trim().split('\n');
  const hexes = document.getElementById('hexInput').value.trim().split(',');
  const charLimitInput = document.getElementById('charLimit').value;
  const charLimit = charLimitInput ? parseInt(charLimitInput) : null;

  if(text.length !== hexes.length) {
    alert('Number of lines and hex codes must match.');
    return;
  }

  let output = '';
  for(let i = 0; i < text.length; i++) {
    const segment = `[${hexes[i]}] ${text[i]}`;
    output += segment + ' ';
  }

  if(charLimit && output.length > charLimit) {
    output = output.slice(0, charLimit) + '...';
  }

  document.getElementById('output').textContent = output.trim();

  const previewDiv = document.getElementById('preview');
  previewDiv.innerHTML = ''; // clear previous preview
  for(let i = 0; i < text.length; i++) {
    const span = document.createElement('span');
    span.style.color = hexes[i];
    span.textContent = text[i] + ' ';
    previewDiv.appendChild(span);
  }
}

// Dark mode / Light mode
const darkToggle = document.getElementById('darkToggle');
const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
if(prefersDark) document.body.classList.add('dark');
darkToggle.textContent = document.body.classList.contains('dark') ? '☀️ Light Mode' : '🌙 Dark Mode';

darkToggle.onclick = () => {
  document.body.classList.toggle('dark');
  darkToggle.textContent = document.body.classList.contains('dark') ? '☀️ Light Mode' : '🌙 Dark Mode';
};
