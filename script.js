function switchTool(id) {
  document.querySelectorAll('.toolSection').forEach(sec => sec.style.display='none');
  document.getElementById(id).style.display='block';
}

function generateColorText() {
  const color = document.getElementById("colorPicker").value.replace('#','');
  const text = document.getElementById("inputText").value;
  const formatted = `%${color} ${text}%`;
  document.getElementById("output").textContent = formatted;

  const preview = document.getElementById("preview");
  preview.style.color = "#" + color;
  preview.textContent = text;
}

document.getElementById("darkToggle").onclick = () => {
  document.body.classList.toggle("dark");
};
