import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from './sidebar/sidebar.component';
import { DashboardComponent } from './dashboard/dashboard.component';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, SidebarComponent, DashboardComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  protected readonly userEmail = 'yashwanth@biltoka.com';
  protected chatOpen = false;
  protected chatWidth = 300;
  protected chatMessages: ChatMessage[] = [];
  protected dynamicOpen = false;
  protected dynamicFormWidth = 520;
  protected dynamicFormSpec: any = null;
  // Support multiple open forms
  protected dynamicForms: Array<{ id: string; spec: any; open: boolean; width: number }> = [];

  protected onChatMessage(text: string): void {
    const timestamp = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    this.chatMessages = [
      ...this.chatMessages,
      {
        id: crypto.randomUUID(),
        role: 'user',
        text,
        timestamp
      }
    ];
  }

  protected onNewChat(): void {
    this.chatMessages = [];
  }

  protected onChatHelp(): void {
    console.log('chat help');
  }

  protected onFormRequested(detail: any): void {
    try {
      const spec = detail?.formSpec ?? detail;
      if (!spec) return;
      // Create a new form entry so multiple forms can be open simultaneously
      const id = crypto.randomUUID();
      this.dynamicForms = [
        ...this.dynamicForms,
        { id, spec, open: true, width: this.dynamicFormWidth }
      ];
      // Also set the single-form convenience properties for backward compatibility
      this.dynamicFormSpec = spec;
      this.dynamicOpen = true;
    } catch (e) {
      console.error('Failed to forward formSpec to acp-dynamic-container', e);
    }
  }

  protected onDynamicSubmit(detail: any): void {
    console.log('dynamic submitted', detail);
    // Close the submitting form (if present) and remove it from the set
    const submittedFormId = detail?.formId;
    // Remove forms with matching formId, otherwise clear none
    this.dynamicForms = this.dynamicForms.filter(f => f.spec?.formId !== submittedFormId);
    if (!this.dynamicForms.length) {
      this.dynamicOpen = false;
      this.dynamicFormSpec = null;
    }
  }

  protected onDynamicCancel(): void {
    // If called without id, clear all; otherwise host template passes event to remove single
    this.dynamicForms = [];
    this.dynamicOpen = false;
    this.dynamicFormSpec = null;
  }

  protected closeFormById(id: string): void {
    this.dynamicForms = this.dynamicForms.filter(f => f.id !== id);
    if (!this.dynamicForms.length) {
      this.dynamicOpen = false;
      this.dynamicFormSpec = null;
    }
  }

  protected onFormOpenChange(id: string, open: boolean): void {
    const idx = this.dynamicForms.findIndex(f => f.id === id);
    if (idx === -1) return;
    this.dynamicForms[idx].open = !!open;
    if (!open) this.closeFormById(id);
  }
}
