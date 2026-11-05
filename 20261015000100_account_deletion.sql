-- حذف الحساب نهائيًا (حق المستخدم في حذف بياناته). يحذف المستخدم من auth.users
-- فتُحذف كل بياناته بالتسلسل (profiles, businesses, reviews, requests, conversations, notifications...).
-- لا يُسمح بحذف آخر مشرف حتى لا يبقى النظام بلا إدارة.

create function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  if public.is_admin() and (select count(*) from profiles where role = 'admin' and not is_banned) <= 1 then
    raise exception 'last_admin';
  end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function public.delete_my_account() from public, anon, authenticated;
grant execute on function public.delete_my_account() to authenticated;
