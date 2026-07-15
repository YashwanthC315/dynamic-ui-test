import { CommonModule } from '@angular/common';
import { Component, ViewChild } from '@angular/core';
import { ChatMessage, ChatOption, ChatPanelComponent } from './chat-panel/chat-panel.component';
import { ChatPromptResponse, FeeCollectionFormComponent } from './fee-collection-form/fee-collection-form.component';
import studentDirectory from './data/student-directory.json';

interface BoardKpi {
  title: string;
  value: string;
  note: string;
}

interface StudentDirectoryEntry {
  id: string;
  course: string;
  enabledInFeeCollection: boolean;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, ChatPanelComponent, FeeCollectionFormComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  @ViewChild(FeeCollectionFormComponent)
  private feeCollectionForm?: FeeCollectionFormComponent;

  readonly title = 'Dynamic Operations Console';
  readonly subtitle = 'Multi-agent operations board with chat-driven workflows';
  readonly chatPlaceholder = 'Try: show pending fees report, open fee collection, pick rahul, admissions summary';

  readonly boardTitle = 'Campus Operations Board';
  readonly boardSubtitle = 'Academic Year 2026-27';

  readonly boardKpis: BoardKpi[] = [
    { title: 'Collected (Month)', value: 'Rs 4,28,500', note: '312 receipts posted' },
    { title: 'Expected (Month)', value: 'Rs 7,38,000', note: 'Term 1 schedule' },
    { title: 'Outstanding', value: 'Rs 3,10,500', note: '48 defaulters across 6 sections' },
  ];

  private readonly directory = studentDirectory as StudentDirectoryEntry[];
  private readonly totalStudents = this.directory.length;
  private readonly enabledStudents = this.directory.filter((student) => student.enabledInFeeCollection).length;
  private readonly uniqueCourseCount = new Set(this.directory.map((student) => student.course)).size;
  private readonly studentsByYear = this.directory.reduce<Record<string, number>>((acc, student) => {
    const yearCode = student.id.slice(0, 2);
    acc[yearCode] = (acc[yearCode] ?? 0) + 1;
    return acc;
  }, {});
  private readonly studentsByProgram = this.directory.reduce<Record<string, number>>((acc, student) => {
    const program = student.course.split(' ')[0];
    acc[program] = (acc[program] ?? 0) + 1;
    return acc;
  }, {});

  activeWorkspace: 'home' | 'fee' = 'home';
  boardInsight = 'Board is active. Ask for fee reports or open fee collection from chat.';

  chatMessages: ChatMessage[] = [
    {
      role: 'assistant',
      text: 'Board home is open. Ask: "show pending fees report", "open fee collection", "pick rahul", or "help".',
      time: this.timeNow(),
    },
  ];

  readonly quickCommands = [
    'Show board',
    'Show pending fees report',
    'Open fee collection',
    'Pick rahul',
    'List fee defaulters',
    'Help',
  ];

  handlePrompt(prompt: string): void {
    this.pushMessage('user', prompt);

    const normalizedPrompt = this.normalizePrompt(prompt);

    if (this.isBoardIntent(normalizedPrompt)) {
      this.activeWorkspace = 'home';
      this.boardInsight = 'Board home is active with cross-module prompts and fee intelligence cards.';
      this.pushMessage('assistant', 'Opened the operations board home. Ask for any report, or say "open fee collection" to work on student receipts.');
      return;
    }

    const boardReply = this.handleBoardPrompt(normalizedPrompt);
    if (boardReply) {
      this.activeWorkspace = 'home';
      this.pushMessage('assistant', boardReply.text, boardReply.options);
      return;
    }

    if (this.isFeeIntent(normalizedPrompt)) {
      this.activeWorkspace = 'fee';
      this.routePromptToFeeWorkflow(prompt);
      return;
    }

    if (this.looksLikeStudentLookup(normalizedPrompt)) {
      this.activeWorkspace = 'fee';
      this.routePromptToFeeWorkflow(prompt);
      return;
    }

    this.pushMessage(
      'assistant',
      'I can help with board insights or fee actions. Try: help, show pending fees report, list fee defaulters, open fee collection, or pick <student>.'
    );
  }

  private routePromptToFeeWorkflow(prompt: string): void {

    if (!this.feeCollectionForm) {
      this.pushMessage('assistant', 'Fee collection form is loading. Try the command again.');
      return;
    }

    const response = this.feeCollectionForm.handleChatPrompt(prompt);
    if (typeof response === 'string') {
      this.pushMessage('assistant', response);
      return;
    }

    this.pushMessage('assistant', response.text, response.options);
  }

  private handleBoardPrompt(normalizedPrompt: string): ChatPromptResponse | null {
    if (normalizedPrompt === 'help' || normalizedPrompt.includes('other prompts') || normalizedPrompt.includes('what prompts')) {
      this.boardInsight = 'Chat help is active with quick command buttons for board and fee actions.';
      return {
        text: 'Help: here are the most important commands. Choose a button or type your own command anytime.',
        options: [
          { label: 'Show board', prompt: 'show board' },
          { label: 'Show pending fees report', prompt: 'show pending fees report' },
          { label: 'List fee defaulters', prompt: 'list fee defaulters' },
          { label: 'Open fee collection', prompt: 'open fee collection' },
          { label: 'What is selected', prompt: 'what is selected' },
        ],
      };
    }

    if (
      normalizedPrompt.includes('pending fees report') ||
      (normalizedPrompt.includes('pending') && normalizedPrompt.includes('report'))
    ) {
      this.boardInsight = 'Pending fees report prepared for the current month with section-wise default counts.';
      return {
        text: 'Pending Fees Report: Rs 3,10,500 outstanding, 48 defaulters across 6 sections. Reply with class or student to filter, or open fee collection for student-level action.',
        options: [
          { label: 'Open fee collection', prompt: 'open fee collection' },
          { label: 'List fee defaulters', prompt: 'list fee defaulters' },
          { label: 'Show board', prompt: 'show board' },
        ],
      };
    }

    if (normalizedPrompt.includes('defaulter')) {
      this.boardInsight = 'Defaulter list is available with section split and total outstanding visibility.';
      return {
        text: 'Top defaulters view: Std X-B, Std IX-A, and B.Com A are currently highest outstanding. Reply with "open fee collection" and then pick a student to collect payment.',
        options: [
          { label: 'Open fee collection', prompt: 'open fee collection' },
          { label: 'Pick rahul', prompt: 'pick rahul' },
          { label: 'Show pending fees report', prompt: 'show pending fees report' },
        ],
      };
    }

    if (normalizedPrompt.includes('admission')) {
      this.boardInsight = 'Admissions board summary shown with conversion and pending-document signals.';
      const batchSummary = Object.entries(this.studentsByYear)
        .sort(([left], [right]) => Number(left) - Number(right))
        .map(([year, count]) => `'${year}: ${count}`)
        .join(', ');
      return {
        text: `Admissions summary: ${this.totalStudents} students in directory (${batchSummary}). ${this.enabledStudents} enabled for fee collection.`,
        options: [
          { label: 'Show board', prompt: 'show board' },
          { label: 'Open fee collection', prompt: 'open fee collection' },
          { label: 'Student strength snapshot', prompt: 'student strength snapshot' },
        ],
      };
    }

    if (normalizedPrompt.includes('student strength') || normalizedPrompt.includes('student snapshot')) {
      this.boardInsight = 'Student strength snapshot updated across classes and courses.';
      const programPriority = ['PUC', 'BBA', 'B.Com', 'BCA'];
      const programSummary = programPriority
        .filter((program) => this.studentsByProgram[program])
        .map((program) => `${program} ${this.studentsByProgram[program]}`)
        .join(', ');
      return {
        text: `Student strength snapshot: ${this.totalStudents} active students across ${this.uniqueCourseCount} course sections. Program split: ${programSummary}.`,
        options: [
          { label: 'Show board', prompt: 'show board' },
          { label: 'Show pending fees report', prompt: 'show pending fees report' },
          { label: 'Open fee collection', prompt: 'open fee collection' },
        ],
      };
    }

    return null;
  }

  private pushMessage(role: 'user' | 'assistant', text: string, options?: ChatOption[] | ChatPromptResponse['options']): void {
    this.chatMessages = [...this.chatMessages, { role, text, options, time: this.timeNow() }];
  }

  private normalizePrompt(prompt: string): string {
    return prompt.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  private isBoardIntent(normalizedPrompt: string): boolean {
    return normalizedPrompt === 'home' || normalizedPrompt === 'show home' || normalizedPrompt === 'show board' || normalizedPrompt === 'open board';
  }

  private isFeeIntent(normalizedPrompt: string): boolean {
    return (
      normalizedPrompt.includes('fee collection') ||
      normalizedPrompt.includes('open receipt') ||
      normalizedPrompt.includes('collect') ||
      normalizedPrompt.includes('payment') ||
      normalizedPrompt.includes('show paid') ||
      normalizedPrompt.includes('show pending') ||
      normalizedPrompt.includes('set amount') ||
      normalizedPrompt.includes('mode ') ||
      normalizedPrompt.includes('paid in ') ||
      normalizedPrompt.includes('save') ||
      normalizedPrompt.includes('what is selected')
    );
  }

  private looksLikeStudentLookup(normalizedPrompt: string): boolean {
    if (/\b\d{2}p\d{3}\b/i.test(normalizedPrompt)) {
      return true;
    }

    return (
      normalizedPrompt.includes('pick ') ||
      normalizedPrompt.includes('select ') ||
      normalizedPrompt.includes('student ') ||
      normalizedPrompt.includes('rahul') ||
      normalizedPrompt.includes('ananya') ||
      normalizedPrompt.includes('rao') ||
      normalizedPrompt.includes('sharma')
    );
  }

  private timeNow(): string {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
