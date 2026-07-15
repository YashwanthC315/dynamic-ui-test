import { CommonModule } from '@angular/common';
import { Component, HostListener } from '@angular/core';
import { ChatPanelComponent } from '../chat-panel/chat-panel.component';
import { AiAgentService } from './ai-agent.service';

@Component({
  selector: 'app-ai-agent-overlay',
  standalone: true,
  imports: [CommonModule, ChatPanelComponent],
  templateUrl: './ai-agent-overlay.component.html',
  styleUrl: './ai-agent-overlay.component.css',
})
export class AiAgentOverlayComponent {
  isDragging = false;
  posX = 16;
  posY = 72;

  private dragOffsetX = 0;
  private dragOffsetY = 0;

  constructor(public readonly aiAgentService: AiAgentService) {}

  startDrag(event: MouseEvent): void {
    this.isDragging = true;
    this.dragOffsetX = event.clientX - this.posX;
    this.dragOffsetY = event.clientY - this.posY;
    event.preventDefault();
  }

  closeOverlay(event: MouseEvent): void {
    event.stopPropagation();
    this.aiAgentService.close();
  }

  handlePrompt(prompt: string): void {
    this.aiAgentService.submitPrompt(prompt);
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (!this.isDragging) {
      return;
    }

    const panelWidth = 380;
    const panelHeight = Math.min(window.innerHeight - 90, 680);

    const nextX = event.clientX - this.dragOffsetX;
    const nextY = event.clientY - this.dragOffsetY;

    this.posX = this.clamp(nextX, 0, Math.max(0, window.innerWidth - panelWidth));
    this.posY = this.clamp(nextY, 56, Math.max(56, window.innerHeight - panelHeight));
  }

  @HostListener('document:mouseup')
  onMouseUp(): void {
    this.isDragging = false;
  }

  private clamp(value: number, minValue: number, maxValue: number): number {
    return Math.min(Math.max(value, minValue), maxValue);
  }
}
