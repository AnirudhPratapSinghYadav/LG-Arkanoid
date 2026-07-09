const io = require('socket.io-client');
const masterSocket = io('http://localhost:3000');

masterSocket.on('connect', () => {
  console.log('Master socket connected');
  masterSocket.emit('master_connect', { adminSecret: 'LGLAB_DEV' });
});

masterSocket.on('master_confirmed', (data) => {
  const token = data.sessionToken;
  console.log('Got session token:', token);
  
  const playerSocket = io('http://localhost:3000');
  playerSocket.on('connect', () => {
    console.log('Player socket connected');
    playerSocket.emit('player_join', { sessionToken: token });
  });

  playerSocket.on('join_confirmed', (pData) => {
    console.log('Joined as player', pData.playerNumber);
    playerSocket.emit('start_game');
    console.log('Emitted start_game');
  });

  playerSocket.on('join_rejected', (err) => {
    console.error('Player rejected', err);
    process.exit(1);
  });
});
