-- ============================================================
-- Seed team members (Murad + Almas)
-- NOTE: After creating Supabase Auth accounts for both users,
-- update the auth_user_id fields with the actual UUIDs from
-- Supabase Auth → Users table.
-- ============================================================

INSERT INTO team_members (name, email, role)
VALUES
  ('Shaik Murad', 'murad@xperiencewave.com', 'admin'),
  ('Almas', 'almas@xperiencewave.com', 'admin');

-- After both users sign up via the login page, run:
-- UPDATE team_members SET auth_user_id = '<uuid-from-auth>' WHERE email = 'murad@xperiencewave.com';
-- UPDATE team_members SET auth_user_id = '<uuid-from-auth>' WHERE email = 'almas@xperiencewave.com';
