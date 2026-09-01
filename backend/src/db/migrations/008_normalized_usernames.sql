BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT
        regexp_replace(
          lower(username),
          '[[:space:]]+',
          '',
          'g'
        ) AS normalized_username,
        COUNT(*)
      FROM users
      GROUP BY 1
      HAVING COUNT(*) > 1
    ) collisions
  ) THEN
    RAISE EXCEPTION
      'Existing usernames collide after normalization';
  END IF;
END
$$;

CREATE UNIQUE INDEX users_username_normalized_unique
ON users (
  (
    regexp_replace(
      lower(username),
      '[[:space:]]+',
      '',
      'g'
    )
  )
);

COMMIT;
