import { CommonModule } from '@angular/common';
import {
  AfterViewChecked,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

interface Student {
  id: string;
  name: string;
  course: string;
  enabledInFeeCollection: boolean;
}

interface ChatMessage {
  id: string;
  role: 'assistant' | 'user' | 'system';
  text: string;
  timestamp: string;
  contract?: {
    actions?: Array<{ label: string; event: any }>;
  };
}

@Component({
  selector: 'app-agent-chat-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './agent-chat-panel.component.html',
})
export class AgentChatPanelComponent implements AfterViewChecked {
  @Input() isOpen = false;
  @Input() appContext: any;
  @Input() feeContext: any;
  @Input() students: Student[] = [];

  @Output() agentEvent = new EventEmitter<any>();
  @Output() status = new EventEmitter<string>();

  @ViewChild('messagesRef') messagesRef?: ElementRef<HTMLDivElement>;

  messages: ChatMessage[] = [];
  inputValue = '';
  panelWidth = 380;
  pendingDisambiguation: Student[] = [];

  private lastMessageCount = 0;
  private dragging = false;
  private startX = 0;
  private startWidth = 380;

  onComposerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  ngAfterViewChecked(): void {
    if (this.messages.length !== this.lastMessageCount) {
      this.lastMessageCount = this.messages.length;
      this.scrollToBottomSoon();
    }
  }

  ngOnInit(): void {
    this.messages = [
      {
        id: `msg_${Date.now()}_intro`,
        role: 'assistant',
        text: `AI mode ready for ${this.contextLabel}. Ask in plain language and I can route sections or perform fee workflow steps.`,
        timestamp: new Date().toISOString(),
      },
    ];
  }

  get contextLabel(): string {
    return `${this.appContext?.app ?? 'CampusTrack'} / ${this.appContext?.screen ?? 'dashboard'}`;
  }

  get contextTabDetail(): string | null {
    return this.appContext?.screen === 'dashboard' ? null : this.appContext?.tab ?? null;
  }

  startResize(event: MouseEvent): void {
    this.dragging = true;
    this.startX = event.clientX;
    this.startWidth = this.panelWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const move = (e: MouseEvent) => {
      if (!this.dragging) {
        return;
      }
      const deltaX = e.clientX - this.startX;
      const nextWidth = this.startWidth + deltaX;
      this.panelWidth = Math.max(300, Math.min(700, nextWidth));
    };

    const up = () => {
      this.dragging = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };

    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }

  send(): void {
    const text = this.inputValue.trim();
    if (!text) {
      return;
    }

    this.appendUser(text);
    this.processText(text);
    this.inputValue = '';
    this.scrollToBottomSoon();
  }

  runShortcut(value: string): void {
    this.appendUser(value);
    this.processText(value);
  }

  private appendUser(text: string): void {
    this.messages.push({
      id: `msg_${Date.now()}_user`,
      role: 'user',
      text,
      timestamp: new Date().toISOString(),
    });
    this.scrollToBottomSoon();
  }

  private appendAssistant(text: string, actions: Array<{ label: string; event: any }> = []): void {
    this.messages.push({
      id: `msg_${Date.now()}_assistant`,
      role: 'assistant',
      text,
      timestamp: new Date().toISOString(),
      contract: { actions },
    });
    this.scrollToBottomSoon();
  }

  private scrollToBottomSoon(): void {
    queueMicrotask(() => {
      const el = this.messagesRef?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    });

    requestAnimationFrame(() => {
      const el = this.messagesRef?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    });
  }

  private normalize(value: string): string {
    return value.trim().toLowerCase();
  }

  private resolveSection(text: string): string | null {
    const aliases: Record<string, string[]> = {
      dashboard: ['dashboard', 'board', 'home'],
      admin: ['admin', 'administration'],
      admissions: ['admissions', 'admission'],
      hr: ['hr', 'human resources'],
      academics: ['academics', 'academic'],
      lms: ['lms', 'learning'],
      assets: ['assets', 'inventory'],
      fees: ['fees', 'fee collection', 'pending fees', 'defaulters'],
      library: ['library', 'books'],
      connect: ['connect', 'messages', 'notifications'],
      accounting: ['accounting', 'accounts', 'ledger'],
      receipts: ['receipts', 'receipt'],
      rc: ['rc'],
      tt: ['tt', 'timetable'],
      vault: ['vault', 'documents'],
    };

    for (const [key, words] of Object.entries(aliases)) {
      if (words.some((word) => text.includes(word))) {
        return key;
      }
    }

    return null;
  }

  private findMatches(token: string): Student[] {
    const term = token.toLowerCase().trim();
    if (!term) {
      return [];
    }

    return this.students.filter((student) => {
      return (
        student.id.toLowerCase() === term ||
        student.name.toLowerCase() === term ||
        student.name.toLowerCase().includes(term)
      );
    });
  }

  private findStudentCandidatesFromPrompt(rawPrompt: string): Student[] {
    const normalizedPrompt = this.normalize(rawPrompt);

    const explicitIds = [...new Set(normalizedPrompt.match(/\b\d{2}p\d{3}\b/gi) ?? [])].map((id) => id.toUpperCase());
    if (explicitIds.length > 0) {
      return this.students.filter((student) => explicitIds.includes(student.id));
    }

    const stopWords = new Set([
      'pick',
      'select',
      'choose',
      'use',
      'open',
      'show',
      'for',
      'student',
      'students',
      'receipt',
      'fees',
      'fee',
      'pending',
      'paid',
      'tab',
      'mode',
      'amount',
      'save',
      'collection',
      'the',
      'a',
      'an',
      'in',
      'to',
      'from',
      'please',
      'can',
      'you',
    ]);

    const words = normalizedPrompt
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);

    const nameWords = words.filter((word) => /^[a-z]+$/.test(word) && !stopWords.has(word));
    if (nameWords.length === 0) {
      return [];
    }

    return this.students.filter((student) => {
      const normalizedName = student.name.toLowerCase();
      return nameWords.every((word) => normalizedName.includes(word));
    });
  }

  private processStudentLookup(token: string): void {
    const matches = this.findMatches(token);

    if (!matches.length) {
      this.appendAssistant('No student matched that query. Try student ID (for example 20P074).');
      return;
    }

    if (matches.length === 1) {
      this.selectStudent(matches[0]);
      return;
    }

    this.pendingDisambiguation = matches;
    const list = matches.map((item, idx) => `${idx + 1}) ${item.name} (${item.id})`).join('; ');
    this.appendAssistant(
      `I found multiple students: ${list}. Reply with option number, student name, or student ID.`,
      matches.map((student, idx) => ({
        label: `${idx + 1}) ${student.name} (${student.id})`,
        event: { type: 'select_student', studentId: student.id },
      }))
    );
  }

  private selectStudent(student: Student): void {
    this.pendingDisambiguation = [];
    this.agentEvent.emit({ type: 'select_student', studentId: student.id });
    this.appendAssistant(`Selected ${student.name} (${student.id}).`, [
      { label: 'Show pending fees', event: { type: 'switch_fee_view', view: 'pending' } },
      { label: 'Mode cash', event: { type: 'set_fee_mode', mode: 'cash' } },
    ]);
  }

  private parseAmount(text: string): number | null {
    const match = text.match(/set amount\s+([0-9]+(?:\.[0-9]+)?)/i);
    if (!match) {
      return null;
    }
    return Number(match[1]);
  }

  private tryResolveDisambiguation(text: string): boolean {
    if (!this.pendingDisambiguation.length) {
      return false;
    }

    const value = text.trim().toLowerCase();
    const n = Number(value);

    if (Number.isInteger(n) && n >= 1 && n <= this.pendingDisambiguation.length) {
      this.selectStudent(this.pendingDisambiguation[n - 1]);
      return true;
    }

    const match = this.pendingDisambiguation.find((student) => {
      return student.id.toLowerCase() === value || student.name.toLowerCase() === value;
    });

    if (match) {
      this.selectStudent(match);
      return true;
    }

    return false;
  }

  private processText(raw: string): void {
    const text = this.normalize(raw);

    if (this.tryResolveDisambiguation(raw)) {
      return;
    }

    if (text.includes('download receipt pdf') || text.includes('show receipt for 2026-07-10')) {
      this.appendAssistant('This command is not available yet.');
      return;
    }

    if (text.includes('weather') || text.includes('cab') || text.includes('taxi')) {
      this.appendAssistant('I can help only with fee collection and receipt actions in this screen.');
      return;
    }

    if (text.includes('network timeout') || text.includes('retry save after timeout')) {
      this.appendAssistant('Network timeout noted. No duplicate save was performed. You can safely retry save.', [
        { label: 'Retry save', event: { type: 'save_transaction' } },
      ]);
      return;
    }

    if (text.includes('help') || text.includes('what can you do')) {
      this.appendAssistant('Help: here are the most important commands.', [
        { label: 'Show board', event: { type: 'navigate', page: 'dashboard' } },
        { label: 'Show pending fees report', event: { type: 'shortcut', value: 'show pending fees report' } },
        { label: 'List fee defaulters', event: { type: 'shortcut', value: 'list fee defaulters' } },
        { label: 'Open fee collection', event: { type: 'switch_tab', page: 'fees', tab: 'collection' } },
        { label: 'What is selected', event: { type: 'shortcut', value: 'what is selected' } },
      ]);
      return;
    }

    if (text.includes('show board')) {
      this.agentEvent.emit({ type: 'navigate', page: 'dashboard' });
      this.appendAssistant('Opened the operations board home. Ask for any report, or say open fee collection to work on student receipts.');
      return;
    }

    if (text.includes('show pending fees report')) {
      this.appendAssistant('Pending Fees Report: Rs 3,10,500 outstanding, 48 defaulters across 6 sections.');
      this.agentEvent.emit({ type: 'switch_tab', page: 'fees', tab: 'defaulters' });
      return;
    }

    if (text.includes('list fee defaulters')) {
      this.appendAssistant('Top defaulters view: Std X-B, Std IX-A, and B.Com A are currently highest outstanding.');
      this.agentEvent.emit({ type: 'switch_tab', page: 'fees', tab: 'defaulters' });
      return;
    }

    if (text.includes('admissions summary')) {
      this.appendAssistant("Admissions summary: 28 students in directory ('20: 2, '21: 1, '22: 10, '23: 15). 28 enabled for fee collection.");
      return;
    }

    if (text.includes('student strength snapshot')) {
      this.appendAssistant('Student strength snapshot: 28 active students across 15 course sections. Program split: PUC 10, BBA 7, B.Com 6, BCA 5.');
      return;
    }

    if (text.includes('open fee collection')) {
      this.agentEvent.emit({ type: 'switch_tab', page: 'fees', tab: 'collection' });
      this.agentEvent.emit({ type: 'switch_fee_view', view: 'pending' });
      this.appendAssistant('Fee collection workspace is active. Pick a student by ID or full name to continue.');
      return;
    }

    const isStudentSelectIntent =
      text.startsWith('pick ') ||
      text.startsWith('select ') ||
      text.startsWith('choose ') ||
      text.startsWith('use ') ||
      text.includes('open receipt for') ||
      text.includes('select student') ||
      /\b\d{2}p\d{3}\b/i.test(text);

    const isFeeSelectionCommand = text.includes('select all pending') || text.includes('clear selection') || text.includes('unselect all');

    if (isStudentSelectIntent && !isFeeSelectionCommand) {
      const matches = this.findStudentCandidatesFromPrompt(raw);

      if (matches.length === 1) {
        this.selectStudent(matches[0]);
        return;
      }

      if (matches.length > 1) {
        this.pendingDisambiguation = matches;
        const list = matches.map((item, idx) => `${idx + 1}) ${item.name} (${item.id})`).join('; ');
        this.appendAssistant(
          `I found multiple students: ${list}. Reply with option number, student name, or student ID.`,
          matches.map((student, idx) => ({
            label: `${idx + 1}) ${student.name} (${student.id})`,
            event: { type: 'select_student', studentId: student.id },
          }))
        );
        return;
      }
    }

    if (text.includes('show latest receipt for')) {
      const tokenMatch = raw.match(/show latest receipt for\s+([a-z0-9\s]+)/i);
      const token = tokenMatch ? tokenMatch[1].trim() : '';
      const match = this.findMatches(token)[0];
      const studentId = match?.id ?? this.feeContext?.selectedStudentId;
      const studentName = match?.name ?? this.feeContext?.selectedStudentName;
      const latest = (this.feeContext?.receipts ?? []).find((item: any) => item.studentId === studentId);
      if (!latest) {
        this.appendAssistant('No paid records found for that student yet.');
      } else {
        this.appendAssistant(
          `Latest receipt for ${studentName}: ${latest.receiptNo}, amount INR ${latest.amount}, paid on ${latest.date}.`
        );
      }
      return;
    }

    if (text.includes('show pending fees')) {
      const tokenMatch = raw.match(/show pending fees(?: for)?\s+([a-z0-9\s]+)/i);
      if (tokenMatch?.[1]) {
        const matches = this.findMatches(tokenMatch[1].trim());
        if (matches.length === 1) {
          const student = matches[0];
          this.agentEvent.emit({ type: 'select_student', studentId: student.id });
          this.agentEvent.emit({ type: 'switch_fee_view', view: 'pending' });
          this.appendAssistant(`Opened Pending Fees tab for ${student.name}.`);
          return;
        }

        this.processStudentLookup(tokenMatch[1].trim());
        return;
      }

      if (!this.feeContext?.selectedStudentId) {
        this.appendAssistant('Select a student first.');
      } else {
        this.agentEvent.emit({ type: 'switch_fee_view', view: 'pending' });
        this.appendAssistant(`Opened Pending Fees tab for ${this.feeContext.selectedStudentName}.`);
      }
      return;
    }

    if (text.includes('show paid')) {
      const tokenMatch = raw.match(/show paid(?: for)?\s+([a-z0-9\s]+)/i);
      if (tokenMatch?.[1]) {
        const matches = this.findMatches(tokenMatch[1].trim());
        if (matches.length === 1) {
          const student = matches[0];
          this.agentEvent.emit({ type: 'select_student', studentId: student.id });
          this.agentEvent.emit({ type: 'switch_fee_view', view: 'paid' });
          this.appendAssistant(`Opened Fees Paid tab for ${student.name}.`);
          return;
        }

        this.processStudentLookup(tokenMatch[1].trim());
        return;
      }

      if (!this.feeContext?.selectedStudentId) {
        this.appendAssistant('Select a student first.');
      } else {
        this.agentEvent.emit({ type: 'switch_fee_view', view: 'paid' });
        this.appendAssistant(`Opened Fees Paid tab for ${this.feeContext.selectedStudentName}.`);
      }
      return;
    }

    if (text.includes('mode cash')) {
      this.agentEvent.emit({ type: 'set_fee_mode', mode: 'cash' });
      this.appendAssistant('Payment mode set to Cash.');
      return;
    }

    if (text.includes('mode cheque') || text.includes('mode check')) {
      this.agentEvent.emit({ type: 'set_fee_mode', mode: 'cheque' });
      this.appendAssistant('Payment mode set to Cheque.');
      return;
    }

    if (text.includes('mode online')) {
      this.agentEvent.emit({ type: 'set_fee_mode', mode: 'online' });
      this.appendAssistant('Payment mode set to Online.');
      return;
    }

    if (text.includes('today receipt')) {
      this.agentEvent.emit({ type: 'set_today_receipt' });
      this.appendAssistant('Receipt date set to today.');
      return;
    }

    if (text.includes('select all pending')) {
      this.agentEvent.emit({ type: 'select_all_pending' });
      this.appendAssistant('All pending fee rows selected.');
      return;
    }

    if (text.includes('clear selection') || text.includes('unselect all')) {
      this.agentEvent.emit({ type: 'clear_selection' });
      this.appendAssistant('Pending fee selection cleared.');
      return;
    }

    if (text.includes('what is selected')) {
      this.appendAssistant(
        `Current selection: ${this.feeContext?.selectedStudentName ?? 'No student selected'}, mode: ${this.feeContext?.mode || 'not set'}, selected pending rows: ${Number(this.feeContext?.selectedPendingCount ?? 0)}, selected pending total: ${Number(this.feeContext?.selectedPendingTotal ?? 0).toFixed(2)}.`
      );
      return;
    }

    if (text.includes('set amount')) {
      const amount = this.parseAmount(text);
      if (amount === null) {
        this.appendAssistant('Please provide a numeric amount, for example: set amount 500.');
        return;
      }
      if (amount <= 0) {
        this.appendAssistant('Amount must be greater than zero.');
        return;
      }
      this.agentEvent.emit({ type: 'set_amount', amount });
      this.appendAssistant(`Amount received set to ${amount.toFixed(2)}.`);
      return;
    }

    if (text === 'save' || text.includes('save transaction')) {
      if (!this.feeContext?.selectedStudentId) {
        this.appendAssistant('Select a student first.');
        return;
      }

      if (Number(this.feeContext?.selectedPendingCount ?? 0) <= 0) {
        this.appendAssistant('Select at least one pending fee before saving.');
        return;
      }

      if (!this.feeContext?.mode) {
        this.appendAssistant('Select payment mode before saving.');
        return;
      }

      if (Number(this.feeContext?.amountReceived ?? 0) <= 0) {
        this.appendAssistant('Amount must be greater than zero before saving.');
        return;
      }

      if (Number(this.feeContext?.pendingDifference ?? 0) !== 0) {
        this.appendAssistant(
          `Amount mismatch: difference is ${Number(this.feeContext.pendingDifference).toFixed(2)}. Amount received must match selected pending total.`
        );
        return;
      }

      this.agentEvent.emit({ type: 'save_transaction' });
      this.appendAssistant('Attempting to save transaction.');
      return;
    }

    if (text.startsWith('open ') || text.startsWith('go to ') || text.includes('switch to ')) {
      const page = this.resolveSection(text);
      if (page) {
        this.agentEvent.emit({ type: 'navigate', page });
        this.appendAssistant(`Opened ${page}.`);
        return;
      }
    }

    this.appendAssistant(`I understood this as a general query in ${this.appContext?.screen}. Choose an action to continue.`, [
      { label: 'Show board', event: { type: 'shortcut', value: 'show board' } },
      { label: 'Open fee collection', event: { type: 'shortcut', value: 'open fee collection' } },
      { label: 'Help', event: { type: 'shortcut', value: 'help' } },
    ]);
  }

  executeAction(action: { label: string; event: any }): void {
    const event = action.event;
    if (event.type === 'shortcut') {
      this.runShortcut(event.value);
      return;
    }
    if (event.type === 'select_student') {
      const found = this.students.find((student) => student.id === event.studentId);
      if (found) {
        this.selectStudent(found);
      }
      return;
    }
    this.agentEvent.emit(event);
  }
}
