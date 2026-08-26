import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { AppComponent } from './app.component';
import { DynamicFormComponent } from './dynamic-forms/components/dynamic-form/dynamic-form.component';
import { AiAgentChatComponent } from './features/ai-agent-chat/ai-agent-chat.component';

@NgModule({
  declarations: [AppComponent, DynamicFormComponent, AiAgentChatComponent],
  imports: [BrowserModule, FormsModule, ReactiveFormsModule],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
