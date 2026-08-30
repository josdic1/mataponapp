BEGIN;

CREATE UNIQUE INDEX user_members_one_primary_per_household
ON user_members (user_id)
WHERE member_role = 'primary';

CREATE OR REPLACE FUNCTION enforce_household_primary()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
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
  THEN
    RAISE EXCEPTION 'HOUSEHOLD_PRIMARY_REQUIRED';
  END IF;

  IF NEW.member_role <> 'primary' THEN
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

CREATE TRIGGER enforce_household_primary_trigger
BEFORE INSERT OR UPDATE OR DELETE ON user_members
FOR EACH ROW
EXECUTE FUNCTION enforce_household_primary();

COMMIT;
