-- Add reach column to ad_spend for Meta Ads API data
ALTER TABLE ad_spend ADD COLUMN IF NOT EXISTS reach INTEGER NOT NULL DEFAULT 0;
