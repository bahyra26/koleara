import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

type BaseFieldProps = {
  id: string;
  label: string;
  helperText?: string;
  error?: string;
};

function controlClasses(hasError: boolean, className: string): string {
  return `w-full rounded-md border bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 disabled:bg-neutral-100 disabled:text-neutral-500 ${
    hasError
      ? "border-neutral-900 ring-1 ring-neutral-900"
      : "border-neutral-300"
  } ${className}`.trim();
}

function Field({
  id,
  label,
  helperText,
  error,
  children,
}: BaseFieldProps & {
  children: (describedBy: string | undefined) => ReactNode;
}) {
  const describedBy = error
    ? `${id}-error`
    : helperText
      ? `${id}-helper`
      : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-neutral-900">
        {label}
      </label>
      {children(describedBy)}
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="text-xs font-medium text-neutral-900"
        >
          {error}
        </p>
      ) : helperText ? (
        <p id={`${id}-helper`} className="text-xs text-neutral-600">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}

type InputProps = BaseFieldProps & InputHTMLAttributes<HTMLInputElement>;

export function Input({
  id,
  label,
  helperText,
  error,
  className = "",
  ...props
}: InputProps) {
  return (
    <Field id={id} label={label} helperText={helperText} error={error}>
      {(describedBy) => (
        <input
          id={id}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy}
          className={controlClasses(Boolean(error), className)}
          {...props}
        />
      )}
    </Field>
  );
}

type TextareaProps = BaseFieldProps &
  TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({
  id,
  label,
  helperText,
  error,
  className = "",
  ...props
}: TextareaProps) {
  return (
    <Field id={id} label={label} helperText={helperText} error={error}>
      {(describedBy) => (
        <textarea
          id={id}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy}
          className={controlClasses(Boolean(error), className)}
          {...props}
        />
      )}
    </Field>
  );
}

type SelectProps = BaseFieldProps & SelectHTMLAttributes<HTMLSelectElement>;

export function Select({
  id,
  label,
  helperText,
  error,
  className = "",
  children,
  ...props
}: SelectProps) {
  return (
    <Field id={id} label={label} helperText={helperText} error={error}>
      {(describedBy) => (
        <select
          id={id}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy}
          className={controlClasses(Boolean(error), className)}
          {...props}
        >
          {children}
        </select>
      )}
    </Field>
  );
}
