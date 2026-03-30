from app.services.scoring.segment_matrix import compute_segment_pair_scores
from app.services.scoring.types import ScoringProfile


def _profile(admission_number: str, sleep: float) -> ScoringProfile:
    return ScoringProfile(
        admission_number=admission_number,
        has_preferences=True,
        q1_enc=sleep,
        q2_enc=1.0,
        q3_enc=1.0,
        q4a_enc=0.0,
        q4b_enc=3.0,
        q5a_enc=0.0,
        q5b_enc=3.0,
        q6_enc=1.0,
        q7_enc=1.0,
        q8_enc=1.0,
        q9_enc=1.0,
        q10_enc=0.0,
    )


def test_compute_segment_pair_scores_returns_undirected_edges() -> None:
    profiles = [
        _profile("ADM003", 1.0),
        _profile("ADM001", 1.0),
        _profile("ADM002", 2.0),
    ]

    result = compute_segment_pair_scores(profiles)

    assert set(result) == {
        ("ADM001", "ADM002"),
        ("ADM001", "ADM003"),
        ("ADM002", "ADM003"),
    }

    for admission_a, admission_b in result:
        assert admission_a != admission_b


def test_compute_segment_pair_scores_is_deterministic_for_input_order() -> None:
    set_a = [
        _profile("ADM001", 1.0),
        _profile("ADM002", 2.0),
        _profile("ADM003", 3.0),
    ]
    set_b = [
        _profile("ADM003", 3.0),
        _profile("ADM001", 1.0),
        _profile("ADM002", 2.0),
    ]

    result_a = compute_segment_pair_scores(set_a)
    result_b = compute_segment_pair_scores(set_b)

    assert set(result_a) == set(result_b)
    for edge, pair_result in result_a.items():
        assert pair_result.pair_score == result_b[edge].pair_score
