const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8787');

ws.on('open', () => {
  console.log('connected');
  const prompts = [
    'take me to fees',
    'collect fees',
    'institute info',
    'create student form'
  ];
  let idx = 0;
  const sendNext = () => {
    if (idx >= prompts.length) {
      ws.close();
      return;
    }
    const msg = {
      type: 'user_message',
      conversationId: 'test_conv_1',
      messageId: 'test_msg_' + (idx + 1),
      text: prompts[idx],
      context: { route: '/fees', persona: 'Admin' }
    };
    console.log('sending:', msg.text);
    ws.send(JSON.stringify(msg));
    idx++;
  };
  sendNext();
});

ws.on('message', (data) => {
  try {
    const parsed = JSON.parse(data.toString());
    console.log('received:', JSON.stringify(parsed, null, 2));
    // if harness expects follow-up, send next prompt after a short delay
    setTimeout(() => typeof sendNext === 'function' && sendNext(), 300);
  } catch (e) {
    console.log('raw:', data.toString());
  }
  // keep connection open until all prompts sent
});

ws.on('error', (err) => { console.error('ws error', err); });
