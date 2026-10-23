import { AfterViewInit, Component, CUSTOM_ELEMENTS_SCHEMA, OnDestroy, signal } from '@angular/core';
import { AcpActivityItem } from '@acp/chat-panel';
import { AcpHarnessConnection, connectAcpHarness } from '@acp/chat-panel/harness';
import { environment } from '../environments/environment';
import { SidebarComponent } from './sidebar/sidebar.component';
import { DashboardComponent } from './dashboard/dashboard.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [SidebarComponent, DashboardComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements AfterViewInit, OnDestroy {
  protected readonly userEmail = 'yashwanth@biltoka.com';
  private readonly mockCourses = [
    { id: 'course-cs-101', name: 'Computer Science' },
    { id: 'course-business-201', name: 'Business Administration' }
  ];
  protected readonly chatOpen = signal(false);
  protected readonly chatWidth = signal(380);
  protected readonly workspaceOpen = signal(false);
  protected readonly buddyWorkspaceOpen = signal(false);
  protected readonly workspaceWidth = signal(540);
  protected readonly workspaceHeight = signal<number | null>(null);
  protected readonly actionsOpen = signal(false);
  protected readonly actionsWidth = signal(280);
  protected readonly actionsHeight = signal<number | null>(null);
  protected readonly activityItems = signal<AcpActivityItem[]>([]);

  private harnessConnection: AcpHarnessConnection | null = null;

  ngAfterViewInit(): void {
    const chat = document.querySelector('acp-chat-panel');
    if (!chat) return;

    const workspace = document.querySelector('acp-dynamic-container');
    const buddyWorkspace = document.querySelector('buddy-enrol-workspace-surface');
    const actions = document.querySelector('acp-actions-pane');

    this.harnessConnection = connectAcpHarness({
      chat,
      workspace: workspace ?? undefined,
      buddyWorkspace: buddyWorkspace ?? undefined,
      actions: actions ?? undefined,
      environment,
      config: {
        getBearerToken: () => (environment.AGENT_FILE_RUN_BEARER_TOKEN || '').trim(),
        getOwnerId: () => environment.AGENT_FILE_RUN_OWNER_ID
      },
      getContext: () => ({
        route: window.location.pathname,
        userId: environment.AGENT_FILE_RUN_OWNER_ID,
        courses: this.mockCourses
      }),
      onSurface: (surface) => {
        if (surface['type'] === 'activity-log') {
          const items = Array.isArray(surface['items']) ? surface['items'] as AcpActivityItem[] : [];
          this.activityItems.set(items);
          this.actionsOpen.set(true);
          return;
        }

        this.workspaceOpen.set(true);
        const isBuddyWorkspace = surface['type'] === 'buddy-enrol-workspace';
        this.buddyWorkspaceOpen.set(isBuddyWorkspace);
        if (isBuddyWorkspace) this.addMockCourses(surface);
      }
    });
  }

  ngOnDestroy(): void {
    this.harnessConnection?.disconnect();
    this.harnessConnection = null;
  }

  protected toggleChat(): void {
    this.chatOpen.update((open) => !open);
  }

  protected setChatOpen(event: Event): void {
    this.chatOpen.set((event as CustomEvent<boolean>).detail);
  }

  protected setChatWidth(event: Event): void {
    this.chatWidth.set((event as CustomEvent<number>).detail);
  }

  protected setWorkspaceOpen(event: Event): void {
    const open = (event as CustomEvent<boolean>).detail;
    this.workspaceOpen.set(open);
    this.buddyWorkspaceOpen.set(false);
  }

  protected setWorkspaceWidth(event: Event): void {
    this.workspaceWidth.set((event as CustomEvent<number>).detail);
  }

  protected setWorkspaceHeight(event: Event): void {
    this.workspaceHeight.set((event as CustomEvent<number | null>).detail);
  }

  protected setActionsOpen(event: Event): void {
    this.actionsOpen.set((event as CustomEvent<boolean>).detail);
  }

  protected setActionsWidth(event: Event): void {
    this.actionsWidth.set((event as CustomEvent<number>).detail);
  }

  protected setActionsHeight(event: Event): void {
    this.actionsHeight.set((event as CustomEvent<number | null>).detail);
  }

  protected openActions(): void {
    this.actionsOpen.set(true);
  }

  protected addActivityItem(event: Event): void {
    const detail = (event as CustomEvent<{ item: AcpActivityItem }>).detail;
    if (!detail?.item) return;
    this.activityItems.update((items) => [detail.item, ...items]);
    this.actionsOpen.set(true);
  }

  protected closeWorkspace(): void {
    this.workspaceOpen.set(false);
    this.buddyWorkspaceOpen.set(false);
  }

  private addMockCourses(surface: Record<string, unknown>): void {
    const fields: Array<Record<string, unknown>> = Array.isArray(surface['fields'])
      ? surface['fields'].filter((field): field is Record<string, unknown> => Boolean(field) && typeof field === 'object')
      : [];
    let courseFieldIndex = fields.findIndex((field) => String(field['id'] || '').toLowerCase().includes('course'));

    if (courseFieldIndex < 0) {
      courseFieldIndex = fields.length;
      fields.push({ id: 'courseId', label: 'Course', required: true });
    }

    fields[courseFieldIndex] = {
      ...fields[courseFieldIndex],
      type: 'select',
      options: this.mockCourses.map((course) => ({ label: course.name, value: course.id }))
    };
    surface['fields'] = fields;

    const buddyWorkspace = document.querySelector<HTMLElement & { surface?: unknown }>('buddy-enrol-workspace-surface');
    if (buddyWorkspace) buddyWorkspace.surface = surface;
  }
}
