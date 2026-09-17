"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveChatError = void 0;
exports.resolveChatCompletionsUrl = resolveChatCompletionsUrl;
exports.callOpenAICompatibleChat = callOpenAICompatibleChat;
const http_1 = require("http");
const https_1 = require("https");
const url_1 = require("url");
class LiveChatError extends Error {
    details;
    constructor(details) {
        super(details.safeMessage);
        this.name = 'LiveChatError';
        this.details = details;
    }
}
exports.LiveChatError = LiveChatError;
function resolveChatCompletionsUrl(baseUrl) {
    const normalized = (baseUrl || '').trim().replace(/\/+$/, '');
    if (!normalized) {
        return '';
    }
    if (/\/chat\/completions$/i.test(normalized)) {
        return normalized;
    }
    return normalized + '/chat/completions';
}
function callOpenAICompatibleChat(request) {
    return new Promise((resolve, reject) => {
        executeLiveChatRequest(request, true)
            .then(resolve)
            .catch((error) => {
            if (shouldRetryWithoutStructuredFormat(error)) {
                request.logger.debug('[mock-harness] live chat retrying without response_format');
                executeLiveChatRequest(request, false)
                    .then(resolve)
                    .catch(reject);
                return;
            }
            reject(error);
        });
    });
}
function readAssistantResponse(responseBody) {
    if (!responseBody || !Array.isArray(responseBody.choices) || !responseBody.choices.length) {
        return { text: '', finishReason: '' };
    }
    const firstChoice = responseBody.choices[0] || {};
    const finishReason = typeof firstChoice.finish_reason === 'string' ? firstChoice.finish_reason : '';
    const message = firstChoice.message || {};
    if (typeof message.content === 'string') {
        return { text: message.content.trim(), finishReason: finishReason };
    }
    if (message && typeof message.content === 'object' && message.content !== null && !Array.isArray(message.content)) {
        try {
            return { text: JSON.stringify(message.content), finishReason: finishReason };
        }
        catch (error) {
            return { text: '', finishReason: finishReason };
        }
    }
    if (Array.isArray(message.content)) {
        const textParts = [];
        message.content.forEach((part) => {
            if (part && typeof part.text === 'string') {
                textParts.push(part.text);
            }
        });
        return { text: textParts.join('\n').trim(), finishReason: finishReason };
    }
    return { text: '', finishReason: finishReason };
}
function executeLiveChatRequest(request, preferStructuredJson) {
    return new Promise((resolve, reject) => {
        const endpoint = resolveChatCompletionsUrl(request.baseUrl);
        if (!endpoint) {
            reject(new LiveChatError({
                endpoint: '',
                model: request.model,
                statusCode: 0,
                latencyMs: 0,
                responseBytes: 0,
                safeMessage: 'Live mode base URL is empty.'
            }));
            return;
        }
        request.logger.debug('[mock-harness] live chat endpoint=%s structured=%s', endpoint, preferStructuredJson);
        const startedAt = Date.now();
        const url = new url_1.URL(endpoint);
        const payloadObject = {
            model: request.model,
            temperature: request.temperature,
            messages: buildMessages(request)
        };
        if (preferStructuredJson && request.structuredOutput !== false) {
            payloadObject.response_format = { type: 'json_object' };
        }
        const payload = JSON.stringify(payloadObject);
        const requestPayloadForLogs = safeStringifyForLogs(payloadObject);
        const transport = url.protocol === 'https:' ? https_1.request : http_1.request;
        request.logger.debug('[mock-harness] live chat request endpoint=%s method=POST auth=%s payloadBytes=%s payload=%s', endpoint, maskApiKey(request.apiKey), Buffer.byteLength(payload, 'utf8'), requestPayloadForLogs);
        const req = transport({
            method: 'POST',
            protocol: url.protocol,
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + (url.search || ''),
            headers: {
                'content-type': 'application/json',
                'authorization': 'Bearer ' + request.apiKey
            }
        }, (response) => {
            const chunks = [];
            response.on('data', (chunk) => {
                chunks.push(typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
            });
            response.on('end', () => {
                const raw = chunks.join('');
                const latencyMs = Date.now() - startedAt;
                const statusCode = typeof response.statusCode === 'number' ? response.statusCode : 0;
                const responseBytes = Buffer.byteLength(raw, 'utf8');
                request.logger.debug('[mock-harness] live chat response endpoint=%s status=%s latencyMs=%s responseBytes=%s', endpoint, statusCode, latencyMs, responseBytes);
                let parsed = {};
                try {
                    parsed = raw ? JSON.parse(raw) : {};
                }
                catch (error) {
                    reject(new LiveChatError({
                        endpoint: endpoint,
                        model: request.model,
                        statusCode: statusCode,
                        latencyMs: latencyMs,
                        responseBytes: responseBytes,
                        safeMessage: 'Live provider returned non-JSON response.',
                        requestPayload: requestPayloadForLogs,
                        responsePreview: truncateForLogs(raw)
                    }));
                    return;
                }
                if (statusCode >= 400) {
                    const providerErrorMessage = (parsed && parsed.error && typeof parsed.error.message === 'string'
                        ? parsed.error.message
                        : 'Live provider request failed.');
                    reject(new LiveChatError({
                        endpoint: endpoint,
                        model: request.model,
                        statusCode: statusCode,
                        latencyMs: latencyMs,
                        responseBytes: responseBytes,
                        safeMessage: providerErrorMessage,
                        requestPayload: requestPayloadForLogs,
                        responsePreview: truncateForLogs(raw),
                        providerError: parsed && parsed.error ? parsed.error : parsed
                    }));
                    return;
                }
                const assistant = readAssistantResponse(parsed);
                if (!assistant.text) {
                    reject(new LiveChatError({
                        endpoint: endpoint,
                        model: request.model,
                        statusCode: statusCode,
                        latencyMs: latencyMs,
                        responseBytes: responseBytes,
                        safeMessage: 'Live provider returned an empty assistant response.',
                        requestPayload: requestPayloadForLogs,
                        responsePreview: truncateForLogs(raw)
                    }));
                    return;
                }
                resolve({
                    endpoint: endpoint,
                    model: request.model,
                    statusCode: statusCode,
                    latencyMs: latencyMs,
                    responseBytes: responseBytes,
                    finishReason: assistant.finishReason,
                    text: assistant.text
                });
            });
        });
        req.on('error', (error) => {
            reject(new LiveChatError({
                endpoint: endpoint,
                model: request.model,
                statusCode: 0,
                latencyMs: Date.now() - startedAt,
                responseBytes: 0,
                safeMessage: error && error.message ? error.message : 'Network error while calling live provider.',
                requestPayload: requestPayloadForLogs,
                networkErrorCode: error.code || '',
                networkErrorStack: error && error.stack ? truncateForLogs(error.stack) : ''
            }));
        });
        req.write(payload);
        req.end();
    });
}
function buildMessages(request) {
    const messages = [{ role: 'system', content: request.systemPrompt }];
    const hasContextRoute = typeof request.contextRoute === 'string' && request.contextRoute.trim().length > 0;
    const hasContextPersona = typeof request.contextPersona === 'string' && request.contextPersona.trim().length > 0;
    const hasFocus = request.contextFocus !== null && request.contextFocus !== undefined;
    const hasModuleFlags = request.contextModuleFlags !== null && request.contextModuleFlags !== undefined;
    const hasFlags = request.contextFlags !== null && request.contextFlags !== undefined;
    const hasView = request.contextView !== null && request.contextView !== undefined;
    const hasInstitute = request.contextInstitute !== null && request.contextInstitute !== undefined;
    const hasFormOptions = request.contextFormOptions !== null && request.contextFormOptions !== undefined;
    if (hasContextRoute || hasContextPersona || hasFocus || hasModuleFlags || hasFlags || hasView || hasInstitute || hasFormOptions) {
        const contextLines = ['Host context:'];
        contextLines.push('route=' + (hasContextRoute ? request.contextRoute.trim() : '(unknown)'));
        contextLines.push('persona=' + (hasContextPersona ? request.contextPersona.trim() : '(unknown)'));
        contextLines.push('focus=' + safeStringifyForPrompt(hasFocus ? request.contextFocus : null));
        contextLines.push('moduleFlags=' + safeStringifyForPrompt(hasModuleFlags ? request.contextModuleFlags : {}));
        contextLines.push('flags=' + safeStringifyForPrompt(hasFlags ? request.contextFlags : {}));
        contextLines.push('view=' + safeStringifyForPrompt(hasView ? request.contextView : null));
        contextLines.push('institute=' + safeStringifyForPrompt(hasInstitute ? request.contextInstitute : null));
        contextLines.push('formOptions=' + safeStringifyForPrompt(hasFormOptions ? request.contextFormOptions : null));
        messages.push({ role: 'user', content: contextLines.join('\n') });
    }
    messages.push({ role: 'user', content: request.userText });
    return messages;
}
function maskApiKey(apiKey) {
    if (!apiKey) {
        return '(missing)';
    }
    if (apiKey.length <= 8) {
        return '***';
    }
    return apiKey.slice(0, 4) + '...' + apiKey.slice(-4);
}
function truncateForLogs(value, maxLength = 1200) {
    if (!value) {
        return '';
    }
    if (value.length <= maxLength) {
        return value;
    }
    return value.slice(0, maxLength) + '... (truncated)';
}
function safeStringifyForLogs(value) {
    try {
        return truncateForLogs(JSON.stringify(value));
    }
    catch (error) {
        return '[unserializable]';
    }
}
function safeStringifyForPrompt(value) {
    try {
        return JSON.stringify(value);
    }
    catch (error) {
        return '[unserializable]';
    }
}
function shouldRetryWithoutStructuredFormat(error) {
    if (!error || !error.details) {
        return false;
    }
    if (error.details.statusCode !== 400 && error.details.statusCode !== 422) {
        return false;
    }
    const message = (error.details.safeMessage || '').toLowerCase();
    return message.indexOf('response_format') >= 0
        || message.indexOf('json_object') >= 0
        || message.indexOf('unsupported') >= 0
        || message.indexOf('unknown parameter') >= 0
        || message.indexOf('not allowed') >= 0;
}
