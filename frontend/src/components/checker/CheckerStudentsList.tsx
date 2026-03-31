import type { SegmentStudentPreferenceRow } from "../../lib/apiClient";
import { Input } from "../ui/input";
import { Select } from "../ui/select";

interface CheckerStudentsListProps {
  students: SegmentStudentPreferenceRow[];
  selectedExistingIds: string[];
  selectedCandidateId: string | null;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onToggleExisting: (admissionNumber: string) => void;
  onCandidateChange: (admissionNumber: string | null) => void;
}

export function CheckerStudentsList({
  students,
  selectedExistingIds,
  selectedCandidateId,
  searchTerm,
  onSearchTermChange,
  onToggleExisting,
  onCandidateChange,
}: CheckerStudentsListProps): JSX.Element {
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredStudents = students.filter((student) => {
    if (!normalizedSearch) {
      return true;
    }

    return (
      student.admission_number.toLowerCase().includes(normalizedSearch) ||
      student.full_name.toLowerCase().includes(normalizedSearch)
    );
  });

  const candidateOptions = filteredStudents.filter(
    (student) => !selectedExistingIds.includes(student.admission_number),
  );

  return (
    <div className="space-y-4">
      <label className="block space-y-1 text-sm font-medium">
        Search students
        <Input
          placeholder="Search by admission number or name"
          value={searchTerm}
          onChange={(event) => onSearchTermChange(event.target.value)}
        />
      </label>

      <div className="space-y-2">
        <p className="text-sm font-medium">Existing students (multi-select)</p>
        <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-border/70 p-3">
          {filteredStudents.map((student) => (
            <label
              key={student.admission_number}
              className="flex items-start gap-2 text-sm"
            >
              <input
                checked={selectedExistingIds.includes(student.admission_number)}
                className="mt-0.5 h-4 w-4 rounded border-input"
                type="checkbox"
                onChange={() => onToggleExisting(student.admission_number)}
              />
              <span>
                {student.admission_number} - {student.full_name}
              </span>
            </label>
          ))}

          {filteredStudents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No students match search.
            </p>
          ) : null}
        </div>
      </div>

      <label className="block space-y-1 text-sm font-medium">
        Candidate student
        <Select
          value={selectedCandidateId ?? ""}
          onChange={(event) =>
            onCandidateChange(event.target.value ? event.target.value : null)
          }
        >
          <option value="">Select candidate</option>
          {candidateOptions.map((student) => (
            <option
              key={student.admission_number}
              value={student.admission_number}
            >
              {student.admission_number} - {student.full_name}
            </option>
          ))}
        </Select>
      </label>
    </div>
  );
}
