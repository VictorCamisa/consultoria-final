
-- Remove duplicates keeping oldest per phone
DELETE FROM leads_raw a
USING leads_raw b
WHERE a.phone IS NOT NULL
  AND a.phone = b.phone
  AND a.created_at > b.created_at
  AND a.id <> b.id;

-- Remove duplicates keeping oldest per email (when no phone)
DELETE FROM leads_raw a
USING leads_raw b
WHERE a.phone IS NULL
  AND a.email IS NOT NULL
  AND lower(a.email) = lower(b.email)
  AND a.created_at > b.created_at
  AND a.id <> b.id;

-- Create unique index on phone to prevent future dupes
CREATE UNIQUE INDEX IF NOT EXISTS leads_raw_phone_unique ON leads_raw(phone) WHERE phone IS NOT NULL;

-- Create unique index on email for leads without phone
CREATE UNIQUE INDEX IF NOT EXISTS leads_raw_email_unique ON leads_raw(lower(email)) WHERE email IS NOT NULL AND phone IS NULL;
