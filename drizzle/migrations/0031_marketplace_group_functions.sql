-- Marketplace (plan 4.1/4.7/4.8): two new school functions.
--   shop:             may create listings for the school and answer their chats
--   market_moderator: handles reports on private listings (only while the school runs a shop)
-- Own migration on purpose: a new enum value must not be used in the transaction that adds it,
-- and 0032 uses both values in function bodies.
ALTER TYPE public.group_function ADD VALUE IF NOT EXISTS 'shop';
ALTER TYPE public.group_function ADD VALUE IF NOT EXISTS 'market_moderator';
