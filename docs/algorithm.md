# Roommate Matcher Algorithm Overview

This document summarizes the algorithmic core used in this repository.
It is intentionally concise and reviewer-focused.

## 1) Segmentation and matching boundary

Matching is run independently per `segment_key`.
A segment groups students by policy-controlled attributes (gender, year group, AC type, and room size).
No cross-segment assignment is allowed.

## 2) Pairwise scoring model

For every student pair in a segment, the scoring pipeline computes:

- `pair_score` in `[0, 1]`
- `factor_breakdown` with per-factor score and effective weight
- `excellent_candidate` safety flag

### 2.1 Factor weights (v1 constants)

| Factor key | Meaning                           | Weight |
| ---------- | --------------------------------- | ------ |
| `q1_enc`   | Sleep schedule                    | 0.20   |
| `q2_enc`   | Cleanliness                       | 0.15   |
| `q3_enc`   | Late return time                  | 0.10   |
| `q4a_enc`  | Room use habit/comfort axis       | 0.10   |
| `q5a_enc`  | Night activity habit/comfort axis | 0.10   |
| `q6_enc`   | Smoking preference                | 0.15   |
| `q7_enc`   | Alcohol preference                | 0.05   |
| `q8_enc`   | Diet preference                   | 0.05   |
| `q9_enc`   | Budget/lifestyle expectation      | 0.05   |
| `q10_enc`  | Lifestyle tolerance               | 0.05   |

Weights sum to 1.0.

### 2.2 Scoring patterns

1. Distance lookup factors (`q1`, `q2`, `q3`, `q9`)

- Score comes from exact lookup tables by absolute encoded distance.

2. Habit-comfort directional mismatch (`q4`, `q5`)

- Directional mismatch:
  - `mismatch(A->B) = max(0, habit_A_norm - comfort_B_norm)`
- Symmetric axis mismatch:
  - average of `mismatch(A->B)` and `mismatch(B->A)`
- Axis score:
  - `1 - mismatch_axis`

3. Pairwise matrix factors (`q6`, `q7`, `q8`)

- Smoking uses its own matrix.
- Alcohol and diet share a different matrix.
- Notably, `(2,3)` differs between smoking and alcohol/diet.

4. Lifestyle tolerance (`q10`)

- Symmetric normalized absolute-difference score.

### 2.3 Missing preferences handling

If one side of a factor is missing, that factor is marked `missing_data=True` and excluded from weighted aggregation.
Remaining factor weights are renormalized over available factors.

### 2.4 Final pair score

`pair_score = sum(raw_factor_score * weight_used)`

The result is clamped to `[0,1]`.

### 2.5 Excellent safety condition

A pair is `excellent_candidate` only if:

- `pair_score >= 0.90`
- every heavy factor is strictly non-zero

Heavy factors are: sleep, cleanliness, room-use axis, night-activity axis, and smoking.

## 3) Segment-level room matching

The matching engine is deterministic and pure (no DB/API dependency).

### 3.1 2-bed segments

- Build complete weighted graph over students.
- Run max-weight matching (`networkx.max_weight_matching`, max cardinality).

### 3.2 3-bed segments

- Start from blossom pairs as seed units.
- Handle leftover singleton seed if needed.
- Grow each unit to 3 members by best available candidate based on pair averages.
- Prioritize units with fewer good third-member options first.

### 3.3 4-bed segments

- Build high-quality pairs first.
- Merge pair+pair into rooms of 4 by maximizing mean of all 6 internal pair scores.
- Tie-break using deterministic ordering.

### 3.4 Swap optimization pass

After initial assignment:

- Compute per-student satisfaction (average pair score vs roommates).
- Try cross-room one-for-one swaps.
- Accept swap only if minimum satisfaction improves and no new `Poor` label is introduced.
- Cap at 3 passes.

## 4) Satisfaction labels and at-risk definition

Per-student satisfaction labels:

- `Excellent`: score >= 0.90 and excellent safety passes
- `Good`: score >= 0.70
- `Okay`: score >= 0.55
- `Poor`: otherwise

At-risk flag:

- `is_at_risk = satisfaction_score < 0.55`

## 5) Explainability pipeline

Explanations are generated from scoring `factor_breakdown` and room context.

- 2-bed: use direct pair factors.
- 3/4-bed: aggregate per-student signals across all roommate edges.
- Output 2-3 reasons with factor trace metadata.
- Sensitive lifestyle factors (smoking/alcohol/diet) are rendered with privacy-safe wording.

The Manual Checker uses the same explanation service as main matching to keep outputs consistent.

## 6) Fairness outputs

Fairness service computes:

- run-level label counts and percentages
- run-level at-risk counts and IDs
- segment-level distributions, at-risk counts, and minimum satisfaction

These artifacts are persisted per matching run and surfaced in the admin reports view.
