/**
 * segmentLabel.ts — one name for a segment, everywhere.
 *
 * The API identifies a segment by an immutable key (`F_1st_year_NonAC_3`) and,
 * on most endpoints, by the four fields that make it. The key never goes into
 * visible copy on its own: it is an identifier for support and CSV matching, so
 * it may appear as a secondary subline next to the human label.
 *
 * Prefer the API fields; fall back to reading the key's own structure
 * `{gender}_{year_group}_{ac_type}_{room_size}`.
 */

export interface SegmentIdentity {
  segment_key: string;
  gender?: string | null;
  year_group?: string | null;
  ac_type?: string | null;
  room_size?: number | null;
}

const GENDERS: Record<string, string> = {
  m: "Male",
  male: "Male",
  f: "Female",
  female: "Female",
  o: "Other",
  other: "Other",
  mixed: "Mixed",
};

const AC_TYPES: Record<string, string> = {
  ac: "AC",
  nonac: "Non-AC",
};

function humanGender(value: string | null | undefined): string | null {
  if (!value) return null;
  const mapped = GENDERS[value.trim().toLowerCase()];
  if (mapped) return mapped;
  const trimmed = value.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

function humanAc(value: string | null | undefined): string | null {
  if (!value) return null;
  const mapped = AC_TYPES[value.trim().toLowerCase().replace(/[\s-]/g, "")];
  if (mapped) return mapped;
  // "NonAC" has no separator to split on; handle it explicitly.
  if (/^nonac$/i.test(value.trim())) return "Non-AC";
  return value.trim();
}

function humanYear(value: string | null | undefined): string | null {
  if (!value) return null;
  const words = value.trim().replace(/_/g, " ").toLowerCase();
  return /year$/.test(words) ? words : `${words} year`;
}

/** `F_1st_year_NonAC_3` → the four fields; null when the key is not this shape. */
function parseSegmentKey(key: string): Omit<SegmentIdentity, "segment_key"> | null {
  const parts = key.split("_").filter(Boolean);
  if (parts.length < 4) return null;
  const roomSize = Number(parts[parts.length - 1]);
  if (!Number.isFinite(roomSize)) return null;
  const yearGroup = parts.slice(1, -2).join("_");
  if (!yearGroup) return null;
  return {
    gender: parts[0],
    year_group: yearGroup,
    ac_type: parts[parts.length - 2],
    room_size: roomSize,
  };
}

/**
 * The human name for a segment: "Female · 1st year · Non-AC · 3-bed".
 * Falls back to the key itself only when the key cannot be read at all, so a
 * new backend format degrades to an identifier rather than to nonsense.
 */
export function segmentLabel(segment: SegmentIdentity): string {
  const parsed = parseSegmentKey(segment.segment_key);
  const gender = humanGender(segment.gender ?? parsed?.gender);
  const year = humanYear(segment.year_group ?? parsed?.year_group);
  const ac = humanAc(segment.ac_type ?? parsed?.ac_type);
  const size = segment.room_size ?? parsed?.room_size;

  const parts = [gender, year, ac, size ? `${size}-bed` : null].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : segment.segment_key;
}

/** True when the label is a real translation and not the key echoed back. */
export function hasReadableSegmentLabel(segment: SegmentIdentity): boolean {
  return segmentLabel(segment) !== segment.segment_key;
}
