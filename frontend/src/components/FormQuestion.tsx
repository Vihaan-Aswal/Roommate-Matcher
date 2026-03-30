interface QuestionOption {
  label: string;
  value: string;
}

interface FormQuestionProps {
  id: string;
  title: string;
  prompt: string;
  options: QuestionOption[];
  value: string;
  error?: string;
  onChange: (value: string) => void;
}

export function FormQuestion({
  id,
  title,
  prompt,
  options,
  value,
  error,
  onChange,
}: FormQuestionProps): JSX.Element {
  return (
    <fieldset className="rounded-2xl border border-border/80 bg-white p-5 shadow-sm">
      <legend className="px-2 text-sm font-semibold tracking-wide text-primary">
        {title}
      </legend>
      <p className="mt-1 text-sm leading-relaxed text-foreground">{prompt}</p>

      <div className="mt-4 space-y-2">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-transparent px-3 py-2 transition hover:border-primary/40 hover:bg-muted/50"
          >
            <input
              type="radio"
              name={id}
              value={option.value}
              checked={value === option.value}
              onChange={(event) => onChange(event.target.value)}
              className="mt-1 h-4 w-4 accent-primary"
            />
            <span className="text-sm text-foreground">{option.label}</span>
          </label>
        ))}
      </div>

      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </fieldset>
  );
}
