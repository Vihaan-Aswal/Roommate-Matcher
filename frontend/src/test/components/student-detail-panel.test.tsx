import { render, screen } from "@testing-library/react";

import { StudentDetailPanel } from "../../components/panels/StudentDetailPanel";

describe("StudentDetailPanel", () => {
  it("redacts sensitive reasons and renders safe factor labels", () => {
    render(
      <StudentDetailPanel
        student={{
          admission_number: "MR009",
          full_name: "Privacy Student",
          room_id: "A-500",
          roommate_ids: ["MR010"],
          satisfaction_score: 0.42,
          satisfaction_label: "Poor",
          is_at_risk: true,
          reasons: [
            "Smoking preferences mismatch in this room.",
            "Noise schedule is not aligned.",
          ],
          factor_trace: [
            {
              factor_key: "q6_enc",
              factor_class: "Strong Mismatch",
              reason_bucket: "lifestyle",
              polarity: "mismatch",
              template_id: "privacy_safe_lifestyle",
              claim_scope: "student_specific_claim",
            },
          ],
        }}
      />, 
    );

    expect(
      screen.getByText(/Lifestyle preference alignment affects compatibility/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/smoking/i)).not.toBeInTheDocument();
    expect(screen.getByText("Lifestyle alignment")).toBeInTheDocument();
    expect(screen.getByText(/⚠ mismatch/i)).toBeInTheDocument();
  });
});
