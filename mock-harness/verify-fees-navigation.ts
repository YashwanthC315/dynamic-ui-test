import { hostProtocolCapabilities, hostProtocolVersion } from './src/app/agent-chat-panel/services/ct-bot-host-protocol';

const WebSocket = require('ws');

const url = process.env.CT_BOT_MOCK_WS_URL || 'ws://localhost:8787?access_token=local-dev-token';
const conversationId = 'conv_verify_' + Date.now();
const messageId = 'msg_verify_' + Date.now();

const socket = new WebSocket(url);

const timeout = setTimeout(() => {
  console.error('Timed out waiting for assistant_response.');
  socket.close();
  process.exitCode = 1;
}, 5000);

socket.on('open', () => {
  socket.send(JSON.stringify({
    type: 'hello',
    hostProtocolVersion,
    capabilities: hostProtocolCapabilities
  }));

  socket.send(JSON.stringify({
    type: 'user_message',
    conversationId,
    messageId,
    text: 'take me to fees',
    context: {
      route: '/home',
      persona: 'admin'
    }
  }));
});

socket.on('message', (raw: any) => {
  let payload: any;
  try {
    payload = JSON.parse(String(raw));
  } catch (error) {
    return;
  }

  if (payload.type !== 'assistant_response') {
    return;
  }

  const hasTextBlock = Array.isArray(payload.messages)
    && payload.messages.some((block: any) => block && block.type === 'text' && typeof block.text === 'string');
  const hasFeesLinkBlock = Array.isArray(payload.messages)
    && payload.messages.some((block: any) =>
      block
      && block.type === 'link'
      && block.href === '/fees'
      && (block.target === 'internal' || typeof block.target === 'undefined')
    );
  const hasFeesNavigateAction = Array.isArray(payload.actions)
    && payload.actions.some((action: any) =>
      action
      && action.type === 'navigate'
      && (action.route === '/fees' || action.href === '/fees')
    );

  console.log(JSON.stringify(payload, null, 2));

  clearTimeout(timeout);
  socket.close();
  if (!hasTextBlock || (!hasFeesLinkBlock && !hasFeesNavigateAction)) {
    process.exitCode = 1;
  }
});

socket.on('error', (error: Error) => {
  clearTimeout(timeout);
  console.error(error);
  process.exitCode = 1;
});
