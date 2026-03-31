from __future__ import annotations

import argparse
import json
import random
from dataclasses import asdict, dataclass
from itertools import combinations

from app.services.explainability.contracts import RoomExplanationContext
from app.services.explainability.service import generate_room_explanations
from app.services.fairness.distribution import compute_fairness_distribution
from app.services.matching.contracts import SegmentData
from app.services.matching.engine import run_matching_for_segment
from app.services.scoring.pipeline import compute_pair_score
from app.services.scoring.types import PairResult, ScoringProfile


@dataclass(frozen=True)
class Scenario:
    name: str
    segment_key: str
    room_size: int
    profiles: list[ScoringProfile]


def _make_profile(
    *,
    student_id: str,
    q1: float,
    q2: float,
    q3: float,
    q4a: float,
    q4b: float,
    q5a: float,
    q5b: float,
    q6: float,
    q7: float,
    q8: float,
    q9: float,
    q10: float,
) -> ScoringProfile:
    return ScoringProfile(
        admission_number=student_id,
        has_preferences=True,
        q1_enc=q1,
        q2_enc=q2,
        q3_enc=q3,
        q4a_enc=q4a,
        q4b_enc=q4b,
        q5a_enc=q5a,
        q5b_enc=q5b,
        q6_enc=q6,
        q7_enc=q7,
        q8_enc=q8,
        q9_enc=q9,
        q10_enc=q10,
    )


def _base_profile(student_id: str) -> ScoringProfile:
    return _make_profile(
        student_id=student_id,
        q1=0,
        q2=0,
        q3=0,
        q4a=0,
        q4b=3,
        q5a=0,
        q5b=3,
        q6=1,
        q7=1,
        q8=1,
        q9=0,
        q10=3,
    )


def _build_scenarios() -> list[Scenario]:
    return [
        Scenario(
            name="excellent_2bed",
            segment_key="SEG_EXCELLENT",
            room_size=2,
            profiles=[
                _base_profile("EX_A"),
                _base_profile("EX_B"),
            ],
        ),
        Scenario(
            name="good_2bed",
            segment_key="SEG_GOOD",
            room_size=2,
            profiles=[
                _base_profile("GD_A"),
                _make_profile(
                    student_id="GD_B",
                    q1=1,
                    q2=0,
                    q3=0,
                    q4a=0,
                    q4b=3,
                    q5a=1,
                    q5b=0,
                    q6=2,
                    q7=2,
                    q8=3,
                    q9=2,
                    q10=3,
                ),
            ],
        ),
        Scenario(
            name="okay_2bed",
            segment_key="SEG_OKAY",
            room_size=2,
            profiles=[
                _base_profile("OK_A"),
                _make_profile(
                    student_id="OK_B",
                    q1=1,
                    q2=1,
                    q3=2,
                    q4a=1,
                    q4b=0,
                    q5a=2,
                    q5b=3,
                    q6=3,
                    q7=1,
                    q8=1,
                    q9=1,
                    q10=3,
                ),
            ],
        ),
        Scenario(
            name="poor_sensitive_2bed",
            segment_key="SEG_POOR",
            room_size=2,
            profiles=[
                _base_profile("PR_A"),
                _make_profile(
                    student_id="PR_B",
                    q1=2,
                    q2=1,
                    q3=0,
                    q4a=0,
                    q4b=2,
                    q5a=1,
                    q5b=3,
                    q6=3,
                    q7=3,
                    q8=3,
                    q9=1,
                    q10=0,
                ),
            ],
        ),
    ]


def _build_pair_results(profiles: list[ScoringProfile]) -> dict[tuple[str, str], PairResult]:
    ordered = sorted(profiles, key=lambda profile: profile.admission_number)
    pair_results: dict[tuple[str, str], PairResult] = {}
    for profile_a, profile_b in combinations(ordered, 2):
        key = (profile_a.admission_number, profile_b.admission_number)
        pair_results[key] = compute_pair_score(profile_a, profile_b)
    return pair_results


def _build_context_for_room(segment_key: str, room) -> RoomExplanationContext:
    student_satisfaction = {student.student_id: student.satisfaction_score for student in room["students"]}
    student_labels = {student.student_id: student.satisfaction_label for student in room["students"]}
    student_at_risk = {student.student_id: student.is_at_risk for student in room["students"]}
    return RoomExplanationContext(
        segment_key=segment_key,
        room_id=room["assignment"].room_id,
        room_size=room["assignment"].room_size,
        student_ids=room["assignment"].student_ids,
        pair_results=room["pair_results"],
        student_satisfaction=student_satisfaction,
        student_labels=student_labels,
        student_at_risk=student_at_risk,
        reason_mode="assigned_room",
    )


def run_evaluation(*, selected_scenario: str = "all", seed: int | None = None) -> dict[str, object]:
    scenarios = _build_scenarios()
    if selected_scenario != "all":
        scenarios = [scenario for scenario in scenarios if scenario.name == selected_scenario]
        if not scenarios:
            raise ValueError(f"Unknown scenario: {selected_scenario}")

    if seed is not None:
        shuffled = list(scenarios)
        random.Random(seed).shuffle(shuffled)
        scenarios = shuffled

    output_scenarios: list[dict[str, object]] = []
    fairness_records: list[dict[str, object]] = []
    privacy_ok = True

    for scenario in scenarios:
        pair_results = _build_pair_results(scenario.profiles)
        segment_data = SegmentData(
            segment_key=scenario.segment_key,
            room_size=scenario.room_size,
            student_ids=sorted(profile.admission_number for profile in scenario.profiles),
            pair_results=pair_results,
            room_ids=None,
            metadata={"scenario": scenario.name},
        )
        matching_result = run_matching_for_segment(segment_data)

        student_lookup = {student.student_id: student for student in matching_result.students}
        room_outputs: list[dict[str, object]] = []

        for room_assignment in matching_result.rooms:
            room_students = [student_lookup[student_id] for student_id in room_assignment.student_ids]
            context = _build_context_for_room(
                scenario.segment_key,
                {
                    "assignment": room_assignment,
                    "students": room_students,
                    "pair_results": pair_results,
                },
            )

            try:
                room_explanations = generate_room_explanations(context)
            except Exception:
                privacy_ok = False
                raise

            room_outputs.append(
                {
                    "assignment": asdict(room_assignment),
                    "students": [asdict(student) for student in room_students],
                    "explanations": [asdict(explanation) for explanation in room_explanations],
                }
            )

        for student in matching_result.students:
            fairness_records.append(
                {
                    "student_id": student.student_id,
                    "segment_key": scenario.segment_key,
                    "satisfaction_score": student.satisfaction_score,
                    "satisfaction_label": student.satisfaction_label,
                    "is_at_risk": student.is_at_risk,
                }
            )

        output_scenarios.append(
            {
                "scenario": scenario.name,
                "segment_key": scenario.segment_key,
                "room_size": scenario.room_size,
                "student_count": len(scenario.profiles),
                "rooms": room_outputs,
                "matching_summary": {
                    "label_counts": matching_result.label_counts,
                    "at_risk_student_ids": matching_result.at_risk_student_ids,
                    "minimum_satisfaction": matching_result.minimum_satisfaction,
                },
            }
        )

    fairness_report = compute_fairness_distribution(fairness_records)
    return {
        "scenarios": output_scenarios,
        "fairness": asdict(fairness_report),
        "privacy_check": "PASS" if privacy_ok else "FAIL",
    }


def _format_text_report(report: dict[str, object]) -> str:
    lines: list[str] = []

    for scenario in report["scenarios"]:
        lines.append(
            f"Scenario: {scenario['scenario']} | room_size={scenario['room_size']} | students={scenario['student_count']}"
        )
        for room in scenario["rooms"]:
            assignment = room["assignment"]
            lines.append(
                f"  Room {assignment['room_id']}: group_score={assignment['group_score']:.4f}, needs_review={assignment['needs_review']}"
            )
            for student in room["students"]:
                lines.append(
                    "    "
                    f"Student {student['student_id']}: label={student['satisfaction_label']} "
                    f"score={student['satisfaction_score']:.4f} at_risk={student['is_at_risk']}"
                )
            for explanation in room["explanations"]:
                lines.append(f"    Explanations for {explanation['student_id']}:")
                for reason in explanation["reasons"]:
                    lines.append(f"      - {reason}")

    lines.append("Fairness Summary:")
    fairness = report["fairness"]
    lines.append(
        "  Run labels: "
        + ", ".join(
            f"{label}={count}" for label, count in fairness["run_label_counts"].items()
        )
    )
    lines.append(
        "  Run percentages: "
        + ", ".join(
            f"{label}={pct:.4f}" for label, pct in fairness["run_label_percentages"].items()
        )
    )
    lines.append(
        f"  At risk: count={fairness['run_at_risk_count']} ids={','.join(fairness['run_at_risk_student_ids'])}"
    )
    lines.append("  Segment summaries:")
    for segment in fairness["by_segment"]:
        lines.append(
            f"    - {segment['segment_key']}: total={segment['total_students']} "
            f"labels={segment['label_counts']} at_risk={segment['at_risk_count']}"
        )

    lines.append(f"Privacy Check: {report['privacy_check']}")
    return "\n".join(lines)


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Evaluate scoring, matching, explanation, and fairness pipeline.")
    parser.add_argument("--scenario", default="all", help="Scenario name to run or 'all'")
    parser.add_argument("--output", default="text", choices=["text", "json"], help="Output mode")
    parser.add_argument("--seed", type=int, default=None, help="Optional deterministic seed for scenario order")
    return parser


def main() -> int:
    parser = _build_parser()
    args = parser.parse_args()

    report = run_evaluation(selected_scenario=args.scenario, seed=args.seed)
    if args.output == "json":
        print(json.dumps(report, indent=2, sort_keys=True))
    else:
        print(_format_text_report(report))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
