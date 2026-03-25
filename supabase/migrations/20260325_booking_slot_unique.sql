-- Prevent concurrent booking of the same slot for the same team member.
-- Only non-cancelled bookings are constrained (cancelled slots can be rebooked).
CREATE UNIQUE INDEX IF NOT EXISTS bookings_unique_slot
  ON bookings (assigned_to, starts_at)
  WHERE status != 'cancelled';
