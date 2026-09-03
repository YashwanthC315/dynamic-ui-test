import { Component, EventEmitter, Output, signal } from '@angular/core';

interface SidebarItem {
  code: string;
  label: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css'
})
export class SidebarComponent {
  protected readonly items: SidebarItem[] = [
    { code: 'DB', label: 'Dashboard' },
    { code: 'AD', label: 'Admissions' },
    { code: 'AT', label: 'Attendance' },
    { code: 'FE', label: 'Fees' },
    { code: 'AC', label: 'Academics' },
    { code: 'LI', label: 'Library' },
    { code: 'AS', label: 'Assessments' },
    { code: 'PE', label: 'Personnel' },
    { code: 'LM', label: 'Learning' },
    { code: 'CN', label: 'Notices' },
    { code: 'AL', label: 'Alumni' },
    { code: 'HC', label: 'Health Care' },
    { code: 'H2', label: 'Hostel' },
    { code: 'TI', label: 'Timetable' },
    { code: 'VE', label: 'Vendors' }
  ];

  protected readonly activeCode = signal('DB');

  protected select(code: string): void {
    this.activeCode.set(code);
  }

  @Output() toggleChat = new EventEmitter<void>();

  protected onToggleChat(): void {
    this.toggleChat.emit();
  }
}
