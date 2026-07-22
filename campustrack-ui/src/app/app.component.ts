import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgentChatPanelComponent } from './components/agent-chat-panel.component';

interface NavItem {
  key: string;
  label: string;
  glyph: string;
}

interface Student {
  id: string;
  name: string;
  course: string;
  enabledInFeeCollection: boolean;
}

interface Receipt {
  receiptNo: string;
  studentId: string;
  studentName: string;
  amount: number;
  mode: string;
  date: string;
  remarks: string;
}

interface PendingFee {
  id: string;
  description: string;
  amount: number;
  dueDate: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, AgentChatPanelComponent],
  templateUrl: './app.component.html',
})
export class AppComponent {
  navItems: NavItem[] = [
    { key: 'dashboard', label: 'Dashboard', glyph: 'DB' },
    { key: 'admin', label: 'Admin', glyph: 'AD' },
    { key: 'admissions', label: 'Admissions', glyph: 'AM' },
    { key: 'hr', label: 'HR', glyph: 'HR' },
    { key: 'academics', label: 'Academics', glyph: 'AC' },
    { key: 'lms', label: 'LMS', glyph: 'LM' },
    { key: 'assets', label: 'Assets', glyph: 'AS' },
    { key: 'fees', label: 'Fees', glyph: 'FE' },
    { key: 'library', label: 'Library', glyph: 'LB' },
    { key: 'connect', label: 'Connect', glyph: 'CN' },
    { key: 'accounting', label: 'Accounting', glyph: 'AT' },
    { key: 'receipts', label: 'Receipts', glyph: 'RC' },
    { key: 'rc', label: 'RC', glyph: 'R2' },
    { key: 'tt', label: 'TT', glyph: 'TT' },
    { key: 'vault', label: 'Vault', glyph: 'VT' },
  ];

  students: Student[] = [
    { id: '20P074', name: 'Chirag Jagadish', course: 'PUC II PCMB A (Annual)', enabledInFeeCollection: true },
    { id: '20P050', name: 'Ananya Rao', course: 'PUC I Commerce B (Annual)', enabledInFeeCollection: true },
    { id: '21P101', name: 'Rahul K S', course: 'B.Com II', enabledInFeeCollection: true },
    { id: '22P090', name: 'Nisha Gowda', course: 'BBA I', enabledInFeeCollection: true },
    { id: '22P091', name: 'Ananya Sharma', course: 'BBA I', enabledInFeeCollection: true },
    { id: '22P092', name: 'Rahul Mehta', course: 'B.Com I', enabledInFeeCollection: true },
    { id: '22P093', name: 'Riya Sharma', course: 'PUC II PCMB A (Annual)', enabledInFeeCollection: true },
    { id: '22P094', name: 'Kiran Rao', course: 'PUC I Science A (Annual)', enabledInFeeCollection: true },
    { id: '22P095', name: 'Sneha Gowda', course: 'PUC I Commerce B (Annual)', enabledInFeeCollection: true },
    { id: '22P096', name: 'Arjun Nair', course: 'BCA I', enabledInFeeCollection: true },
    { id: '22P097', name: 'Arjun Patel', course: 'BCA I', enabledInFeeCollection: true },
    { id: '22P098', name: 'Vikram Rao', course: 'B.Com II', enabledInFeeCollection: true },
    { id: '22P099', name: 'Neha Mehta', course: 'BBA II', enabledInFeeCollection: true },
    { id: '23P100', name: 'Pooja Nair', course: 'BBA I', enabledInFeeCollection: true },
    { id: '23P101', name: 'Kiran Iyer', course: 'PUC II PCMB B (Annual)', enabledInFeeCollection: true },
    { id: '23P102', name: 'Rahul Rao', course: 'B.Com III', enabledInFeeCollection: true },
    { id: '23P103', name: 'Ananya Gupta', course: 'BCA II', enabledInFeeCollection: true },
    { id: '23P104', name: 'Rohan Sharma', course: 'PUC I Science B (Annual)', enabledInFeeCollection: true },
    { id: '23P105', name: 'Riya Nair', course: 'BBA II', enabledInFeeCollection: true },
    { id: '23P106', name: 'Aditya Mehta', course: 'B.Com I', enabledInFeeCollection: true },
    { id: '23P107', name: 'Nisha Rao', course: 'PUC II PCMB A (Annual)', enabledInFeeCollection: true },
    { id: '23P108', name: 'Deepa Gowda', course: 'BCA III', enabledInFeeCollection: true },
    { id: '23P109', name: 'Karthik Sharma', course: 'BBA III', enabledInFeeCollection: true },
    { id: '23P110', name: 'Priya Iyer', course: 'PUC I Commerce A (Annual)', enabledInFeeCollection: true },
    { id: '23P111', name: 'Aman Patel', course: 'BCA I', enabledInFeeCollection: true },
    { id: '23P112', name: 'Neha Rao', course: 'B.Com II', enabledInFeeCollection: true },
    { id: '23P113', name: 'Vikram Nair', course: 'BBA I', enabledInFeeCollection: true },
    { id: '23P114', name: 'Sneha Gupta', course: 'PUC II PCMB B (Annual)', enabledInFeeCollection: true },
  ];

  pageDescriptions: Record<string, string> = {
    admin: 'Role management, institution setup, and global configuration.',
    hr: 'Staff records, leave, attendance sync, and salary processing.',
    academics: 'Class schedules, grading plans, and term-level operations.',
    lms: 'Learning resources, assignments, and progress workflows.',
    assets: 'Inventory, issue-return tracking, and maintenance logs.',
    library: 'Catalog setup, book circulation, and due monitoring.',
    connect: 'Communication center for notices, SMS, and email templates.',
    accounting: 'Ledger controls, vouchers, and account reconciliation.',
    rc: 'Regulatory compliance checklists and statutory report export.',
    tt: 'Timetable planning, slot conflicts, and substitution views.',
    vault: 'Secure records and downloadable policy documents.',
  };

  dashboardTabs = ['overview', 'notices', 'today'];
  admissionsTabs = ['applications', 'verified', 'reports'];
  feesTabs = ['collection', 'defaulters', 'summary'];
  receiptsTabs = ['all', 'today', 'search'];

  activePage = 'dashboard';
  statusMessage = 'Dashboard loaded.';
  isAgentOpen = false;

  dashboardTab = 'overview';
  admissionsTab = 'applications';
  feesTab = 'collection';
  receiptsTab = 'all';
  feeCollectionView: 'pending' | 'paid' = 'pending';

  admissionsQuery = '';
  receiptSearch = '';

  feeStudentId = '';
  feeMode = '';
  feeAmount = '';
  selectedPendingFeeIds = new Set<string>();

  receipts: Receipt[] = [
    {
      receiptNo: 'R-1001',
      studentId: '20P074',
      studentName: 'Chirag Jagadish',
      amount: 6200,
      mode: 'online',
      date: '2026-07-18',
      remarks: 'Term 1 partial',
    },
    {
      receiptNo: 'R-1002',
      studentId: '22P090',
      studentName: 'Nisha Gowda',
      amount: 5400,
      mode: 'cash',
      date: '2026-07-19',
      remarks: 'Tuition payment',
    },
  ];

  pendingFeesByStudent: Record<string, PendingFee[]> = this.buildInitialPendingFeeMap();

  dashboardCards = [
    { id: 'quick-links', title: 'Quick Links', lines: ['Admissions Queue', 'Fee Collection', 'Daily Receipts'] },
    { id: 'notifications', title: 'Notifications', lines: ['Holiday on 15th August', 'September Programme sheet'] },
    { id: 'fee-defaulters', title: 'Fee Defaulters', lines: ['8 students have pending fee above 15,000'], hasAction: true },
    { id: 'help', title: 'Help', lines: ['Guided Tour'] },
    { id: 'events', title: 'Upcoming Events (Today)', lines: ['Science exhibition briefing at 2:30 PM'], hasAction: true },
  ];

  get activeLabel(): string {
    return this.navItems.find((item) => item.key === this.activePage)?.label ?? 'Unknown';
  }

  get filteredAdmissions(): Student[] {
    const term = this.admissionsQuery.trim().toLowerCase();
    if (!term) {
      return this.students;
    }
    return this.students.filter((student) => {
      return (
        student.id.toLowerCase().includes(term) ||
        student.name.toLowerCase().includes(term) ||
        student.course.toLowerCase().includes(term)
      );
    });
  }

  get feeEnabledStudents(): Student[] {
    return this.students.filter((student) => student.enabledInFeeCollection);
  }

  get selectedFeeStudent(): Student | undefined {
    return this.feeEnabledStudents.find((student) => student.id === this.feeStudentId);
  }

  get feeDue(): { tuition: number; misc: number } {
    const student = this.selectedFeeStudent;
    if (!student) {
      return { tuition: 0, misc: 0 };
    }

    const pending = this.pendingFeesByStudent[student.id] ?? [];
    const tuition = pending
      .filter((item) => item.description.toLowerCase().includes('tuition'))
      .reduce((sum, item) => sum + item.amount, 0);
    const misc = pending
      .filter((item) => !item.description.toLowerCase().includes('tuition'))
      .reduce((sum, item) => sum + item.amount, 0);

    return { tuition, misc };
  }

  get feeTotalDue(): number {
    return this.pendingFees.reduce((sum, item) => sum + item.amount, 0);
  }

  get defaulterRows(): Array<Student & { totalDue: number }> {
    return this.feeEnabledStudents
      .map((student) => {
        const due = (this.pendingFeesByStudent[student.id] ?? []).reduce((sum, item) => sum + item.amount, 0);
        return { ...student, totalDue: due };
      })
      .sort((a, b) => b.totalDue - a.totalDue);
  }

  get pendingFees(): PendingFee[] {
    const student = this.selectedFeeStudent;
    if (!student) {
      return [];
    }
    return this.pendingFeesByStudent[student.id] ?? [];
  }

  get paidFeesForSelected(): Receipt[] {
    if (!this.selectedFeeStudent) {
      return [];
    }
    return this.receipts.filter((receipt) => receipt.studentId === this.selectedFeeStudent?.id);
  }

  get selectedPendingFeesTotal(): number {
    return this.pendingFees
      .filter((item) => this.selectedPendingFeeIds.has(item.id))
      .reduce((sum, item) => sum + item.amount, 0);
  }

  get enteredAmount(): number {
    if (this.feeAmount.trim() === '') {
      return 0;
    }
    const parsed = Number(this.feeAmount);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  get pendingDifference(): number {
    return this.enteredAmount - this.selectedPendingFeesTotal;
  }

  get searchedReceipts(): Receipt[] {
    const term = this.receiptSearch.trim().toLowerCase();
    if (!term) {
      return this.receipts;
    }
    return this.receipts.filter((receipt) => {
      return (
        receipt.receiptNo.toLowerCase().includes(term) ||
        receipt.studentName.toLowerCase().includes(term) ||
        receipt.studentId.toLowerCase().includes(term)
      );
    });
  }

  get todayReceipts(): Receipt[] {
    return this.receipts.filter((receipt) => receipt.date === '2026-07-19');
  }

  get bbaCount(): number {
    return this.students.filter((student) => student.course.includes('BBA')).length;
  }

  get bcomCount(): number {
    return this.students.filter((student) => student.course.includes('B.Com')).length;
  }

  get pucCount(): number {
    return this.students.filter((student) => student.course.includes('PUC')).length;
  }

  get totalDuePool(): number {
    return this.defaulterRows.reduce((sum, row) => sum + row.totalDue, 0);
  }

  get studentsCleared(): number {
    return this.defaulterRows.filter((row) => row.totalDue === 0).length;
  }

  get averageDue(): number {
    if (!this.defaulterRows.length) {
      return 0;
    }
    return this.totalDuePool / this.defaulterRows.length;
  }

  get todayCollection(): number {
    return this.todayReceipts.reduce((sum, receipt) => sum + receipt.amount, 0);
  }

  get amountReceivedDisplay(): number {
    return this.feeAmount === '' ? 0 : Number(this.feeAmount) || 0;
  }

  openPage(page: string): void {
    this.activePage = page;
    this.statusMessage = `${this.activeLabel} opened.`;
  }

  toggleAgentPanel(): void {
    this.isAgentOpen = !this.isAgentOpen;
    this.statusMessage = 'AI Agent panel toggled.';
  }

  openCardAction(title: string): void {
    this.statusMessage = `${title} action clicked.`;
  }

  launchGuidedTour(): void {
    this.statusMessage = 'Guided tour started (UI mock action).';
  }

  collectSelectedFee(options: { studentId?: string; mode?: string; amount?: number } = {}): boolean {
    const student = options.studentId
      ? this.feeEnabledStudents.find((item) => item.id === options.studentId)
      : this.selectedFeeStudent;

    if (!student) {
      this.statusMessage = 'No student is selected for fee collection.';
      return false;
    }

    const pending = this.pendingFeesByStudent[student.id] ?? [];
    const selectedIds = options.studentId && options.studentId !== this.selectedFeeStudent?.id
      ? new Set(pending.map((item) => item.id))
      : new Set(this.selectedPendingFeeIds);
    const selectedFees = pending.filter((item) => selectedIds.has(item.id));
    const selectedTotal = selectedFees.reduce((sum, item) => sum + item.amount, 0);
    const mode = options.mode ?? this.feeMode;
    const requestedAmount = options.amount ?? this.enteredAmount;

    if (selectedFees.length === 0) {
      this.statusMessage = 'Select at least one pending fee before saving.';
      return false;
    }

    if (!mode) {
      this.statusMessage = 'Select payment mode before saving.';
      return false;
    }

    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      this.statusMessage = 'Amount must be greater than zero.';
      return false;
    }

    if (requestedAmount !== selectedTotal) {
      const diff = requestedAmount - selectedTotal;
      this.statusMessage = `Amount mismatch: difference is ${diff.toFixed(2)}. Amount received must match selected pending total.`;
      return false;
    }

    if (selectedTotal <= 0) {
      this.statusMessage = 'No pending fee available for selected student.';
      return false;
    }

    const nextNo = `R-${1000 + this.receipts.length + 1}`;
    const newReceipt: Receipt = {
      receiptNo: nextNo,
      studentId: student.id,
      studentName: student.name,
      amount: requestedAmount,
      mode,
      date: '2026-07-19',
      remarks: selectedFees.map((item) => item.description).join(', '),
    };

    this.receipts = [newReceipt, ...this.receipts];
    this.pendingFeesByStudent[student.id] = pending.filter((item) => !selectedIds.has(item.id));
    this.selectedPendingFeeIds.clear();
    this.feeAmount = '';
    this.feeCollectionView = 'paid';
    this.statusMessage = `Transaction saved for ${student.name} and moved to Fees Paid tab.`;
    return true;
  }

  togglePendingFee(id: string): void {
    if (this.selectedPendingFeeIds.has(id)) {
      this.selectedPendingFeeIds.delete(id);
      this.syncAmountToSelection();
      return;
    }
    this.selectedPendingFeeIds.add(id);
    this.syncAmountToSelection();
  }

  isPendingFeeSelected(id: string): boolean {
    return this.selectedPendingFeeIds.has(id);
  }

  selectAllPendingFees(): void {
    this.selectedPendingFeeIds = new Set(this.pendingFees.map((item) => item.id));
    this.syncAmountToSelection();
  }

  clearPendingSelection(): void {
    this.selectedPendingFeeIds.clear();
    this.syncAmountToSelection();
  }

  collectFullDue(): void {
    this.selectAllPendingFees();
    this.feeAmount = this.selectedPendingFeesTotal.toFixed(2);
    this.collectSelectedFee();
  }

  createReceiptFromAgent(payload: { studentId: string; amount: number; mode: string; remarks: string }): void {
    const student = this.students.find((item) => item.id === payload.studentId);
    const safeAmount = Number(payload.amount);

    if (!student || !Number.isFinite(safeAmount) || safeAmount <= 0) {
      this.statusMessage = 'AI receipt request has invalid data.';
      return;
    }

    const nextNo = `R-${1000 + this.receipts.length + 1}`;
    this.receipts = [
      {
        receiptNo: nextNo,
        studentId: student.id,
        studentName: student.name,
        amount: safeAmount,
        mode: payload.mode ?? 'cash',
        date: '2026-07-19',
        remarks: payload.remarks || 'Created from AI panel',
      },
      ...this.receipts,
    ];
    this.statusMessage = `Receipt ${nextNo} created for ${student.name}.`;
  }

  handleAgentEvent(event: any): void {
    if (event.type === 'navigate') {
      this.openPage(event.page);
      return;
    }

    if (event.type === 'switch_tab') {
      this.openPage(event.page);
      if (event.page === 'dashboard' && this.dashboardTabs.includes(event.tab)) {
        this.dashboardTab = event.tab;
      }
      if (event.page === 'admissions' && this.admissionsTabs.includes(event.tab)) {
        this.admissionsTab = event.tab;
      }
      if (event.page === 'fees' && this.feesTabs.includes(event.tab)) {
        this.feesTab = event.tab;
      }
      if (event.page === 'receipts' && this.receiptsTabs.includes(event.tab)) {
        this.receiptsTab = event.tab;
      }
      return;
    }

    if (event.type === 'select_student') {
      const selected = this.students.find((student) => student.id === event.studentId);
      if (!selected) {
        return;
      }
      this.feeStudentId = selected.id;
      this.feeCollectionView = 'pending';
      this.selectedPendingFeeIds.clear();
      this.feeAmount = '';
      this.openPage('fees');
      this.feesTab = 'collection';
      this.statusMessage = `AI selected ${selected.name} for fee workflows.`;
      return;
    }

    if (event.type === 'select_pending_fee') {
      if (!this.selectedFeeStudent) {
        this.statusMessage = 'Select a student first, then select fee rows.';
        return;
      }

      const matches = this.findPendingFeesByQuery(String(event.query ?? ''));
      if (matches.length === 0) {
        this.statusMessage = `No matching pending fee found for ${this.selectedFeeStudent.name}.`;
        return;
      }

      const action = event.action === 'unselect' ? 'unselect' : 'select';
      for (const fee of matches) {
        if (action === 'unselect') {
          this.selectedPendingFeeIds.delete(fee.id);
        } else {
          this.selectedPendingFeeIds.add(fee.id);
        }
      }

      this.syncAmountToSelection();
      const feeNames = matches.map((fee) => fee.description).join(', ');
      this.statusMessage =
        action === 'unselect'
          ? `Unselected ${matches.length} fee row(s): ${feeNames}.`
          : `Selected ${matches.length} fee row(s): ${feeNames}. Amount set to ${this.selectedPendingFeesTotal.toFixed(2)}.`;
      return;
    }

    if (event.type === 'collect_fee') {
      this.openPage('fees');
      this.feesTab = 'collection';
      this.collectSelectedFee({ studentId: event.studentId, mode: event.mode });
      return;
    }

    if (event.type === 'set_fee_mode') {
      this.feeMode = event.mode;
      this.statusMessage = `Payment mode set to ${event.mode}.`;
      return;
    }

    if (event.type === 'switch_fee_view' && (event.view === 'pending' || event.view === 'paid')) {
      this.openPage('fees');
      this.feesTab = 'collection';
      this.feeCollectionView = event.view;
      return;
    }

    if (event.type === 'set_amount') {
      this.feeAmount = String(event.amount);
      this.statusMessage = `Amount received set to ${Number(event.amount).toFixed(2)}.`;
      return;
    }

    if (event.type === 'save_transaction') {
      this.openPage('fees');
      this.feesTab = 'collection';
      if (!this.selectedFeeStudent) {
        this.statusMessage = 'Select a student first.';
        return;
      }
      this.collectSelectedFee();
      return;
    }

    if (event.type === 'set_today_receipt') {
      this.statusMessage = 'Receipt date set to today.';
      return;
    }

    if (event.type === 'select_all_pending') {
      this.selectAllPendingFees();
      this.statusMessage = `Selected all pending fee rows (${this.selectedPendingFeeIds.size}).`;
      return;
    }

    if (event.type === 'clear_selection') {
      this.clearPendingSelection();
      this.statusMessage = 'Pending fee selection cleared.';
      return;
    }

    if (event.type === 'create_receipt') {
      this.openPage('receipts');
      this.receiptsTab = 'all';
      this.createReceiptFromAgent(event.payload || {});
    }
  }

  currency(value: number): string {
    return value.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }

  private buildInitialPendingFeeMap(): Record<string, PendingFee[]> {
    return this.students.reduce<Record<string, PendingFee[]>>((acc, student, idx) => {
      const tuition = 9000 + (idx % 6) * 1000;
      const lab = 800 + (idx % 3) * 200;
      const exam = 1000 + (idx % 4) * 250;

      acc[student.id] = [
        {
          id: `${student.id}-TUI`,
          description: `Tuition Fee ${idx % 2 === 0 ? 'August' : 'September'} 2026`,
          amount: tuition,
          dueDate: idx % 2 === 0 ? '2026-08-20' : '2026-09-20',
        },
        {
          id: `${student.id}-LAB`,
          description: `Lab Fee ${idx % 2 === 0 ? 'August' : 'September'} 2026`,
          amount: lab,
          dueDate: idx % 2 === 0 ? '2026-08-20' : '2026-09-20',
        },
        {
          id: `${student.id}-EXM`,
          description: 'Exam Fee Term 1',
          amount: exam,
          dueDate: '2026-10-05',
        },
      ];

      return acc;
    }, {});
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

  private findPendingFeesByQuery(query: string): PendingFee[] {
    const normalizedQuery = this.normalizeFeeText(query);
    if (!normalizedQuery) {
      return [];
    }

    const queryParts = normalizedQuery
      .split(/,|\band\b/)
      .map((part) => part.trim())
      .filter(Boolean);

    const feeSearchPool = this.pendingFees.map((fee) => ({
      fee,
      normalizedDescription: this.normalizeFeeText(fee.description),
    }));

    const direct = feeSearchPool
      .filter(({ normalizedDescription }) => normalizedDescription.includes(normalizedQuery))
      .map(({ fee }) => fee);
    if (direct.length > 0) {
      return direct;
    }

    if (queryParts.length > 1) {
      const collected = new Map<string, PendingFee>();
      for (const part of queryParts) {
        const tokens = part.split(' ').filter((word) => word.length > 1);
        for (const entry of feeSearchPool) {
          if (tokens.every((token) => entry.normalizedDescription.includes(token))) {
            collected.set(entry.fee.id, entry.fee);
          }
        }
      }
      if (collected.size > 0) {
        return [...collected.values()];
      }
    }

    const tokens = normalizedQuery.split(' ').filter((word) => word.length > 1);
    if (tokens.length === 0) {
      return [];
    }

    return feeSearchPool
      .filter(({ normalizedDescription }) => tokens.every((token) => normalizedDescription.includes(token)))
      .map(({ fee }) => fee);
  }

  private syncAmountToSelection(): void {
    this.feeAmount = this.selectedPendingFeesTotal > 0 ? this.selectedPendingFeesTotal.toFixed(2) : '';
  }
}
