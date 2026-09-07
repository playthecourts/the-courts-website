import "dotenv/config";
import { Client } from "pg";

// ---------------------------------------------------------------------------
// Provisions the private athlete-photos bucket and its access rules.
//
// Supabase Storage was chosen because Supabase is ALREADY the auth provider and
// database for this platform — adding S3/Cloudinary/Blob would have meant a
// second set of credentials and a second access-control model to keep in sync
// with the one in lib/os/permissions.ts. There is no second provider here.
//
// Everything below runs as the database owner over DIRECT_URL, so this needs no
// service-role key and no dashboard clicking. It is idempotent: run it as often
// as you like.
//
//   npm run storage:setup
// ---------------------------------------------------------------------------

const BUCKET = "athlete-photos";

const SQL = `
-- Private bucket. 5MB ceiling and an explicit mime allowlist so a rogue upload
-- can't turn the bucket into a file drop.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('${BUCKET}', '${BUCKET}', false, 5242880,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg','image/png','image/webp'];

-- Object paths are athletes/<athlete_id>/<file>. The athlete id is the second
-- segment, and both policies below derive it from the path rather than trusting
-- anything the client sends alongside the upload.

-- READ: the athlete's own guardians, plus any active staff member. Staff need
-- to put a face to a name at the door and courtside; that is the whole point of
-- the photo. Marketing is included only because it is staff — the media CONSENT
-- flag, not this bucket, is what governs whether a photo may be published.
create or replace function public.can_read_athlete_photo(object_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.staff_users s
    where s.auth_id = auth.uid()::text and s.active
  ) or exists (
    select 1
    from public.athletes a
    join public.family_guardians fg on fg.family_id = a.family_id
    join public.guardians g on g.id = fg.guardian_id
    where g.auth_id = auth.uid()::text
      and a.id = split_part(object_name, '/', 2)
  );
$$;

-- WRITE: a guardian of that athlete, or admin/owner/front desk. A coach cannot
-- change a child's photo, and no signed-in user can write into another family's
-- folder even with a hand-crafted request.
create or replace function public.can_write_athlete_photo(object_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.staff_users s
    where s.auth_id = auth.uid()::text and s.active
      and s.role in ('owner','admin','front_desk')
  ) or exists (
    select 1
    from public.athletes a
    join public.family_guardians fg on fg.family_id = a.family_id
    join public.guardians g on g.id = fg.guardian_id
    where g.auth_id = auth.uid()::text
      and a.id = split_part(object_name, '/', 2)
  );
$$;

drop policy if exists "athlete photos readable by family and staff" on storage.objects;
create policy "athlete photos readable by family and staff"
  on storage.objects for select to authenticated
  using (bucket_id = '${BUCKET}' and public.can_read_athlete_photo(name));

drop policy if exists "athlete photos insertable by family" on storage.objects;
create policy "athlete photos insertable by family"
  on storage.objects for insert to authenticated
  with check (bucket_id = '${BUCKET}' and public.can_write_athlete_photo(name));

drop policy if exists "athlete photos updatable by family" on storage.objects;
create policy "athlete photos updatable by family"
  on storage.objects for update to authenticated
  using (bucket_id = '${BUCKET}' and public.can_write_athlete_photo(name))
  with check (bucket_id = '${BUCKET}' and public.can_write_athlete_photo(name));

drop policy if exists "athlete photos deletable by family" on storage.objects;
create policy "athlete photos deletable by family"
  on storage.objects for delete to authenticated
  using (bucket_id = '${BUCKET}' and public.can_write_athlete_photo(name));
`;

async function main() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DIRECT_URL / DATABASE_URL not set");

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(SQL);
    const bucket = await client.query(
      "select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = $1",
      [BUCKET]
    );
    const policies = await client.query(
      "select policyname, cmd from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'athlete photos%' order by policyname"
    );
    console.log("bucket:", bucket.rows[0]);
    console.log("policies:");
    for (const p of policies.rows) console.log(`  ${p.cmd.padEnd(6)} ${p.policyname}`);
    console.log("\nStorage ready.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
