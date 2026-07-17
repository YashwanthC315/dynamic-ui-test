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
  isResizing = false;
  posX = 16;
  posY = 72;
  width = 380;
  height = 620;

  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private resizeStartX = 0;
  private resizeStartY = 0;
  private resizeStartWidth = 0;
  private resizeStartHeight = 0;

  private readonly minWidth = 320;
  private readonly minHeight = 420;
  private readonly maxWidth = 760;
  private readonly maxHeight = 760;

  constructor(public readonly aiAgentService: AiAgentService) {}

  startDrag(event: MouseEvent): void {
    if (this.isResizing) {
      return;
    }

    this.isDragging = true;
    this.dragOffsetX = event.clientX - this.posX;
    this.dragOffsetY = event.clientY - this.posY;
    event.preventDefault();
  }

  startResize(event: MouseEvent): void {
    this.isResizing = true;
    this.resizeStartX = event.clientX;
    this.resizeStartY = event.clientY;
    this.resizeStartWidth = this.width;
    this.resizeStartHeight = this.height;
    event.preventDefault();
    event.stopPropagation();
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
    if (this.isResizing) {
      const deltaX = event.clientX - this.resizeStartX;
      const deltaY = event.clientY - this.resizeStartY;

      const maxAllowedWidth = Math.max(this.minWidth, Math.min(this.maxWidth, window.innerWidth - this.posX - 8));
      const maxAllowedHeight = Math.max(this.minHeight, Math.min(this.maxHeight, window.innerHeight - this.posY - 8));

      this.width = this.clamp(this.resizeStartWidth + deltaX, this.minWidth, maxAllowedWidth);
      this.height = this.clamp(this.resizeStartHeight + deltaY, this.minHeight, maxAllowedHeight);
      return;
    }

    if (!this.isDragging) {
      return;
    }

    const panelWidth = this.width;
    const panelHeight = this.height;

    const nextX = event.clientX - this.dragOffsetX;
    const nextY = event.clientY - this.dragOffsetY;

    this.posX = this.clamp(nextX, 0, Math.max(0, window.innerWidth - panelWidth));
    this.posY = this.clamp(nextY, 56, Math.max(56, window.innerHeight - panelHeight));
  }

  @HostListener('document:mouseup')
  onMouseUp(): void {
    this.isDragging = false;
    this.isResizing = false;
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    const maxAllowedWidth = Math.max(this.minWidth, Math.min(this.maxWidth, window.innerWidth - this.posX - 8));
    const maxAllowedHeight = Math.max(this.minHeight, Math.min(this.maxHeight, window.innerHeight - this.posY - 8));

    this.width = this.clamp(this.width, this.minWidth, maxAllowedWidth);
    this.height = this.clamp(this.height, this.minHeight, maxAllowedHeight);

    this.posX = this.clamp(this.posX, 0, Math.max(0, window.innerWidth - this.width));
    this.posY = this.clamp(this.posY, 56, Math.max(56, window.innerHeight - this.height));
  }

  private clamp(value: number, minValue: number, maxValue: number): number {
    return Math.min(Math.max(value, minValue), maxValue);
  }
}
