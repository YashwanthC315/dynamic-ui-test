# CampusTrack (Angular 22)

The same minimal dashboard clone — top bar, icon sidebar, and a card-based dashboard
(Quick Links, Notifications, Fee Defaulters, Help, Upcoming Events) — rebuilt on the
current latest stable Angular release (**Angular 22**, released June 2026) instead of
Angular 7.

## What's different from the Angular 7 version

This isn't just a version bump in `package.json` — the project structure itself reflects
how Angular apps are built today:

- **Standalone components**, no `NgModule` / `AppModule` anywhere.
- **`bootstrapApplication()`** in `main.ts` instead of `platformBrowserDynamic().bootstrapModule()`.
- **Signals** (`signal()`) for component state instead of plain class fields.
- **New `@if` / `@for` control-flow syntax** in templates instead of `*ngIf` / `*ngFor`
  (so there's no `CommonModule` import needed either).
- **Zoneless change detection** (`provideZonelessChangeDetection()`), so `zone.js` isn't
  a dependency at all.
- The **esbuild-based `@angular/build:application` builder**, replacing the old
  `@angular-devkit/build-angular:browser` webpack builder.
- Static assets live in a top-level `public/` folder instead of `src/assets/`.

## Requirements

- Node.js 20.19+ or 22.12+ (Angular 22's minimum supported Node versions)
- npm 10.x (comes with modern Node)

## Setup

```bash
cd campustrack
npm install
npm start
```

Then open http://localhost:4200.

## Trying out a package install

```bash
npm install lodash-es
```

```ts
import { debounce } from 'lodash-es';
```

Because everything here is a standalone component with no shared module, adding a new
library only ever means importing it where you use it — no module wiring required.

## Project structure

```
public/
  favicon.ico
src/
  app/
    app.config.ts       application-wide providers (zoneless change detection)
    app.component.*      top bar + overall shell
    sidebar/               left icon rail
    dashboard/              dashboard tabs + cards
  main.ts                bootstraps the standalone root component
  index.html
  styles.css
```

No routing, HTTP calls, or state management are wired up — it's just the static interface
from the reference screenshot, with plain component-scoped CSS (no UI library) so a
freshly-installed package won't collide with anything already in use.
