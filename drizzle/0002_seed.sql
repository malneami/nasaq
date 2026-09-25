-- Idempotent per-user defaults. Call via `select public.seed_user_defaults('<user_id>');`

create or replace function public.seed_user_defaults(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    raise exception 'user_id is required';
  end if;

  if auth.uid() is not null and p_user_id <> auth.uid() then
    raise exception 'cannot seed defaults for another user';
  end if;

  insert into public.life_areas (user_id, name, sort_order, icon, is_default)
  values
    (p_user_id, 'Career & Clinical Work', 1, 'stethoscope', true),
    (p_user_id, 'Ventures & Innovation', 2, 'lightbulb', true),
    (p_user_id, 'Family', 3, 'home', true),
    (p_user_id, 'Health', 4, 'heart', true),
    (p_user_id, 'Finance', 5, 'wallet', true),
    (p_user_id, 'Personal Development', 6, 'book', true),
    (p_user_id, 'Relationships & Network', 7, 'users', true)
  on conflict (user_id, name) do nothing;

  insert into public.transaction_categories (user_id, name, is_default, sort_order)
  values
    (p_user_id, 'Housing', true, 1),
    (p_user_id, 'Food', true, 2),
    (p_user_id, 'Dining', true, 3),
    (p_user_id, 'Transportation', true, 4),
    (p_user_id, 'Shopping', true, 5),
    (p_user_id, 'Family', true, 6),
    (p_user_id, 'Education', true, 7),
    (p_user_id, 'Health', true, 8),
    (p_user_id, 'Travel', true, 9),
    (p_user_id, 'Utilities', true, 10),
    (p_user_id, 'Subscriptions', true, 11),
    (p_user_id, 'Entertainment', true, 12),
    (p_user_id, 'Investment', true, 13),
    (p_user_id, 'Charity', true, 14),
    (p_user_id, 'Business', true, 15),
    (p_user_id, 'Projects', true, 16),
    (p_user_id, 'Other', true, 17)
  on conflict (user_id, name) do nothing;

  insert into public.accounts (user_id, name, account_type, currency, is_active)
  values (p_user_id, 'Cash', 'cash', 'SAR', true)
  on conflict (user_id, name) do nothing;
end;
$$;
--> statement-breakpoint

revoke all on function public.seed_user_defaults(uuid) from public;
--> statement-breakpoint

grant execute on function public.seed_user_defaults(uuid) to authenticated, service_role;
