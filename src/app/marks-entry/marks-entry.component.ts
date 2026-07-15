import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import studentDirectory from '../data/student-directory.json';
import { AiAgentService } from '../ai-agent/ai-agent.service';
import { ChatPromptResponse } from '../fee-collection-form/fee-collection-form.component';

interface StudentDirectoryEntry {
  id: string;
  name: string;
  course: string;
  enabledInFeeCollection: boolean;
}

interface MarksRow {
  id: string;
  student: string;
  section: string;
  marks: number;
  grade: string;
}

@Component({
  selector: 'app-marks-entry',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './marks-entry.component.html',
  styleUrl: './marks-entry.component.css',
})
export class MarksEntryComponent implements OnInit, OnDestroy {
  readonly title = 'FA1 Marks Workspace';
  readonly subtitle = 'Guided class-wise marks preparation';

  readonly sections = this.buildSections();
  selectedSection = this.sections[0] ?? 'All Sections';

  readonly allRows = this.buildRows();
  private unregisterHandler?: () => void;

  constructor(private readonly aiAgentService: AiAgentService) {}

  ngOnInit(): void {
    this.unregisterHandler = this.aiAgentService.registerHandler('marks', (prompt) => this.handleAgentPrompt(prompt));
  }

  ngOnDestroy(): void {
    this.unregisterHandler?.();
  }

  get visibleRows(): MarksRow[] {
    if (this.selectedSection === 'All Sections') {
      return this.allRows;
    }
    return this.allRows.filter((row) => row.section === this.selectedSection);
  }

  get sectionCount(): number {
    return this.sections.length - 1;
  }

  private handleAgentPrompt(prompt: string): string | ChatPromptResponse {
    const normalized = this.normalizePrompt(prompt);
    if (!normalized) {
      return 'Please enter a marks command. Try help.';
    }

    if (this.isOperationsIntent(normalized)) {
      return {
        text: 'This looks like an operations or fee question. Do you want to move to Operations section?',
        options: [
          { label: 'Open operations section', prompt: 'open operations section' },
          { label: 'Stay in marks', prompt: 'help' },
        ],
      };
    }

    if (normalized === 'help' || normalized.includes('commands')) {
      return {
        text: 'Marks help: choose a section, show summary, or list top scorers.',
        options: [
          { label: 'Show section list', prompt: 'show section list' },
          { label: 'Set section All Sections', prompt: 'set section all sections' },
          { label: 'Show marks summary', prompt: 'show marks summary' },
          { label: 'Show top scorers', prompt: 'show top scorers' },
        ],
      };
    }

    if (normalized.includes('show section list') || normalized.includes('list section')) {
      return `Available sections: ${this.sections.slice(1).join('; ')}.`;
    }

    const requestedSection = this.resolveSectionFromPrompt(normalized);
    if (requestedSection) {
      this.selectedSection = requestedSection;
      return `Section set to ${requestedSection}. Showing ${this.visibleRows.length} students.`;
    }

    if (normalized.includes('summary') || normalized.includes('overview')) {
      const count = this.visibleRows.length;
      const average = count === 0 ? 0 : this.visibleRows.reduce((sum, row) => sum + row.marks, 0) / count;
      const highest = count === 0 ? 0 : Math.max(...this.visibleRows.map((row) => row.marks));
      const lowest = count === 0 ? 0 : Math.min(...this.visibleRows.map((row) => row.marks));
      return `Marks summary for ${this.selectedSection}: students ${count}, average ${average.toFixed(2)}, highest ${highest}, lowest ${lowest}.`;
    }

    if (normalized.includes('top scorer') || normalized.includes('top marks') || normalized.includes('highest')) {
      const topRows = [...this.visibleRows].sort((left, right) => right.marks - left.marks).slice(0, 3);
      if (topRows.length === 0) {
        return 'No students available for the current section filter.';
      }

      const topText = topRows.map((row, index) => `${index + 1}) ${row.student} (${row.id}) - ${row.marks}`).join('; ');
      return `Top scorers in ${this.selectedSection}: ${topText}.`;
    }

    return 'I can assist only with marks workflow in this screen. Try: help, show section list, set section <name>, show marks summary, or show top scorers.';
  }

  private resolveSectionFromPrompt(normalizedPrompt: string): string | null {
    const normalizedWithNumericAliases = this.normalizeSectionAlias(normalizedPrompt);

    if (normalizedWithNumericAliases.includes('all sections') || normalizedWithNumericAliases === 'all') {
      return 'All Sections';
    }

    const section = this.sections.find(
      (item) => item !== 'All Sections' && normalizedWithNumericAliases.includes(this.normalizeSectionAlias(item.toLowerCase()))
    );
    return section ?? null;
  }

  private normalizeSectionAlias(value: string): string {
    return value
      .toLowerCase()
      .replace(/\b1\b/g, 'i')
      .replace(/\b2\b/g, 'ii')
      .replace(/\b3\b/g, 'iii')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizePrompt(prompt: string): string {
    return prompt.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  private isOperationsIntent(normalizedPrompt: string): boolean {
    const operationsSignals = ['fee', 'receipt', 'pending fee', 'payment mode', 'defaulter', 'collect amount'];
    return operationsSignals.some((signal) => normalizedPrompt.includes(signal));
  }

  private buildSections(): string[] {
    const students = studentDirectory as StudentDirectoryEntry[];
    const sectionSet = new Set(
      students.filter((student) => student.enabledInFeeCollection).map((student) => student.course)
    );
    return ['All Sections', ...[...sectionSet].sort((left, right) => left.localeCompare(right))];
  }

  private buildRows(): MarksRow[] {
    const students = studentDirectory as StudentDirectoryEntry[];
    return students
      .filter((student) => student.enabledInFeeCollection)
      .map((student) => {
        const marks = this.deriveMarks(student.id);
        return {
          id: student.id,
          student: student.name,
          section: student.course,
          marks,
          grade: this.deriveGrade(marks),
        };
      })
      .sort((left, right) => left.student.localeCompare(right.student));
  }

  private deriveMarks(id: string): number {
    const digitSum = id
      .replace(/\D/g, '')
      .split('')
      .reduce((sum, digit) => sum + Number(digit), 0);
    return 20 + (digitSum % 21);
  }

  private deriveGrade(marks: number): string {
    if (marks >= 35) {
      return 'A';
    }
    if (marks >= 28) {
      return 'B';
    }
    if (marks >= 20) {
      return 'C';
    }
    return 'D';
  }
}
