import { FormControl, Validators } from '@angular/forms';
import { FieldType, FormFieldSpec } from '../models/form-spec.model';

/**
 * The ONLY place that decides "a text field needs Validators.maxLength",
 * "a select needs Validators.required", etc.
 *
 * The agent never sees this file. It just says `type: 'text'` and this
 * registry deterministically decides how that becomes a real control.
 */
export const FIELD_CONTROL_FACTORY: Record<
  FieldType,
  (field: FormFieldSpec) => FormControl
> = {
  text: (f) => new FormControl('', buildValidators(f)),
  textarea: (f) => new FormControl('', buildValidators(f)),
  number: (f) => new FormControl(null, buildValidators(f)),
  select: (f) => new FormControl(null, buildValidators(f)),
  checkbox: (f) => new FormControl(false, f.required ? [Validators.requiredTrue] : []),
  date: (f) => new FormControl(null, buildValidators(f)),
};

function buildValidators(field: FormFieldSpec) {
  const validators = [];
  if (field.required) {
    validators.push(Validators.required);
  }
  if (field.maxLength) {
    validators.push(Validators.maxLength(field.maxLength));
  }
  return validators;
}

/** Whitelist used to reject anything the agent invents outside this set. */
export const SUPPORTED_FIELD_TYPES: FieldType[] = Object.keys(
  FIELD_CONTROL_FACTORY
) as FieldType[];
