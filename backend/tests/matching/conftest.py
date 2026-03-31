from __future__ import annotations

import pytest

from app.services.scoring.types import FactorScore, PairResult


@pytest.fixture
def pair_result_factory() -> object:
    def _build(score: float, *, excellent: bool | None = None) -> PairResult:
        if excellent is None:
            excellent = score >= 0.90
        return PairResult(
            pair_score=score,
            factor_breakdown={
                "q1_enc": FactorScore(raw_score=score, weight_used=1.0, missing_data=False),
            },
            excellent_candidate=excellent,
        )

    return _build
