-- Migration 031: Add meta JSONB to status_transitions for audit trail enrichment
-- Stores prereq confirmations, context, and future metadata

ALTER TABLE status_transitions ADD COLUMN IF NOT EXISTS meta JSONB;
