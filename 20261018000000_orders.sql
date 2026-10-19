-- نظام الشراء والطلبات: إعدادات الدفع لكل نشاط، الطلبات، إيصالات التحويل (bucket خاص)،
-- إشعارات تلقائية، وقواعد انتقال الحالة مفروضة في القاعدة. لا يحذف أي بيانات.

-- ───────────── طرق الدفع التي يقبلها النشاط ─────────────
create table if not exists public.business_payments (
  business_id    uuid primary key references public.businesses (id) on delete cascade,
  vodafone_cash  text check (vodafone_cash is null or vodafone_cash ~ '^01[0125][0-9]{8}$'),
  etisalat_cash  text check (etisalat_cash is null or etisalat_cash ~ '^01[0125][0-9]{8}$'),
  orange_cash    text check (orange_cash is null or orange_cash ~ '^01[0125][0-9]{8}$'),
  instapay       text check (instapay is null or char_length(instapay) between 3 and 80),
  cod            boolean not null default true,
  updated_at     timestamptz not null default now()
);

-- ───────────── الطلبات (منتج واحد وكمية) ─────────────
create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses (id) on delete cascade,
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  product_id      uuid references public.products (id) on delete set null,
  business_name   text not null,
  product_name    text not null,
  product_photo   text,
  unit_price      numeric(10, 2) not null,
  quantity        integer not null check (quantity between 1 and 99),
  total           numeric(12, 2) not null,
  customer_name   text not null check (char_length(btrim(customer_name)) between 2 and 80),
  customer_phone  text not null check (customer_phone ~ '^0[0-9]{8,10}$'),
  address         text not null check (char_length(btrim(address)) between 5 and 300),
  village_id      smallint references public.villages (id),
  note            text check (note is null or char_length(note) <= 300),
  payment_method  text not null check (payment_method in ('vodafone_cash', 'etisalat_cash', 'orange_cash', 'instapay', 'cod')),
  receipt_path    text check (receipt_path is null or char_length(receipt_path) <= 200),
  status          text not null default 'new' check (status in ('new', 'accepted', 'shipped', 'delivered', 'rejected', 'cancelled')),
  reject_reason   text check (reject_reason is null or char_length(reject_reason) <= 200),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists orders_user_idx on public.orders (user_id, created_at desc);
create index if not exists orders_business_idx on public.orders (business_id, created_at desc);

-- ───────────── منطق الإنشاء والتحديث ─────────────
create or replace function public.trg_orders_before() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_prod record; v_bp record; v_biz record;
  v_owner boolean; v_buyer boolean;
begin
  if tg_op = 'INSERT' then
    if v_uid is null or not public.can_interact(new.business_id) then
      raise exception 'cannot_order' using errcode = '42501';
    end if;
    if (select count(*) from orders where user_id = v_uid and created_at > now() - interval '1 day') >= 20 then
      raise exception 'rate_limit_order';
    end if;
    select p.name, p.price, p.photo into v_prod from products p where p.id = new.product_id and p.business_id = new.business_id;
    if not found then raise exception 'product_not_found'; end if;
    select b.name into v_biz from businesses b where b.id = new.business_id;
    select * into v_bp from business_payments where business_id = new.business_id;
    if not (case new.payment_method
              when 'cod'           then coalesce(v_bp.cod, true)
              when 'vodafone_cash' then v_bp.vodafone_cash is not null
              when 'etisalat_cash' then v_bp.etisalat_cash is not null
              when 'orange_cash'   then v_bp.orange_cash is not null
              when 'instapay'      then v_bp.instapay is not null
              else false end) then
      raise exception 'payment_not_accepted';
    end if;
    if new.payment_method = 'cod' then new.receipt_path := null; end if;
    if new.receipt_path is not null and split_part(new.receipt_path, '/', 1) <> v_uid::text then
      raise exception 'invalid_receipt';
    end if;
    new.user_id := v_uid;
    new.business_name := v_biz.name;
    new.product_name := v_prod.name;
    new.product_photo := v_prod.photo;
    new.unit_price := v_prod.price;
    new.total := v_prod.price * new.quantity;
    new.customer_name := btrim(new.customer_name);
    new.address := btrim(new.address);
    new.note := nullif(btrim(coalesce(new.note, '')), '');
    new.status := 'new';
    new.reject_reason := null;
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;

  -- UPDATE: لا يتغير إلا status / reject_reason / receipt_path (بصلاحيات الأعمدة) وبقواعد الدور
  new.updated_at := now();
  if v_uid is null then return new; end if;
  v_buyer := old.user_id = v_uid;
  v_owner := public.is_business_owner(old.business_id);
  if v_buyer then
    if new.status is distinct from old.status and not (old.status = 'new' and new.status = 'cancelled') then
      raise exception 'invalid_transition';
    end if;
    if new.reject_reason is distinct from old.reject_reason then raise exception 'invalid_transition'; end if;
    if new.receipt_path is distinct from old.receipt_path then
      if old.status not in ('new', 'accepted') or old.payment_method = 'cod'
         or (new.receipt_path is not null and split_part(new.receipt_path, '/', 1) <> v_uid::text) then
        raise exception 'invalid_transition';
      end if;
    end if;
  elsif v_owner then
    if new.receipt_path is distinct from old.receipt_path then raise exception 'invalid_transition'; end if;
    if new.status is distinct from old.status and not (
         (old.status = 'new' and new.status in ('accepted', 'rejected'))
      or (old.status = 'accepted' and new.status in ('shipped', 'delivered'))
      or (old.status = 'shipped' and new.status = 'delivered')) then
      raise exception 'invalid_transition';
    end if;
    if new.reject_reason is distinct from old.reject_reason and new.status <> 'rejected' then
      raise exception 'invalid_transition';
    end if;
  else
    raise exception 'invalid_transition';
  end if;
  return new;
end $$;
create or replace trigger orders_before before insert or update on public.orders
  for each row execute function public.trg_orders_before();

-- ───────────── الإشعارات ─────────────
create or replace function public.trg_orders_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  select owner_id into v_owner from businesses where id = new.business_id;
  if tg_op = 'INSERT' then
    if v_owner is not null then
      perform notify(v_owner, 'order_new', 'طلب شراء جديد على «' || new.business_name || '»',
                     new.product_name || ' × ' || new.quantity, '/orders/' || new.id);
    end if;
  elsif new.status is distinct from old.status then
    if new.status = 'cancelled' then
      if v_owner is not null then
        perform notify(v_owner, 'order_cancelled', 'تم إلغاء طلب شراء', new.product_name, '/orders/' || new.id);
      end if;
    else
      perform notify(new.user_id, 'order_update',
        case new.status when 'accepted' then 'تمت الموافقة على طلبك ✅' when 'rejected' then 'تعذّر قبول طلبك'
                        when 'shipped' then 'طلبك جاري التوصيل 🚚' when 'delivered' then 'تم تسليم طلبك — مكتمل 🎉' else 'تحديث على طلبك' end,
        new.product_name || ' — «' || new.business_name || '»', '/orders/' || new.id);
    end if;
  elsif new.receipt_path is distinct from old.receipt_path and new.receipt_path is not null and v_owner is not null then
    perform notify(v_owner, 'order_receipt', 'تم رفع إيصال دفع لطلب', new.product_name, '/orders/' || new.id);
  end if;
  return new;
end $$;
create or replace trigger orders_notify after insert or update on public.orders
  for each row execute function public.trg_orders_notify();

revoke all on function public.trg_orders_before() from public, anon, authenticated;
revoke all on function public.trg_orders_notify() from public, anon, authenticated;

-- ───────────── الصلاحيات (RLS) ─────────────
alter table public.business_payments enable row level security;
alter table public.orders enable row level security;

create policy payments_select on public.business_payments for select
  using (public.is_business_owner(business_id) or public.is_admin());
create policy payments_insert on public.business_payments for insert
  with check (public.is_business_owner(business_id) and public.is_active_user());
create policy payments_update on public.business_payments for update
  using (public.is_business_owner(business_id)) with check (public.is_business_owner(business_id));

create policy orders_select on public.orders for select
  using (user_id = auth.uid() or public.is_business_owner(business_id));
create policy orders_insert on public.orders for insert
  with check (user_id = auth.uid() and public.can_interact(business_id));
create policy orders_update on public.orders for update
  using (user_id = auth.uid() or public.is_business_owner(business_id))
  with check (user_id = auth.uid() or public.is_business_owner(business_id));

-- العميل المسجَّل فقط يرى طرق دفع الأنشطة المعتمدة (أرقام المحافظ لا تُعرض للزوار)
create or replace view public.payment_methods_public with (security_invoker = false) as
  select bp.business_id, bp.vodafone_cash, bp.etisalat_cash, bp.orange_cash, bp.instapay, bp.cod
  from public.business_payments bp
  join public.businesses b on b.id = bp.business_id
  where b.status = 'approved';

revoke all on public.business_payments, public.orders, public.payment_methods_public from public, anon, authenticated;
grant select on public.payment_methods_public to authenticated;
grant select on public.business_payments to authenticated;
grant insert (business_id, vodafone_cash, etisalat_cash, orange_cash, instapay, cod) on public.business_payments to authenticated;
grant update (vodafone_cash, etisalat_cash, orange_cash, instapay, cod, updated_at) on public.business_payments to authenticated;
grant select on public.orders to authenticated;
grant insert (business_id, product_id, quantity, customer_name, customer_phone, address, village_id, note, payment_method, receipt_path)
  on public.orders to authenticated;
grant update (status, reject_reason, receipt_path) on public.orders to authenticated;

-- ───────────── إيصالات التحويل: bucket خاص (العميل وصاحب النشاط فقط) ─────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy receipts_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text and public.is_active_user());
create policy receipts_select on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.orders o where o.receipt_path = name and public.is_business_owner(o.business_id))));
create policy receipts_delete on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
