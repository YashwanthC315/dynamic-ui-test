import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

/**
 * Maps formId -> a function that "calls the API" (mocked here with a
 * delayed Observable). This is the ONLY place in the whole app that is
 * allowed to know about endpoints/services. Neither the agent nor the
 * DynamicFormComponent ever import this directly for calling out — the
 * host feature component does that lookup.
 */
@Injectable({ providedIn: 'root' })
export class SubmitHandlerRegistry {
  private handlers: Record<string, (value: Record<string, any>) => Observable<any>> = {
    'add-organization': (value) => {
      console.log('[MOCK API] POST /api/organizations', value);
      return of({ id: 'org-' + Math.floor(Math.random() * 1000), ...value }).pipe(
        delay(500)
      );
    },
  };

  getHandler(formId: string) {
    return this.handlers[formId] ?? null;
  }
}
