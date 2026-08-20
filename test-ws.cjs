const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:3000/ws/live');
ws.on('open', () => {
  console.log('connected');
});
ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.audio) console.log('got audio chunk');
  else console.log('msg:', JSON.stringify(msg, null, 2));
});
