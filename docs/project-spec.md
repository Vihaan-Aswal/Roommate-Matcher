# Roommate Matcher – Full Project Specification

## 0. Purpose of this document

This document is a complete blueprint for the Roommate Matcher project. It consolidates everything we discussed:

- Core logic and philosophy
- Data collection and inputs
- Scoring engine and weights
- Matching algorithms for 2-, 3-, and 4-person rooms
- Admin dashboard & UI/UX
- Privacy and explainability
- Edge cases, error handling, and operational policies

It is written so that product, design, and engineering can all work from the same source of truth.

---

## 1. High-level overview

### 1.1 One-line idea

Roommate Matcher assigns students to rooms by respecting physical and policy constraints and optimizing for compatibility on lifestyle factors. It avoids random matching, explains every match in plain language, and surfaces fairness issues so admins can review at-risk cases.

### 1.2 Problem today

- Matching is often random or overly simplistic (e.g., only gender or “non-smoker”).
- Preferences are ignored, leading to avoidable conflicts (sleep/cleanliness/noise/etc.).
- Students and admins lack explanations for why certain people were paired.
- Some students repeatedly get worse matches; there is no fairness visibility.
- Group rooms (3–4 people) are especially hard: local good pairs don’t always form good groups.

### 1.3 Our solution

A web-based tool for housing admins that:

1. Takes a master list of students and room segments from the institution.
2. Collects lifestyle and room preference data from students via a short form.
3. For each homogeneous segment (e.g., Male · 1st year · AC · 2-bed):
   - Computes compatibility scores between every pair.
   - Assigns students into rooms of 2, 3, or 4 using a fair and explainable heuristic.
4. Produces:
   - Assignments: who shares which room
   - Per-student explanations: 2–3 reasons why this is a reasonable match
   - Fairness views: who is at risk (poor matches) and basic satisfaction distribution

### 1.4 Key principles

- **Segmentation first:** We do not decide who gets AC, which hostel, or which gender block. That is upstream. We only match compatible roommates within each segment.
- **Hard vs soft constraints:**
  - **Hard constraints:** physical and policy rules that must never be broken (capacity, gender segmentation, segment membership, rare medical exceptions)
  - **Soft constraints:** lifestyle preferences (sleep, visitors, smoking, etc.) that shape scores but don’t make matches impossible
- **Transparency & explainability:** A small set of named factors drives the score; explanations use those factors in plain English.
- **Privacy respecting:** Sensitive preferences (smoking/drinking/diet) are collected as room-related preferences, not “how often do you do X”, and never exposed in raw form in admin UI.
- **Fairness by design:** The algorithm tries to avoid very bad matches and the UI highlights at-risk students for manual review.
- **Batch first, tools for exceptions:** Primary value is a strong initial matching at term start. Mid-semester changes are supported via a “Manual Checker”, not by rematching everyone.

---

## 2. Scope and non-goals

### 2.1 In scope

- Matching students to roommates within homogeneous segments defined by the institution
- Handling 2-, 3-, and 4-person rooms
- Collecting and validating student preferences through a form
- Computing compatibility scores and room/group scores
- Providing admin UI to upload data, run matching, view results, and download assignments
- Showing basic fairness and satisfaction distributions
- Providing a manual compatibility checker for mid-semester changes

### 2.2 Explicitly out of scope (v1)

- Deciding who gets which hostel, block, or AC/non-AC
- Enforcing gender policies (we assume segments are gender-homogeneous)
- Optimizing for distance to classrooms, floor assignments, or building allocation
- Live, continuous re-matching as students join/leave; we do not reshuffle the whole system mid-semester
- Complex legal or discrimination checks; we focus on operational fairness and comfort

---

## 3. Core concepts & data model

### 3.1 Core entities

#### 1. Student

- `admission_number` (primary key)
- `full_name`
- `gender`
- `year_group` (e.g., `1st_year`, `2nd_to_4th` or more granular)
- `ac_type` (e.g., `AC`, `NonAC`)
- `room_size` (`2`, `3`, or `4`)
- `dob` (for validation only)
- `segment_key` (see below)

#### 2. Segment

Logical group where matching happens independently.

Canonical v1 structure:

- `gender` (e.g., `M` / `F`)
- `year_group` (e.g., `1st_year`, `2nd_to_4th`)
- `ac_type` (`AC` / `NonAC`)
- `room_size` (`2` / `3` / `4`)
- `segment_key = gender + "_" + year_group + "_" + ac_type + "_" + room_size`

#### 3. Room (within segment)

- `room_id` (e.g., `A-201`, `Block B-305`)
- `capacity` (must match `room_size` of the segment)
- Belongs to exactly one segment

#### 4. Preference profile (per student)

- Answers to 12 questions (see Section 4) transformed into encoded values

#### 5. Pair score

- A numeric compatibility score `pair_score ∈ [0,1]` between two students in the same segment

#### 6. Room assignment

- For each room, a list of student IDs occupying that room

Derived values:

- **Group score:** average of `pair_scores` for all pairs within the room
- **Per-student satisfaction:** for each student, the average `pair_score` with their roommates

### 3.2 Files & storage

#### 3.2.1 Admin master file (Step 0 – Manual input)

`master_students.csv` (or equivalent import) contains:

- `admission_number` (required, unique)
- `full_name`
- `gender`
- `year_group`
- `ac_type`
- `room_size`
- `dob`
- Optional: `segment_override` if admins want custom segmentation

The system derives `segment_key` for each student.

#### 3.2.2 Rooms file (optional)

`rooms.csv` for explicit room IDs and capacity per segment:

- `room_id`
- `segment_key`
- `capacity` (`2`, `3`, or `4`)

If not provided, the system can auto-create generic room IDs within each segment (e.g., `SEG1-Room-001`, `Room-002`, etc.).

#### 3.2.3 Form responses

`form_responses` table (internal) stores:

- `timestamp`
- `admission_number`
- `dob`
- Answers to the 12 questions (raw options)

The backend validates each response:

- Check if `admission_number` exists in `master_students`
- Check if `dob` matches
- If both match:
  - Mark as `VALID` and update that student’s preference profile (latest timestamp wins)
- If not:
  - Mark as `INVALID` and exclude from matching

Final dataset for matching (per segment) is the join of `master_students` and the latest valid preference profile.

---

## 4. Student questionnaire (Final v1 question set)

**Total: 12 questions**

Design goals:

- Short and simple
- Focused on in-room behaviour and preferences, not moral judgment
- Sensitive topics framed as room preferences, not “how often do you drink/smoke”

### 4.1 Big daily conflict factors

#### Q1. Sleep schedule

**Question:**  
On most regular weekdays, when do you usually go to sleep?  
_(Think about a normal week, not exam days.)_

**Options:**

1. Before 11 PM (early)
2. 11 PM – 1 AM (normal)
3. 1 AM – 3 AM (late)
4. After 3 AM (very late)

#### Q2. Cleanliness / tidiness

**Question:**  
Which best describes how you keep your side of the room?

**Options:**

1. Very tidy – I like things clean and organized
2. Tidy – I clean up a few times a week
3. Relaxed – I clean when it looks messy

#### Q3. Late-night return time

**Question:**  
On most days, by what time are you usually back in your room/hostel?

**Options:**

1. Before 10 PM
2. Between 10 PM and midnight
3. Often after midnight

### 4.2 Room use, visitors, and night activity (Habit + comfort)

We separate:

- Your habit (what you do in the room)
- Your comfort with your roommate doing similar things

#### Q4a. Room use – Your habit

**Question:**  
How do you usually use your room?

**Options:**

0. Mainly for sleeping/studying, not for hanging out
1. Sometimes hang out with friends in the room
2. Often a hangout place, friends visit frequently

#### Q4b. Room use – Your comfort with others

**Question:**  
How comfortable are you if your roommate often invites friends / uses the room to hang out?

**Options:**

0. Very uncomfortable
1. Prefer to avoid, but can manage
2. Okay if it’s occasional
3. Fine even if it’s frequent

#### Q5a. Night activity – Your habit (Gaming/Streaming/Calls After 11 PM)

**Question:**  
After 11 PM, how often do you game/stream/call or chat in the room?

**Options:**

0. Almost never
1. Sometimes (a few nights a week)
2. Frequently (most nights)

#### Q5b. Night activity – Your comfort with others

**Question:**  
How comfortable are you if your roommate is often active at night (gaming/streaming/calls) in the room?

**Options:**

0. Very uncomfortable
1. Prefer to avoid, but can manage
2. Okay if occasional
3. Fine even if frequent

### 4.3 Preference factors for smoking, alcohol, and diet (Room-focused)

Sensitive factors are framed as room-related preferences, not “how often you do it”.

#### Q6. Smoking – In-room preference

**Question:**  
What is your preference about smoking related to your room?

**Options:**

1. I need a 100% smoke-free room
2. I don’t smoke but don’t mind if roommates smoke (following hostel rules)
3. I am a smoker

#### Q7. Alcohol – In-room preference

**Question:**  
What is your preference about alcohol related to your room?

**Options:**

1. I require an alcohol-free room
2. I don’t drink, but don’t mind if roommates store/drink responsibly
3. I may store or drink (where allowed)

#### Q8. Diet – In-room food preference

**Question:**  
What best describes your in-room food preference?

**Options:**

1. I am strict vegetarian and require a meat-free room
2. I am vegetarian but okay if roommates keep/cook non-veg
3. I am non-vegetarian

### 4.4 Budget & lifestyle tolerance

#### Q9. Shared budget / comfort level

**Question:**  
What’s your approach to shared room expenses (e.g., extra appliances, better Wi-Fi, etc.)?

**Options:**

1. Budget-conscious – prefer to keep costs low
2. Standard – okay with reasonable shared costs
3. Flexible – willing to spend more for extra comfort

#### Q10. Lifestyle tolerance (Global)

**Question:**  
In general, how comfortable are you living with someone whose lifestyle is different from yours (sleep time, social life, guests, etc.)?

**Options:**

0. I prefer someone very similar to me
1. I can manage some differences
2. I’m okay with many differences
3. I’m very flexible / open

> Optional future questions like explicit day-time presence or talkativeness can be added later; v1 focuses on the highest-impact items above.

---

## 5. Encoding and scoring model

We now specify how each answer is encoded numerically and combined into a pair compatibility score `pair_score ∈ [0,1]`.

### 5.1 Distance-based factors

These use simple categorical distances.

#### 5.1.1 Sleep schedule (Q1)

Encode:

- Early → `s = 1`
- Normal → `s = 2`
- Late → `s = 3`
- Very late → `s = 4`

For two students with `s1`, `s2`:

- `d = |s1 - s2|`
- If `d = 0` → `sleep_score = 1.0`
- If `d = 1` → `sleep_score = 0.6`
- If `d = 2` → `sleep_score = 0.2`
- If `d = 3` → `sleep_score = 0.0`

#### 5.1.2 Cleanliness (Q2)

Encode:

- Very tidy → `c = 1`
- Tidy → `c = 2`
- Relaxed → `c = 3`

For `c1`, `c2`:

- `d = |c1 - c2|`
- If `d = 0` → `clean_score = 1.0`
- If `d = 1` → `clean_score = 0.5`
- If `d = 2` → `clean_score = 0.0`

#### 5.1.3 Late-night return time (Q3)

Encode:

- Before 10 PM → `r = 1`
- 10 PM – midnight → `r = 2`
- Often after midnight → `r = 3`

For `r1`, `r2`:

- `d = |r1 - r2|`
- If `d = 0` → `late_return_score = 1.0`
- If `d = 1` → `late_return_score = 0.6`
- If `d = 2` → `late_return_score = 0.2`

#### 5.1.4 Budget style (Q9)

Encode:

- Budget-conscious → `b = 1`
- Standard → `b = 2`
- Flexible → `b = 3`

For `b1`, `b2`:

- `d = |b1 - b2|`
- If `d = 0` → `budget_score = 1.0`
- If `d = 1` → `budget_score = 0.7`
- If `d = 2` → `budget_score = 0.3`

### 5.2 Habit + comfort factors

Used for room use (Q4a/Q4b) and night activity (Q5a/Q5b).

General pattern:

- Habit `H` is in `{0,1,2}`
- Comfort `C` is in `{0,1,2,3}`
- Normalize:
  - `h_norm = H / 2` (∈ [0,1])
  - `c_norm = C / 3` (∈ [0,1])
- Directional mismatch:
  - `mismatch(A → B) = max(0, hA_norm - cB_norm)`
  - This is > 0 only if A’s habit is “stronger” than B’s comfort.
- Symmetric mismatch for the axis:
  - `mismatch_axis = ( mismatch(A→B) + mismatch(B→A) ) / 2`
- Axis score:
  - `axis_score = 1 - mismatch_axis`

#### 5.2.1 Room use & visitors (Q4a/Q4b)

- Habit: `H_room ∈ {0,1,2}` from Q4a
- Comfort: `C_room ∈ {0,1,2,3}` from Q4b

Apply the general habit/comfort formula:

- `room_use_score = axis_score(H_room, C_room)`

#### 5.2.2 Night activity / noise (Q5a/Q5b)

- Habit: `H_night ∈ {0,1,2}` from Q5a
- Comfort: `C_night ∈ {0,1,2,3}` from Q5b

Apply the same formula:

- `night_activity_score = axis_score(H_night, C_night)`

This ensures:

- Matching two quiet people → high score
- Matching a very active-at-night student with someone very uncomfortable → low score
- Matching a quiet person with someone who’s okay with noise → fine

### 5.3 Matrix factors: smoking, alcohol, diet (Q6–Q8)

We use a 3-level encoding:

- `1 = strict / need-free` (smoke-free, alcohol-free, meat-free)
- `2 = tolerant non-user` (doesn’t do it but okay if others do)
- `3 = user` (smoker / may drink / non-veg)

We then use a pairwise matrix for compatibility.

#### 5.3.1 Base encoding

For each factor:

- Smoking preference (Q6): `S ∈ {1,2,3}`
- Alcohol preference (Q7): `A ∈ {1,2,3}`
- Diet preference (Q8): `D ∈ {1,2,3}`

#### 5.3.2 Scoring logic

Base logic:

- Strict vs strict: `1.0`
- Tolerant vs tolerant: `1.0`
- User vs user: `1.0`
- Strict vs user: `0.0` (hard clash)
- Mixed but tolerant: moderate score (`0.6–0.7` depending on factor)

**Diet & Alcohol (less intense than smoking):**

- `(1,1)`, `(2,2)`, `(3,3)` → `1.0`
- `(1,2)` or `(2,1)` → `0.7` (both don’t consume, one stricter)
- `(2,3)` or `(3,2)` → `0.7` (tolerant non-user with user)
- `(1,3)` or `(3,1)` → `0.0` (strict vs user)

**Smoking (more serious due to health/smell):**

- `(1,1)`, `(2,2)`, `(3,3)` → `1.0`
- `(1,2)` or `(2,1)` → `0.6`
- `(2,3)` or `(3,2)` → `0.5`
- `(1,3)` or `(3,1)` → `0.0`

This yields three factor scores:

- `smoking_score ∈ [0,1]`
- `drinking_score ∈ [0,1]`
- `diet_score ∈ [0,1]`

### 5.4 Lifestyle tolerance (Q10)

Encode:

- Very similar → `L = 0`
- Some differences → `L = 1`
- Many differences okay → `L = 2`
- Very flexible / open → `L = 3`

Normalize:

- `L_norm = L / 3`

For two students:

- `lifestyle_score = 1 - |L1_norm - L2_norm|`

This is a soft factor used to smooth matches: rigid people are matched with rigid; flexible can match anyone.

---

## 6. Factor weights and final pair score

We assign weights based on how often each factor leads to serious roommate conflict:

| Factor                 | Symbol                 | Weight | Rationale                                             |
| ---------------------- | ---------------------- | -----: | ----------------------------------------------------- |
| Sleep schedule         | `sleep_score`          |     20 | Daily, highly disruptive mismatch                     |
| Cleanliness/tidiness   | `clean_score`          |     15 | Very common source of tension                         |
| Late-night return time | `late_return_score`    |     10 | Night disruption & lifestyle friction                 |
| Room use & visitors    | `room_use_score`       |     10 | “Quiet room” vs “social hangout” differences          |
| Night activity/noise   | `night_activity_score` |     10 | Affects sleep and study directly                      |
| Smoking preference     | `smoking_score`        |     15 | Daily habit, health, smell; more serious than alcohol |
| Drinking preference    | `drinking_score`       |      5 | Important but less frequent                           |
| Diet preference        | `diet_score`           |      5 | Sensitive in India, but not always daily conflict     |
| Budget style           | `budget_score`         |      5 | Practical but not as emotionally charged              |
| Lifestyle tolerance    | `lifestyle_score`      |      5 | Soft modifier, shouldn’t override core conflicts      |

**Total weight = 100**

### 6.1 Final pair score formula

For a pair of students `(A, B)`, after computing all factor scores in `[0,1]`:

```text
PairScore_raw =
  20 * sleep_score
+ 15 * clean_score
+ 10 * late_return_score
+ 10 * room_use_score
+ 10 * night_activity_score
+ 15 * smoking_score
+  5 * drinking_score
+  5 * diet_score
+  5 * budget_score
+  5 * lifestyle_score
```

````

```text
PairScore = PairScore_raw / 100.0
```

- `PairScore ∈ [0,1]` is the pair compatibility score.
- If some answers are missing, we can drop that factor and renormalize weights for that pair (v1 can require all questions to be answered to simplify).

---

## 7. Lifting pair scores to rooms & students

### 7.1 Group score (Room-level)

For a room with `k` students `{1,2,…,k}`:

- Compute `pairScore(i,j)` for all unordered pairs `(i,j)`
- Number of pairs: `k*(k-1)/2`
- `GroupScore(room) = average of all pair scores in that room`

This is displayed in Room View as the room’s overall compatibility.

### 7.2 Per-student satisfaction

For a given student `i` in a room:

- Let `R` be the set of their roommates in that room
- For each roommate `j ∈ R`, compute `pairScore(i,j)`
- `Satisfaction(i) = average of these pair scores`

This drives:

- The Satisfaction column in Student View
- The Excellent/Good/Okay/Poor labels
- Fairness metrics and at-risk flags

---

## 8. Thresholds & labels (Non-random, reasoned)

We define qualitative buckets for satisfaction based on the structure of the weights.

### 8.1 Observations

- If one heavy factor (e.g., Smoking, weight 15) is a complete clash (`score = 0`) and all others are perfect (`score = 1`):
  - `PairScore = (100 - 15)/100 = 0.85`

- If two heavy factors (e.g., Sleep + Smoking = 35) are complete clashes and the rest perfect:
  - `PairScore = (100 - 35)/100 = 0.65`

Interpretation:

- Scores below `~0.65` almost certainly involve multiple significant clashes
- Scores above `~0.85` can still hide one heavy clash if we are not careful

### 8.2 Label scheme (with safety rule)

#### 1. Excellent

- Numeric: `PairScore ≥ 0.90`
- Additional rule: no heavy-factor score (Sleep, Cleanliness, Smoking, Night Activity, Room Use) is `0.0`
- Meaning: No total disasters on the main axes; overall very strong compatibility

#### 2. Good (Healthy)

- Numeric: `0.70 ≤ PairScore < 0.90`, **or** `PairScore ≥ 0.90` but at least one heavy factor is `0`
- Meaning: A few trade-offs are present but no obvious “this will explode” pattern. Suitable as default OK matches

#### 3. Okay / At risk

- Numeric: `0.55 ≤ PairScore < 0.70`
- Meaning: Likely at least one major clash or several smaller mismatches. Marked as ⚠️ At risk in the UI for monitoring

#### 4. Poor

- Numeric: `PairScore < 0.55`
- Meaning: Multiple high-weight mismatches; high risk of complaints. These are strong candidates for manual review

These thresholds can be recalibrated in future using real feedback, but are justified by weight structure rather than arbitrary numbers.

---

## 9. Matching algorithm

Matching is performed per segment (e.g., Male · 1st year · AC · 2-bed). Each segment is independent.

### 9.1 High-level steps per segment

1. Validate that number of beds equals number of students
2. Generate all pair scores between students in the segment
3. Use matching algorithm appropriate to room size:
   - 2-bed rooms: maximum-weight matching
   - 3- and 4-bed rooms: pair-first + greedy grouping heuristic

4. Compute per-student satisfaction and room group scores
5. Label satisfaction (Excellent/Good/Okay/Poor) and flag at-risk students

### 9.2 Hard constraints

Within a segment, hard constraints are:

- Room capacity (exactly `room_size` students per room)
- Each student must appear in exactly one room
- Rare, admin-marked exceptions (e.g., medical) can be manually enforced outside the algorithm

Smoking/alcohol/diet and other lifestyle factors are not hard constraints; they are handled via scores and weights.

### 9.3 2-bed rooms (Pairs)

For segments with `room_size = 2`:

1. Build a complete weighted graph:
   - Nodes = students
   - Edge weight between `i` and `j` = `PairScore(i,j)`

2. Run a maximum-weight perfect matching algorithm (e.g., Edmonds’ blossom algorithm)
   - Objective: maximize the sum of pair scores

3. Optionally, apply a fairness tweak:
   - Identify students with `Satisfaction < 0.55` (Poor)
   - Attempt simple swaps between pairs that increase the minimum satisfaction without greatly hurting others

This balances total quality and fairness while remaining explainable.

### 9.4 3- and 4-bed rooms (Groups)

Perfect optimization is NP-hard; we use a clear, explainable heuristic.

#### 9.4.1 Step 1 – Build strong pairs

1. Construct the same pair-score graph
2. Run a maximum-weight matching to find a set of high-quality pairs
   - Some students may be unpaired if counts don’t align perfectly

These pairs are building blocks for rooms.

#### 9.4.2 Step 2 – Grow to full rooms

**For 3-person rooms:**

1. For each pair, compute the best possible third student to add (one who has a high average `PairScore` with both members)
2. Order pairs so that those with fewer good third options are processed first (helps fairness)
3. Assign the best available third student to each pair, forming rooms of 3, ensuring no student is used more than once

**For 4-person rooms:**

Two approaches (v1 can pick one):

1. **Merge pairs**
   - Consider merging compatible pairs `(A,B)` and `(C,D)` into a room of 4
   - Check average `PairScore` among all 6 pairs `(A,B,C,D)` and choose merges that maximize group score

2. **Grow triplets**
   - Form triplets first (as for 3-person rooms), then add a fourth student to each triplet

The heuristic should:

- Prioritize forming good groups while avoiding extremely bad placements

#### 9.4.3 Step 3 – Local improvements

Once initial groups are formed (3- or 4-person rooms):

1. Compute `Satisfaction(i)` for each student
2. Identify at-risk students (`Satisfaction < 0.55`)
3. Attempt simple swaps:
   - Try swapping student `X` in room `A` with student `Y` in room `B`
   - Apply swap if it significantly improves the minimum satisfaction and doesn’t create new “Poor” cases

4. Iterate until no simple beneficial swaps remain or a maximum number of iterations is reached

This heuristic is explainable: we start with good pairs and iteratively improve the worst-off students.

---

## 10. Fairness & “Good roommate” benchmark

### 10.1 Satisfaction-based fairness

We focus on satisfaction per student as the core fairness signal.

- For each student `i`, we have `Satisfaction(i) ∈ [0,1]`
- We classify each student’s match as Excellent/Good/Okay/Poor using thresholds

### 10.2 Distribution view

For each segment and overall, we compute:

- Count of students in each bucket:
  - Excellent
  - Good
  - Okay
  - Poor

This is shown as bars or counts, e.g.:

- Excellent: 430
- Good: 390
- Okay: 140
- Poor: 40

Admins can click on Poor or At risk to jump to those students for review.

### 10.3 Good roommate benchmark

Informally:

> “We prefer everyone to have at least a Good roommate if possible, rather than a few students getting ‘Excellent’ matches while others get ‘Poor’ ones.”

We operationalize this as:

- The algorithm aims to maximize the number of students with `Satisfaction ≥ 0.70`
- Within segments, if multiple matchings have similar total `PairScore`, we prefer the one with:
  - Fewer “Poor” students
  - Higher minimum satisfaction

In v1, this is implemented through:

- Threshold design
- Local swap improvements focused on the bottom of the satisfaction distribution
- UI surfacing at-risk students for human intervention

More advanced fairness metrics (envy, Gini) can be added later.

---

## 11. Admin UI/UX

The admin is the primary user; students only see a form.

### 11.1 Main navigation

Left sidebar sections:

1. Dashboard
2. Students & Data
3. Form & Collection
4. Matching Runs
5. Reports & Fairness
6. Manual Checker (mid-semester helper)

Weights/thresholds are not editable by admins in v1 to preserve fairness and consistency.

### 11.2 Dashboard

Shows the overall status at a glance:

- **Setup checklist:**
  - Master list uploaded? (Yes/No)
  - Rooms data uploaded? (Yes/No; optional)
  - Valid preference responses collected? (`X` of `Y` students)

- **Key stats:**
  - Total students in master
  - Total valid responses
  - Number of segments
  - Number of segments ready to run

- **Primary actions:**
  - “Upload master student data”
  - “View form link”
  - “Run matching for all ready segments”

### 11.3 Students & data

#### 11.3.1 Upload master CSV (Step 0 – Manual)

UI:

- Drag-and-drop or file selector for `master_students.csv`
- Column mapping step:
  - Left: system fields (`admission_number`, `full_name`, `gender`, `year_group`, `ac_type`, `room_size`, `dob`)
  - Right: dropdowns mapped to CSV columns

- Preview table with first 10 rows
- Validation results:
  - Missing required fields
  - Duplicate admission numbers
  - Invalid `year` or `room_size` values

- Option to download an error report of problematic rows

#### 11.3.2 Form response validation summary

Shows:

- Total form responses
- Valid responses (ID + DOB match)
- Invalid responses

Invalid responses can be downloaded for investigation.

All merging and deduplication (latest valid submission wins) is automatic.

### 11.4 Form & collection

- Displays the student form link (a single URL) and instructions:
  - “Share this link with students. They will enter their Admission Number and Date of Birth, then answer a few questions about room preferences.”

- Shows stats:
  - Total students in master
  - Number and percentage of students who submitted valid preferences
  - List or export of students who haven’t submitted yet

Admins can see a read-only preview of the questionnaire so they know what is being asked.

### 11.5 Matching runs

This is where admins run and monitor the core matching.

#### 11.5.1 Segment list

| Segment                     | Students | Beds | Status                                | Avg Match | Actions      |
| --------------------------- | -------: | ---: | ------------------------------------- | --------- | ------------ |
| M · 1st yr · AC · 2-bed     |      200 |  100 | ✅ Ready                              | –         | Run / View   |
| F · 1st yr · Non-AC · 3-bed |      151 |   50 | ❌ Impossible: 151 students, 150 beds | –         | View details |
| M · 2–4 yr · Non-AC · 4-bed |      120 |   30 | ⚠️ Risk: missing preferences for 10   | –         | View details |

**Status can be:**

- ✅ Ready – beds == students; enough preference data
- ❌ Impossible – e.g., beds < students; serious data inconsistency
- ⚠️ Risk – e.g., many missing preferences (we may still run, but with warning)

**Actions:**

- Run matching for an individual segment
- Run all ready segments
- View details for error states (see Section 12)

#### 11.5.2 Segment results – Room view

For a selected segment, Room View shows:

| Room ID | Students (with mini scores)               | Group Score | Status          |
| ------- | ----------------------------------------- | ----------- | --------------- |
| A-201   | A101 – Rahul (0.87), A102 – Karan (0.90)  | 0.89 (Good) | ✅ Healthy      |
| A-202   | A103 – Aditya (0.62), A104 – Mohit (0.58) | 0.60 (Okay) | ✅ Healthy      |
| A-203   | A105 – Vivek (0.40), A106 – Nikhil (0.47) | 0.44 (Poor) | ⚠️ Needs review |

- Clicking a student opens a side panel with more detail.
- Status based on worst student in the room:
  - If all students ≥ Good → ✅ Healthy
  - If anyone is Okay but near Poor → ⚠️ Needs review

**Top actions:**

- Download assignments (CSV)
- Download full report (PDF)
- Filter: `[Show only ⚠️ rooms]`

#### 11.5.3 Segment results – Student view

Student View lists students row by row:

| Admission No | Name     | Room ID | Satisfaction     | Status     | Top Reasons                                                            |
| ------------ | -------- | ------- | ---------------- | ---------- | ---------------------------------------------------------------------- |
| A101         | Rahul S. | A-201   | 0.87 (Good)      | ✅ Healthy | Same sleep schedule; both prefer quieter rooms; similar cleanliness    |
| A102         | Karan M. | A-201   | 0.90 (Excellent) | ✅ Healthy | Same sleep schedule; similar cleanliness; similar room-use preferences |
| A105         | Vivek R. | A-203   | 0.40 (Poor)      | ⚠️ At risk | Similar cleanliness; different sleep times; different night activity   |

**Features:**

- Filter by Status: show only ⚠️ At risk
- Clicking a row opens a student detail panel with factor-wise breakdown:
  - Sleep: Good match
  - Cleanliness: Good match
  - Late-night return: Poor match
  - Night activity: Poor match
  - etc.

### 11.6 Reports & fairness

Shows aggregate satisfaction stats.

For the whole intake and per segment:

- Number of students in each satisfaction band:
  - Excellent
  - Good
  - Okay
  - Poor

- Simple chart (bar or donut) visualizing distribution

Example:

- Total students: 1,000
- Excellent: 420
- Good: 430
- Okay: 120
- Poor: 30

Click:

- “30 students” under Poor → takes the admin to Student View filtered to those 30

### 11.7 Manual checker (Mid-semester tool)

Purpose: support mid-semester room changes without rematching everyone.

**UI layout**

**Left panel – Inputs**

1. **Remaining roommates:**
   - Multi-select dropdown of current students and their rooms
     (e.g., “A106 – Nikhil (Room A-203)”)

2. **New student:**
   - Dropdown of unassigned or candidate students
     (e.g., “A207 – Keshav (unassigned)”)

3. **Button:**
   - Run compatibility report

**Right panel – Output**

Shows compatibility of the hypothetical group (remaining + new student):

- Overall group score and label:
  - e.g., “Compatibility with this room: 0.78 (Good)”

- Factor-based reasons:
  - ✅ New student has a similar sleep schedule as current roommates
  - ✅ All prefer quieter rooms
  - ⚠️ One roommate prefers higher cleanliness than the new student – may need adjustment

This tool does not automatically update assignments. The admin can use the insight to make manual changes in their own system.

---

## 12. Privacy & explainability

### 12.1 Privacy

- Smoking, drinking, and diet preferences are collected as room-related preferences, not usage frequency.
- The admin UI never displays:
  - “Smoker: Yes/No”
  - “Drinks: Yes/No”
  - “Non-veg: Yes/No” explicitly

- Explanations use neutral wording like:
  - “Similar lifestyle habits”
  - “Differences in lifestyle preferences – may need adjustment”

- Sensitive data is used only for scoring and stored securely.

### 12.2 Explainability

Each student gets 2–3 plain-English reasons for their match.

We classify each factor per student-pair as:

- Strong match
- Moderate match
- Neutral
- Moderate mismatch
- Strong mismatch

For Good/Excellent matches:

- Show 2–3 positive reasons:
  - “Same sleep schedule (both sleep between 11 PM and 1 AM)”
  - “Both prefer quieter rooms”
  - “Similar cleanliness expectations”

For Okay/Poor matches:

- Show at least 1 positive factor plus 1–2 mismatch factors:
  - “Similar cleanliness expectations”
  - “Different sleep times (one early, one late) – may cause friction”
  - “Different night activity levels – may need communication”

We avoid blaming language (no “you are messy”). Instead:

- “Different cleanliness expectations – may need conversation.”

Sensitive factors like smoking/drinking are surfaced only as high-level lifestyle phrasing if at all.

---

## 13. Edge cases & error handling

### 13.1 Impossible scenarios (Beds vs students)

If, for a segment:

- Total capacity (sum of room capacities) < number of students

Status in Matching Runs:

- ❌ Impossible: e.g., “151 students, 150 beds”

Clicking **View details** shows:

- Explanation: “This segment cannot be assigned: 151 students, capacity 150 beds. Please adjust room counts or segment allocation.”

Admin must fix data and re-upload.

### 13.2 Missing preferences

- If some students have no preference form:
  - We can either exclude them from scoring (not ideal), or
  - Assign them neutral/average values (v1 decision TBD), but they will likely get more Okay or Poor matches

- Segment status may show ⚠️ Risk if a large proportion of students lack preferences

### 13.3 Duplicate form submissions

- Multiple responses with same `admission_number`:
  - We keep the latest valid submission (ID + DOB match)
  - Earlier ones are ignored

This is automated; no manual dedup needed.

### 13.4 Late arrivals and cancellations

- **Late arrivals:**
  - Their data may or may not have been included in the initial run
  - If not included, they are unassigned; admin can use the Manual Checker to test them in open beds

- **Cancellations:**
  - Bed remains empty until a new student arrives
  - No automatic re-run of global matching

### 13.5 Hard medical or religious exceptions

- Rare cases (e.g., severe asthma, serious religious dietary requirements) are better handled via manual overrides and room changes.
- We intentionally keep very few hard constraints inside the algorithm to avoid infeasible instances; the rest is handled through admin judgment.

### 13.6 System failures / timeouts

- If matching fails for a segment due to timeout or internal error:
  - Status: ❌ Error – “Matching failed, please retry or contact support.”
  - No results are committed for that segment

---

## 14. Future extensions (Beyond v1)

- **More fairness metrics:**
  - Envy (how many would prefer someone else’s room)
  - Gini coefficient over satisfaction
  - Parity across cohorts (programs/years)

- **Admin-adjustable profiles:**
  - Predefined weight profiles like “Academic focus” or “Social focus”, still within safe bounds

- **Student-facing transparency:**
  - Limited student dashboard where they can see a friendly version of their match explanation

- **Feedback loop:**
  - After some time, gather student feedback and conflict/room-change stats to tune thresholds and weights

- **Language factor:**
  - Optional questions about language comfort (handled carefully)

---

## 15. Summary

The Roommate Matcher is a practical, student-centered system:

- Segmentation ensures we only solve the “who with whom” problem where the upstream system has already decided who goes where (gender, building, AC/non-AC, room size).
- A concise, culturally-aware questionnaire captures the core lifestyle and room-use factors that really cause friction in Indian hostel/PG contexts.
- A transparent scoring model transforms those answers into pair compatibility scores with carefully thought-out weights and thresholds.

On top of that, we layer:

- Clear admin tools for data upload, matching, and review
- Privacy-safe explanations for each student
- Fairness and at-risk surfacing instead of blindly maximizing average scores
- Mid-semester realities are handled by a Manual Checker rather than global reshuffles

This spec is intended to be detailed enough for engineering to start implementing and for product/design to shape the exact UI and messaging without ambiguity.
````
