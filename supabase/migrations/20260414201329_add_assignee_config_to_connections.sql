-- Add assignee_config to column_connections
-- Controls who becomes the assignee of the linked card created by the connection.
--
-- Format (JSONB):
--   { "mode": "none" }                                    — no assignee
--   { "mode": "fixed", "user_id": "<uuid>" }              — fixed assignee
--   { "mode": "choose", "candidates": ["<uuid>", ...] }   — user picks at drop time
--
-- NULL = inherit from original card (current default behavior)

ALTER TABLE public.column_connections
  ADD COLUMN assignee_config jsonb DEFAULT NULL;
