-- Dedicated Tripora project only. Run before the first API migration/deployment.
-- All app data is served by ASP.NET Identity/API, never by the Supabase public Data API.
revoke all on schema public from public, anon, authenticated;
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
