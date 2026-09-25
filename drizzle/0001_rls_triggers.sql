-- Auth FKs, milestone FKs, category parent FK, updated_at triggers, grants, and RLS.

do $$
declare
  t text;
begin
  foreach t in array array[
    'life_areas',
    'goals',
    'projects',
    'project_scores',
    'milestones',
    'tasks',
    'calendar_events',
    'time_blocks',
    'contacts',
    'interactions',
    'commitments',
    'waiting_items',
    'inbox_items',
    'accounts',
    'transactions',
    'transaction_categories',
    'budgets',
    'financial_goals',
    'project_finances',
    'daily_briefs',
    'weekly_reviews',
    'ai_recommendations',
    'notifications',
    'audit_logs',
    'goal_life_areas',
    'project_life_areas',
    'goal_projects'
  ]
  loop
    execute format(
      'alter table public.%I drop constraint if exists %I',
      t,
      t || '_user_id_auth_fkey'
    );
    execute format(
      'alter table public.%I add constraint %I foreign key (user_id) references auth.users(id) on delete cascade',
      t,
      t || '_user_id_auth_fkey'
    );
  end loop;
end $$;
--> statement-breakpoint

alter table public.profiles
  drop constraint if exists profiles_user_id_auth_fkey;
--> statement-breakpoint

alter table public.profiles
  add constraint profiles_user_id_auth_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
--> statement-breakpoint

alter table public.projects
  drop constraint if exists projects_current_milestone_id_fk;
--> statement-breakpoint

alter table public.projects
  add constraint projects_current_milestone_id_fk
  foreign key (current_milestone_id) references public.milestones(id) on delete set null;
--> statement-breakpoint

alter table public.projects
  drop constraint if exists projects_next_milestone_id_fk;
--> statement-breakpoint

alter table public.projects
  add constraint projects_next_milestone_id_fk
  foreign key (next_milestone_id) references public.milestones(id) on delete set null;
--> statement-breakpoint

alter table public.transaction_categories
  drop constraint if exists transaction_categories_parent_id_fk;
--> statement-breakpoint

alter table public.transaction_categories
  add constraint transaction_categories_parent_id_fk
  foreign key (parent_id) references public.transaction_categories(id) on delete set null;
--> statement-breakpoint

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
--> statement-breakpoint

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles',
    'life_areas',
    'goals',
    'projects',
    'project_scores',
    'milestones',
    'tasks',
    'calendar_events',
    'time_blocks',
    'contacts',
    'interactions',
    'commitments',
    'waiting_items',
    'inbox_items',
    'accounts',
    'transactions',
    'transaction_categories',
    'budgets',
    'financial_goals',
    'project_finances',
    'daily_briefs',
    'weekly_reviews',
    'ai_recommendations',
    'notifications',
    'audit_logs',
    'goal_life_areas',
    'project_life_areas',
    'goal_projects'
  ]
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute procedure public.set_updated_at()',
      t
    );
  end loop;
end $$;
--> statement-breakpoint

grant usage on schema public to anon, authenticated, service_role;
--> statement-breakpoint

grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
--> statement-breakpoint

grant usage, select on all sequences in schema public to anon, authenticated, service_role;
--> statement-breakpoint

grant execute on all functions in schema public to anon, authenticated, service_role;
--> statement-breakpoint

do $$
declare
  r record;
begin
  for r in
    select n.nspname as schema_name, t.typname as type_name
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typtype = 'e'
  loop
    execute format(
      'grant usage on type %I.%I to anon, authenticated, service_role',
      r.schema_name,
      r.type_name
    );
  end loop;
end $$;
--> statement-breakpoint

do $$
declare
  t text;
begin
  foreach t in array array[
    'life_areas',
    'goals',
    'projects',
    'project_scores',
    'milestones',
    'tasks',
    'calendar_events',
    'time_blocks',
    'contacts',
    'interactions',
    'commitments',
    'waiting_items',
    'inbox_items',
    'accounts',
    'transactions',
    'transaction_categories',
    'budgets',
    'financial_goals',
    'project_finances',
    'daily_briefs',
    'weekly_reviews',
    'ai_recommendations',
    'notifications',
    'goal_life_areas',
    'project_life_areas',
    'goal_projects'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_own_all', t);
    execute format(
      'create policy %I on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t || '_own_all',
      t
    );
  end loop;
end $$;
--> statement-breakpoint

alter table public.profiles enable row level security;
--> statement-breakpoint

drop policy if exists profiles_select_own on public.profiles;
--> statement-breakpoint

create policy profiles_select_own
  on public.profiles
  for select
  using (user_id = auth.uid());
--> statement-breakpoint

drop policy if exists profiles_insert_own on public.profiles;
--> statement-breakpoint

create policy profiles_insert_own
  on public.profiles
  for insert
  with check (user_id = auth.uid());
--> statement-breakpoint

drop policy if exists profiles_update_own on public.profiles;
--> statement-breakpoint

create policy profiles_update_own
  on public.profiles
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
--> statement-breakpoint

alter table public.audit_logs enable row level security;
--> statement-breakpoint

drop policy if exists audit_logs_select_own on public.audit_logs;
--> statement-breakpoint

create policy audit_logs_select_own
  on public.audit_logs
  for select
  using (user_id = auth.uid());
--> statement-breakpoint

drop policy if exists audit_logs_insert_own on public.audit_logs;
--> statement-breakpoint

create policy audit_logs_insert_own
  on public.audit_logs
  for insert
  with check (user_id = auth.uid());
