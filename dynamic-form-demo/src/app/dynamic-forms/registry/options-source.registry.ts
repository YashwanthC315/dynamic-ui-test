import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { FieldOption } from '../models/form-spec.model';

/**
 * The agent only ever says `optionsSource: 'organizations.parentOptions'`.
 * It never knows this resolves to a (mocked) API call. Swap the bodies of
 * these resolvers for real HttpClient calls later — nothing else in the
 * dynamic-form pipeline needs to change.
 */
@Injectable({ providedIn: 'root' })
export class OptionsResolverService {
  private registry: Record<string, () => Observable<FieldOption[]>> = {
    'organizations.parentOptions': () =>
      of<FieldOption[]>([
        { label: 'None', value: '' },
        { label: 'Institute HQ', value: 'org-1' },
        { label: 'Engineering Campus', value: 'org-2' },
      ]).pipe(delay(300)), // simulated network latency

    'organizations.ownerOptions': () =>
      of<FieldOption[]>([
        { label: 'None', value: '' },
        { label: 'Yashwanth', value: 'user-1' },
        { label: 'Priya Sharma', value: 'user-2' },
      ]).pipe(delay(300)),
  };

  resolve(sourceKey: string): Observable<FieldOption[]> {
    const resolver = this.registry[sourceKey];
    if (!resolver) {
      console.warn(`[OptionsResolverService] Unknown optionsSource: ${sourceKey}`);
      return of([]);
    }
    return resolver();
  }

  isKnownSource(sourceKey: string): boolean {
    return !!this.registry[sourceKey];
  }
}
