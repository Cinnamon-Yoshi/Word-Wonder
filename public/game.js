function renderBoard(board, rows) {
  const grid = document.getElementById('boggle-board');
  grid.className = `boggle-grid grid-${rows}`;
  grid.innerHTML = '';
  selectedDieIndices = [];

  board.forEach((letter, index) => {
    const die = document.createElement('div');
    die.className = 'die';
    die.innerText = letter;
    die.onclick = () => {
      const idx = selectedDieIndices.indexOf(index);
      if (idx !== -1) {
        if (idx === selectedDieIndices.length - 1) {
          die.classList.remove('selected');
          selectedDieIndices.pop();
          const input = document.getElementById('input-word');
          input.value = input.value.slice(0, -letter.length);
          updateScorePreview();
        }
        return;
      }
      die.classList.add('selected');
      selectedDieIndices.push(index);
      document.getElementById('input-word').value += letter;
      updateScorePreview();
    };
    grid.appendChild(die);
  });
}