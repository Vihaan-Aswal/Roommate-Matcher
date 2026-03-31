import { render, screen } from "@testing-library/react";

import { CheckerResultPanel } from "../../components/checker/CheckerResultPanel";
import { RoomStudentDetailPanel } from "../../components/panels/RoomStudentDetailPanel";
import { StudentDetailPanel } from "../../components/panels/StudentDetailPanel";

const BLOCKED_TERMS = /smok|alcohol|vegetarian|meat|diet/i;

describe("phase 7 privacy safeguards", () => {
  it("redacts blocked sensitive wording in student and room detail panels", () => {
    const student = {
      admission_number: "MR601",
      full_name: "Sensitive Student",
      room_id: "A-601",
      roommate_ids: ["MR602"],
      satisfaction_score: 0.41,
      satisfaction_label: "Poor" as const,
      is_at_risk: true,
      reasons: [
        "Smoking mismatch detected",
        "Alcohol preference mismatch",
        "Diet requirements conflict",
      ],
      factor_trace: [
        {
          factor_key: "q6_enc",
          factor_class: "Strong Mismatch" as const,
          reason_bucket: "lifestyle",
          polarity: "mismatch" as const,
          template_id: "privacy_lifestyle",
          claim_scope: "student_specific_claim" as const,
        },
      ],
    };

    const { container } = render(
      <>
        <StudentDetailPanel student={student} />
        <RoomStudentDetailPanel roomId="A-601" student={student} />
      </>,
    );

    expect(container.textContent).not.toMatch(BLOCKED_TERMS);
    expect(
      screen.getAllByText(
        /Lifestyle preference alignment affects compatibility/i,
      ).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Lifestyle alignment").length).toBeGreaterThan(
      0,
    );
  });

  it("redacts blocked wording in checker result panel", () => {
    const { container } = render(
      <CheckerResultPanel
        errorMessage={null}
        isRunning={false}
        result={{
          group_score: 0.55,
          group_label: "Okay",
          at_risk_students: ["MR701"],
          students: [
            {
              admission_number: "MR701",
              satisfaction_score: 0.44,
              satisfaction_label: "Poor",
              reasons: ["Smoking and alcohol mismatch observed"],
              is_at_risk: true,
              factor_trace: [
                {
                  factor_key: "q7_enc",
                  factor_class: "Strong Mismatch",
                  reason_bucket: "lifestyle",
                  polarity: "mismatch",
                  template_id: "checker_lifestyle",
                  claim_scope: "student_specific_claim",
                },
              ],
            },
          ],
        }}
      />,
    );

    expect(container.textContent).not.toMatch(BLOCKED_TERMS);
    expect(
      screen.getByText(/Lifestyle preference alignment affects compatibility/i),
    ).toBeInTheDocument();
  });
});
