-- Align users.level to the 3 official tiers: Standard, Premium, VIP
-- Map old 4-tier values: Platinum/Gold/Silver -> VIP/Premium/Premium, Standard stays Standard

UPDATE users SET level = CASE
  WHEN level = 'Platinum' THEN 'VIP'
  WHEN level IN ('Gold','Silver') THEN 'Premium'
  ELSE 'Standard'
END;

-- Make sure any NULL levels become Standard
UPDATE users SET level = 'Standard' WHERE level IS NULL;

-- Default status/points if missing
UPDATE users SET status = 'active' WHERE status IS NULL;
UPDATE users SET points = COALESCE(points, 0);
