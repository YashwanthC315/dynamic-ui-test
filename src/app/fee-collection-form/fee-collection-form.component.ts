import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import studentDirectory from '../data/student-directory.json';

type PaymentMode = 'cash' | 'cheque' | 'online';

interface Student {
  id: string;
  name: string;
  course: string;
}

interface StudentDirectoryEntry extends Student {
  enabledInFeeCollection: boolean;
}

interface PendingFee {
  id: string;
  description: string;
  amount: number;
  dueDate: string;
}

interface PaidFee {
  receiptNo: string;
  description: string;
  amount: number;
  paidOn: string;
  mode: PaymentMode;
}

export interface ChatOption {
  label: string;
  prompt: string;
}

export interface ChatPromptResponse {
  text: string;
  options?: ChatOption[];
}

@Component({
  selector: 'app-fee-collection-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './fee-collection-form.component.html',
  styleUrl: './fee-collection-form.component.css',
})
export class FeeCollectionFormComponent {
  readonly title = 'Fee Collection';

  readonly paymentModes: PaymentMode[] = ['cash', 'cheque', 'online'];
  readonly students: Student[] = (studentDirectory as StudentDirectoryEntry[])
    .filter((student) => student.enabledInFeeCollection)
    .map(({ id, name, course }) => ({ id, name, course }));

  readonly pendingFeesByStudent: Record<string, PendingFee[]> = {
    '20P074': [
      { id: 'pf1', description: 'Tuition Fee August 2020', amount: 100, dueDate: '2026-07-20' },
      { id: 'pf2', description: 'Lab Fee August 2020', amount: 250, dueDate: '2026-07-20' },
      { id: 'pf3', description: 'Exam Fee Term 1', amount: 150, dueDate: '2026-07-25' },
    ],
    '20P050': [
      { id: 'pf4', description: 'Tuition Fee July 2020', amount: 300, dueDate: '2026-07-20' },
      { id: 'pf5', description: 'Sports Fee', amount: 100, dueDate: '2026-07-20' },
    ],
    '21P101': [{ id: 'pf6', description: 'Admission Fee Balance', amount: 500, dueDate: '2026-07-30' }],
    '22P090': [
      { id: 'pf7', description: 'Computer Fee', amount: 450, dueDate: '2026-07-28' },
      { id: 'pf8', description: 'Miscellaneous', amount: 150, dueDate: '2026-08-01' },
    ],
    '23P104': [
      { id: 'pf9', description: 'Tuition Fee September 2026', amount: 400, dueDate: '2026-09-20' },
      { id: 'pf10', description: 'Lab Fee September 2026', amount: 200, dueDate: '2026-09-20' },
    ],
  };

  readonly paidFeesByStudent: Record<string, PaidFee[]> = {
    '20P074': [
      {
        receiptNo: '1/BTLCOL',
        description: 'Admission Fee',
        amount: 1500,
        paidOn: '2026-06-01',
        mode: 'online',
      },
      {
        receiptNo: '2/BTLCOL',
        description: 'Computer Fee',
        amount: 800,
        paidOn: '2026-06-10',
        mode: 'cash',
      },
    ],
    '20P050': [
      {
        receiptNo: '3/BTLCOL',
        description: 'Term Fee',
        amount: 1000,
        paidOn: '2026-05-20',
        mode: 'cheque',
      },
    ],
    '21P101': [],
    '22P090': [],
  };

  readonly form = this.fb.group({
    studentSearch: [''],
    receiptDate: [this.today(), Validators.required],
    amountReceived: [0, [Validators.required, Validators.min(0.01)]],
    paymentMode: [''],
    adjustmentAmount: [{ value: false, disabled: true }],
  });

  selectedStudent: Student | null = null;
  selectedPendingFeeIds = new Set<string>();
  activeTab: 'pending' | 'paid' = 'pending';
  saveClicked = false;
  private pendingDisambiguation: Student[] = [];
  private pendingSuggestedPrompt: string | null = null;
  private lastSavedFingerprint: string | null = null;

  constructor(private readonly fb: FormBuilder) {
    this.form.controls.amountReceived.valueChanges.subscribe(() => {
      this.syncAdjustmentControl();
    });
  }

  commitStudentSearchSelection(): void {
    const rawInput = this.form.controls.studentSearch.value ?? '';
    const normalizedInput = this.normalizePrompt(rawInput);
    if (!normalizedInput) {
      return;
    }

    const explicitId = normalizedInput.match(/\b\d{2}p\d{3}\b/i)?.[0]?.toUpperCase();
    if (explicitId) {
      const byId = this.students.find((student) => student.id === explicitId);
      if (byId) {
        this.selectStudent(byId);
        return;
      }
    }

    const exactNameMatches = this.students.filter((student) => this.normalizePrompt(student.name) === normalizedInput);
    if (exactNameMatches.length === 1) {
      this.selectStudent(exactNameMatches[0]);
      return;
    }

    const includeMatches = this.students.filter((student) => {
      const composed = this.normalizePrompt(`${student.name} (${student.id})`);
      return composed.includes(normalizedInput);
    });

    if (includeMatches.length === 1) {
      this.selectStudent(includeMatches[0]);
    }
  }

  handleChatPrompt(prompt: string): string | ChatPromptResponse {
    const normalized = this.normalizePrompt(prompt);
    if (!normalized) {
      return 'Please enter a command. Try "help" to see supported fee collection commands.';
    }

    if (this.pendingSuggestedPrompt) {
      if (this.isAffirmative(normalized)) {
        const suggested = this.pendingSuggestedPrompt;
        this.pendingSuggestedPrompt = null;
        const result = this.handleChatPrompt(suggested);
        return `Using suggested command "${suggested}". ${result}`;
      }

      if (this.isNegative(normalized)) {
        this.pendingSuggestedPrompt = null;
        return 'Okay, suggestion cancelled. Please rephrase your command.';
      }
    }

    if (this.pendingDisambiguation.length > 0) {
      const disambiguationReply = this.resolveDisambiguation(normalized);
      if (disambiguationReply) {
        return disambiguationReply;
      }
    }

    if (this.isHelpIntent(normalized)) {
      return this.helpText();
    }

    if (this.isOutOfScopeIntent(normalized)) {
      return 'I can help only with fee collection and receipt actions in this screen. Try: pick <student id>, set amount 500, mode cash, show paid tab, or save.';
    }

    const recoveryReply = this.handleRecoveryPrompt(normalized);
    if (recoveryReply) {
      return recoveryReply;
    }

    if (this.hasContradictoryTabIntent(normalized)) {
      return 'Did you mean show paid tab or show pending tab? Reply with one option.';
    }

    if (this.hasAnyPhrase(normalized, ['start over completely', 'reset all', 'clear everything', 'reset completely'])) {
      this.resetState(false);
      return 'Reset complete. Student selection and form fields are cleared.';
    }

    if (this.hasAnyPhrase(normalized, ['start over', 'reset', 'clear form'])) {
      this.resetState(true);
      return this.selectedStudent
        ? `Reset fields and selections for ${this.selectedStudent.name}.`
        : 'Reset form fields. Select a student to continue.';
    }

    if (this.hasAnyPhrase(normalized, ['clear selection', 'unselect all', 'deselect all'])) {
      this.selectedPendingFeeIds.clear();
      this.syncAdjustmentControl();
      return 'Cleared all selected pending fee rows.';
    }

    if (this.isFeeSelectionIntent(normalized)) {
      return this.handleFeeRowSelectionPrompt(normalized);
    }

    if (this.hasAnyPhrase(normalized, ['select all pending', 'select all fees', 'mark all pending'])) {
      if (!this.selectedStudent) {
        return 'Select a student first, then I can select all pending fees.';
      }

      for (const fee of this.pendingFees) {
        this.selectedPendingFeeIds.add(fee.id);
      }
      this.syncAdjustmentControl();
      return `Selected all pending fee rows (${this.selectedPendingFeeIds.size}).`;
    }

    if (this.isShowPaidIntent(normalized)) {
      if (!this.selectedStudent) {
        const contextStudentReply = this.tryResolveStudentFromPrompt(normalized);
        if (!this.selectedStudent) {
          return contextStudentReply ?? 'Select a student first, then I can open Fees Paid tab.';
        }
      }

      this.activeTab = 'paid';
      if (this.paidFees.length === 0) {
        return `Opened Fees Paid tab for ${this.selectedStudent.name}. No paid records yet.`;
      }

      if (normalized.includes('latest receipt') || normalized.includes('show latest receipt')) {
        const latest = this.paidFees[0];
        return `Latest receipt for ${this.selectedStudent.name}: ${latest.receiptNo}, amount ${latest.amount.toFixed(2)}, paid on ${latest.paidOn}.`;
      }

      return `Opened Fees Paid tab for ${this.selectedStudent.name}.`;
    }

    if (this.isShowPendingIntent(normalized)) {
      if (!this.selectedStudent) {
        const contextStudentReply = this.tryResolveStudentFromPrompt(normalized);
        if (!this.selectedStudent) {
          return contextStudentReply ?? 'Select a student first, then I can open Pending Fees tab.';
        }
      }

      this.activeTab = 'pending';
      if (this.pendingFees.length === 0) {
        return `Opened Pending Fees tab for ${this.selectedStudent.name}. No pending fees for this student.`;
      }

      const dataQualityNote = this.getDataQualityNote();
      if (dataQualityNote) {
        return `Opened Pending Fees tab for ${this.selectedStudent.name}. ${dataQualityNote}`;
      }

      return `Opened Pending Fees tab for ${this.selectedStudent.name}.`;
    }

    if (this.hasAnyPhrase(normalized, ['today receipt', 'receipt today', 'set date today', 'use today date'])) {
      this.form.controls.receiptDate.setValue(this.today());
      return `Set receipt date to ${this.today()}.`;
    }

    const modeFromPrompt = this.extractPaymentMode(normalized);
    if (modeFromPrompt && this.hasPaymentModeIntent(normalized)) {
      this.form.controls.paymentMode.setValue(modeFromPrompt);
      if (!normalized.includes('save')) {
        return `Payment mode set to ${this.toModeLabel(modeFromPrompt)}.`;
      }
    }

    if (normalized.includes('mode') || normalized.includes('payment mode')) {
      return 'I could not identify a payment mode. Use: mode cash, mode cheque, mode online, or paid in cash.';
    }

    if (this.isAmountIntent(normalized)) {
      const amountMatch = normalized.match(/-?\d+(?:\.\d+)?/);
      if (!amountMatch) {
        return 'Please provide a numeric amount, for example: set amount 500.';
      }

      const parsedAmount = Number(amountMatch[0]);
      if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
        return 'Amount must be greater than zero.';
      }

      this.form.controls.amountReceived.setValue(parsedAmount);
      this.syncAdjustmentControl();
      return `Amount received set to ${parsedAmount.toFixed(2)}.`;
    }

    if (this.hasAnyPhrase(normalized, ['how much is pending', 'pending total', 'how much pending', 'total pending'])) {
      if (!this.selectedStudent) {
        return 'Select a student first to view pending totals.';
      }

      const totalPending = this.pendingFees.reduce((sum, fee) => sum + fee.amount, 0);
      const dataQualityNote = this.getDataQualityNote();
      const noteSuffix = dataQualityNote ? ` ${dataQualityNote}` : '';
      return `Selected pending total: ${this.selectedPendingFeesTotal.toFixed(2)}. Overall pending total: ${totalPending.toFixed(2)}.${noteSuffix}`;
    }

    if (this.hasAnyPhrase(normalized, ['what is selected', 'status', 'summary', 'current selection', 'selected details'])) {
      return this.selectionSummary();
    }

    if (this.isSaveIntent(normalized)) {
      return this.trySaveFromChat();
    }

    const studentResult = this.tryResolveStudentFromPrompt(normalized);
    if (studentResult) {
      return studentResult;
    }

    if (this.shouldPromptForValidStudentIdentity(normalized)) {
      return 'Please enter valid student name or id';
    }

    if (this.hasAnyPhrase(normalized, ['fee', 'collect', 'collection', 'receipt'])) {
      return this.selectedStudent
        ? `Fee collection is active for ${this.selectedStudent.name}.`
        : 'Fee collection form is active. Pick a student by ID or full name to continue.';
    }

    const suggestion = this.suggestPrompt(normalized);
    if (suggestion) {
      this.pendingSuggestedPrompt = suggestion;
      return `Did you mean "${suggestion}"? Reply yes or no.`;
    }

    return 'I am focused on fee collection. Try: pick 20P074, set amount 500, mode cash, show pending tab, what is selected, or help.';
  }

  selectStudent(student: Student): void {
    this.selectedStudent = student;
    this.selectedPendingFeeIds.clear();
    this.activeTab = 'pending';
    this.form.patchValue({ studentSearch: `${student.name} (${student.id})` }, { emitEvent: false });
    this.syncAdjustmentControl();
  }

  get pendingFees(): PendingFee[] {
    if (!this.selectedStudent) {
      return [];
    }
    return this.pendingFeesByStudent[this.selectedStudent.id] ?? [];
  }

  get paidFees(): PaidFee[] {
    if (!this.selectedStudent) {
      return [];
    }
    return this.paidFeesByStudent[this.selectedStudent.id] ?? [];
  }

  isFeeSelected(id: string): boolean {
    return this.selectedPendingFeeIds.has(id);
  }

  togglePendingFee(id: string): void {
    if (this.selectedPendingFeeIds.has(id)) {
      this.selectedPendingFeeIds.delete(id);
    } else {
      this.selectedPendingFeeIds.add(id);
    }
    this.syncAdjustmentControl();
  }

  get selectedPendingFeesTotal(): number {
    return this.pendingFees
      .filter((fee) => this.selectedPendingFeeIds.has(fee.id))
      .reduce((sum, fee) => sum + fee.amount, 0);
  }

  get amountReceived(): number {
    return Number(this.form.controls.amountReceived.value ?? 0);
  }

  get pendingDifference(): number {
    return this.amountReceived - this.selectedPendingFeesTotal;
  }

  get canSave(): boolean {
    const hasSelectedStudent = !!this.selectedStudent;
    const hasAtLeastOnePendingSelection = this.selectedPendingFeeIds.size > 0;
    const hasPaymentMode = !!this.form.controls.paymentMode.value;
    const amountMatchesSelectedTotal = this.amountReceived === this.selectedPendingFeesTotal;

    return (
      hasSelectedStudent &&
      hasAtLeastOnePendingSelection &&
      hasPaymentMode &&
      amountMatchesSelectedTotal &&
      this.form.controls.amountReceived.valid &&
      this.form.controls.receiptDate.valid
    );
  }

  saveTransaction(): void {
    this.saveClicked = true;
    if (!this.canSave || !this.selectedStudent) {
      return;
    }

    const nextReceiptNo = `${Math.floor(Math.random() * 9000) + 1000}/BTLCOL`;
    const paidItems = this.pendingFees.filter((fee) => this.selectedPendingFeeIds.has(fee.id));

    const totalForReceipt = paidItems.reduce((sum, fee) => sum + fee.amount, 0);

    const nextPaid: PaidFee = {
      receiptNo: nextReceiptNo,
      description: paidItems.map((item) => item.description).join(', '),
      amount: totalForReceipt,
      paidOn: this.form.controls.receiptDate.value ?? this.today(),
      mode: this.form.controls.paymentMode.value as PaymentMode,
    };

    this.paidFeesByStudent[this.selectedStudent.id] = [nextPaid, ...(this.paidFeesByStudent[this.selectedStudent.id] ?? [])];

    const selectedIds = new Set(this.selectedPendingFeeIds);
    this.pendingFeesByStudent[this.selectedStudent.id] = this.pendingFees.filter((fee) => !selectedIds.has(fee.id));

    this.selectedPendingFeeIds.clear();
    this.form.patchValue({
      amountReceived: 0,
      paymentMode: '',
      adjustmentAmount: false,
    });
    this.form.controls.adjustmentAmount.disable({ emitEvent: false });
    this.activeTab = 'paid';
  }

  private normalizePrompt(prompt: string): string {
    return prompt.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  private isHelpIntent(normalizedPrompt: string): boolean {
    return (
      normalizedPrompt === 'help' ||
      normalizedPrompt.includes('commands') ||
      normalizedPrompt.includes('what can you do') ||
      normalizedPrompt.startsWith('how do i')
    );
  }

  private hasAnyPhrase(normalizedPrompt: string, phrases: string[]): boolean {
    return phrases.some((phrase) => normalizedPrompt.includes(phrase));
  }

  private hasAnyWord(normalizedPrompt: string, words: string[]): boolean {
    return words.some((word) => new RegExp(`\\b${word}\\b`, 'i').test(normalizedPrompt));
  }

  private isShowPendingIntent(normalizedPrompt: string): boolean {
    if (normalizedPrompt === 'pending') {
      return true;
    }

    const pendingSignals = ['pending', 'due', 'unpaid'];
    const showSignals = ['show', 'open', 'view', 'list', 'display'];
    return this.hasAnyWord(normalizedPrompt, pendingSignals) && this.hasAnyWord(normalizedPrompt, showSignals);
  }

  private isShowPaidIntent(normalizedPrompt: string): boolean {
    if (normalizedPrompt === 'paid') {
      return true;
    }

    if (normalizedPrompt.includes('latest receipt')) {
      return true;
    }

    const paidSignals = ['paid', 'receipt', 'receipts', 'history'];
    const showSignals = ['show', 'open', 'view', 'list', 'display'];
    return this.hasAnyWord(normalizedPrompt, paidSignals) && this.hasAnyWord(normalizedPrompt, showSignals);
  }

  private isAmountIntent(normalizedPrompt: string): boolean {
    const amountSignals = ['amount', 'receive', 'received', 'collect', 'payment'];
    const hasNumber = /-?\d+(?:\.\d+)?/.test(normalizedPrompt);
    return hasNumber && this.hasAnyWord(normalizedPrompt, amountSignals);
  }

  private isSaveIntent(normalizedPrompt: string): boolean {
    return this.hasAnyWord(normalizedPrompt, ['save', 'submit', 'confirm', 'post']);
  }

  private isFeeSelectionIntent(normalizedPrompt: string): boolean {
    const selectSignals = ['select', 'unselect', 'deselect', 'check', 'uncheck', 'mark'];
    const feeSignals = ['fee', 'fees', 'lab', 'tuition', 'tution', 'exam', 'sports', 'computer', 'miscellaneous'];
    return this.hasAnyWord(normalizedPrompt, selectSignals) && this.hasAnyWord(normalizedPrompt, feeSignals);
  }

  private isOutOfScopeIntent(normalizedPrompt: string): boolean {
    const outOfScopeTerms = ['weather', 'cab', 'attendance', 'timetable', 'mass entry', 'password'];
    return outOfScopeTerms.some((term) => normalizedPrompt.includes(term));
  }

  private helpText(): string {
    return 'Commands: pick <id or name>, show <name> fee, show paid tab, show pending tab, set amount <number>, mode <cash|cheque|online>, paid in cash, select <fee name>, unselect <fee name>, select all pending, unselect all, what is selected, save, start over, start over completely.';
  }

  private selectionSummary(): string {
    if (!this.selectedStudent) {
      return 'No student selected. Use: pick <student id> or full name.';
    }

    const mode = this.form.controls.paymentMode.value || 'not set';
    const course = this.selectedStudent.course || 'Course not available';
    const dataQualityNote = this.getDataQualityNote();
    const noteSuffix = dataQualityNote ? ` ${dataQualityNote}` : '';
    return `Student: ${this.selectedStudent.name} (${this.selectedStudent.id}), course: ${course}, tab: ${this.activeTab}, amount: ${this.amountReceived.toFixed(2)}, mode: ${mode}, selected pending rows: ${this.selectedPendingFeeIds.size}, selected pending total: ${this.selectedPendingFeesTotal.toFixed(2)}.${noteSuffix}`;
  }

  private trySaveFromChat(): string {
    if (!this.selectedStudent) {
      return 'Select a student first.';
    }

    if (this.pendingFees.length === 0) {
      return 'No pending fees for this student.';
    }

    if (this.selectedPendingFeeIds.size === 0) {
      return 'Select at least one pending fee before saving.';
    }

    if (!this.form.controls.paymentMode.value) {
      return 'Select payment mode before saving.';
    }

    if (!this.form.controls.amountReceived.valid || this.amountReceived <= 0) {
      return 'Amount must be greater than zero before saving.';
    }

    if (this.pendingDifference !== 0) {
      return `Amount mismatch: difference is ${this.pendingDifference.toFixed(2)}. Amount received must match selected pending total.`;
    }

    const currentFingerprint = this.currentSaveFingerprint();
    if (this.lastSavedFingerprint && this.lastSavedFingerprint === currentFingerprint) {
      return 'Possible duplicate save request detected. This transaction appears to be already saved.';
    }

    this.saveTransaction();
    this.lastSavedFingerprint = currentFingerprint;
    return `Transaction saved for ${this.selectedStudent.name} and moved to Fees Paid tab.`;
  }

  private resetState(keepStudent: boolean): void {
    this.selectedPendingFeeIds.clear();
    this.pendingDisambiguation = [];
    this.form.patchValue({
      amountReceived: 0,
      paymentMode: '',
      adjustmentAmount: false,
      receiptDate: this.today(),
    });

    if (!keepStudent) {
      this.selectedStudent = null;
      this.form.patchValue({ studentSearch: '' });
    }

    this.syncAdjustmentControl();
    this.activeTab = 'pending';
  }

  private resolveDisambiguation(normalizedPrompt: string): string | ChatPromptResponse | null {
    if (normalizedPrompt === 'cancel' || normalizedPrompt === 'none') {
      this.pendingDisambiguation = [];
      return 'Cancelled selection. You can enter a different student name or ID.';
    }

    const optionNumber = Number(normalizedPrompt.match(/\b(\d{1,2})\b/)?.[1] ?? NaN);
    if (Number.isInteger(optionNumber) && optionNumber >= 1 && optionNumber <= this.pendingDisambiguation.length) {
      const student = this.pendingDisambiguation[optionNumber - 1];
      this.pendingDisambiguation = [];
      this.selectStudent(student);
      return `Selected ${student.name} (${student.id}).`;
    }

    const explicitId = normalizedPrompt.match(/\b\d{2}p\d{3}\b/i)?.[0]?.toUpperCase();
    if (explicitId) {
      const matchedStudent = this.pendingDisambiguation.find((student) => student.id === explicitId);
      if (matchedStudent) {
        this.pendingDisambiguation = [];
        this.selectStudent(matchedStudent);
        return `Selected ${matchedStudent.name} (${matchedStudent.id}).`;
      }
    }

    const nameTokens = normalizedPrompt
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
    if (nameTokens.length > 0) {
      const nameMatches = this.pendingDisambiguation.filter((student) => {
        const normalizedName = this.normalizePrompt(student.name);
        return nameTokens.every((token) => normalizedName.includes(token));
      });

      if (nameMatches.length === 1) {
        const matchedStudent = nameMatches[0];
        this.pendingDisambiguation = [];
        this.selectStudent(matchedStudent);
        return `Selected ${matchedStudent.name} (${matchedStudent.id}).`;
      }
    }

    return this.response(
      `Please choose one option by number, student name, or ID: ${this.formatStudentOptions(this.pendingDisambiguation)}.`,
      this.buildDisambiguationOptions(this.pendingDisambiguation)
    );
  }

  private tryResolveStudentFromPrompt(normalizedPrompt: string): string | ChatPromptResponse | null {
    const matches = this.findStudentCandidates(normalizedPrompt);
    if (matches.length === 0) {
      return null;
    }

    const isListIntent = normalizedPrompt.includes('show') && normalizedPrompt.includes('student');
    if (isListIntent) {
      return `Matched students: ${this.formatStudentOptions(matches)}.`;
    }

    if (matches.length === 1) {
      const student = matches[0];
      this.selectStudent(student);
      if (normalizedPrompt.includes('show') && (normalizedPrompt.includes('fee') || normalizedPrompt.includes('pending'))) {
        this.activeTab = 'pending';
        return `Showing pending fees for ${student.name} (${student.id}).`;
      }
      return `Selected ${student.name} (${student.id}).`;
    }

    this.pendingDisambiguation = matches;
    return this.response(
      `I found multiple students: ${this.formatStudentOptions(matches)}. Reply with option number, student name, or student ID.`,
      this.buildDisambiguationOptions(matches)
    );
  }

  private findStudentCandidates(normalizedPrompt: string): Student[] {
    const explicitIds = [...new Set(normalizedPrompt.match(/\b\d{2}p\d{3}\b/gi) ?? [])].map((id) => id.toUpperCase());
    if (explicitIds.length > 0) {
      return this.students.filter((student) => explicitIds.includes(student.id));
    }

    const stopWords = new Set([
      'can',
      'could',
      'would',
      'will',
      'you',
      'u',
      'please',
      'kindly',
      'quickly',
      'just',
      'me',
      'my',
      'the',
      'a',
      'an',
      'pick',
      'select',
      'open',
      'show',
      'student',
      'students',
      'for',
      'the',
      'to',
      'tab',
      'fees',
      'fee',
      'paid',
      'pending',
      'receipt',
      'set',
      'amount',
      'mode',
      'cash',
      'cheque',
      'online',
      'save',
      'what',
      'is',
      'how',
      'much',
      'in',
      'and',
      'all',
      'with',
      'switch',
      'change',
    ]);

    const courseKeywords = ['bca', 'bcom', 'bba', 'puc', 'science', 'commerce', 'pcmb'];
    const words = normalizedPrompt.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
    const nameWords = words.filter((word) => !stopWords.has(word) && !courseKeywords.includes(word));
    const courseWords = words.filter((word) => courseKeywords.includes(word));

    if (nameWords.length === 0) {
      return [];
    }

    return this.students.filter((student) => {
      const normalizedName = student.name.toLowerCase();
      const normalizedCourse = student.course.toLowerCase();
      const nameMatch = nameWords.every((word) => normalizedName.includes(word));
      const courseMatch = courseWords.every((word) => normalizedCourse.includes(word));
      return nameMatch && courseMatch;
    });
  }

  private shouldPromptForValidStudentIdentity(normalizedPrompt: string): boolean {
    const explicitId = normalizedPrompt.match(/\b\d{2}p\d{3}\b/i);
    if (explicitId) {
      return false;
    }

    const words = normalizedPrompt
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);

    const alphaWords = words.filter((word) => /^[a-z]+$/.test(word));
    if (alphaWords.length === 0) {
      return false;
    }

    const commandKeywords = new Set([
      'help',
      'commands',
      'show',
      'paid',
      'pending',
      'tab',
      'set',
      'amount',
      'mode',
      'cash',
      'cheque',
      'online',
      'today',
      'receipt',
      'save',
      'clear',
      'selection',
      'select',
      'unselect',
      'deselect',
      'all',
      'fee',
      'fees',
      'how',
      'much',
      'what',
      'status',
      'summary',
      'start',
      'over',
      'reset',
      'retry',
      'network',
      'timeout',
      'backend',
      'lookup',
      'error',
      'yes',
      'no',
      'weather',
      'cab',
      'attendance',
      'timetable',
      'password',
    ]);

    const hasLookupVerb = ['pick', 'select', 'open', 'switch', 'student', 'name'].some((term) => normalizedPrompt.includes(term));
    const unknownNameLike = alphaWords.length <= 3 && alphaWords.every((word) => !commandKeywords.has(word));

    return hasLookupVerb || unknownNameLike;
  }

  private formatStudentOptions(students: Student[]): string {
    return students.map((student, index) => `${index + 1}) ${student.name} (${student.id})`).join('; ');
  }

  private buildDisambiguationOptions(students: Student[]): ChatOption[] {
    return students.map((student, index) => ({
      label: `${index + 1}) ${student.name} (${student.id})`,
      prompt: student.id,
    }));
  }

  private response(text: string, options?: ChatOption[]): ChatPromptResponse {
    return options && options.length > 0 ? { text, options } : { text };
  }

  private hasPaymentModeIntent(normalizedPrompt: string): boolean {
    return (
      normalizedPrompt.includes('mode') ||
      normalizedPrompt.includes('payment') ||
      normalizedPrompt.includes('paid in') ||
      normalizedPrompt.includes('pay by') ||
      normalizedPrompt.includes('using') ||
      normalizedPrompt.includes('through') ||
      normalizedPrompt.includes('cash') ||
      normalizedPrompt.includes('cheque') ||
      normalizedPrompt.includes('online')
    );
  }

  private hasContradictoryTabIntent(normalizedPrompt: string): boolean {
    const hasPaidIntent = normalizedPrompt.includes('paid');
    const hasPendingIntent = normalizedPrompt.includes('pending');
    const hasTabSwitchIntent = normalizedPrompt.includes('show') || normalizedPrompt.includes('tab');
    return hasTabSwitchIntent && hasPaidIntent && hasPendingIntent;
  }

  private isAffirmative(normalizedPrompt: string): boolean {
    return ['yes', 'y', 'yeah', 'yup', 'ok', 'okay', 'sure'].includes(normalizedPrompt);
  }

  private isNegative(normalizedPrompt: string): boolean {
    return ['no', 'n', 'nope', 'cancel', 'stop'].includes(normalizedPrompt);
  }

  private suggestPrompt(normalizedPrompt: string): string | null {
    const normalizedWords = normalizedPrompt.split(' ').filter(Boolean);

    if (normalizedPrompt.includes('svae')) {
      return 'save';
    }

    if (normalizedPrompt.includes('shwo paid')) {
      return 'show paid tab';
    }

    if (normalizedPrompt.includes('shwo pending')) {
      return 'show pending tab';
    }

    if (normalizedPrompt.includes('mod cash') || normalizedPrompt.includes('mode cahs')) {
      return 'mode cash';
    }

    if (normalizedPrompt.includes('fe colletcion') || normalizedPrompt.includes('fee colletcion')) {
      return 'fee collection';
    }

    if (normalizedPrompt.includes('tution fee') && (normalizedPrompt.includes('select') || normalizedPrompt.includes('unselect'))) {
      return normalizedPrompt.replace('tution fee', 'tuition fee');
    }

    if (normalizedWords.length === 1) {
      const singleWordMap: Record<string, string> = {
        paid: 'show paid tab',
        pending: 'show pending tab',
      };
      return singleWordMap[normalizedWords[0]] ?? null;
    }

    return null;
  }

  private handleRecoveryPrompt(normalizedPrompt: string): string | null {
    if (normalizedPrompt.includes('backend lookup fail') || normalizedPrompt.includes('lookup failed')) {
      return 'Temporary lookup issue detected. Please retry in a moment, or use student ID directly as fallback.';
    }

    if (normalizedPrompt.includes('student list fail') || normalizedPrompt.includes('student list failed')) {
      return 'Student list failed to load. Please enter a full student ID manually to continue.';
    }

    if (normalizedPrompt.includes('network timeout')) {
      return 'Network timeout noted. No duplicate save was performed. You can safely retry save.';
    }

    if (normalizedPrompt.includes('retry save after timeout') || normalizedPrompt.includes('retry save')) {
      if (this.lastSavedFingerprint && this.lastSavedFingerprint === this.currentSaveFingerprint()) {
        return 'Idempotency check: this transaction already appears saved. No duplicate action taken.';
      }
      return 'Retry is safe. Run save again and I will prevent duplicates when signature matches.';
    }

    if (normalizedPrompt.includes('partial update error')) {
      return 'Partial update issue noted. Please refresh student data and retry the last action.';
    }

    return null;
  }

  private getDataQualityNote(): string | null {
    if (!this.selectedStudent) {
      return null;
    }

    const missingDueDateCount = this.pendingFees.filter((fee) => !fee.dueDate).length;
    const duplicates = this.findDuplicatePendingFeeDescriptions();

    if (missingDueDateCount > 0 && duplicates.length > 0) {
      return `Data quality note: ${missingDueDateCount} pending rows have no due date, and duplicate fee lines found for ${duplicates.join(', ')}.`;
    }

    if (missingDueDateCount > 0) {
      return `Data quality note: ${missingDueDateCount} pending rows have no due date.`;
    }

    if (duplicates.length > 0) {
      return `Data quality note: duplicate pending fee lines found for ${duplicates.join(', ')}.`;
    }

    if (!this.selectedStudent.course) {
      return 'Data quality note: Course not available for this student.';
    }

    return null;
  }

  private findDuplicatePendingFeeDescriptions(): string[] {
    const map = new Map<string, number>();
    for (const fee of this.pendingFees) {
      const key = this.normalizeFeeText(fee.description);
      map.set(key, (map.get(key) ?? 0) + 1);
    }

    return [...map.entries()]
      .filter(([, count]) => count > 1)
      .map(([desc]) => desc);
  }

  private currentSaveFingerprint(): string {
    const studentId = this.selectedStudent?.id ?? '';
    const selectedFeeIds = [...this.selectedPendingFeeIds].sort().join(',');
    const amount = this.amountReceived.toFixed(2);
    const mode = this.form.controls.paymentMode.value ?? '';
    const date = this.form.controls.receiptDate.value ?? '';
    return `${studentId}|${selectedFeeIds}|${amount}|${mode}|${date}`;
  }

  private extractPaymentMode(normalizedPrompt: string): PaymentMode | null {
    if (normalizedPrompt.includes('cash')) {
      return 'cash';
    }
    if (normalizedPrompt.includes('cheque')) {
      return 'cheque';
    }
    if (normalizedPrompt.includes('online')) {
      return 'online';
    }
    return null;
  }

  private toModeLabel(mode: PaymentMode): string {
    if (mode === 'cheque') {
      return 'Cheque';
    }
    if (mode === 'online') {
      return 'Online';
    }
    return 'Cash';
  }

  private handleFeeRowSelectionPrompt(normalizedPrompt: string): string {
    if (!this.selectedStudent) {
      return 'Select a student first, then I can select fee rows.';
    }

    const isUnselect = normalizedPrompt.includes('unselect') || normalizedPrompt.includes('deselect');
    const matches = this.findFeeCandidatesFromPrompt(normalizedPrompt, isUnselect);
    const isMultiTargetPrompt = /,|\band\b/.test(normalizedPrompt);

    if (matches.length === 0) {
      return `No matching pending fee found for ${this.selectedStudent.name}.`;
    }

    if (matches.length > 1 && !isMultiTargetPrompt) {
      const options = matches.map((fee) => fee.description).join('; ');
      return `Multiple fee rows matched: ${options}. Please be more specific.`;
    }

    if (matches.length > 1 && isMultiTargetPrompt) {
      for (const fee of matches) {
        if (isUnselect) {
          this.selectedPendingFeeIds.delete(fee.id);
        } else {
          this.selectedPendingFeeIds.add(fee.id);
        }
      }
      this.syncAdjustmentControl();
      const action = isUnselect ? 'Unselected' : 'Selected';
      const labels = matches.map((fee) => fee.description).join(', ');
      return `${action} ${matches.length} fee rows: ${labels}.`;
    }

    const matchedFee = matches[0];
    if (isUnselect) {
      this.selectedPendingFeeIds.delete(matchedFee.id);
      this.syncAdjustmentControl();
      return `Unselected ${matchedFee.description}.`;
    }

    this.selectedPendingFeeIds.add(matchedFee.id);
    this.syncAdjustmentControl();
    return `Selected ${matchedFee.description}.`;
  }

  private findFeeCandidatesFromPrompt(normalizedPrompt: string, isUnselect: boolean): PendingFee[] {
    const actionWord = isUnselect ? /(unselect|deselect)/ : /select/;
    let query = normalizedPrompt.replace(actionWord, '').trim();
    query = query
      .replace(/\b(the|a|an|checkbox|row|item|pending|fees?)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!query) {
      return [];
    }

    const normalizedQuery = this.normalizeFeeText(query);

    const queryTargets = normalizedQuery
      .split(/,|\band\b/)
      .map((part) => part.trim())
      .filter(Boolean);

    const feeSearchPool = this.pendingFees.map((fee) => ({
      fee,
      normalizedDescription: this.normalizeFeeText(fee.description),
    }));

    const exactLikeMatches = feeSearchPool
      .filter(({ normalizedDescription }) => normalizedDescription.includes(normalizedQuery))
      .map(({ fee }) => fee);
    if (exactLikeMatches.length > 0) {
      return exactLikeMatches;
    }

    if (queryTargets.length > 1) {
      const collected = new Map<string, PendingFee>();
      for (const target of queryTargets) {
        const targetKeywords = target.split(' ').filter((word) => word.length > 1);
        for (const item of feeSearchPool) {
          if (targetKeywords.every((word) => item.normalizedDescription.includes(word))) {
            collected.set(item.fee.id, item.fee);
          }
        }
      }
      if (collected.size > 0) {
        return [...collected.values()];
      }
    }

    const keywords = normalizedQuery.split(' ').filter((word) => word.length > 1);
    if (keywords.length === 0) {
      return [];
    }

    return feeSearchPool
      .filter(({ normalizedDescription }) => keywords.every((word) => normalizedDescription.includes(word)))
      .map(({ fee }) => fee);
  }

  private normalizeFeeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\btution\b/g, 'tuition')
      .replace(/\bmisc\b/g, 'miscellaneous')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private syncAdjustmentControl(): void {
    const adjustmentCtrl = this.form.controls.adjustmentAmount;
    const shouldEnable = this.amountReceived > this.selectedPendingFeesTotal && this.selectedPendingFeesTotal > 0;

    if (shouldEnable) {
      adjustmentCtrl.enable({ emitEvent: false });
    } else {
      adjustmentCtrl.disable({ emitEvent: false });
      adjustmentCtrl.setValue(false, { emitEvent: false });
    }
  }

  private today(): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}
