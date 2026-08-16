function rollBoardLocal(rows) {
  const DICE_4 = [
    ['A', 'A', 'C', 'I', 'O', 'T'], ['A', 'B', 'J', 'O', 'B', 'O'],
    ['A', 'C', 'H', 'O', 'P', 'S'], ['D', 'E', 'E', 'N', 'H', 'W'],
    ['D', 'E', 'L', 'R', 'V', 'Y'], ['A', 'I', 'S', 'O', 'F', 'R'],
    ['E', 'H', 'E', 'G', 'K', 'N'], ['E', 'I', 'I', 'T', 'T', 'S'],
    ['E', 'M', 'O', 'T', 'T', 'T'], ['E', 'N', 'S', 'S', 'I', 'U'],
    ['F', 'I', 'P', 'R', 'S', 'Y'], ['G', 'O', 'R', 'R', 'W', 'V'],
    ['I', 'P', 'S', 'S', 'E', 'F'], ['L', 'I', 'N', 'R', 'T', 'U'],
    ['W', 'O', 'B', 'O', 'J', 'A'], ['N', 'M', 'T', 'O', 'I', 'C']
  ];

  const DICE_5 = [
    ...DICE_4,
    ['E', 'T', 'U', 'V', 'W', 'Y'], ['B', 'E', 'K', 'O', 'QU', 'Z'],
    ['C', 'I', 'M', 'P', 'S', 'U'], ['E', 'H', 'R', 'V', 'W', 'Y'],
    ['A', 'C', 'E', 'E', 'M', 'N'], ['D', 'I', 'F', 'R', 'Y', 'Z'],
    ['G', 'K', 'L', 'U', 'Y', 'E'], ['A', 'B', 'I', 'L', 'T', 'Y'],
    ['J', 'K', 'QU', 'W', 'X', 'Z']
  ];

  const DICE_6 = [
    ...DICE_5,
    ['C', 'D', 'E', 'E', 'H', 'M'], ['P', 'H', 'L', 'N', 'O', 'D'],
    ['R', 'S', 'T', 'I', 'E', 'L'], ['B', 'M', 'A', 'O', 'T', 'E'],
    ['C', 'K', 'L', 'N', 'E', 'W'], ['S', 'T', 'P', 'I', 'O', 'R'],
    ['F', 'G', 'H', 'L', 'N', 'Y'], ['A', 'E', 'D', 'I', 'O', 'U'],
    ['V', 'W', 'R', 'S', 'T', 'L'], ['M', 'N', 'P', 'K', 'T', 'S']
  ];

  let selectedPool = DICE_4;
  if (rows === 5) selectedPool = DICE_5;
  if (rows === 6) selectedPool = DICE_6;

  let pool = [...selectedPool].sort(() => Math.random() - 0.5);
  const totalNeeded = rows * rows;
  return pool.slice(0, totalNeeded).map(die => die[Math.floor(Math.random() * die.length)]);
}