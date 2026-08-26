/**
 * FormSpec is the ONLY thing that crosses from the "Agent" side into the
 * rendering side. It is plain data — no functions, no API URLs, no markup.
 */

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'checkbox'
  | 'date';

export interface FieldOption {
  label: string;
  value: string | number;
}

export interface FormFieldSpec {
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  maxLength?: number;

  /**
   * Symbolic key only, e.g. 'organizations.parentOptions'.
   * Resolved by OptionsResolverService. The agent never sees a real
   * endpoint or payload — just this key.
   */
  optionsSource?: string;

  /** Small, fixed option sets the agent is allowed to specify directly. */
  staticOptions?: FieldOption[];

  order: number;
}

export interface FormSpec {
  formId: string;
  title: string;
  description?: string;
  submitLabel?: string;
  fields: FormFieldSpec[];
}

/** What DynamicFormComponent emits on submit — still plain data, no API call. */
export interface FormSubmitEvent {
  formId: string;
  value: Record<string, any>;
}
