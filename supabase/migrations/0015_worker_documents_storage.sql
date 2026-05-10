-- ============================================================================
-- 0015: Worker Documents — Supabase Storage bucket + RLS
-- ============================================================================
-- Renamed from 0011_worker_documents_storage.sql to resolve the version-number
-- collision with Hermes's 0011_missing_tables (now captured in this repo).
-- This file's content is unchanged — only the filename moved.
--
-- Creates the `attachments` bucket for worker document file storage and
-- adds RLS policies so only authenticated users can upload/delete.
--
-- The bucket is PUBLIC (files accessible by direct URL) because document
-- URLs need to be stable and permanent. Security is enforced at the
-- application layer: file URLs are only surfaced to users who can read
-- the worker_documents table (which has its own RLS via the backend).
--
-- Sections:
--   1. Create attachments bucket
--   2. Upload policy (INSERT)
--   3. Delete policy (DELETE)
-- ============================================================================

-- 1. Create attachments bucket ------------------------------------------------
-- file_size_limit = 50 MB, allowed MIME types for documents
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'attachments',
  'attachments',
  true,
  52428800, -- 50 MB
  '{"application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document","image/png","image/jpeg"}'
)
on conflict (id) do nothing;

-- 2. Upload policy ------------------------------------------------------------
-- Only authenticated users can upload to the attachments bucket.
drop policy if exists "Authenticated users can upload attachments" on storage.objects;
create policy "Authenticated users can upload attachments"
on storage.objects for insert
to authenticated
with check (bucket_id = 'attachments');

-- 3. Delete policy ------------------------------------------------------------
-- Only authenticated users can delete from the attachments bucket.
drop policy if exists "Authenticated users can delete attachments" on storage.objects;
create policy "Authenticated users can delete attachments"
on storage.objects for delete
to authenticated
using (bucket_id = 'attachments');
