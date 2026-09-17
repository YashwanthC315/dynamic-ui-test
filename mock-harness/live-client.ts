import { request as httpRequest } from 'http';
import { request as httpsRequest } from 'https';
import { URL } from 'url';

import { HarnessLogger } from './harness-config';

export interface LiveChatRequest {
  baseUrl: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  userText: string;
  contextRoute?: string;
  contextPersona?: string;
  contextFocus?: any;
  contextModuleFlags?: any;
  contextFlags?: any;
  contextView?: any;
  contextInstitute?: any;
  contextFormOptions?: any;
  temperature: number;
  logger: HarnessLogger;
  /** H2: set false for plain-text hops (no response_format json_object). */
  structuredOutput?: boolean;
}

export interface LiveChatResult {
  endpoint: string;
  model: string;
  statusCode: number;
  latencyMs: number;
  responseBytes: number;
  finishReason: string;
  text: string;
}

export interface LiveChatFailureDetails {
  endpoint: string;
  model: string;
  statusCode: number;
  latencyMs: number;
  responseBytes: number;
  safeMessage: string;
  requestPayload?: string;
  responsePreview?: string;
  providerError?: any;
  networkErrorCode?: string;
  networkErrorStack?: string;
}

export class LiveChatError extends Error {
  details: LiveChatFailureDetails;

  constructor(details: LiveChatFailureDetails) {
    super(details.safeMessage);
    this.name = 'LiveChatError';
    this.details = details;
  }
}

export function resolveChatCompletionsUrl(baseUrl: string): string {
  const normalized = (baseUrl || '').trim().replace(/\/+$/, '');
  if (!normalized) {
    return '';
  }

  if (/\/chat\/completions$/i.test(normalized)) {
    return normalized;
  }

  return normalized + '/chat/completions';
}

export function callOpenAICompatibleChat(request: LiveChatRequest): Promise<LiveChatResult> {
  return new Promise<LiveChatResult>((resolve, reject) => {
    executeLiveChatRequest(request, true)
      .then(resolve)
      .catch((error: LiveChatError) => {
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

function readAssistantResponse(responseBody: any): { text: string; finishReason: string } {
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
    } catch (error) {
      return { text: '', finishReason: finishReason };
    }
  }

  if (Array.isArray(message.content)) {
    const textParts: string[] = [];
    message.content.forEach((part: any) => {
      if (part && typeof part.text === 'string') {
        textParts.push(part.text);
      }
    });
    return { text: textParts.join('\n').trim(), finishReason: finishReason };
  }

  return { text: '', finishReason: finishReason };
}

function executeLiveChatRequest(request: LiveChatRequest, preferStructuredJson: boolean): Promise<LiveChatResult> {
  return new Promise<LiveChatResult>((resolve, reject) => {
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
    const url = new URL(endpoint);
    const payloadObject: any = {
      model: request.model,
      temperature: request.temperature,
      messages: buildMessages(request)
    };
    if (preferStructuredJson && request.structuredOutput !== false) {
      payloadObject.response_format = { type: 'json_object' };
    }
    const payload = JSON.stringify(payloadObject);
    const requestPayloadForLogs = safeStringifyForLogs(payloadObject);
    const transport = url.protocol === 'https:' ? httpsRequest : httpRequest;
    request.logger.debug(
      '[mock-harness] live chat request endpoint=%s method=POST auth=%s payloadBytes=%s payload=%s',
      endpoint,
      maskApiKey(request.apiKey),
      Buffer.byteLength(payload, 'utf8'),
      requestPayloadForLogs
    );
    const req = transport(
      {
        method: 'POST',
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + (url.search || ''),
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer ' + request.apiKey
        }
      },
      (response: any) => {
        const chunks: string[] = [];
        response.on('data', (chunk: Buffer | string) => {
          chunks.push(typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
        });
        response.on('end', () => {
          const raw = chunks.join('');
          const latencyMs = Date.now() - startedAt;
          const statusCode = typeof response.statusCode === 'number' ? response.statusCode : 0;
          const responseBytes = Buffer.byteLength(raw, 'utf8');
          request.logger.debug(
            '[mock-harness] live chat response endpoint=%s status=%s latencyMs=%s responseBytes=%s',
            endpoint,
            statusCode,
            latencyMs,
            responseBytes
          );
          let parsed: any = {};
          try {
            parsed = raw ? JSON.parse(raw) : {};
          } catch (error) {
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
            const providerErrorMessage = (
              parsed && parsed.error && typeof parsed.error.message === 'string'
                ? parsed.error.message
                : 'Live provider request failed.'
            );
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
      }
    );

    req.on('error', (error: Error) => {
      reject(new LiveChatError({
        endpoint: endpoint,
        model: request.model,
        statusCode: 0,
        latencyMs: Date.now() - startedAt,
        responseBytes: 0,
        safeMessage: error && error.message ? error.message : 'Network error while calling live provider.',
        requestPayload: requestPayloadForLogs,
        networkErrorCode: (error as any).code || '',
        networkErrorStack: error && error.stack ? truncateForLogs(error.stack) : ''
      }));
    });
    req.write(payload);
    req.end();
  });
}

function buildMessages(request: LiveChatRequest): any[] {
  const messages: any[] = [{ role: 'system', content: request.systemPrompt }];
  const hasContextRoute = typeof request.contextRoute === 'string' && request.contextRoute.trim().length > 0;
  const hasContextPersona = typeof request.contextPersona === 'string' && request.contextPersona.trim().length > 0;
  const hasFocus = request.contextFocus !== null && request.contextFocus !== undefined;
  const hasModuleFlags = request.contextModuleFlags !== null && request.contextModuleFlags !== undefined;
  const hasFlags = request.contextFlags !== null && request.contextFlags !== undefined;
  const hasView = request.contextView !== null && request.contextView !== undefined;
  const hasInstitute = request.contextInstitute !== null && request.contextInstitute !== undefined;
  const hasFormOptions = request.contextFormOptions !== null && request.contextFormOptions !== undefined;
  if (hasContextRoute || hasContextPersona || hasFocus || hasModuleFlags || hasFlags || hasView || hasInstitute || hasFormOptions) {
    const contextLines: string[] = ['Host context:'];
    contextLines.push('route=' + (hasContextRoute ? request.contextRoute!.trim() : '(unknown)'));
    contextLines.push('persona=' + (hasContextPersona ? request.contextPersona!.trim() : '(unknown)'));
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

function maskApiKey(apiKey: string): string {
  if (!apiKey) {
    return '(missing)';
  }
  if (apiKey.length <= 8) {
    return '***';
  }
  return apiKey.slice(0, 4) + '...' + apiKey.slice(-4);
}

function truncateForLogs(value: string, maxLength: number = 1200): string {
  if (!value) {
    return '';
  }
  if (value.length <= maxLength) {
    return value;
  }
  return value.slice(0, maxLength) + '... (truncated)';
}

function safeStringifyForLogs(value: any): string {
  try {
    return truncateForLogs(JSON.stringify(value));
  } catch (error) {
    return '[unserializable]';
  }
}

function safeStringifyForPrompt(value: any): string {
  try {
    return JSON.stringify(value);
  } catch (error) {
    return '[unserializable]';
  }
}

function shouldRetryWithoutStructuredFormat(error: LiveChatError): boolean {
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
