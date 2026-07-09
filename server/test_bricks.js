const io = require('socket.io-client');

const playerSocket = io('http://localhost:3000');
playerSocket.on('connect', () => {
  playerSocket.emit('player_join', { sessionToken: '' });
});

playerSocket.on('join_confirmed', (pData) => {
  console.log('Joined as player', pData.playerNumber);
  if (pData.playerNumber === 1) {
    playerSocket.emit('start_game');
    console.log('Emitted start_game');
  }
});

playerSocket.on('game_state', (state) => {
  if (state.bricks && state.bricks.length > 0) {
    for (let r = 0; r < state.bricks.length; r++) {
      const row = state.bricks[r];
      if (row && row.length > 0) {
        for (let c = 0; c < row.length; c++) {
          const brick = row[c];
          if (brick && brick.active) {
            console.log('brick dims', brick.width, brick.height, brick.y);
            process.exit(0);
          }
        }
      }
    }
  }
});

playerSocket.on('join_rejected', (err) => {
  console.error('Player rejected', err);
  process.exit(1);
});
