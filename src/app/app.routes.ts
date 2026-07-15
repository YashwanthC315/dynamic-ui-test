import { Routes } from '@angular/router';
import { MarksEntryComponent } from './marks-entry/marks-entry.component';
import { OperationsConsoleComponent } from './operations-console/operations-console.component';

export const routes: Routes = [
	{
		path: '',
		component: OperationsConsoleComponent,
	},
	{
		path: 'marks',
		component: MarksEntryComponent,
	},
	{
		path: '**',
		redirectTo: '',
	},
];
