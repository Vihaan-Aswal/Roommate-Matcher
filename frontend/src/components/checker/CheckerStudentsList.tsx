import type { SegmentStudentPreferenceRow } from "../../lib/apiClient";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

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
    <div className="desk-stack-sm">
      <label className="desk-field">
        <span className="desk-label">Search students</span>
        <Input
          placeholder="Admission number or name"
          value={searchTerm}
          onChange={(event) => onSearchTermChange(event.target.value)}
        />
      </label>

      <div className="desk-field">
        <p className="desk-label">
          Already in the room · {selectedExistingIds.length} chosen
        </p>
        <div className="desk-checklist">
          {filteredStudents.map((student) => (
            <label className="desk-check" key={student.admission_number}>
              <input
                checked={selectedExistingIds.includes(student.admission_number)}
                className="desk-checkbox"
                type="checkbox"
                onChange={() => onToggleExisting(student.admission_number)}
              />
              <span>{`${student.admission_number} - ${student.full_name}`}</span>
            </label>
          ))}

          {filteredStudents.length === 0 ? (
            <p className="desk-help">No student matches that search.</p>
          ) : null}
        </div>
      </div>

      <label className="desk-field">
        <span className="desk-label">Candidate student</span>
        <Select
          value={selectedCandidateId ?? "none"}
          onValueChange={(val) => onCandidateChange(val === "none" ? null : val)}
        >
          <SelectTrigger className="desk-input desk-select-radix">
            <SelectValue placeholder="Select candidate" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Select candidate</SelectItem>
            {candidateOptions.map((student) => (
              <SelectItem
                key={student.admission_number}
                value={student.admission_number}
              >
                {`${student.admission_number} - ${student.full_name}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
    </div>
  );
}
