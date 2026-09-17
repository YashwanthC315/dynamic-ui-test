import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

export type HarnessMode = 'canned' | 'live';
export type HarnessLogLevel = 'debug' | 'info' | 'error';

export interface LiveModeConfig {
  provider: string;
  apiKey: string;
  model: string;
  baseUrl: string;
  temperature: number;
  maxTurns: number;
}

export interface HarnessConfig {
  host: string;
  port: number;
  mode: HarnessMode;
  logLevel: HarnessLogLevel;
  sqlitePath: string;
  live: LiveModeConfig;
}

export interface HarnessLogger {
  debug: (...args: any[]) => void;
  info: (...args: any[]) => void;
  error: (...args: any[]) => void;
}

const DEFAULT_CONFIG: HarnessConfig = {
  host: '0.0.0.0',
  port: 8787,
  mode: 'canned',
  logLevel: 'info',
  sqlitePath: path.join(__dirname, 'data', 'conversations.sqlite3'),
  live: {
    provider: 'openrouter',
    apiKey: '',
    model: 'openai/gpt-4o-mini',
    baseUrl: 'https://openrouter.ai/api/v1',
    temperature: 0.2,
    maxTurns: 4
  }
};

export function loadHarnessConfig(): HarnessConfig {
  const configPath = resolveConfigPath();
  const fileConfig = readConfigFile(configPath);

  const merged: HarnessConfig = {
    host: readString(process.env.MOCK_HARNESS_HOST) || readString(process.env.CT_BOT_MOCK_HOST) || readString(fileConfig.host) || DEFAULT_CONFIG.host,
    port: readPort(process.env.MOCK_HARNESS_PORT)
      || readPort(process.env.CT_BOT_MOCK_PORT)
      || readPort(fileConfig.port)
      || DEFAULT_CONFIG.port,
    mode: readMode(process.env.MOCK_HARNESS_MODE)
      || readMode(fileConfig.mode)
      || DEFAULT_CONFIG.mode,
    logLevel: readLogLevel(process.env.MOCK_HARNESS_LOG_LEVEL)
      || readLogLevel(fileConfig.logLevel)
      || DEFAULT_CONFIG.logLevel,
    sqlitePath: readString(fileConfig.sqlitePath) || DEFAULT_CONFIG.sqlitePath,
    live: {
      provider: readString(process.env.MOCK_HARNESS_LIVE_PROVIDER)
        || readString(fileConfig.live && fileConfig.live.provider)
        || DEFAULT_CONFIG.live.provider,
      apiKey: readString(process.env.MOCK_HARNESS_LIVE_API_KEY)
        || readString(process.env.OPENAI_API_KEY)
        || readString(fileConfig.live && fileConfig.live.apiKey)
        || DEFAULT_CONFIG.live.apiKey,
      model: readString(process.env.MOCK_HARNESS_LIVE_MODEL)
        || readString(fileConfig.live && fileConfig.live.model)
        || DEFAULT_CONFIG.live.model,
      baseUrl: readString(process.env.MOCK_HARNESS_LIVE_BASE_URL)
        || readString(process.env.OPENAI_BASE_URL)
        || readString(fileConfig.live && fileConfig.live.baseUrl)
        || DEFAULT_CONFIG.live.baseUrl,
      temperature: readNumber(process.env.MOCK_HARNESS_LIVE_TEMPERATURE)
        || readNumber(fileConfig.live && fileConfig.live.temperature)
        || DEFAULT_CONFIG.live.temperature,
      maxTurns: readInteger(process.env.MOCK_HARNESS_LIVE_MAX_TURNS)
        || readInteger(fileConfig.live && fileConfig.live.maxTurns)
        || DEFAULT_CONFIG.live.maxTurns
    }
  };

  return merged;
}

export function resolveConfigPath(): string {
  const fromEnv = readString(process.env.MOCK_HARNESS_CONFIG);
  if (fromEnv) {
    return path.resolve(fromEnv);
  }
  return path.resolve(__dirname, 'config.json');
}

export function createLogger(level: HarnessLogLevel): HarnessLogger {
  const order: { [key: string]: number } = { debug: 10, info: 20, error: 30 };
  const current = order[level] || order.info;

  const allow = (target: HarnessLogLevel) => {
    return (order[target] || order.info) >= current;
  };
  const withLevel = (label: HarnessLogLevel, args: any[]) => {
    const rawMessage = args.length
      ? util.format.apply(null, args)
      : '';
    const normalizedMessage = rawMessage.indexOf('[mock-harness] ') === 0
      ? rawMessage.slice('[mock-harness] '.length)
      : rawMessage;
    return '[mock-harness][' + label.toUpperCase() + '] ' + normalizedMessage;
  };

  return {
    debug: (...args: any[]) => { if (allow('debug')) { console.log(withLevel('debug', args)); } },
    info: (...args: any[]) => { if (allow('info')) { console.log(withLevel('info', args)); } },
    error: (...args: any[]) => { if (allow('error')) { console.error(withLevel('error', args)); } }
  };
}

function readConfigFile(configPath: string): any {
  if (!fs.existsSync(configPath)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.error('[mock-harness][ERROR] Failed to parse config file:', configPath);
    return {};
  }
}

function readString(value: any): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readNumber(value: any): number {
  const parsed = Number(value);
  return isFinite(parsed) ? parsed : 0;
}

function readInteger(value: any): number {
  const parsed = Math.floor(Number(value));
  return isFinite(parsed) ? parsed : 0;
}

function readPort(value: any): number {
  const parsed = readInteger(value);
  return parsed > 0 ? parsed : 0;
}

function readMode(value: any): HarnessMode | '' {
  const normalized = readString(value).toLowerCase();
  if (normalized === 'canned' || normalized === 'live') {
    return normalized;
  }
  return '';
}

function readLogLevel(value: any): HarnessLogLevel | '' {
  const normalized = readString(value).toLowerCase();
  if (normalized === 'debug' || normalized === 'info' || normalized === 'error') {
    return normalized;
  }
  return '';
}
