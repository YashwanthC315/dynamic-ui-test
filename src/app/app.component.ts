import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

type FieldType = 'text' | 'email' | 'number' | 'date' | 'textarea' | 'select';

interface FormField {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  required?: boolean;
  options?: string[];
}

interface FormDefinition {
  key: string;
  title: string;
  description: string;
  fields: FormField[];
}

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'Dynamic Form Fetcher';

  promptInput = '';
  activeForm: FormDefinition | null = null;
  activeFormModel: Record<string, string | number> = {};
  showSubmitToast = false;

  readonly forms: FormDefinition[] = [
    {
      key: 'payslip',
      title: 'Payslip Request Form',
      description: 'Use this to request a payslip copy for a specific month and year.',
      fields: [
        { key: 'employeeId', label: 'Employee ID', type: 'text', placeholder: 'EMP-10021', required: true },
        { key: 'fullName', label: 'Full Name', type: 'text', placeholder: 'Alex Carter', required: true },
        { key: 'month', label: 'Month', type: 'select', required: true, options: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] },
        { key: 'year', label: 'Year', type: 'number', placeholder: '2026', required: true },
        { key: 'deliveryEmail', label: 'Delivery Email', type: 'email', placeholder: 'alex@company.com', required: true }
      ]
    },
    {
      key: 'details',
      title: 'Personal Details Form',
      description: 'Collect or update personal information for profile records.',
      fields: [
        { key: 'firstName', label: 'First Name', type: 'text', placeholder: 'Alex', required: true },
        { key: 'lastName', label: 'Last Name', type: 'text', placeholder: 'Carter', required: true },
        { key: 'dateOfBirth', label: 'Date of Birth', type: 'date', required: true },
        { key: 'phone', label: 'Phone Number', type: 'text', placeholder: '+1-555-0199', required: true },
        { key: 'email', label: 'Personal Email', type: 'email', placeholder: 'alex@email.com', required: true }
      ]
    },
    {
      key: 'address',
      title: 'Address Update Form',
      description: 'Submit a residential address update for records and correspondence.',
      fields: [
        { key: 'line1', label: 'Address Line 1', type: 'text', placeholder: '221B Baker Street', required: true },
        { key: 'line2', label: 'Address Line 2', type: 'text', placeholder: 'Apartment / Suite' },
        { key: 'city', label: 'City', type: 'text', placeholder: 'London', required: true },
        { key: 'state', label: 'State / Province', type: 'text', placeholder: 'Greater London', required: true },
        { key: 'postalCode', label: 'Postal Code', type: 'text', placeholder: 'NW1 6XE', required: true },
        { key: 'country', label: 'Country', type: 'text', placeholder: 'United Kingdom', required: true }
      ]
    },
    {
      key: 'leave',
      title: 'Leave Request Form',
      description: 'Submit leave duration and reason for manager review.',
      fields: [
        { key: 'employeeId', label: 'Employee ID', type: 'text', placeholder: 'EMP-10021', required: true },
        { key: 'leaveType', label: 'Leave Type', type: 'select', required: true, options: ['Vacation', 'Sick', 'Personal', 'Comp Off'] },
        { key: 'fromDate', label: 'From Date', type: 'date', required: true },
        { key: 'toDate', label: 'To Date', type: 'date', required: true },
        { key: 'notes', label: 'Reason / Notes', type: 'textarea', placeholder: 'Add a short reason...', required: true }
      ]
    }
  ];

  chatMessages: ChatMessage[] = [
    {
      role: 'assistant',
      text: 'Try prompts like "fetch me form for payslip", "show details form", or "load address form".'
    }
  ];

  submitPrompt(): void {
    const prompt = this.promptInput.trim();
    if (!prompt) {
      return;
    }

    this.chatMessages.push({ role: 'user', text: prompt });
    const match = this.detectFormFromPrompt(prompt);

    if (!match) {
      this.chatMessages.push({
        role: 'assistant',
        text: 'No matching form found. Try: payslip, details, address, or leave.'
      });
      this.promptInput = '';
      return;
    }

    const form = this.forms.find((item) => item.key === match);
    if (!form) {
      this.promptInput = '';
      return;
    }

    this.loadForm(form);
    this.chatMessages.push({
      role: 'assistant',
      text: `Loaded "${form.title}". This replaces any previously shown form.`
    });
    this.promptInput = '';
  }

  loadFormFromChip(formKey: string): void {
    this.promptInput = `fetch me form for ${formKey}`;
    this.submitPrompt();
  }

  onFormSubmit(): void {
    this.showSubmitToast = true;
    setTimeout(() => {
      this.showSubmitToast = false;
    }, 2000);
  }

  private loadForm(form: FormDefinition): void {
    this.activeForm = form;
    this.activeFormModel = form.fields.reduce<Record<string, string | number>>((acc, field) => {
      acc[field.key] = '';
      return acc;
    }, {});
  }

  private detectFormFromPrompt(prompt: string): FormDefinition['key'] | null {
    const input = prompt.toLowerCase();

    if (input.includes('payslip') || input.includes('salary')) {
      return 'payslip';
    }

    if (input.includes('detail') || input.includes('profile') || input.includes('personal')) {
      return 'details';
    }

    if (input.includes('address') || input.includes('location')) {
      return 'address';
    }

    if (input.includes('leave') || input.includes('vacation') || input.includes('time off')) {
      return 'leave';
    }

    return null;
  }
}
