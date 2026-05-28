"""
test_magic_fill_scope.py — Tests for the Magic Fill service.

Tests verify:
  1. Workspace-wide fill creates profiles for ALL missing students.
  2. Segment-scoped fill only creates profiles for the target segment.
  3. Students with existing active profiles are skipped.
  4. Generated profiles have is_generated=TRUE.
  5. Generated profiles contain valid raw answers from QUESTION_OPTION_VALUES.
  6. Generated profiles contain correct encoded values.
  7. Re-running magic fill is idempotent (no duplicates).
"""
import uuid
from datetime import date

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.preference_profile import PreferenceProfile
from app.models.segment import Segment
from app.models.student import Student
from app.models.tenant import Tenant
from app.models.workspace import Workspace
from app.services.ingestion.form_response import QUESTION_KEYS, QUESTION_OPTION_VALUES, ENCODED_FIELD_MAP
from app.services.magic_fill.service import magic_fill


@pytest.fixture
def seeded_workspace(db_session: Session):
    """
    Creates a tenant, workspace, 2 segments, and students:
      - Segment A: 4 students (2 with profiles, 2 without)
      - Segment B: 3 students (0 with profiles)
    """
    tenant = Tenant(slug="test-mf", display_name="MF Test Tenant")
    db_session.add(tenant)
    db_session.flush()

    workspace = Workspace(
        tenant_id=tenant.id, name="MF Test Workspace", status="active", source="manual"
    )
    db_session.add(workspace)
    db_session.flush()

    seg_a = Segment(
        tenant_id=tenant.id,
        workspace_id=workspace.id,
        segment_key="M_1st_year_AC_2",
        gender="M", year_group="1st_year", ac_type="AC", room_size=2,
    )
    seg_b = Segment(
        tenant_id=tenant.id,
        workspace_id=workspace.id,
        segment_key="F_1st_year_NonAC_3",
        gender="F", year_group="1st_year", ac_type="NonAC", room_size=3,
    )
    db_session.add_all([seg_a, seg_b])
    db_session.flush()

    students_a = []
    for i in range(4):
        s = Student(
            tenant_id=tenant.id,
            workspace_id=workspace.id,
            segment_id=seg_a.id,
            admission_number=f"TEST-A-{i:03}",
            full_name=f"Test A Student {i}",
            gender="M", year_group="1st_year", ac_type="AC", room_size=2,
            dob=date(2005, 1, 1),
            phone_last4="1234",
            is_active=True,
        )
        db_session.add(s)
        students_a.append(s)

    students_b = []
    for i in range(3):
        s = Student(
            tenant_id=tenant.id,
            workspace_id=workspace.id,
            segment_id=seg_b.id,
            admission_number=f"TEST-B-{i:03}",
            full_name=f"Test B Student {i}",
            gender="F", year_group="1st_year", ac_type="NonAC", room_size=3,
            dob=date(2005, 1, 1),
            phone_last4="5678",
            is_active=True,
        )
        db_session.add(s)
        students_b.append(s)

    db_session.flush()

    # Give 2 students in segment A existing profiles
    for s in students_a[:2]:
        profile = PreferenceProfile(
            tenant_id=tenant.id,
            workspace_id=workspace.id,
            student_id=s.id,
            has_preferences=True,
            is_active=True,
            is_generated=False,
            q1_raw="Before 11 PM (early)",
            q2_raw="Very tidy - I like things clean and organized",
            q3_raw="Before 10 PM",
            q4a_raw="Mainly for sleeping/studying, not for hanging out",
            q4b_raw="Very uncomfortable",
            q5a_raw="Almost never",
            q5b_raw="Very uncomfortable",
            q6_raw="I need a 100% smoke-free room",
            q7_raw="I require an alcohol-free room",
            q8_raw="I am strict vegetarian and require a meat-free room",
            q9_raw="Budget-conscious - prefer to keep costs low",
            q10_raw="I prefer someone very similar to me",
            q1_enc=1.0, q2_enc=1.0, q3_enc=1.0,
            q4a_enc=0.0, q4b_enc=0.0, q5a_enc=0.0, q5b_enc=0.0,
            q6_enc=1.0, q7_enc=1.0, q8_enc=1.0, q9_enc=1.0, q10_enc=0.0,
        )
        db_session.add(profile)

    db_session.commit()

    return {
        "tenant": tenant,
        "workspace": workspace,
        "seg_a": seg_a,
        "seg_b": seg_b,
        "students_a": students_a,
        "students_b": students_b,
    }


class TestMagicFillWorkspaceWide:
    """Tests for workspace-wide (no segment filter) magic fill."""

    def test_fills_all_missing_students(self, db_session: Session, seeded_workspace):
        ws = seeded_workspace
        result = magic_fill(db_session, ws["workspace"].id, ws["tenant"].id)

        # 2 missing in seg_a + 3 missing in seg_b = 5 created
        assert result.profiles_created == 5
        # 2 already had profiles in seg_a
        assert result.students_skipped == 2

    def test_all_generated_profiles_flagged(self, db_session: Session, seeded_workspace):
        ws = seeded_workspace
        magic_fill(db_session, ws["workspace"].id, ws["tenant"].id)

        generated = db_session.scalars(
            select(PreferenceProfile).where(
                PreferenceProfile.workspace_id == ws["workspace"].id,
                PreferenceProfile.is_generated == True,
            )
        ).all()
        assert len(generated) == 5
        for p in generated:
            assert p.is_generated is True
            assert p.is_active is True
            assert p.has_preferences is True
            assert p.source_form_response_id is None

    def test_generated_profiles_have_valid_answers(self, db_session: Session, seeded_workspace):
        ws = seeded_workspace
        magic_fill(db_session, ws["workspace"].id, ws["tenant"].id)

        profiles = db_session.scalars(
            select(PreferenceProfile).where(
                PreferenceProfile.workspace_id == ws["workspace"].id,
                PreferenceProfile.is_generated == True,
            )
        ).all()

        for profile in profiles:
            for key in QUESTION_KEYS:
                raw_value = getattr(profile, key)
                assert raw_value is not None, f"{key} should not be None"
                assert raw_value in QUESTION_OPTION_VALUES[key], (
                    f"{key} value '{raw_value}' is not a canonical option"
                )

                enc_key = ENCODED_FIELD_MAP[key]
                enc_value = getattr(profile, enc_key)
                assert enc_value == QUESTION_OPTION_VALUES[key][raw_value], (
                    f"Encoded value mismatch for {key}: "
                    f"expected {QUESTION_OPTION_VALUES[key][raw_value]}, got {enc_value}"
                )

    def test_idempotent_no_duplicates(self, db_session: Session, seeded_workspace):
        ws = seeded_workspace

        result1 = magic_fill(db_session, ws["workspace"].id, ws["tenant"].id)
        assert result1.profiles_created == 5

        result2 = magic_fill(db_session, ws["workspace"].id, ws["tenant"].id)
        assert result2.profiles_created == 0
        assert result2.students_skipped == 7  # all 7 now have profiles


class TestMagicFillSegmentScoped:
    """Tests for segment-scoped magic fill."""

    def test_fills_only_target_segment(self, db_session: Session, seeded_workspace):
        ws = seeded_workspace
        result = magic_fill(
            db_session, ws["workspace"].id, ws["tenant"].id,
            segment_id=ws["seg_b"].id,
        )

        # Only segment B students (3 missing, 0 with profiles)
        assert result.profiles_created == 3
        assert result.students_skipped == 0

    def test_does_not_fill_other_segments(self, db_session: Session, seeded_workspace):
        ws = seeded_workspace
        magic_fill(
            db_session, ws["workspace"].id, ws["tenant"].id,
            segment_id=ws["seg_b"].id,
        )

        # Check segment A still has 2 students without profiles
        seg_a_profiles = db_session.scalars(
            select(PreferenceProfile).join(Student).where(
                Student.segment_id == ws["seg_a"].id,
                PreferenceProfile.is_generated == True,
            )
        ).all()
        assert len(seg_a_profiles) == 0  # no generated profiles in seg_a

    def test_existing_profiles_skipped_in_segment(self, db_session: Session, seeded_workspace):
        ws = seeded_workspace
        result = magic_fill(
            db_session, ws["workspace"].id, ws["tenant"].id,
            segment_id=ws["seg_a"].id,
        )

        # Segment A: 4 students total, 2 with profiles, 2 without
        assert result.profiles_created == 2
        assert result.students_skipped == 2
