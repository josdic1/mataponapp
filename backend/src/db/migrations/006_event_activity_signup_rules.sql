BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM event_activity_signups eas
    JOIN member_attendees ma
      ON ma.id = eas.member_attendee_id
    GROUP BY eas.event_activity_id, ma.member_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'EXISTING_DUPLICATE_ACTIVITY_SIGNUPS';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM event_activity_signups s1
    JOIN member_attendees m1
      ON m1.id = s1.member_attendee_id
    JOIN event_activities ea1
      ON ea1.id = s1.event_activity_id
    JOIN event_activity_signups s2
      ON s2.id > s1.id
    JOIN member_attendees m2
      ON m2.id = s2.member_attendee_id
     AND m2.member_id = m1.member_id
    JOIN event_activities ea2
      ON ea2.id = s2.event_activity_id
    WHERE ea1.starts_at::timestamptz < ea2.ends_at::timestamptz
      AND ea1.ends_at::timestamptz > ea2.starts_at::timestamptz
  ) THEN
    RAISE EXCEPTION 'EXISTING_OVERLAPPING_ACTIVITY_SIGNUPS';
  END IF;
END;
$$;

ALTER TABLE event_activity_signups
ADD CONSTRAINT event_activity_signups_event_activity_member_attendee_unique
UNIQUE (event_activity_id, member_attendee_id);

CREATE OR REPLACE FUNCTION enforce_event_activity_signup_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  requested_member_id BIGINT;
  attendee_event_id BIGINT;
  requested_event_id BIGINT;
  requested_start TIMESTAMPTZ;
  requested_end TIMESTAMPTZ;
  requested_activity_name TEXT;
  current_signup_id BIGINT;
  conflicting_activity_name TEXT;
  conflicting_start TEXT;
  conflicting_end TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    current_signup_id := OLD.id;
  ELSE
    current_signup_id := NULL;
  END IF;

  SELECT
    ma.member_id,
    ma.event_id
  INTO
    requested_member_id,
    attendee_event_id
  FROM member_attendees ma
  WHERE ma.id = NEW.member_attendee_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(requested_member_id);

  SELECT
    ea.event_id,
    ea.starts_at::timestamptz,
    ea.ends_at::timestamptz,
    a.name
  INTO
    requested_event_id,
    requested_start,
    requested_end,
    requested_activity_name
  FROM event_activities ea
  JOIN activities a
    ON a.id = ea.activity_id
  WHERE ea.id = NEW.event_activity_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF requested_event_id <> attendee_event_id THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'ACTIVITY_SIGNUP_EVENT_MISMATCH';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM event_activity_signups existing_signup
    JOIN member_attendees existing_attendee
      ON existing_attendee.id = existing_signup.member_attendee_id
    WHERE existing_signup.event_activity_id = NEW.event_activity_id
      AND existing_attendee.member_id = requested_member_id
      AND (
        current_signup_id IS NULL
        OR existing_signup.id <> current_signup_id
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'ACTIVITY_SIGNUP_DUPLICATE',
      DETAIL = json_build_object(
        'activity_name',
        requested_activity_name
      )::text;
  END IF;

  SELECT
    conflicting_activity.name,
    conflicting_event_activity.starts_at,
    conflicting_event_activity.ends_at
  INTO
    conflicting_activity_name,
    conflicting_start,
    conflicting_end
  FROM event_activity_signups existing_signup
  JOIN member_attendees existing_attendee
    ON existing_attendee.id = existing_signup.member_attendee_id
  JOIN event_activities conflicting_event_activity
    ON conflicting_event_activity.id = existing_signup.event_activity_id
  JOIN activities conflicting_activity
    ON conflicting_activity.id = conflicting_event_activity.activity_id
  WHERE existing_attendee.member_id = requested_member_id
    AND existing_signup.event_activity_id <> NEW.event_activity_id
    AND (
      current_signup_id IS NULL
      OR existing_signup.id <> current_signup_id
    )
    AND requested_start < conflicting_event_activity.ends_at::timestamptz
    AND requested_end > conflicting_event_activity.starts_at::timestamptz
  ORDER BY
    conflicting_event_activity.starts_at::timestamptz,
    existing_signup.id
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'ACTIVITY_TIME_CONFLICT',
      DETAIL = json_build_object(
        'activity_name',
        conflicting_activity_name,
        'starts_at',
        conflicting_start,
        'ends_at',
        conflicting_end
      )::text;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_event_activity_signup_rules_trigger
BEFORE INSERT OR UPDATE ON event_activity_signups
FOR EACH ROW
EXECUTE FUNCTION enforce_event_activity_signup_rules();

COMMIT;
