import { Injectable } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ChatMessage, ChatOption } from '../chat-panel/chat-panel.component';

export type ScreenKey = 'operations' | 'marks';

type AgentResponse = string | { text: string; options?: ChatOption[] };
type AgentHandler = (prompt: string) => AgentResponse;

@Injectable({ providedIn: 'root' })
export class AiAgentService {
  isOpen = false;
  activeScreen: ScreenKey = 'operations';

  private readonly handlers = new Map<ScreenKey, AgentHandler>();
  private readonly historyByScreen: Record<ScreenKey, ChatMessage[]> = {
    operations: [],
    marks: [],
  };

  constructor(private readonly router: Router) {
    this.syncActiveScreenFromUrl(this.router.url);
    this.ensureHistoryInitialized(this.activeScreen);

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.syncActiveScreenFromUrl(event.urlAfterRedirects);
        this.ensureHistoryInitialized(this.activeScreen);
      });
  }

  registerHandler(screen: ScreenKey, handler: AgentHandler): () => void {
    this.handlers.set(screen, handler);
    this.ensureHistoryInitialized(screen);

    return () => {
      const existing = this.handlers.get(screen);
      if (existing === handler) {
        this.handlers.delete(screen);
      }
    };
  }

  getMessages(): ChatMessage[] {
    this.ensureHistoryInitialized(this.activeScreen);
    return this.historyByScreen[this.activeScreen];
  }

  getTitle(): string {
    return this.activeScreen === 'operations' ? 'AI Agent - Operations' : 'AI Agent - Marks';
  }

  getSubtitle(): string {
    return this.activeScreen === 'operations'
      ? 'Context-aware help for board and fee collection'
      : 'Context-aware help for marks workflow';
  }

  getPlaceholder(): string {
    return this.activeScreen === 'operations'
      ? 'Try: open fee collection, pick rahul, collect 500 for lab'
      : 'Try: help, show section list, set section bca i, show top scorers';
  }

  toggle(): void {
    this.isOpen = !this.isOpen;
    this.ensureHistoryInitialized(this.activeScreen);
  }

  close(): void {
    this.isOpen = false;
  }

  submitPrompt(prompt: string): void {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      return;
    }

    const screen = this.activeScreen;
    this.pushMessage(screen, 'user', trimmedPrompt);

    const globalIntent = this.handleCrossScreenNavigationIntent(screen, trimmedPrompt);
    if (globalIntent) {
      this.pushMessage(screen, 'assistant', globalIntent.text, globalIntent.options);
      return;
    }

    const handler = this.handlers.get(screen);
    if (!handler) {
      this.pushMessage(screen, 'assistant', 'This screen assistant is still loading. Please try again.');
      return;
    }

    const response = handler(trimmedPrompt);
    if (typeof response === 'string') {
      this.pushMessage(screen, 'assistant', response);
      return;
    }

    this.pushMessage(screen, 'assistant', response.text, response.options);
  }

  private handleCrossScreenNavigationIntent(
    currentScreen: ScreenKey,
    prompt: string
  ): { text: string; options?: ChatOption[] } | null {
    const normalized = this.normalizePrompt(prompt);

    const wantsMarks =
      normalized.includes('open marks section') ||
      normalized.includes('go to marks') ||
      normalized.includes('switch to marks') ||
      normalized === 'open marks';

    if (wantsMarks) {
      void this.router.navigate(['/marks']);
      return {
        text:
          currentScreen === 'marks'
            ? 'You are already in Marks. I can continue helping here.'
            : 'Opening Marks section. I will continue with marks assistance there.',
      };
    }

    const wantsOperations =
      normalized.includes('open operations section') ||
      normalized.includes('go to operations') ||
      normalized.includes('switch to operations') ||
      normalized === 'open operations';

    if (wantsOperations) {
      void this.router.navigate(['/']);
      return {
        text:
          currentScreen === 'operations'
            ? 'You are already in Operations. I can continue helping here.'
            : 'Opening Operations section. I will continue with operations assistance there.',
      };
    }

    return null;
  }

  private pushMessage(roleScreen: ScreenKey, role: 'user' | 'assistant', text: string, options?: ChatOption[]): void {
    this.historyByScreen[roleScreen] = [
      ...this.historyByScreen[roleScreen],
      {
        role,
        text,
        options,
        time: this.timeNow(),
      },
    ];
  }

  private ensureHistoryInitialized(screen: ScreenKey): void {
    if (this.historyByScreen[screen].length > 0) {
      return;
    }

    const openingText =
      screen === 'operations'
        ? 'AI Agent is ready for Operations. Ask about board insights or fee collection actions.'
        : 'AI Agent is ready for Marks. Ask about sections, class view, and marks insights.';

    this.historyByScreen[screen] = [
      {
        role: 'assistant',
        text: openingText,
        time: this.timeNow(),
      },
    ];
  }

  private syncActiveScreenFromUrl(url: string): void {
    this.activeScreen = url.startsWith('/marks') ? 'marks' : 'operations';
  }

  private normalizePrompt(prompt: string): string {
    return prompt.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  private timeNow(): string {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
