BEGIN;

ALTER TABLE staff_activities
ADD CONSTRAINT staff_activities_staff_member_activity_unique
UNIQUE (staff_member_id, activity_id);

COMMIT;
