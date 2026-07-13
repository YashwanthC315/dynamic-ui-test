import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

type PaymentMode = 'cash' | 'cheque' | 'online';

interface Student {
  id: string;
  name: string;
  course: string;
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
  readonly students: Student[] = [
    { id: '20P074', name: 'Chirag Jagadish', course: 'PUC II PCMB A (Annual)' },
    { id: '20P050', name: 'Ananya Rao', course: 'PUC I Commerce B (Annual)' },
    { id: '21P101', name: 'Rahul K S', course: 'B.Com II' },
    { id: '22P090', name: 'Nisha Gowda', course: 'BBA I' },
    { id: '22P091', name: 'Ananya Sharma', course: 'BBA I' },
    { id: '22P092', name: 'Rahul Mehta', course: 'B.Com I' },
    { id: '22P093', name: 'Riya Sharma', course: 'PUC II PCMB A (Annual)' },
    { id: '22P094', name: 'Kiran Rao', course: 'PUC I Science A (Annual)' },
    { id: '22P095', name: 'Sneha Gowda', course: 'PUC I Commerce B (Annual)' },
    { id: '22P096', name: 'Arjun Nair', course: 'BCA I' },
    { id: '22P097', name: 'Arjun Patel', course: 'BCA I' },
    { id: '22P098', name: 'Vikram Rao', course: 'B.Com II' },
    { id: '22P099', name: 'Neha Mehta', course: 'BBA II' },
    { id: '23P100', name: 'Pooja Nair', course: 'BBA I' },
    { id: '23P101', name: 'Kiran Iyer', course: 'PUC II PCMB B (Annual)' },
    { id: '23P102', name: 'Rahul Rao', course: 'B.Com III' },
    { id: '23P103', name: 'Ananya Gupta', course: 'BCA II' },
    { id: '23P104', name: 'Rohan Sharma', course: 'PUC I Science B (Annual)' },
    { id: '23P105', name: 'Riya Nair', course: 'BBA II' },
    { id: '23P106', name: 'Aditya Mehta', course: 'B.Com I' },
    { id: '23P107', name: 'Nisha Rao', course: 'PUC II PCMB A (Annual)' },
    { id: '23P108', name: 'Deepa Gowda', course: 'BCA III' },
    { id: '23P109', name: 'Karthik Sharma', course: 'BBA III' },
    { id: '23P110', name: 'Priya Iyer', course: 'PUC I Commerce A (Annual)' },
    { id: '23P111', name: 'Aman Patel', course: 'BCA I' },
    { id: '23P112', name: 'Neha Rao', course: 'B.Com II' },
    { id: '23P113', name: 'Vikram Nair', course: 'BBA I' },
    { id: '23P114', name: 'Sneha Gupta', course: 'PUC II PCMB B (Annual)' },
  ];

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
  filteredStudents: Student[] = [];
  selectedPendingFeeIds = new Set<string>();
  activeTab: 'pending' | 'paid' = 'pending';
  saveClicked = false;

  constructor(private readonly fb: FormBuilder) {
    this.filteredStudents = [...this.students];

    this.form.controls.studentSearch.valueChanges.subscribe((value) => {
      const term = (value ?? '').trim().toLowerCase();
      this.filteredStudents = this.students.filter((student) => {
        return (
          student.name.toLowerCase().includes(term) ||
          student.id.toLowerCase().includes(term) ||
          student.course.toLowerCase().includes(term)
        );
      });
    });

    this.form.controls.amountReceived.valueChanges.subscribe(() => {
      this.syncAdjustmentControl();
    });
  }

  handleChatPrompt(prompt: string): string {
    const normalized = prompt.toLowerCase();

    const student = this.findStudentFromPrompt(normalized);
    if (student) {
      this.selectStudent(student);
    }

    const amountMatch = normalized.match(/(\d+(?:\.\d+)?)/);
    if ((normalized.includes('amount') || normalized.includes('pay') || normalized.includes('received')) && amountMatch) {
      this.form.controls.amountReceived.setValue(Number(amountMatch[1]));
    }

    if (normalized.includes('cash')) {
      this.form.controls.paymentMode.setValue('cash');
    } else if (normalized.includes('cheque')) {
      this.form.controls.paymentMode.setValue('cheque');
    } else if (normalized.includes('online')) {
      this.form.controls.paymentMode.setValue('online');
    }

    if (normalized.includes('show paid') || normalized.includes('fees paid') || normalized.includes('paid tab')) {
      this.activeTab = 'paid';
      return 'Opened Fees Paid tab for the selected student.';
    }

    if (normalized.includes('show pending') || normalized.includes('pending tab') || normalized.includes('pending fees')) {
      this.activeTab = 'pending';
      return 'Opened Pending Fees tab for the selected student.';
    }

    if (normalized.includes('fee') || normalized.includes('collect')) {
      if (student) {
        return `Fee collection is ready for ${student.name}.`;
      }
      return 'Fee collection form is active. You can ask me to pick a student, set amount, or choose payment mode.';
    }

    if (student) {
      return `Selected ${student.name}. You can continue with fee collection details.`;
    }

    return 'I am focused on fee collection. Try prompts like: pick student a, set amount 500, mode cash, or show paid tab.';
  }

  selectStudent(student: Student): void {
    this.selectedStudent = student;
    this.selectedPendingFeeIds.clear();
    this.activeTab = 'pending';
    this.form.patchValue({ studentSearch: `${student.name} (${student.id})` }, { emitEvent: false });
    this.filteredStudents = [student];
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

  private findStudentFromPrompt(normalizedPrompt: string): Student | null {
    if (normalizedPrompt.includes('student a') || normalizedPrompt.includes('20p074')) {
      return this.students[0];
    }

    const explicitId = normalizedPrompt.match(/\b\d{2}p\d{3}\b/i)?.[0]?.toUpperCase();
    if (explicitId) {
      return this.students.find((student) => student.id === explicitId) ?? null;
    }

    return (
      this.students.find((student) => {
        const nameParts = student.name.toLowerCase().split(' ');
        return nameParts.some((part) => normalizedPrompt.includes(part));
      }) ?? null
    );
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
