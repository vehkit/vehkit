-- =====================================================================
-- Allow workshop_reviews.workshop_id to be null.
--
-- Why: most service entries are logged via /shop/[code] by walk-in
-- workshops that aren't registered Vehkit workshops. Those entries have
-- workshop_name_freetext set but workshop_id null. The review form
-- (rendered for any confirmed workshop attestation) was failing
-- submission because the review insert required a non-null workshop_id.
--
-- After this change: a review can attach to a freetext-workshop entry,
-- and aggregations on workshops table (avg rating, score, etc.) simply
-- exclude reviews with null workshop_id — they don't roll up to any
-- specific workshop, but they do remain attached to the service record
-- and the customer's car for trust/history purposes.
-- =====================================================================

alter table public.workshop_reviews
  alter column workshop_id drop not null;

-- Index already filters on workshop_id; no change needed there.
-- Supabase RLS policies on workshop_reviews don't reference workshop_id
-- in WITH CHECK or USING, so they don't need updating.

notify pgrst, 'reload schema';
