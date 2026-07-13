import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should have the expected title', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('Dynamic Operations Console');
  });

  it('should append user and assistant messages when handling a prompt', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    fixture.detectChanges();

    const initialCount = app.chatMessages.length;
    app.handlePrompt('pick student a');

    expect(app.chatMessages.length).toBe(initialCount + 2);
    expect(app.chatMessages[initialCount].role).toBe('user');
    expect(app.chatMessages[initialCount].text).toBe('pick student a');
    expect(app.chatMessages[initialCount + 1].role).toBe('assistant');
  });

  it('should render chat and fee collection components', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-chat-panel')).toBeTruthy();
    expect(compiled.querySelector('app-fee-collection-form')).toBeTruthy();
  });
});
