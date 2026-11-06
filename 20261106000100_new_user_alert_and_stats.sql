-- 1) تنبيه المشرفين عند تسجيل مستخدم جديد (يمر عبر جدول notifications ← trigger الدفع ← OneSignal الموجود).
--    أي خطأ هنا لا يمنع التسجيل أبدًا.
create or replace function public.trg_new_user() returns trigger
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_rows int; v_label text; a record;
begin
  insert into profiles (id, phone, full_name)
  values (new.id, nullif(new.phone, ''),
          nullif(left(btrim(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '')), 80), ''))
  on conflict do nothing;
  get diagnostics v_rows = row_count;
  if v_rows > 0 then
    begin
      v_label := coalesce(nullif(btrim(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '')), ''),
                          nullif(new.email, ''), nullif(new.phone, ''), 'مستخدم جديد');
      for a in select id from profiles where role = 'admin' and not is_banned loop
        perform notify(a.id, 'new_user', 'مستخدم جديد انضم للتطبيق 🎉', left(v_label, 80), '/admin');
      end loop;
    exception when others then null;
    end;
  end if;
  return new;
end $function$;

-- 2) إحصاءات المستخدمين للمشرف فقط
create or replace function public.admin_user_stats() returns jsonb
language plpgsql stable security definer set search_path to 'public' as $function$
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  return jsonb_build_object(
    'total_users',   (select count(*) from auth.users),
    'new_24h',       (select count(*) from auth.users where created_at > now() - interval '1 day'),
    'new_7d',        (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'active_24h',    (select count(*) from auth.users where last_sign_in_at > now() - interval '1 day'),
    'active_7d',     (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'),
    'active_30d',    (select count(*) from auth.users where last_sign_in_at > now() - interval '30 days'),
    'push_devices',  (select count(*) from onesignal_players),
    'push_users',    (select count(distinct user_id) from onesignal_players)
  );
end $function$;
revoke all on function public.admin_user_stats() from public, anon;
grant execute on function public.admin_user_stats() to authenticated;

-- 3) فك ربط جهاز الإشعارات عند تسجيل الخروج (حتى لا تصل إشعارات الحساب السابق للجهاز)
create or replace function public.unlink_onesignal_player(p_player text) returns void
language plpgsql security definer set search_path to 'public' as $function$
begin
  if auth.uid() is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  delete from onesignal_players where player_id = p_player and user_id = auth.uid();
end $function$;
revoke all on function public.unlink_onesignal_player(text) from public, anon;
grant execute on function public.unlink_onesignal_player(text) to authenticated;
