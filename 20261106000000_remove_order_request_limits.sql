-- إزالة الحد اليومي لطلبات الشراء (٢٠) ولطلبات الخدمة (١٠). بقية منطق الدوال كما هو دون أي تغيير.
create or replace function public.trg_orders_before() returns trigger
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_uid uuid := auth.uid();
  v_prod record; v_bp record; v_biz record;
  v_owner boolean; v_buyer boolean;
begin
  if tg_op = 'INSERT' then
    if v_uid is null or not public.can_interact(new.business_id) then
      raise exception 'cannot_order' using errcode = '42501';
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
end $function$;

create or replace function public.trg_requests_before() returns trigger
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_uid uuid := auth.uid();
  v_is_owner boolean;
begin
  new.updated_at := now();
  if v_uid is null or public.is_admin() then return new; end if;

  if tg_op = 'INSERT' then
    new.user_id := v_uid; new.status := 'new';
    new.requester_name := first_name(v_uid);
    new.business_name := (select name from businesses where id = new.business_id);
    new.contact_phone := case when new.share_phone then (select phone from profiles where id = v_uid) end;
  else
    v_is_owner := public.is_business_owner(old.business_id);
    new.business_id := old.business_id; new.user_id := old.user_id; new.kind := old.kind;
    new.message := old.message; new.share_phone := old.share_phone; new.contact_phone := old.contact_phone;
    new.requester_name := old.requester_name; new.business_name := old.business_name;
    new.created_at := old.created_at;
    if new.status is distinct from old.status then
      if v_is_owner then
        if not ((old.status, new.status) in (('new','accepted'), ('new','declined'),
                ('accepted','in_progress'), ('accepted','completed'), ('in_progress','completed'))) then
          new.status := old.status;
        end if;
      elsif old.user_id = v_uid then
        if not (old.status in ('new', 'accepted') and new.status = 'cancelled') then
          new.status := old.status;
        end if;
      else
        new.status := old.status;
      end if;
    end if;
  end if;
  return new;
end $function$;
