const io = require('socket.io-client');
const socket = io('http://localhost:3000');
socket.on('connect', () => {
  socket.emit('player_join', { sessionToken: '' });
});
socket.on('join_confirmed', (data) => {
  console.log('Joined as', data.playerId);
  if (data.playerNumber === 1) {
    socket.emit('start_game');
    console.log('Emitted start_game');
    setInterval(() => {}, 10000); // Keep alive
  }
});
socket.on('join_rejected', (data) => {
  console.log('Rejected:', data);
  process.exit(1);
});
