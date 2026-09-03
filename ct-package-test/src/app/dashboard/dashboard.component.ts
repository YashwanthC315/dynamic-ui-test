import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent {
  protected readonly tabs: string[] = ['Overview', 'Notices', 'Today'];
  protected readonly activeTab = signal('Overview');

  protected readonly quickLinks: string[] = ['Admissions Queue', 'Fee Collection', 'Daily Receipts'];
  protected readonly notifications: string[] = ['Holiday on 15th August', 'September Programme sheet'];

  protected setTab(tab: string): void {
    this.activeTab.set(tab);
  }
}
