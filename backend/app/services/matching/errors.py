from __future__ import annotations


class MatchingError(Exception):
    """Base class for all phase-3 matching errors."""


class SegmentValidationError(MatchingError):
    """Raised when segment input is invalid for matching."""


class InvalidPairMatrixError(MatchingError):
    """Raised when pair-score matrix shape or values are invalid."""


class IncompletePairMatrixError(MatchingError):
    """Raised when expected canonical pair edges are missing."""

    def __init__(self, missing_pairs: list[tuple[str, str]]) -> None:
        self.missing_pairs = sorted(missing_pairs)
        super().__init__(f"Missing {len(self.missing_pairs)} pair entries")


class MatchingConstructionError(MatchingError):
    """Raised when a matcher cannot build a full valid assignment."""


class InvalidMatchingOutputError(MatchingError):
    """Raised when matcher output shape is malformed."""


class InvariantViolationError(MatchingError):
    """Raised when final room assignment invariants fail."""
