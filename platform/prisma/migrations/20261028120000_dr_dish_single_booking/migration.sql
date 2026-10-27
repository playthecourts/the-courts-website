-- Dr. Dish self-serve: exactly one athlete per slot.
--
-- The app already serializes bookings with SELECT ... FOR UPDATE on the session
-- row and counts seats against sessions.capacity (now 1). This trigger is the
-- last line of defense inside the database itself: even a code path that skips
-- the app check cannot put a second active booking on a Dr. Dish slot.
-- Scoped to self_serve_dr_dish only; every other program is untouched.

CREATE OR REPLACE FUNCTION enforce_single_dr_dish_booking() RETURNS trigger AS $$
DECLARE
  is_dish boolean;
  others integer;
BEGIN
  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  SELECT (p.program_type = 'self_serve_dr_dish') INTO is_dish
    FROM sessions s JOIN programs p ON p.id = s.program_id
   WHERE s.id = NEW.session_id;

  IF is_dish THEN
    -- Serialize with any concurrent booking of the same slot.
    PERFORM 1 FROM sessions WHERE id = NEW.session_id FOR UPDATE;
    SELECT count(*) INTO others FROM bookings
     WHERE session_id = NEW.session_id AND status <> 'cancelled' AND id <> NEW.id;
    IF others >= 1 THEN
      RAISE EXCEPTION 'That Dr. Dish slot is already booked.' USING ERRCODE = '23505';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS dr_dish_single_booking ON bookings;
CREATE TRIGGER dr_dish_single_booking
  BEFORE INSERT OR UPDATE OF status, session_id ON bookings
  FOR EACH ROW EXECUTE FUNCTION enforce_single_dr_dish_booking();
