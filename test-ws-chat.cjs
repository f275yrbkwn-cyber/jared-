const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:3000/ws/live');
ws.on('open', () => {
  console.log('connected');
});
ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.type === 'transcription') {
    console.log(`[${msg.role}] ${msg.text} (finished: ${msg.finished})`);
  }
});
