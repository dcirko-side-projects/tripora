-- Run in the selected free Supabase project's SQL editor before deploying the API.
-- App authentication remains ASP.NET Identity; do not add anonymous storage policies.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tripora-private', 'tripora-private', false, 8388608, array['image/png'])
on conflict (id) do nothing;

do $$
begin
  if exists (select 1 from storage.buckets where id = 'tripora-private' and public) then
    raise exception 'tripora-private must not be public';
  end if;
end $$;
