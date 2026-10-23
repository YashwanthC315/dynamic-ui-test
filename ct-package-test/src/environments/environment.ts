import { environmentLocal } from './environment.local';

export const environment = {
  ...environmentLocal,
  production: false,
  AGENT_HARNESS_WS_URL: 'ws://localhost:8787',
  AGENT_HARNESS_API_URL: 'http://localhost:8787',
  AGENT_FILE_RUN_API_URL: 'http://localhost:4300',
  AGENT_FILE_RUN_AGENT_PATH: 'ct-bot/agents/main.exs',
  AGENT_SUGGESTIONS_AGENT_PATH: 'ct-bot/agents/suggestions.exs',
  AGENT_COMPOSE_AGENT_PATH: 'ct-bot/agents/compose.exs',
  AGENT_TITLE_AGENT_PATH: 'ct-bot/agents/title.exs',
  AGENT_FILE_RUN_OWNER_ID: 'yashwanth@biltoka.com'
};