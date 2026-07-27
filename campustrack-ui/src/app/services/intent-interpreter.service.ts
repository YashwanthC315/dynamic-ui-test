import { Injectable } from '@angular/core';

export type StudentIntent =
  | {
      type: 'select_student';
      studentReference?: string;
      confidence: number;
      source: 'rule';
    }
  | {
      type: 'open_receipt';
      studentReference?: string;
      confidence: number;
      source: 'rule';
    }
  | {
      type: 'unknown';
      confidence: number;
      source: 'rule';
    };

export type AssistantCommand =
  | {
      type: 'student.select';
      studentReference: string;
    }
  | {
      type: 'receipt.open';
      studentReference: string;
    };

export type InterpretationResult =
  | {
      status: 'resolved';
      command: AssistantCommand;
      intent: StudentIntent;
    }
  | {
      status: 'needs_clarification';
      question: string;
      missing: Array<'student'>;
      intent: StudentIntent;
    }
  | {
      status: 'unrecognized';
      intent: StudentIntent;
    };

export interface ConversationContext {
  selectedStudentId?: string;
}

const STUDENT_ID_PATTERN = /\b\d{2}p\d{3}\b/i;

const SELECT_STUDENT_PATTERNS: RegExp[] = [
  /^(pick|select|choose)\s+(student\s+)?(.+)$/i,
  /^use\s+(student\s+)?(.+)$/i,
  /\bselect\s+(the\s+)?student\b/i,
];

const OPEN_RECEIPT_PATTERNS: RegExp[] = [
  /\bopen\s+(the\s+)?receipt\s+for\b/i,
  /\bshow\s+(me\s+)?(?:the\s+)?receipt\s+for\b/i,
  /\bview\s+(the\s+)?receipt\s+for\b/i,
  /\bopen\s+receipt\b/i,
];

function normalizePrompt(input: string): string {
  return input
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[.,!?]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function matchesAny(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function cleanReference(text: string): string | undefined {
  const cleaned = text
    .replace(/^(for|student|the)\s+/i, '')
    .replace(/\s+(please|now)$/i, '')
    .trim();
  return cleaned || undefined;
}

function extractStudentReference(text: string): string | undefined {
  const explicitId = text.match(STUDENT_ID_PATTERN)?.[0]?.toUpperCase();
  if (explicitId) {
    return explicitId;
  }

  const selectMatch = text.match(/^(?:pick|select|choose|use)\s+(?:student\s+)?(.+)$/i);
  if (selectMatch?.[1]) {
    return cleanReference(selectMatch[1]);
  }

  const openReceiptMatch = text.match(/\b(?:open|show|view)\s+(?:me\s+)?(?:the\s+)?receipt\s+for\s+(.+)$/i);
  if (openReceiptMatch?.[1]) {
    return cleanReference(openReceiptMatch[1]);
  }

  return undefined;
}

function hasNegatedAction(text: string): boolean {
  return /\b(do not|don't|dont|not)\s+(pick|select|choose|use|open|show|view)\b/i.test(text);
}

@Injectable({ providedIn: 'root' })
export class RuleBasedIntentInterpreter {
  interpret(input: string, context: ConversationContext = {}): InterpretationResult {
    const text = normalizePrompt(input);

    if (!text || hasNegatedAction(text)) {
      return {
        status: 'unrecognized',
        intent: { type: 'unknown', confidence: 0, source: 'rule' },
      };
    }

    const isOpenReceiptIntent = matchesAny(text, OPEN_RECEIPT_PATTERNS);
    const isSelectStudentIntent = matchesAny(text, SELECT_STUDENT_PATTERNS);

    if (isOpenReceiptIntent) {
      const extractedReference = extractStudentReference(text);
      const resolvedReference = extractedReference ?? context.selectedStudentId;
      const confidence = extractedReference ? 0.95 : context.selectedStudentId ? 0.82 : 0.65;
      const intent: StudentIntent = {
        type: 'open_receipt',
        studentReference: resolvedReference,
        confidence,
        source: 'rule',
      };

      if (!resolvedReference || confidence < 0.8) {
        return {
          status: 'needs_clarification',
          question: 'Which student receipt should I open?',
          missing: ['student'],
          intent,
        };
      }

      return {
        status: 'resolved',
        command: {
          type: 'receipt.open',
          studentReference: resolvedReference,
        },
        intent,
      };
    }

    if (isSelectStudentIntent) {
      const extractedReference = extractStudentReference(text);
      const resolvedReference = extractedReference ?? context.selectedStudentId;
      const confidence = extractedReference ? 0.9 : context.selectedStudentId ? 0.8 : 0.6;
      const intent: StudentIntent = {
        type: 'select_student',
        studentReference: resolvedReference,
        confidence,
        source: 'rule',
      };

      if (!resolvedReference || confidence < 0.8) {
        return {
          status: 'needs_clarification',
          question: 'Which student should I select?',
          missing: ['student'],
          intent,
        };
      }

      return {
        status: 'resolved',
        command: {
          type: 'student.select',
          studentReference: resolvedReference,
        },
        intent,
      };
    }

    return {
      status: 'unrecognized',
      intent: { type: 'unknown', confidence: 0, source: 'rule' },
    };
  }
}
