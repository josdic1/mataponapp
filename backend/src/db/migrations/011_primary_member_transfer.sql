BEGIN;

CREATE OR REPLACE FUNCTION enforce_household_primary()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  transfer_in_progress BOOLEAN :=
    COALESCE(
      current_setting('matapon.primary_transfer', true),
      'off'
    ) = 'on';
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.member_role = 'primary'
       AND EXISTS (
         SELECT 1
         FROM user_members
         WHERE user_id = OLD.user_id
           AND id <> OLD.id
       )
    THEN
      RAISE EXCEPTION 'HOUSEHOLD_PRIMARY_REQUIRED';
    END IF;

    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.member_role = 'primary'
     AND (
       NEW.member_role <> 'primary'
       OR NEW.user_id <> OLD.user_id
     )
     AND EXISTS (
       SELECT 1
       FROM user_members
       WHERE user_id = OLD.user_id
         AND id <> OLD.id
     )
     AND NOT transfer_in_progress
  THEN
    RAISE EXCEPTION 'HOUSEHOLD_PRIMARY_REQUIRED';
  END IF;

  IF NEW.member_role <> 'primary' AND NOT transfer_in_progress THEN
    IF TG_OP = 'INSERT' THEN
      IF NOT EXISTS (
        SELECT 1
        FROM user_members
        WHERE user_id = NEW.user_id
          AND member_role = 'primary'
      )
      THEN
        RAISE EXCEPTION 'FIRST_HOUSEHOLD_MEMBER_MUST_BE_PRIMARY';
      END IF;
    ELSE
      IF NOT EXISTS (
        SELECT 1
        FROM user_members
        WHERE user_id = NEW.user_id
          AND member_role = 'primary'
          AND id <> OLD.id
      )
      THEN
        RAISE EXCEPTION 'HOUSEHOLD_PRIMARY_REQUIRED';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
