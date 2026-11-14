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
  index?: number;
  onChange: (value: string) => void;
}

/**
 * One question, one page-ish block: a mono number, the question in serif, and
 * options as full-width rows so a thumb can hit them.
 */
export function FormQuestion({
  id,
  title,
  prompt,
  options,
  value,
  error,
  index,
  onChange,
}: FormQuestionProps): JSX.Element {
  const errorId = `${id}-error`;

  return (
    <fieldset
      className="desk-question"
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
    >
      <legend className="desk-question-legend">
        {typeof index === "number" ? <span className="desk-question-num">{String(index + 1).padStart(2, "0")}</span> : null}
        <span className="desk-question-title">{title}</span>
      </legend>
      <p className="desk-question-prompt">{prompt}</p>

      <div className="desk-options">
        {options.map((option) => (
          <label
            className="desk-option"
            key={option.value}
            data-checked={value === option.value}
          >
            <input
              type="radio"
              name={id}
              value={option.value}
              checked={value === option.value}
              onChange={(event) => onChange(event.target.value)}
              className="desk-radio"
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>

      {error ? (
        <p className="desk-error" id={errorId}>
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
