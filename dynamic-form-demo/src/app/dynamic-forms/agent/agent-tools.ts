import { FieldOption, FieldType, FormFieldSpec, FormSpec } from '../models/form-spec.model';
import { SUPPORTED_FIELD_TYPES } from '../registry/field-control.registry';

/**
 * These are the ONLY functions an "agent" (LLM) is allowed to invoke.
 * In a real system these would be exposed as tool/function-calling
 * definitions to the model. Here we call them directly from mocked
 * agent output to demonstrate the same execution path.
 *
 * Every call is validated. Invalid input never reaches a FormSpec.
 */

export type AddFieldArgs = {
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  maxLength?: number;
};

export type AddSelectFieldArgs = {
  id: string;
  label: string;
  required?: boolean;
  optionsSource?: string;
  staticOptions?: FieldOption[];
};

export class ToolValidationError extends Error {}

export class AgentToolHandler {
  private spec: Partial<FormSpec> | null = null;
  private fields: FormFieldSpec[] = [];
  private order = 0;

  /** Optional: per-formId allow-list so the agent can't invent backend fields. */
  private static ALLOWED_FIELD_IDS: Record<string, string[]> = {
    'add-organization': ['name', 'shortName', 'parentOrgId', 'ownerId'],
  };

  startForm(formId: string, title: string, description?: string): void {
    if (!formId || !title) {
      throw new ToolValidationError('startForm requires formId and title');
    }
    this.spec = { formId, title, description };
    this.fields = [];
    this.order = 0;
  }

  addField(args: AddFieldArgs): void {
    this.assertStarted();
    this.assertFieldAllowed(args.id);

    if (!SUPPORTED_FIELD_TYPES.includes(args.type)) {
      throw new ToolValidationError(`Unsupported field type: ${args.type}`);
    }
    if (args.type === 'select') {
      throw new ToolValidationError('Use addSelectField for select-type fields');
    }

    this.fields.push({
      id: args.id,
      label: args.label,
      type: args.type,
      required: args.required,
      placeholder: args.placeholder,
      helpText: args.helpText,
      maxLength: args.maxLength,
      order: this.order++,
    });
  }

  addSelectField(args: AddSelectFieldArgs): void {
    this.assertStarted();
    this.assertFieldAllowed(args.id);

    if (!args.optionsSource && !args.staticOptions) {
      throw new ToolValidationError(
        `addSelectField for "${args.id}" needs optionsSource or staticOptions`
      );
    }

    this.fields.push({
      id: args.id,
      label: args.label,
      type: 'select',
      required: args.required,
      optionsSource: args.optionsSource,
      staticOptions: args.staticOptions,
      order: this.order++,
    });
  }

  finalizeForm(submitLabel = 'Submit'): FormSpec {
    this.assertStarted();
    if (this.fields.length === 0) {
      throw new ToolValidationError('Cannot finalize a form with no fields');
    }
    const finalSpec: FormSpec = {
      formId: this.spec!.formId!,
      title: this.spec!.title!,
      description: this.spec!.description,
      submitLabel,
      fields: this.fields,
    };
    this.spec = null;
    return finalSpec;
  }

  private assertStarted() {
    if (!this.spec) {
      throw new ToolValidationError('startForm must be called before adding fields');
    }
  }

  private assertFieldAllowed(fieldId: string) {
    const allowList = AgentToolHandler.ALLOWED_FIELD_IDS[this.spec?.formId ?? ''];
    if (allowList && !allowList.includes(fieldId)) {
      throw new ToolValidationError(
        `Field "${fieldId}" is not allowed for form "${this.spec?.formId}"`
      );
    }
  }
}
