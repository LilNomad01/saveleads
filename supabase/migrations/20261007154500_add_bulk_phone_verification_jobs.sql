create table if not exists public.phone_verification_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  api_key_id uuid references public.api_keys(id) on delete set null,
  external_file_id text not null,
  status text not null default 'verifying',
  total integer not null default 0,
  processed integer not null default 0,
  lead_ids uuid[] not null default '{}',
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists phone_verification_jobs_user_created_idx
  on public.phone_verification_jobs(user_id, created_at desc);

alter table public.phone_verification_jobs enable row level security;

drop policy if exists "Users can view own phone verification jobs" on public.phone_verification_jobs;
create policy "Users can view own phone verification jobs"
  on public.phone_verification_jobs
  for select
  using (auth.uid() = user_id);

create or replace function public.apply_phone_verification_results(
  p_user_id uuid,
  p_results jsonb
)
returns integer
language sql
security definer
set search_path = public
as $$
  with parsed as (
    select
      (item->>'id')::uuid as id,
      coalesce((item->>'phone_valid')::boolean, false) as phone_valid,
      nullif(item->>'phone_line_type', '') as phone_line_type,
      nullif(item->>'phone_carrier', '') as phone_carrier,
      nullif(item->>'e164_digits', '') as e164_digits
    from jsonb_array_elements(p_results) item
  ),
  updated as (
    update public.leads l
    set
      phone_lookup_status = 'verified',
      phone_valid = p.phone_valid,
      phone_line_type = p.phone_line_type,
      phone_carrier = p.phone_carrier,
      phone_lookup_provider = 'veriphone',
      phone_lookup_error = null,
      phone_verified_at = now(),
      whatsapp_numero = coalesce(p.e164_digits, l.whatsapp_numero),
      updated_at = now()
    from parsed p
    where l.id = p.id
      and l.user_id = p_user_id
    returning l.id
  )
  select count(*)::integer from updated;
$$;

revoke all on function public.apply_phone_verification_results(uuid, jsonb) from public;
grant execute on function public.apply_phone_verification_results(uuid, jsonb) to service_role;
