-- ═══════════════ الإشعارات الفورية (Web Push) ═══════════════
-- كل صف جديد في notifications يُرسل تلقائيًا كإشعار على أجهزة صاحبه، حتى لو التطبيق مغلق.
-- مفاتيح VAPID والسر المشترك تُحفظ في push_config (لا يصل إليها أحد من التطبيق)، وتُضاف بعد التشغيل:
--   insert into push_config(key,value) values ('function_url','https://<project>.supabase.co/functions/v1/send-push'),
--     ('secret','<سر عشوائي>'), ('vapid_public','...'), ('vapid_private','...'), ('vapid_subject','mailto:you@example.com');

create extension if not exists pg_net with schema extensions;

create table if not exists public.push_subscriptions (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  endpoint   text not null unique check (length(endpoint) between 20 and 1000),
  p256dh     text not null check (length(p256dh) between 20 and 200),
  auth       text not null check (length(auth) between 8 and 100),
  user_agent text check (length(user_agent) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;

do $$ begin
  create policy push_sub_select on public.push_subscriptions for select using (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy push_sub_insert on public.push_subscriptions for insert with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy push_sub_update on public.push_subscriptions for update using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy push_sub_delete on public.push_subscriptions for delete using (user_id = auth.uid());
exception when duplicate_object then null; end $$;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- إعدادات سرية: RLS مفعّل بلا أي سياسة، وبلا صلاحيات للعملاء
create table if not exists public.push_config (key text primary key, value text not null);
alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;

-- إرسال الإشعار إلى دالة send-push بعد إدخاله. أي فشل هنا لا يمنع إنشاء الإشعار نفسه.
create or replace function public.trg_notifications_push() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare v_url text; v_secret text;
begin
  select value into v_url from push_config where key = 'function_url';
  select value into v_secret from push_config where key = 'secret';
  if v_url is null or v_secret is null then return new; end if;
  if not exists (select 1 from push_subscriptions where user_id = new.user_id) then return new; end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
    body := jsonb_build_object('id', new.id, 'user_id', new.user_id, 'kind', new.kind,
                               'title', new.title, 'body', new.body, 'link', new.link),
    timeout_milliseconds := 5000
  );
  return new;
exception when others then
  return new;
end $$;
revoke all on function public.trg_notifications_push() from public, anon, authenticated;

do $$ begin
  create trigger notifications_push after insert on public.notifications
    for each row execute function public.trg_notifications_push();
exception when duplicate_object then null; end $$;
