import { ChangeDetectorRef, Component, CUSTOM_ELEMENTS_SCHEMA, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from './sidebar/sidebar.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { ChatHarnessService, HarnessChatMessage, HarnessSurface } from './chat-harness.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, SidebarComponent, DashboardComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnDestroy {
  protected readonly userEmail = 'yashwanth@biltoka.com';
  protected chatOpen = false;
  protected chatWidth = 300;
  protected readonly chatMessages = signal<HarnessChatMessage[]>([]);
  private conversationId = crypto.randomUUID();

  constructor(
    private readonly chatHarness: ChatHarnessService,
    private readonly changeDetector: ChangeDetectorRef
  ) {
    this.chatHarness.connect(this.conversationId, response => this.onHarnessResponse(response), error => this.appendAssistant(error));
  }
  protected dynamicOpen = false;
  protected dynamicFormWidth = 520;
  protected dynamicFormSpec: any = null;
  // Support multiple open forms
  protected dynamicForms: Array<{ id: string; spec: any; open: boolean; width: number }> = [];
  protected buddyWorkspaces: Array<{ id: string; surface: HarnessSurface; open: boolean; width: number }> = [];

  protected onChatMessage(text: string): void {
    const timestamp = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const messageId = crypto.randomUUID();
    this.chatMessages.update(messages => [
      ...messages,
      {
        id: messageId,
        role: 'user',
        text,
        timestamp
      }
    ]);
    this.chatHarness.sendPrompt(this.conversationId, messageId, text, error => this.appendAssistant(error));
  }

  protected onNewChat(): void {
    this.conversationId = crypto.randomUUID();
    this.chatMessages.set([]);
    this.dynamicForms = [];
    this.buddyWorkspaces = [];
    this.dynamicOpen = false;
    this.dynamicFormSpec = null;
    this.chatHarness.connect(this.conversationId, response => this.onHarnessResponse(response), error => this.appendAssistant(error));
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
      this.changeDetector.markForCheck();
    } catch (e) {
      console.error('Failed to forward formSpec to acp-dynamic-container', e);
    }
  }

  protected onDynamicSubmit(detail: any): void {
    console.log('dynamic submitted', detail);
    const submittedForm = this.dynamicForms.find(form => form.spec?.formId === detail?.formId);
    this.chatHarness.sendEvent(this.conversationId, 'form_submit', {
      formId: detail?.formId,
      submitAction: submittedForm?.spec?.submitAction,
      values: detail?.values || {}
    }, error => this.appendAssistant(error));
    // Close the submitting form (if present) and remove it from the set
    const submittedFormId = detail?.formId;
    // Remove forms with matching formId, otherwise clear none
    this.dynamicForms = this.dynamicForms.filter(f => f.spec?.formId !== submittedFormId);
    if (!this.dynamicForms.length) {
      this.dynamicOpen = false;
      this.dynamicFormSpec = null;
    }
    this.changeDetector.markForCheck();
  }

  protected onDynamicCancel(): void {
    // If called without id, clear all; otherwise host template passes event to remove single
    this.dynamicForms = [];
    this.buddyWorkspaces = [];
    this.dynamicOpen = false;
    this.dynamicFormSpec = null;
    this.changeDetector.markForCheck();
  }

  ngOnDestroy(): void {
    this.chatHarness.close();
  }

  private onHarnessResponse(response: { messages?: Array<{ type?: string; text?: string; markdown?: string; items?: Array<{ label?: string }> }>; actions?: Array<{ type?: string; route?: string }>; surface?: HarnessSurface }): void {
    const parts = (response.messages || []).flatMap(block => {
      if (block.type === 'text' && block.text) return [block.text];
      if (block.type === 'markdown' && block.markdown) return [block.markdown];
      if (block.type === 'suggestions' && block.items?.length) {
        return [`Suggestions: ${block.items.map(item => item.label).filter(Boolean).join(', ')}`];
      }
      return [];
    });
    const actions = (response.actions || [])
      .filter(action => action.type === 'navigate' && action.route)
      .map(action => `Opening ${action.route}.`);
    if (response.surface) {
      if (response.surface.type === 'buddy-enrol-workspace') {
        this.openBuddyWorkspace(response.surface);
      } else {
        this.openHarnessSurface(response.surface);
      }
    }
    this.appendAssistant([...parts, ...actions].filter(Boolean).join('\n\n') || (response.surface ? `Opened ${response.surface.title || response.surface.type || 'dynamic form'}.` : 'The harness returned an empty response.'));
  }

  private openHarnessSurface(surface: HarnessSurface): void {
    const rawFields = Array.isArray(surface.schema?.fields) ? surface.schema.fields : (Array.isArray(surface.fields) ? surface.fields : []);
    const fields = rawFields
      .filter(field => typeof field['id'] === 'string' && typeof field['label'] === 'string')
      .map(field => ({
        id: String(field['id']),
        label: String(field['label']),
        type: this.normalizeFieldType(field['type']),
        required: Boolean(field['required']),
        disabled: Boolean(field['disabled']),
        placeholder: typeof field['placeholder'] === 'string' ? field['placeholder'] : undefined,
        options: Array.isArray(field['options']) ? field['options'] : undefined,
        validation: {
          maxLength: typeof field['maxLength'] === 'number' ? field['maxLength'] : undefined,
          min: typeof field['min'] === 'number' ? field['min'] : undefined,
          max: typeof field['max'] === 'number' ? field['max'] : undefined
        }
      }));

    if (!fields.length) {
      this.appendAssistant(`The harness returned ${surface.type || 'a dynamic'} surface without renderable fields.`);
      return;
    }

    const spec = {
      formId: surface.formId || surface.id || crypto.randomUUID(),
      title: surface.title || 'Dynamic form',
      initialValues: surface.data || {},
      submitAction: surface.submitAction,
      fields
    };
    const id = crypto.randomUUID();
    this.dynamicForms = [...this.dynamicForms, { id, spec, open: true, width: this.dynamicFormWidth }];
    this.dynamicFormSpec = spec;
    this.dynamicOpen = true;
    this.changeDetector.markForCheck();
  }

  private openBuddyWorkspace(surface: HarnessSurface): void {
    const key = surface.id || surface.formId || 'student-enrol-buddy';
    const existingIndex = this.buddyWorkspaces.findIndex(workspace =>
      workspace.surface.id === key || workspace.surface.formId === key || workspace.id === key
    );
    const workspace = {
      id: key,
      surface,
      open: true,
      width: Math.max(this.dynamicFormWidth, 720)
    };
    if (existingIndex >= 0) {
      this.buddyWorkspaces[existingIndex] = {
        ...this.buddyWorkspaces[existingIndex],
        surface,
        open: true
      };
      this.buddyWorkspaces = [...this.buddyWorkspaces];
    } else {
      this.buddyWorkspaces = [...this.buddyWorkspaces, workspace];
    }
    this.dynamicOpen = true;
    this.changeDetector.markForCheck();
  }

  private normalizeFieldType(value: unknown): 'text' | 'number' | 'date' | 'checkbox' | 'select' | 'textarea' {
    const type = String(value || 'text');
    return ['text', 'number', 'date', 'checkbox', 'select', 'textarea'].includes(type)
      ? type as 'text' | 'number' | 'date' | 'checkbox' | 'select' | 'textarea'
      : 'text';
  }

  private appendAssistant(text: string): void {
    this.chatMessages.update(messages => [
      ...messages,
      { id: crypto.randomUUID(), role: 'assistant', text, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }
    ]);
  }

  protected closeFormById(id: string): void {
    this.dynamicForms = this.dynamicForms.filter(f => f.id !== id);
    if (!this.dynamicForms.length && !this.buddyWorkspaces.length) {
      this.dynamicOpen = false;
      this.dynamicFormSpec = null;
    }
    this.changeDetector.markForCheck();
  }

  protected closeBuddyWorkspace(id: string): void {
    this.buddyWorkspaces = this.buddyWorkspaces.filter(workspace => workspace.id !== id);
    if (!this.dynamicForms.length && !this.buddyWorkspaces.length) {
      this.dynamicOpen = false;
      this.dynamicFormSpec = null;
    }
    this.changeDetector.markForCheck();
  }

  protected onFormOpenChange(id: string, open: boolean): void {
    const idx = this.dynamicForms.findIndex(f => f.id === id);
    if (idx === -1) return;
    this.dynamicForms[idx].open = !!open;
    if (!open) this.closeFormById(id);
  }

  protected onFormWidthChange(id: string, width: number): void {
    const index = this.dynamicForms.findIndex(form => form.id === id);
    if (index === -1) return;
    this.dynamicForms[index] = { ...this.dynamicForms[index], width: Number(width) };
    this.dynamicForms = [...this.dynamicForms];
    this.changeDetector.markForCheck();
  }

  protected onBuddyParse(detail: any): void {
    this.chatHarness.sendEvent(this.conversationId, 'buddy_parse', {
      action: detail?.action || 'student.enrol.parse',
      text: detail?.text || detail?.buddyText || '',
      buddyText: detail?.buddyText || detail?.text || '',
      surfaceId: detail?.surfaceId || ''
    }, error => this.appendAssistant(error));
  }

  protected onBuddyCheck(detail: any): void {
    this.chatHarness.sendEvent(this.conversationId, 'buddy_validate', {
      action: detail?.action || 'student.enrol.validate',
      fields: detail?.fields || [],
      records: detail?.records || [],
      surfaceId: detail?.surfaceId || '',
      activeRecordId: detail?.activeRecordId || '',
      buddyText: detail?.buddyText || '',
      parse: detail?.parse
    }, error => this.appendAssistant(error));
  }

  protected onBuddySubmit(detail: any): void {
    this.chatHarness.sendEvent(this.conversationId, 'form_submit', {
      formId: detail?.formId,
      action: detail?.action || 'student.enrol.submit',
      submitAction: detail?.action || 'student.enrol.submit',
      correlationId: detail?.correlationId,
      recordId: detail?.recordId,
      values: detail?.values || {}
    }, error => this.appendAssistant(error));
  }

  protected onBuddyRecordSelected(detail: any): void {
    this.chatHarness.sendEvent(this.conversationId, 'record_selected', {
      action: 'student.enrol.select',
      recordId: detail?.recordId || ''
    }, error => this.appendAssistant(error));
  }
}
