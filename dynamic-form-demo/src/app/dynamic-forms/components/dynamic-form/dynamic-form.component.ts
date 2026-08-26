import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormGroup } from '@angular/forms';
import { FieldOption, FormFieldSpec, FormSpec, FormSubmitEvent } from '../../models/form-spec.model';
import { FIELD_CONTROL_FACTORY } from '../../registry/field-control.registry';
import { OptionsResolverService } from '../../registry/options-source.registry';

/**
 * Generic, reusable renderer. It knows NOTHING about "Organization" or
 * any API. It only knows how to turn a FormSpec into real Angular
 * controls (via the deterministic registry) and emit plain values on
 * submit. The host component decides what happens with those values.
 */
@Component({
  selector: 'app-dynamic-form',
  templateUrl: './dynamic-form.component.html',
  styleUrls: ['./dynamic-form.component.css'],
})
export class DynamicFormComponent implements OnChanges {
  @Input() spec!: FormSpec;
  @Output() formSubmit = new EventEmitter<FormSubmitEvent>();
  @Output() formCancel = new EventEmitter<void>();

  form!: FormGroup;
  sortedFields: FormFieldSpec[] = [];
  optionsByFieldId: Record<string, FieldOption[]> = {};
  optionsLoadingByFieldId: Record<string, boolean> = {};
  submitting = false;

  constructor(private optionsResolver: OptionsResolverService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['spec'] && this.spec) {
      this.buildForm();
    }
  }

  private buildForm(): void {
    this.sortedFields = [...this.spec.fields].sort((a, b) => a.order - b.order);

    const group: Record<string, any> = {};
    for (const field of this.sortedFields) {
      const factory = FIELD_CONTROL_FACTORY[field.type];
      if (!factory) {
        console.warn(`[DynamicForm] No control factory for type "${field.type}" — skipping field "${field.id}"`);
        continue;
      }
      group[field.id] = factory(field);

      if (field.type === 'select') {
        this.loadOptionsFor(field);
      }
    }
    this.form = new FormGroup(group);
    this.submitting = false;
  }

  private loadOptionsFor(field: FormFieldSpec): void {
    if (field.staticOptions) {
      this.optionsByFieldId[field.id] = field.staticOptions;
      return;
    }
    if (!field.optionsSource) {
      this.optionsByFieldId[field.id] = [];
      return;
    }
    this.optionsLoadingByFieldId[field.id] = true;
    this.optionsResolver.resolve(field.optionsSource).subscribe((options) => {
      this.optionsByFieldId[field.id] = options;
      this.optionsLoadingByFieldId[field.id] = false;
    });
  }

  isInvalid(fieldId: string): boolean {
    const control = this.form.get(fieldId);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting = true;
    this.formSubmit.emit({
      formId: this.spec.formId,
      value: this.form.value,
    });
  }

  onCancel(): void {
    this.formCancel.emit();
  }
}
