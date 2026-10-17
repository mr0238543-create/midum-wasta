-- كتالوج المنتجات: يضيفها صاحب النشاط (اسم + سعر + صورة)، ويراها الجميع في صفحة النشاط المعتمد فقط.
-- آمن لإعادة التشغيل ولا يحذف أي بيانات.

create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 2 and 80),
  price       numeric(10, 2) not null check (price >= 0 and price <= 10000000),
  photo       text check (photo is null or char_length(photo) <= 200),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists products_business_idx on public.products (business_id, sort_order, created_at);

-- تنظيف الاسم (عدد المنتجات مفتوح بدون حد أقصى)
create or replace function public.trg_products_before() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.name := btrim(new.name);
  return new;
end $$;
create or replace trigger products_before before insert or update on public.products
  for each row execute function public.trg_products_before();

alter table public.products enable row level security;

do $$ begin
  execute $q$create policy products_select on public.products for select
  using (public.is_business_owner(business_id) or public.is_admin())$q$;
exception when duplicate_object then null; end $$;
do $$ begin
  execute $q$create policy products_insert on public.products for insert
  with check (public.is_business_owner(business_id) and public.is_active_user())$q$;
exception when duplicate_object then null; end $$;
do $$ begin
  execute $q$create policy products_update on public.products for update
  using (public.is_business_owner(business_id)) with check (public.is_business_owner(business_id))$q$;
exception when duplicate_object then null; end $$;
do $$ begin
  execute $q$create policy products_delete on public.products for delete
  using (public.is_business_owner(business_id) or public.is_admin())$q$;
exception when duplicate_object then null; end $$;

-- العرض العام: منتجات الأنشطة المعتمدة فقط
create or replace view public.products_public with (security_invoker = false) as
  select p.id, p.business_id, p.name, p.price, p.photo, p.sort_order, p.created_at
  from public.products p
  join public.businesses b on b.id = p.business_id
  where b.status = 'approved';

revoke all on public.products, public.products_public from public, anon, authenticated;
grant select on public.products_public to anon, authenticated;
grant select, delete on public.products to authenticated;
grant insert (business_id, name, price, photo, sort_order) on public.products to authenticated;
grant update (name, price, photo, sort_order) on public.products to authenticated;
