-- ============================================================================
--  «ميدوم والواسطي» — مخطط قاعدة البيانات والصلاحيات (Supabase / PostgreSQL)
--  شغّله مرة واحدة من: Supabase Dashboard ← SQL Editor
--  ثم شغّل ملف seed.sql (الأقسام والقرى).
-- ============================================================================
--  مبادئ التصميم:
--   * الزائر (anon) يقرأ فقط من الواجهات العامة (views) والدوال المعلنة.
--   * لا أحد يقرأ جدول الأنشطة مباشرة إلا صاحبه أو المشرف؛ العامة تقرأ
--     business_public التي تُظهر المعتمد فقط وتخفي الهاتف/العنوان حسب إعدادات صاحب النشاط.
--   * كل الصلاحيات مفروضة على مستوى قاعدة البيانات (RLS + صلاحيات الأعمدة + Triggers)،
--     فلا يعتمد الأمان على كود الواجهة.
--   * المشرف لا يقرأ المحادثات الخاصة.
-- ============================================================================

-- ───────────────────────── دوال مساعدة عامة ─────────────────────────

-- توحيد النص العربي للبحث: إزالة التشكيل والتطويل، أ/إ/آ→ا، ى→ي، ة→ه
create or replace function public.ar_norm(t text) returns text
language sql immutable parallel safe as $$
  select regexp_replace(
           translate(lower(coalesce(t, '')),
                     U&'\0623\0625\0622\0649\0629',
                     U&'\0627\0627\0627\064A\0647'),
           '[ً-ْـ]', '', 'g');
$$;

-- ───────────────────────── الجداول ─────────────────────────

create table public.villages (
  id          smallserial primary key,
  name        text not null unique,
  region      text not null check (region in ('ميدوم', 'الواسطى')),
  sort_order  int  not null default 0,
  is_active   boolean not null default true
);

create table public.categories (
  id          text primary key check (id ~ '^[a-z0-9_-]{2,30}$'),
  name        text not null check (char_length(name) between 2 and 60),
  emoji       text not null default '📍',
  kind        text not null default 'business' check (kind in ('business', 'jobs')),
  sort_order  int  not null default 0,
  is_active   boolean not null default true
);

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text check (char_length(full_name) <= 80),
  phone       text,
  role        text not null default 'user' check (role in ('user', 'owner', 'admin')),
  village_id  smallint references public.villages (id),
  is_banned   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table public.businesses (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid default auth.uid() references auth.users (id) on delete cascade,
  category_id  text     not null references public.categories (id),
  village_id   smallint not null references public.villages (id),
  name         text not null check (char_length(name) between 3 and 80),
  type_label   text not null check (char_length(type_label) between 2 and 60),
  description  text not null check (char_length(description) between 10 and 1000),
  phone        text not null check (phone ~ '^0[0-9]{8,10}$'),
  address      text not null check (char_length(address) between 3 and 200),
  hours        text not null check (char_length(hours) between 2 and 100),
  lat          double precision check (lat between -90 and 90),
  lng          double precision check (lng between -180 and 180),
  show_phone   boolean not null default true,
  show_address boolean not null default true,
  photos       text[] not null default '{}' check (cardinality(photos) <= 5),
  status       text not null default 'pending'
               check (status in ('pending', 'approved', 'rejected', 'changes_requested', 'suspended')),
  review_note  text,
  reviewed_by  uuid references auth.users (id) on delete set null,
  reviewed_at  timestamptz,
  rating_avg   numeric(2, 1) not null default 0,
  rating_count int not null default 0,
  is_demo      boolean not null default false,
  search_text  text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (is_demo or owner_id is not null),
  check ((lat is null) = (lng is null))
);
create index businesses_status_idx   on public.businesses (status, created_at desc);
create index businesses_owner_idx    on public.businesses (owner_id);
create index businesses_category_idx on public.businesses (category_id);
create index businesses_village_idx  on public.businesses (village_id);

create table public.reviews (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  rating      smallint not null check (rating between 1 and 5),
  comment     text check (char_length(comment) <= 500),
  status      text not null default 'visible' check (status in ('visible', 'hidden')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (business_id, user_id)
);

create table public.favorites (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, business_id)
);

create table public.service_requests (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses (id) on delete cascade,
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind           text not null default 'inquiry' check (kind in ('inquiry', 'service')),
  message        text not null check (char_length(message) between 5 and 1000),
  share_phone    boolean not null default false,
  contact_phone  text,
  requester_name text,
  business_name  text,
  status         text not null default 'new'
                 check (status in ('new', 'accepted', 'in_progress', 'completed', 'declined', 'cancelled')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index service_requests_user_idx on public.service_requests (user_id, created_at desc);
create index service_requests_biz_idx  on public.service_requests (business_id, created_at desc);

create table public.conversations (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  created_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  unique (business_id, user_id)
);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body            text not null check (char_length(body) between 1 and 1000),
  created_at      timestamptz not null default now(),
  read_at         timestamptz
);
create index messages_conv_idx on public.messages (conversation_id, created_at);

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null,
  title      text not null,
  body       text,
  link       text,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.reports (
  id              uuid primary key default gen_random_uuid(),
  reporter_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  target_type     text not null check (target_type in ('business', 'review', 'job')),
  target_id       uuid not null,
  reason          text not null check (reason in ('wrong_info', 'inappropriate', 'spam', 'closed', 'other')),
  details         text check (char_length(details) <= 500),
  status          text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolution_note text,
  handled_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);

create table public.job_posts (
  id            uuid primary key default gen_random_uuid(),
  poster_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title         text not null check (char_length(title) between 3 and 80),
  employer_name text not null check (char_length(employer_name) between 2 and 80),
  description   text not null check (char_length(description) between 10 and 1000),
  village_id    smallint not null references public.villages (id),
  job_type      text not null check (job_type in ('full', 'part', 'temp', 'freelance')),
  contact_phone text not null check (contact_phone ~ '^0[0-9]{8,10}$'),
  status        text not null default 'pending'
                check (status in ('pending', 'approved', 'rejected', 'suspended')),
  review_note   text,
  reviewed_by   uuid references auth.users (id) on delete set null,
  reviewed_at   timestamptz,
  expires_at    timestamptz not null default (now() + interval '30 days'),
  created_at    timestamptz not null default now()
);
create index job_posts_status_idx on public.job_posts (status, created_at desc);

create table public.moderation_log (
  id          bigserial primary key,
  admin_id    uuid references auth.users (id) on delete set null,
  action      text not null,
  target_type text not null,
  target_id   text,
  note        text,
  created_at  timestamptz not null default now()
);

-- ───────────────────────── دوال الصلاحيات ─────────────────────────
-- (SECURITY DEFINER لتتجاوز RLS داخليًا دون تعريض الجداول)

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin' and not is_banned)
$$;

create function public.is_active_user() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
     and not exists (select 1 from profiles where id = auth.uid() and is_banned)
$$;

create function public.is_business_owner(p_business uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from businesses where id = p_business and owner_id = auth.uid())
$$;

-- هل يستطيع المستخدم تقييم/مراسلة هذا النشاط؟ (معتمد، له صاحب حقيقي، وليس نشاطه)
create function public.can_interact(p_business uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_active_user()
     and exists (select 1 from businesses
                 where id = p_business and status = 'approved'
                   and owner_id is not null and owner_id <> auth.uid())
$$;

create function public.is_participant(p_conversation uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from conversations c
    join businesses b on b.id = c.business_id
    where c.id = p_conversation and (c.user_id = auth.uid() or b.owner_id = auth.uid())
  )
$$;

create function public.internal_flag() returns boolean
language sql stable as $$ select coalesce(current_setting('app.internal', true), '') = '1' $$;

create function public.notify(p_user uuid, p_kind text, p_title text,
                              p_body text default null, p_link text default null)
returns void language sql security definer set search_path = public as $$
  insert into notifications (user_id, kind, title, body, link) values (p_user, p_kind, p_title, p_body, p_link)
$$;

create function public.first_name(p_user uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(split_part(btrim(coalesce(full_name, '')), ' ', 1), ''), 'مستخدم')
  from profiles where id = p_user
$$;

-- ───────────────────────── Triggers ─────────────────────────

-- إنشاء الملف الشخصي عند أول تسجيل دخول
create function public.trg_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, phone) values (new.id, new.phone) on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.trg_new_user();

-- الأنشطة: تنظيف المدخلات، منع تجاوز الصلاحيات، حدود الإرسال، إعادة المراجعة عند التعديل الجوهري
create function public.trg_businesses_before() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_admin boolean := public.is_admin();
  v_village text; v_cat text;
begin
  select name into v_village from villages where id = new.village_id;
  select name into v_cat from categories where id = new.category_id;
  new.search_text := ar_norm(concat_ws(' ', new.name, new.type_label, new.description, v_village, v_cat));
  new.updated_at := now();

  if public.internal_flag() or v_uid is null or v_admin then
    return new;   -- عمليات داخلية / SQL Editor / المشرف
  end if;

  if tg_op = 'INSERT' then
    new.status := 'pending'; new.rating_avg := 0; new.rating_count := 0; new.is_demo := false;
    new.review_note := null; new.reviewed_by := null; new.reviewed_at := null;
    new.owner_id := v_uid;
    if (select count(*) from businesses where owner_id = v_uid and created_at > now() - interval '1 day') >= 3 then
      raise exception 'rate_limit_business' using errcode = 'P0001';
    end if;
    if (select count(*) from businesses where owner_id = v_uid) >= 10 then
      raise exception 'limit_business_total' using errcode = 'P0001';
    end if;
  else
    new.owner_id := old.owner_id; new.is_demo := old.is_demo;
    new.rating_avg := old.rating_avg; new.rating_count := old.rating_count;
    new.review_note := old.review_note; new.reviewed_by := old.reviewed_by; new.reviewed_at := old.reviewed_at;
    new.created_at := old.created_at;
    -- الحالة: المالك يستطيع فقط إعادة الإرسال بعد الرفض/طلب التعديل
    if new.status is distinct from old.status then
      if not (old.status in ('rejected', 'changes_requested') and new.status = 'pending') then
        new.status := old.status;
      end if;
    end if;
    -- تعديل جوهري لنشاط معتمد يعيده للمراجعة
    if old.status = 'approved' and new.status = 'approved'
       and (new.name is distinct from old.name or new.description is distinct from old.description
            or new.type_label is distinct from old.type_label or new.category_id is distinct from old.category_id
            or new.photos is distinct from old.photos) then
      new.status := 'pending';
    end if;
  end if;
  return new;
end $$;
create trigger businesses_before before insert or update on public.businesses
  for each row execute function public.trg_businesses_before();

-- ترقية المستخدم إلى «صاحب نشاط» عند أول نشاط
create function public.trg_business_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.owner_id is not null then
    update profiles set role = 'owner' where id = new.owner_id and role = 'user';
  end if;
  return new;
end $$;
create trigger businesses_after_insert after insert on public.businesses
  for each row execute function public.trg_business_after_insert();

-- إشعار صاحب النشاط عند تغيّر حالة طلبه
create function public.trg_business_status_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.owner_id is null or new.status is not distinct from old.status then return new; end if;
  if new.status = 'approved' then
    perform notify(new.owner_id, 'business_approved', 'تمت الموافقة على نشاطك',
                   'تم نشر «' || new.name || '» ويظهر الآن للجميع.', '/b/' || new.id);
  elsif new.status = 'rejected' then
    perform notify(new.owner_id, 'business_rejected', 'تم رفض نشاطك',
                   '«' || new.name || '»: ' || coalesce(new.review_note, ''), '/my/' || new.id);
  elsif new.status = 'changes_requested' then
    perform notify(new.owner_id, 'business_changes', 'مطلوب تعديل على نشاطك',
                   '«' || new.name || '»: ' || coalesce(new.review_note, ''), '/my/' || new.id);
  elsif new.status = 'suspended' then
    perform notify(new.owner_id, 'business_suspended', 'تم إيقاف نشاطك',
                   '«' || new.name || '»: ' || coalesce(new.review_note, ''), '/my/' || new.id);
  end if;
  return new;
end $$;
create trigger businesses_status_notify after update of status on public.businesses
  for each row execute function public.trg_business_status_notify();

-- التقييمات
create function public.recompute_rating(p_business uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.internal', '1', true);
  update businesses b set
    rating_avg   = coalesce((select round(avg(rating)::numeric, 1) from reviews r
                             where r.business_id = p_business and r.status = 'visible'), 0),
    rating_count = (select count(*) from reviews r where r.business_id = p_business and r.status = 'visible')
  where b.id = p_business;
  perform set_config('app.internal', '', true);
end $$;

create function public.trg_reviews_before() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  new.updated_at := now();
  if v_uid is null or public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    new.status := 'visible'; new.user_id := v_uid;
    if (select count(*) from reviews where user_id = v_uid and created_at > now() - interval '1 hour') >= 10 then
      raise exception 'rate_limit_review' using errcode = 'P0001';
    end if;
  else
    new.status := old.status; new.business_id := old.business_id; new.user_id := old.user_id;
    new.created_at := old.created_at;
  end if;
  return new;
end $$;
create trigger reviews_before before insert or update on public.reviews
  for each row execute function public.trg_reviews_before();

create function public.trg_reviews_after() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform recompute_rating(coalesce(new.business_id, old.business_id));
  return null;
end $$;
create trigger reviews_after after insert or update or delete on public.reviews
  for each row execute function public.trg_reviews_after();

-- الطلبات
create function public.trg_requests_before() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_is_owner boolean;
begin
  new.updated_at := now();
  if v_uid is null or public.is_admin() then return new; end if;

  if tg_op = 'INSERT' then
    if (select count(*) from service_requests where user_id = v_uid and created_at > now() - interval '1 day') >= 10 then
      raise exception 'rate_limit_request' using errcode = 'P0001';
    end if;
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
end $$;
create trigger requests_before before insert or update on public.service_requests
  for each row execute function public.trg_requests_before();

create function public.trg_requests_after() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_name text;
begin
  select owner_id, name into v_owner, v_name from businesses where id = new.business_id;
  if tg_op = 'INSERT' then
    if v_owner is not null then
      perform notify(v_owner, 'request_new', 'طلب جديد على «' || v_name || '»', left(new.message, 80), '/requests');
    end if;
  elsif new.status is distinct from old.status then
    if new.status = 'cancelled' then
      if v_owner is not null then
        perform notify(v_owner, 'request_cancelled', 'تم إلغاء طلب على «' || v_name || '»', null, '/requests');
      end if;
    else
      perform notify(new.user_id, 'request_update', 'تحديث على طلبك من «' || v_name || '»',
        case new.status when 'accepted' then 'تم قبول طلبك' when 'in_progress' then 'جارٍ تنفيذ طلبك'
             when 'completed' then 'تم إكمال طلبك' when 'declined' then 'تعذّر قبول طلبك' end, '/requests');
    end if;
  end if;
  return null;
end $$;
create trigger requests_after after insert or update on public.service_requests
  for each row execute function public.trg_requests_after();

-- الرسائل
create function public.trg_messages_before() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    new.sender_id := auth.uid(); new.read_at := null;
    if (select count(*) from messages where sender_id = auth.uid() and created_at > now() - interval '1 minute') >= 20 then
      raise exception 'rate_limit_message' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger messages_before before insert on public.messages
  for each row execute function public.trg_messages_before();

create function public.trg_messages_after() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_owner uuid; v_to uuid;
begin
  select c.user_id, b.owner_id into v_user, v_owner
  from conversations c join businesses b on b.id = c.business_id where c.id = new.conversation_id;
  update conversations set last_message_at = new.created_at where id = new.conversation_id;
  v_to := case when new.sender_id = v_user then v_owner else v_user end;
  if v_to is not null and not exists (
       select 1 from notifications where user_id = v_to and kind = 'message'
         and link = '/chat/' || new.conversation_id and not is_read) then
    perform notify(v_to, 'message', 'رسالة جديدة', left(new.body, 80), '/chat/' || new.conversation_id);
  end if;
  return null;
end $$;
create trigger messages_after after insert on public.messages
  for each row execute function public.trg_messages_after();

-- البلاغات (حد يومي)
create function public.trg_reports_before() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.reporter_id := auth.uid(); new.status := 'open';
    new.resolution_note := null; new.handled_by := null;
    if (select count(*) from reports where reporter_id = auth.uid() and created_at > now() - interval '1 day') >= 10 then
      raise exception 'rate_limit_report' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger reports_before before insert on public.reports
  for each row execute function public.trg_reports_before();

-- الوظائف
create function public.trg_jobs_before() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    new.status := 'pending'; new.poster_id := v_uid;
    new.review_note := null; new.reviewed_by := null; new.reviewed_at := null;
    new.expires_at := now() + interval '30 days';
    if (select count(*) from job_posts where poster_id = v_uid and created_at > now() - interval '1 day') >= 3 then
      raise exception 'rate_limit_job' using errcode = 'P0001';
    end if;
  else
    new.poster_id := old.poster_id; new.review_note := old.review_note;
    new.reviewed_by := old.reviewed_by; new.reviewed_at := old.reviewed_at;
    new.created_at := old.created_at; new.expires_at := old.expires_at;
    if new.status is distinct from old.status then
      if not (old.status = 'rejected' and new.status = 'pending') then new.status := old.status; end if;
    end if;
    if old.status = 'approved' and new.status = 'approved'
       and (new.title is distinct from old.title or new.description is distinct from old.description
            or new.employer_name is distinct from old.employer_name or new.contact_phone is distinct from old.contact_phone) then
      new.status := 'pending';
    end if;
  end if;
  return new;
end $$;
create trigger jobs_before before insert or update on public.job_posts
  for each row execute function public.trg_jobs_before();

create function public.trg_job_status_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'approved' then
      perform notify(new.poster_id, 'job_approved', 'تم نشر إعلان الوظيفة', '«' || new.title || '» يظهر الآن للجميع.', '/jobs');
    elsif new.status = 'rejected' then
      perform notify(new.poster_id, 'job_rejected', 'تم رفض إعلان الوظيفة', '«' || new.title || '»: ' || coalesce(new.review_note, ''), '/jobs/mine');
    elsif new.status = 'suspended' then
      perform notify(new.poster_id, 'job_suspended', 'تم إيقاف إعلان الوظيفة', '«' || new.title || '»: ' || coalesce(new.review_note, ''), '/jobs/mine');
    end if;
  end if;
  return new;
end $$;
create trigger jobs_status_notify after update of status on public.job_posts
  for each row execute function public.trg_job_status_notify();

-- ───────────────────────── الواجهات العامة (Views) ─────────────────────────
-- تُنفَّذ بصلاحيات مالك الواجهة عمدًا: تُظهر المعتمد فقط وتحجب بيانات الاتصال حسب موافقة صاحب النشاط.

create view public.business_public with (security_invoker = false) as
select b.id, b.category_id, b.village_id, b.name, b.type_label, b.description,
       case when b.show_phone then b.phone end       as phone,
       case when b.show_address then b.address end   as address,
       b.hours,
       case when b.show_address then b.lat end       as lat,
       case when b.show_address then b.lng end       as lng,
       b.photos, b.rating_avg, b.rating_count, b.is_demo, b.created_at,
       (b.owner_id is not null)                      as chat_enabled
from public.businesses b
where b.status = 'approved';

create view public.reviews_public with (security_invoker = false) as
select r.id, r.business_id, r.rating, r.comment, r.created_at,
       coalesce(nullif(split_part(btrim(coalesce(p.full_name, '')), ' ', 1), ''), 'مستخدم') as author
from public.reviews r
join public.profiles p on p.id = r.user_id
join public.businesses b on b.id = r.business_id and b.status = 'approved'
where r.status = 'visible';

create view public.jobs_public with (security_invoker = false) as
select j.id, j.title, j.employer_name, j.description, j.village_id, j.job_type,
       j.contact_phone, j.created_at, j.expires_at
from public.job_posts j
where j.status = 'approved' and j.expires_at > now();

-- ───────────────────────── دوال الواجهة (RPC) ─────────────────────────

create function public.search_businesses(
  q            text default null,
  p_category   text default null,
  p_village    smallint default null,
  p_region     text default null,
  p_min_rating numeric default 0,
  p_sort       text default 'newest',      -- newest | rating | nearest
  p_lat        double precision default null,
  p_lng        double precision default null,
  p_limit      int default 30,
  p_offset     int default 0)
returns table (
  id uuid, category_id text, village_id smallint, name text, type_label text, description text,
  phone text, address text, hours text, lat double precision, lng double precision,
  photos text[], rating_avg numeric, rating_count int, is_demo boolean, chat_enabled boolean,
  created_at timestamptz, distance_km double precision)
language sql stable security definer set search_path = public as $$
  with words as (
    select w from unnest(string_to_array(ar_norm(btrim(coalesce(q, ''))), ' ')) as w where w <> ''
  ), base as (
    select b.*, (select bb.search_text from businesses bb where bb.id = b.id) as st,
           case when p_lat is not null and p_lng is not null and b.lat is not null then
             6371 * 2 * asin(sqrt(
               power(sin(radians(b.lat - p_lat) / 2), 2) +
               cos(radians(p_lat)) * cos(radians(b.lat)) * power(sin(radians(b.lng - p_lng) / 2), 2)))
           end as dist
    from business_public b
    join villages v on v.id = b.village_id
    join categories c on c.id = b.category_id and c.is_active and c.kind = 'business'
    where (p_category is null or b.category_id = p_category)
      and (p_village  is null or b.village_id = p_village)
      and (p_region   is null or v.region = p_region)
      and b.rating_avg >= coalesce(p_min_rating, 0)
  )
  select base.id, base.category_id, base.village_id, base.name, base.type_label, base.description,
         base.phone, base.address, base.hours, base.lat, base.lng, base.photos, base.rating_avg,
         base.rating_count, base.is_demo, base.chat_enabled, base.created_at, base.dist
  from base
  where not exists (select 1 from words where strpos(base.st, words.w) = 0)
  order by (case when p_sort = 'rating'  then base.rating_avg end) desc nulls last,
           (case when p_sort = 'rating'  then base.rating_count end) desc nulls last,
           (case when p_sort = 'nearest' then base.dist end) asc nulls last,
           base.created_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0)
$$;

-- بدء محادثة مع نشاط (أو استرجاع الموجودة)
create function public.start_conversation(p_business uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.can_interact(p_business) then
    raise exception 'cannot_contact' using errcode = '42501';
  end if;
  insert into conversations (business_id, user_id) values (p_business, auth.uid())
  on conflict (business_id, user_id) do update set business_id = excluded.business_id
  returning id into v_id;
  return v_id;
end $$;

create function public.my_conversations()
returns table (id uuid, business_id uuid, title text, as_owner boolean,
               last_body text, last_message_at timestamptz, unread bigint)
language sql stable security definer set search_path = public as $$
  select c.id, c.business_id,
         case when b.owner_id = auth.uid() then public.first_name(c.user_id) else b.name end,
         (b.owner_id = auth.uid()),
         lm.body, c.last_message_at,
         (select count(*) from messages m
          where m.conversation_id = c.id and m.sender_id <> auth.uid() and m.read_at is null)
  from conversations c
  join businesses b on b.id = c.business_id
  left join lateral (select body from messages where conversation_id = c.id
                     order by created_at desc limit 1) lm on true
  where (c.user_id = auth.uid() or b.owner_id = auth.uid())
  order by c.last_message_at desc
$$;

create function public.mark_conversation_read(p_conversation uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_participant(p_conversation) then
    raise exception 'not_participant' using errcode = '42501';
  end if;
  update messages set read_at = now()
  where conversation_id = p_conversation and sender_id <> auth.uid() and read_at is null;
  update notifications set is_read = true
  where user_id = auth.uid() and kind = 'message' and link = '/chat/' || p_conversation;
end $$;

-- ───────────────────────── دوال المشرف ─────────────────────────

create function public.admin_moderate_business(p_id uuid, p_action text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  v_status := case p_action when 'approve' then 'approved' when 'reject' then 'rejected'
                            when 'request_changes' then 'changes_requested' when 'suspend' then 'suspended' end;
  if v_status is null then raise exception 'invalid_action'; end if;
  if v_status <> 'approved' and btrim(coalesce(p_note, '')) = '' then raise exception 'note_required'; end if;
  update businesses set status = v_status,
         review_note = case when v_status = 'approved' then null else btrim(p_note) end,
         reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_id;
  if not found then raise exception 'not_found'; end if;
  insert into moderation_log (admin_id, action, target_type, target_id, note)
  values (auth.uid(), 'business_' || p_action, 'business', p_id::text, p_note);
end $$;

create function public.admin_moderate_job(p_id uuid, p_action text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  v_status := case p_action when 'approve' then 'approved' when 'reject' then 'rejected'
                            when 'suspend' then 'suspended' end;
  if v_status is null then raise exception 'invalid_action'; end if;
  if v_status <> 'approved' and btrim(coalesce(p_note, '')) = '' then raise exception 'note_required'; end if;
  update job_posts set status = v_status,
         review_note = case when v_status = 'approved' then null else btrim(p_note) end,
         reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_id;
  if not found then raise exception 'not_found'; end if;
  insert into moderation_log (admin_id, action, target_type, target_id, note)
  values (auth.uid(), 'job_' || p_action, 'job', p_id::text, p_note);
end $$;

-- معالجة بلاغ: dismiss | resolve | suspend (يوقف النشاط/الإعلان أو يخفي التقييم)
create function public.admin_handle_report(p_id uuid, p_action text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare r reports%rowtype;
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  select * into r from reports where id = p_id;
  if not found then raise exception 'not_found'; end if;
  if p_action not in ('dismiss', 'resolve', 'suspend') then raise exception 'invalid_action'; end if;
  if p_action = 'suspend' then
    if btrim(coalesce(p_note, '')) = '' then raise exception 'note_required'; end if;
    if r.target_type = 'business' then
      update businesses set status = 'suspended', review_note = btrim(p_note),
             reviewed_by = auth.uid(), reviewed_at = now() where id = r.target_id;
    elsif r.target_type = 'job' then
      update job_posts set status = 'suspended', review_note = btrim(p_note),
             reviewed_by = auth.uid(), reviewed_at = now() where id = r.target_id;
    elsif r.target_type = 'review' then
      update reviews set status = 'hidden' where id = r.target_id;
    end if;
  end if;
  update reports set status = case when p_action = 'dismiss' then 'dismissed' else 'resolved' end,
         resolution_note = nullif(btrim(coalesce(p_note, '')), ''), handled_by = auth.uid()
  where id = p_id;
  insert into moderation_log (admin_id, action, target_type, target_id, note)
  values (auth.uid(), 'report_' || p_action, r.target_type, r.target_id::text, p_note);
end $$;

create function public.admin_set_banned(p_user uuid, p_banned boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  if p_user = auth.uid() then raise exception 'cannot_ban_self'; end if;
  perform set_config('app.internal', '1', true);
  update profiles set is_banned = p_banned where id = p_user;
  perform set_config('app.internal', '', true);
  insert into moderation_log (admin_id, action, target_type, target_id)
  values (auth.uid(), case when p_banned then 'ban_user' else 'unban_user' end, 'user', p_user::text);
end $$;

-- عدّادات سريعة للوحة المشرف
create function public.admin_counts() returns table (pending_businesses bigint, pending_jobs bigint, open_reports bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  return query select
    (select count(*) from businesses where status = 'pending'),
    (select count(*) from job_posts where status = 'pending'),
    (select count(*) from reports where status = 'open');
end $$;

-- ───────────────────────── Row Level Security ─────────────────────────

alter table public.villages          enable row level security;
alter table public.categories        enable row level security;
alter table public.profiles          enable row level security;
alter table public.businesses        enable row level security;
alter table public.reviews           enable row level security;
alter table public.favorites         enable row level security;
alter table public.service_requests  enable row level security;
alter table public.conversations     enable row level security;
alter table public.messages          enable row level security;
alter table public.notifications     enable row level security;
alter table public.reports           enable row level security;
alter table public.job_posts         enable row level security;
alter table public.moderation_log    enable row level security;

-- القرى والأقسام: قراءة عامة للمفعّل، وإدارة للمشرف
create policy villages_read   on public.villages   for select using (is_active or public.is_admin());
create policy villages_admin  on public.villages   for all    using (public.is_admin()) with check (public.is_admin());
create policy categories_read on public.categories for select using (is_active or public.is_admin());
create policy categories_admin on public.categories for all   using (public.is_admin()) with check (public.is_admin());

-- الملف الشخصي: صاحبه والمشرف فقط (التعديل على الاسم والقرية فقط عبر صلاحيات الأعمدة)
create policy profiles_select on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy profiles_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- الأنشطة: صاحبها أو المشرف (العامة تقرأ business_public)
create policy businesses_select on public.businesses for select using (owner_id = auth.uid() or public.is_admin());
create policy businesses_insert on public.businesses for insert with check (owner_id = auth.uid() and public.is_active_user());
create policy businesses_update on public.businesses for update
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());
create policy businesses_delete on public.businesses for delete using (owner_id = auth.uid() or public.is_admin());

-- التقييمات (العامة تقرأ reviews_public)
create policy reviews_select on public.reviews for select using (user_id = auth.uid() or public.is_admin());
create policy reviews_insert on public.reviews for insert with check (user_id = auth.uid() and public.can_interact(business_id));
create policy reviews_update on public.reviews for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy reviews_delete on public.reviews for delete using (user_id = auth.uid() or public.is_admin());

-- المفضلة
create policy favorites_all on public.favorites for all
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_active_user());

-- الطلبات: صاحب الطلب أو صاحب النشاط أو المشرف
create policy requests_select on public.service_requests for select
  using (user_id = auth.uid() or public.is_business_owner(business_id) or public.is_admin());
create policy requests_insert on public.service_requests for insert
  with check (user_id = auth.uid() and public.can_interact(business_id));
create policy requests_update on public.service_requests for update
  using (user_id = auth.uid() or public.is_business_owner(business_id))
  with check (user_id = auth.uid() or public.is_business_owner(business_id));

-- المحادثات والرسائل: الطرفان فقط (لا وصول للمشرف حفاظًا على الخصوصية)
create policy conversations_select on public.conversations for select using (public.is_participant(id));
create policy messages_select on public.messages for select using (public.is_participant(conversation_id));
create policy messages_insert on public.messages for insert
  with check (sender_id = auth.uid() and public.is_participant(conversation_id) and public.is_active_user());

-- الإشعارات: صاحبها فقط (تحديث is_read فقط عبر صلاحيات الأعمدة)
create policy notifications_select on public.notifications for select using (user_id = auth.uid());
create policy notifications_update on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete on public.notifications for delete using (user_id = auth.uid());

-- البلاغات
create policy reports_select on public.reports for select using (reporter_id = auth.uid() or public.is_admin());
create policy reports_insert on public.reports for insert with check (reporter_id = auth.uid() and public.is_active_user());

-- الوظائف (العامة تقرأ jobs_public)
create policy jobs_select on public.job_posts for select using (poster_id = auth.uid() or public.is_admin());
create policy jobs_insert on public.job_posts for insert with check (poster_id = auth.uid() and public.is_active_user());
create policy jobs_update on public.job_posts for update
  using (poster_id = auth.uid() or public.is_admin()) with check (poster_id = auth.uid() or public.is_admin());
create policy jobs_delete on public.job_posts for delete using (poster_id = auth.uid() or public.is_admin());

create policy modlog_select on public.moderation_log for select using (public.is_admin());

-- ───────────────────────── الصلاحيات الصريحة (Grants) ─────────────────────────
-- نسحب كل شيء أولًا ثم نمنح الحد الأدنى. (عند إضافة جداول لاحقًا امنحها يدويًا.)

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

grant usage on schema public to anon, authenticated;

grant select on public.villages, public.categories                       to anon, authenticated;
grant insert, update, delete on public.villages, public.categories       to authenticated;
grant usage on sequence public.villages_id_seq                           to authenticated;
grant select on public.business_public, public.reviews_public, public.jobs_public to anon, authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, village_id) on public.profiles to authenticated;

grant select, delete on public.businesses to authenticated;
grant insert (category_id, village_id, name, type_label, description, phone, address, hours,
              lat, lng, show_phone, show_address, photos)
  on public.businesses to authenticated;
grant update (category_id, village_id, name, type_label, description, phone, address, hours,
              lat, lng, show_phone, show_address, photos, status)
  on public.businesses to authenticated;

grant select, delete on public.reviews to authenticated;
grant insert (business_id, rating, comment) on public.reviews to authenticated;
grant update (rating, comment) on public.reviews to authenticated;

grant select, delete on public.favorites to authenticated;
grant insert (business_id) on public.favorites to authenticated;

grant select on public.service_requests to authenticated;
grant insert (business_id, kind, message, share_phone) on public.service_requests to authenticated;
grant update (status) on public.service_requests to authenticated;

grant select on public.conversations to authenticated;
grant select on public.messages to authenticated;
grant insert (conversation_id, body) on public.messages to authenticated;

grant select, delete on public.notifications to authenticated;
grant update (is_read) on public.notifications to authenticated;

grant select on public.reports to authenticated;
grant insert (target_type, target_id, reason, details) on public.reports to authenticated;

grant select, delete on public.job_posts to authenticated;
grant insert (title, employer_name, description, village_id, job_type, contact_phone) on public.job_posts to authenticated;
grant update (title, employer_name, description, village_id, job_type, contact_phone, status) on public.job_posts to authenticated;

grant select on public.moderation_log to authenticated;

-- دوال تُستدعى من سياسات RLS (تحتاج EXECUTE للأدوار التي تُقيَّم سياساتها)
grant execute on function public.is_admin()                  to anon, authenticated;
grant execute on function public.is_active_user()            to anon, authenticated;
grant execute on function public.is_business_owner(uuid)     to anon, authenticated;
grant execute on function public.can_interact(uuid)          to anon, authenticated;
grant execute on function public.is_participant(uuid)        to anon, authenticated;
grant execute on function public.ar_norm(text)               to anon, authenticated;
-- دوال الواجهة
grant execute on function public.search_businesses(text, text, smallint, text, numeric, text,
                                                   double precision, double precision, int, int) to anon, authenticated;
grant execute on function public.start_conversation(uuid)           to authenticated;
grant execute on function public.my_conversations()                 to authenticated;
grant execute on function public.mark_conversation_read(uuid)       to authenticated;
-- دوال المشرف (تتحقق من is_admin() داخليًا أيضًا)
grant execute on function public.admin_moderate_business(uuid, text, text) to authenticated;
grant execute on function public.admin_moderate_job(uuid, text, text)      to authenticated;
grant execute on function public.admin_handle_report(uuid, text, text)     to authenticated;
grant execute on function public.admin_set_banned(uuid, boolean)           to authenticated;
grant execute on function public.admin_counts()                            to authenticated;

-- ───────────────────────── تخزين الصور ─────────────────────────
-- حاوية عامة للقراءة (روابط الصور). الرفع فقط داخل مجلد المستخدم نفسه، بنوع وحجم محدّدين.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('business-photos', 'business-photos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy photos_select on storage.objects for select to authenticated
  using (bucket_id = 'business-photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'business-photos' and (storage.foldername(name))[1] = auth.uid()::text and public.is_active_user());
create policy photos_update on storage.objects for update to authenticated
  using (bucket_id = 'business-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'business-photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- ───────────────────────── Realtime (المحادثات والإشعارات) ─────────────────────────
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages, public.notifications;
  end if;
end $$;
