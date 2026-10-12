-- MOLMS expenditure month-end workflow
-- Applied to production on 2026-10-12; keep this migration in source control for reproducibility.
begin;

alter table public.expense_registers drop constraint if exists expense_registers_status_check;
alter table public.expense_registers add constraint expense_registers_status_check
  check (status = any (array['open','returned','submitted','approved','closed']::text[]));

alter table public.expense_registers
  add column if not exists submitted_at timestamptz,
  add column if not exists submitted_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists review_comments text,
  add column if not exists reopened_at timestamptz,
  add column if not exists reopened_by uuid references auth.users(id) on delete set null;

create table if not exists public.expense_register_reviews (
  id uuid primary key default gen_random_uuid(),
  expense_register_id uuid not null references public.expense_registers(id) on delete restrict,
  action text not null check (action = any(array['submitted','approved','returned','reopened','legacy_closed']::text[])),
  from_status text,
  to_status text not null,
  comments text,
  performed_by uuid references auth.users(id) on delete set null,
  performed_at timestamptz not null default now()
);
alter table public.expense_register_reviews enable row level security;
drop policy if exists expense_register_reviews_select on public.expense_register_reviews;
create policy expense_register_reviews_select on public.expense_register_reviews for select to authenticated using (
  exists(select 1 from public.roles r where r.user_id=auth.uid() and r.role=any(array['partner','admin','office_manager','office_admin']::text[]))
);
drop policy if exists expense_register_reviews_insert on public.expense_register_reviews;
create policy expense_register_reviews_insert on public.expense_register_reviews for insert to authenticated with check (
  performed_by=auth.uid() and exists(select 1 from public.roles r where r.user_id=auth.uid() and r.role=any(array['partner','admin','office_manager','office_admin']::text[]))
);

create or replace function public.fn_expense_register_workflow_guard()
returns trigger language plpgsql set search_path=public as $$
declare actor_role text;
begin
  if new.status is not distinct from old.status then return new; end if;
  select r.role into actor_role from public.roles r
  where r.user_id=auth.uid() and coalesce(r.active,true)=true
  order by case r.role when 'partner' then 1 when 'admin' then 2 when 'office_manager' then 3 when 'office_admin' then 4 else 9 end limit 1;

  if new.status='submitted' and old.status in ('open','returned') then
    if actor_role not in ('office_manager','office_admin','partner','admin') or actor_role is null then
      raise exception 'Only the Office Manager or an authorised partner can submit this expenditure register.';
    end if;
    new.submitted_at:=coalesce(new.submitted_at,now()); new.submitted_by:=coalesce(new.submitted_by,auth.uid());
    new.reviewed_at:=null; new.reviewed_by:=null;
  elsif new.status in ('approved','returned','closed') and old.status='submitted' then
    if actor_role not in ('partner','admin') or actor_role is null then
      raise exception 'Only a partner or administrator can review a submitted expenditure register.';
    end if;
    new.reviewed_at:=now(); new.reviewed_by:=auth.uid();
    if new.status='closed' then new.closed_at:=coalesce(new.closed_at,now()); new.closed_by:=coalesce(new.closed_by,auth.uid()); end if;
  elsif new.status='returned' and old.status in ('approved','closed') then
    if actor_role not in ('partner','admin') or actor_role is null then
      raise exception 'Only a partner or administrator can reopen a finalised expenditure register.';
    end if;
    new.reopened_at:=now(); new.reopened_by:=auth.uid(); new.reviewed_at:=now(); new.reviewed_by:=auth.uid();
  else
    raise exception 'Invalid expenditure register status transition: % to %.',old.status,new.status;
  end if;
  return new;
end $$;

drop trigger if exists trg_expense_register_workflow_guard on public.expense_registers;
create trigger trg_expense_register_workflow_guard before update of status on public.expense_registers
for each row execute function public.fn_expense_register_workflow_guard();

create or replace function public.fn_expense_entry_register_lock()
returns trigger language plpgsql set search_path=public as $$
declare register_status text; register_id uuid;
begin
  if tg_op='DELETE' then register_id:=old.expense_register_id; else register_id:=new.expense_register_id; end if;
  if register_id is null then if tg_op='DELETE' then return old; else return new; end if; end if;
  select er.status into register_status from public.expense_registers er where er.id=register_id;
  if register_status is null then raise exception 'The expenditure register for this entry could not be found.'; end if;
  if register_status not in ('open','returned') then
    raise exception 'This monthly expenditure register is locked (status: %). Return it for correction before changing entries.',register_status;
  end if;
  if tg_op='UPDATE' and new.expense_register_id is distinct from old.expense_register_id then
    select er.status into register_status from public.expense_registers er where er.id=old.expense_register_id;
    if register_status is distinct from 'open' and register_status is distinct from 'returned' then raise exception 'The original monthly expenditure register is locked.'; end if;
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end $$;

drop trigger if exists trg_expense_entry_register_lock on public.expense_entries;
create trigger trg_expense_entry_register_lock before insert or update or delete on public.expense_entries
for each row execute function public.fn_expense_entry_register_lock();

create or replace function public.fn_audit_expense_register_status()
returns trigger language plpgsql set search_path=public as $$
declare action_name text;
begin
  if new.status is not distinct from old.status then return new; end if;
  action_name:=case when new.status='submitted' then 'submitted'
    when new.status='approved' then 'approved'
    when new.status='returned' then case when old.status in ('approved','closed') then 'reopened' else 'returned' end
    when new.status='closed' then 'legacy_closed' else new.status end;
  insert into public.expense_register_reviews(expense_register_id,action,from_status,to_status,comments,performed_by)
  values(new.id,action_name,old.status,new.status,nullif(btrim(new.review_comments),''),auth.uid());
  return new;
end $$;
drop trigger if exists trg_audit_expense_register_status on public.expense_registers;
create trigger trg_audit_expense_register_status after update of status on public.expense_registers
for each row execute function public.fn_audit_expense_register_status();

drop policy if exists er_update_office_manager on public.expense_registers;
create policy er_update_office_manager on public.expense_registers for update to public
using (status in ('open','returned') and exists(select 1 from public.roles r where r.user_id=auth.uid() and r.role='office_manager' and coalesce(r.active,true)=true))
with check (status in ('open','returned','submitted') and exists(select 1 from public.roles r where r.user_id=auth.uid() and r.role='office_manager' and coalesce(r.active,true)=true));

drop policy if exists er_update_office_admin on public.expense_registers;
create policy er_update_office_admin on public.expense_registers for update to authenticated
using (status in ('open','returned') and created_by=auth.uid() and exists(select 1 from public.roles r where r.user_id=auth.uid() and r.role='office_admin' and coalesce(r.active,true)=true))
with check (status in ('open','returned','submitted') and created_by=auth.uid());

drop policy if exists expense_register_notifications_insert on public.notifications;
create policy expense_register_notifications_insert on public.notifications for insert to authenticated with check (
  created_by=auth.uid() and exists(select 1 from public.roles r where r.user_id=auth.uid() and r.role=any(array['partner','admin','office_manager','office_admin']::text[]))
);
commit;
