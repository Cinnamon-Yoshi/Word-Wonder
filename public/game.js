// Instant theme preview update on landing screen selection
document.getElementById('select-theme').onchange = (e) => {
  currentTheme = e.target.value;
  applyTheme(currentTheme);
};

document.getElementById('select-lobby-theme').onchange = (e) => {
  currentTheme = e.target.value;
  applyTheme(currentTheme);
  socket.emit('update-theme', currentTheme);
};