// Small launcher to set env and start the compiled mock harness.
// Force our local config so the harness reads port 8788.
process.env.MOCK_HARNESS_CONFIG = './config.json';
try {
  require('./dist/server.js');
} catch (err) {
  console.error('Failed to start harness:', err);
  process.exit(1);
}
