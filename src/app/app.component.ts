import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AiAgentOverlayComponent } from './ai-agent/ai-agent-overlay.component';
import { AiAgentService } from './ai-agent/ai-agent.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, AiAgentOverlayComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  readonly title = 'Dynamic UI Workbench';

  constructor(public readonly aiAgentService: AiAgentService) {}

  toggleAiAgent(): void {
    this.aiAgentService.toggle();
  }
}
