import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  createdOrganizations: any[] = [];

  onOrganizationCreated(org: any): void {
    this.createdOrganizations.unshift(org);
  }
}
