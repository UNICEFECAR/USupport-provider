/**
 * Slot / consultation duration helpers.
 *
 * Consultations used to be implicitly one hour long. They now carry their own
 * length, and provider availability carries a length per open slot. Everything
 * that needs to know "how long is this?" goes through here so the fallback for
 * legacy rows lives in exactly one place.
 */

/** Length used for any slot or consultation written before durations existed. */
export const DEFAULT_SLOT_MINUTES = 60;

/** The lengths a provider may pick for a slot. */
export const ALLOWED_SLOT_MINUTES = [30, 60];

/**
 * Longest slot the system can produce. Overlap predicates use this as a lower
 * bound on `time` so they stay index scans; raising the maximum slot length
 * without raising this would make them silently miss conflicts.
 */
export const MAX_SLOT_MINUTES = 60;

/** The grid providers open availability on. */
export const SLOT_STEP_MINUTES = 30;

export const isAllowedSlotDuration = (minutes) =>
  ALLOWED_SLOT_MINUTES.includes(Number(minutes));

/**
 * Normalise anything that claims to be a duration into a usable number of
 * minutes, falling back to the legacy hour.
 *
 * @param {unknown} value
 * @returns {number}
 */
export const normalizeDuration = (value) => {
  const minutes = Number(value);
  return isAllowedSlotDuration(minutes) ? minutes : DEFAULT_SLOT_MINUTES;
};

/**
 * The key a slot's duration is stored under in `availability.slot_durations`.
 * Always epoch seconds as text - never a rendered timestamp, so the map is
 * immune to the DB session timezone.
 *
 * @param {number|string|Date} slotTime unix seconds, or something Date-like
 * @returns {string}
 */
export const slotDurationKey = (slotTime) => {
  if (slotTime instanceof Date) {
    return String(Math.floor(slotTime.getTime() / 1000));
  }
  const asNumber = Number(slotTime);
  if (!Number.isNaN(asNumber)) return String(Math.floor(asNumber));
  return String(Math.floor(new Date(slotTime).getTime() / 1000));
};

/**
 * Look a slot's duration up in a `slot_durations` map. An absent key means the
 * slot predates per-slot durations, so it is an hour.
 *
 * @param {number|string|Date} slotTime
 * @param {Object<string, number>} [durations]
 * @returns {number}
 */
export const getSlotDuration = (slotTime, durations) =>
  normalizeDuration(durations?.[slotDurationKey(slotTime)]);

/**
 * Do [startA, startA + durationA) and [startB, startB + durationB) overlap?
 * All times are unix seconds, all durations minutes.
 *
 * @returns {boolean}
 */
export const doSlotsOverlap = (startA, durationA, startB, durationB) => {
  const aStart = Number(startA);
  const bStart = Number(startB);
  const aEnd = aStart + normalizeDuration(durationA) * 60;
  const bEnd = bStart + normalizeDuration(durationB) * 60;
  return aStart < bEnd && aEnd > bStart;
};

/**
 * Unix seconds for a slot, whether it arrives as a bare timestamp, a timestamp
 * string, a Date, or a `{ time }` object from the campaign/organization pools.
 *
 * @returns {number}
 */
export const getSlotTimestamp = (slot) => {
  const value = slot?.time ?? slot;
  const asNumber = Number(value);
  if (!Number.isNaN(asNumber) && typeof value !== "object") return asNumber;
  return new Date(value).getTime() / 1000;
};

/**
 * When does a consultation end? Reads the row's own length, falling back to the
 * legacy hour for rows written before durations existed.
 *
 * @param {{time: string|Date|number, duration_minutes?: number}} consultation
 * @returns {Date}
 */
export const getConsultationEndDate = (consultation) => {
  const start = new Date(consultation?.time).getTime();
  return new Date(
    start + normalizeDuration(consultation?.duration_minutes) * 60 * 1000,
  );
};

/**
 * Has a consultation finished? Replaces the old "started more than an hour ago"
 * shorthand, which is wrong for anything that is not 60 minutes long.
 *
 * @param {{time: string|Date|number, duration_minutes?: number}} consultation
 * @param {Date} [at]
 * @returns {boolean}
 */
export const hasConsultationEnded = (consultation, at = new Date()) =>
  getConsultationEndDate(consultation).getTime() <= at.getTime();

/**
 * Index open slots by their start time, so contiguity can be walked.
 *
 * @param {Array<{time: number, duration_minutes: number, campaign_id?: string|null, organization_id?: string|null}>} slots
 *   `time` in unix seconds
 * @returns {Map<number, object>}
 */
export const indexSlotsByStart = (slots) => {
  const map = new Map();
  slots.forEach((slot) => {
    map.set(Number(slot.time), slot);
  });
  return map;
};

/**
 * Which consultation lengths can be booked starting at `startSeconds`?
 *
 * A length counts only if the provider's open slots tile it *exactly*:
 *
 *   - two adjacent 30-minute slots make an hour, which is what lets a client
 *     book 01:00-02:00 when the provider opened 01:00 and 01:30 separately;
 *   - a single 60-minute slot makes an hour;
 *   - half of a 60-minute slot is NOT on offer - the provider said that hour was
 *     one consultation, and booking 30 minutes of it would strand the rest.
 *
 * Slots are only combined within the same pool: an hour cannot be assembled
 * from a normal half and an organization half, because the resulting
 * consultation could only belong to one of them.
 *
 * @param {number} startSeconds
 * @param {Map<number, object>} slotsByStart from indexSlotsByStart
 * @returns {number[]} allowed lengths, ascending
 */
export const getBookableDurations = (startSeconds, slotsByStart) => {
  const first = slotsByStart.get(Number(startSeconds));
  if (!first) return [];

  const samePool = (slot) =>
    (slot.campaign_id || null) === (first.campaign_id || null) &&
    (slot.organization_id || null) === (first.organization_id || null);

  return ALLOWED_SLOT_MINUTES.filter((candidate) => {
    const target = Number(startSeconds) + candidate * 60;
    let cursor = Number(startSeconds);

    while (cursor < target) {
      const slot = slotsByStart.get(cursor);
      if (!slot || !samePool(slot)) return false;
      cursor += normalizeDuration(slot.duration_minutes) * 60;
    }

    // Overshooting means the last slot runs past the end - not an exact tiling.
    return cursor === target;
  }).sort((a, b) => a - b);
};
