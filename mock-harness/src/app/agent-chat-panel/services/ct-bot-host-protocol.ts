export const hostProtocolVersion = '1.0';

// Minimal stub types used by the mock harness. These are intentionally
// permissive `any`/simplified shapes to allow compilation and runtime.
export type AssistantAction = any;
export type AssistantMessageBlock = any;
export type HarnessAssistantResponse = any;
export type HarnessErrorResponse = any;
export type HostContextBag = any;
export type HostEmitEvent = any;
export type HostResponseAgent = any;
export type HostToHarnessMessage = any;
export type HostUserMessage = any;

export const hostProtocolCapabilities = ['dynamicForms', 'buddyMount'];

export type HostProtocolCapabilities = string[];
