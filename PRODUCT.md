# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The office that runs hostel allocation at an institute: wardens, deans of student affairs and housing officers. They work in a multi-tenant admin console, often across several institutes and workspaces. Students are participants, not users: they answer twelve questions through a private tokenized link and have no account.

## Product Purpose

Roommate Matcher is a room-allocation desk. It turns student preference responses and a room inventory into a proposed set of room assignments, a written reason for every student, a fairness statement and an audit trail. Success is a proposal a responsible person can sign without reading raw student answers, with every at-risk case surfaced before keys are issued.

## Positioning

Four hard boundaries — gender, year group, AC type, room size — split the cohort before any compatibility is scored; nothing crosses a boundary. Inside each segment, ten weighted factors and a room-size-specific matching strategy produce the proposal, and a swap pass only accepts changes that strictly improve the weakest student without creating a new Poor case. The output is a signed proposal, not an automatic key issue.

## Operating Context

Institutes upload a student roster and (optionally) a room inventory. Segment keys are immutable and derived from the four boundaries. Students submit responses via a tokenized link validated against the roster; only the latest valid response counts. A run produces versioned, append-only artifacts. A person reviews at-risk cases and signs before keys are issued. A manual checker gives an after-hours second opinion on a proposed group; it is advisory and never creates a run, edits a room or issues a key.

## Capabilities and Constraints

- Ten weighted factors, weights summing to 1.0; missing answers are excluded and remaining weights renormalised.
- Satisfaction labels: Excellent (score >= 0.90 with all heavy factors non-zero), Good (>= 0.70), Okay (>= 0.55), Poor (below 0.55). At-risk is score < 0.55.
- Room strategies: 2-bed maximum-weight matching; 3-bed blossom-seeded growth from the fewest-options student; 4-bed pair-then-merge over six edges; post-pass swap optimisation over up to three passes.
- Fairness reports the floor: label distribution, every at-risk student, the weakest room in each segment.
- Deterministic: identical inputs produce identical outputs, including tie-breaks.
- Wardens never see raw student answers, only privacy-safe reasons.
- The product is an allocation aid, not a legal audit; a person remains responsible.

## Brand Commitments

The product name is Roommate Matcher. No institution, hall, term or academic calendar may be invented in product copy; sample cohorts are labelled as illustrative. Sample figures must be internally consistent with the on-page simulation.

## Evidence on Hand

The repository contains the working admin console, the backend matching engine and README documentation of the scoring model, labels, matching strategies and fairness outputs. There are no customer testimonials, logos, counts, prices or case studies; none may be fabricated.

## Product Principles

1. The boundary decides the cohort before compatibility decides the room.
2. Explain the weakest student, not the average one.
3. A person signs; the system proposes.
4. Privacy is structural: reasons, never raw answers.
5. Same inputs, same outputs, including ties.

## Accessibility & Inclusion

Web surface, keyboard operable, visible focus, reduced-motion support. No product-specific standard was established beyond this build's brief.

<!-- Inferred under the init fallback: this file was written from the build brief and repository evidence, with no interview available to this subagent. -->
