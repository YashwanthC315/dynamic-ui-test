"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadHarnessConfig = loadHarnessConfig;
exports.resolveConfigPath = resolveConfigPath;
exports.createLogger = createLogger;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const util = __importStar(require("util"));
const DEFAULT_CONFIG = {
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
function loadHarnessConfig() {
    const configPath = resolveConfigPath();
    const fileConfig = readConfigFile(configPath);
    const merged = {
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
function resolveConfigPath() {
    const fromEnv = readString(process.env.MOCK_HARNESS_CONFIG);
    if (fromEnv) {
        return path.resolve(fromEnv);
    }
    return path.resolve(__dirname, 'config.json');
}
function createLogger(level) {
    const order = { debug: 10, info: 20, error: 30 };
    const current = order[level] || order.info;
    const allow = (target) => {
        return (order[target] || order.info) >= current;
    };
    const withLevel = (label, args) => {
        const rawMessage = args.length
            ? util.format.apply(null, args)
            : '';
        const normalizedMessage = rawMessage.indexOf('[mock-harness] ') === 0
            ? rawMessage.slice('[mock-harness] '.length)
            : rawMessage;
        return '[mock-harness][' + label.toUpperCase() + '] ' + normalizedMessage;
    };
    return {
        debug: (...args) => { if (allow('debug')) {
            console.log(withLevel('debug', args));
        } },
        info: (...args) => { if (allow('info')) {
            console.log(withLevel('info', args));
        } },
        error: (...args) => { if (allow('error')) {
            console.error(withLevel('error', args));
        } }
    };
}
function readConfigFile(configPath) {
    if (!fs.existsSync(configPath)) {
        return {};
    }
    try {
        const raw = fs.readFileSync(configPath, 'utf8');
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    }
    catch (error) {
        console.error('[mock-harness][ERROR] Failed to parse config file:', configPath);
        return {};
    }
}
function readString(value) {
    return typeof value === 'string' ? value.trim() : '';
}
function readNumber(value) {
    const parsed = Number(value);
    return isFinite(parsed) ? parsed : 0;
}
function readInteger(value) {
    const parsed = Math.floor(Number(value));
    return isFinite(parsed) ? parsed : 0;
}
function readPort(value) {
    const parsed = readInteger(value);
    return parsed > 0 ? parsed : 0;
}
function readMode(value) {
    const normalized = readString(value).toLowerCase();
    if (normalized === 'canned' || normalized === 'live') {
        return normalized;
    }
    return '';
}
function readLogLevel(value) {
    const normalized = readString(value).toLowerCase();
    if (normalized === 'debug' || normalized === 'info' || normalized === 'error') {
        return normalized;
    }
    return '';
}
