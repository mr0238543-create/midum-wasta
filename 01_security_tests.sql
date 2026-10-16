-- اختبارات الأمان والصلاحيات. تُشغَّل على Postgres محلي بعد 00_supabase_stub.sql + المخطط + seed.sql
-- أي فشل يوقف التنفيذ برسالة FAIL.
\set ON_ERROR_STOP on
\set QUIET on

create schema tt;
grant usage on schema tt to anon, authenticated;
create function tt.ok(c boolean, msg text) returns void language plpgsql as $$
begin if c is not true then raise exception 'FAIL: %', msg; end if; end $$;
create function tt.eq(a numeric, b numeric, msg text) returns void language plpgsql as $$
begin if a is distinct from b then raise exception 'FAIL: % (got %, expected %)', msg, a, b; end if; end $$;
create function tt.eqt(a text, b text, msg text) returns void language plpgsql as $$
begin if a is distinct from b then raise exception 'FAIL: % (got %, expected %)', msg, a, b; end if; end $$;
create function tt.fails(q text, msg text) returns void language plpgsql as $$
begin
  begin execute q; exception when others then return; end;
  raise exception 'FAIL (expected an error): %', msg;
end $$;
create function tt.fails_with(q text, expect text, msg text) returns void language plpgsql as $$
begin
  begin execute q; exception when others then
    if sqlerrm like '%' || expect || '%' then return; end if;
    raise exception 'FAIL: % (wrong error: %)', msg, sqlerrm;
  end;
  raise exception 'FAIL (expected an error): %', msg;
end $$;
create function tt.affected(q text) returns bigint language plpgsql as $$
declare n bigint; begin execute q; get diagnostics n = row_count; return n; end $$;
grant execute on all functions in schema tt to anon, authenticated;

\set as_su    'reset role; select set_config(''request.jwt.claim.sub'', '''', false);'
\set as_anon  'reset role; select set_config(''request.jwt.claim.sub'', '''', false); set role anon;'
\set as_a     'reset role; select set_config(''request.jwt.claim.sub'', ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'', false); set role authenticated;'
\set as_b     'reset role; select set_config(''request.jwt.claim.sub'', ''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'', false); set role authenticated;'
\set as_c     'reset role; select set_config(''request.jwt.claim.sub'', ''cccccccc-cccc-cccc-cccc-cccccccccccc'', false); set role authenticated;'
\set as_d     'reset role; select set_config(''request.jwt.claim.sub'', ''dddddddd-dddd-dddd-dddd-dddddddddddd'', false); set role authenticated;'
\set as_e     'reset role; select set_config(''request.jwt.claim.sub'', ''eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'', false); set role authenticated;'

-- ═══ إعداد المستخدمين: A صاحب نشاط، B مستخدم، C مشرف، D مستخدم آخر، E محظور ═══
:as_su
insert into auth.users (id, phone) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '201000000001'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '201000000002'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '201000000003'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '201000000004'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '201000000005');
update profiles set role = 'admin' where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
update profiles set is_banned = true where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
update profiles set full_name = 'أحمد علي' where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
select tt.eq((select count(*) from profiles), 5, '1. profile auto-created for each auth user');

-- ═══ 2. الأدوار والملف الشخصي ═══
:as_b
select tt.fails($$update profiles set role = 'admin' where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'$$, '2a. user cannot self-promote to admin');
select tt.fails($$update profiles set is_banned = false where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'$$, '2b. user cannot edit is_banned');
select tt.fails($$update profiles set phone = '0100' where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'$$, '2c. user cannot change phone');
select tt.eq(tt.affected($$update profiles set full_name = 'أحمد علي' where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'$$), 1, '2d. user can edit own name');
select tt.eq((select count(*) from profiles), 1, '2e. user only sees own profile');
select tt.fails($$select admin_moderate_business(gen_random_uuid(), 'approve')$$, '2f. user cannot call admin RPC');
select tt.fails($$select admin_set_banned('dddddddd-dddd-dddd-dddd-dddddddddddd', true)$$, '2g. user cannot ban');
:as_anon
select tt.fails($$select count(*) from profiles$$, '2h. anon cannot read profiles');
select tt.fails($$select admin_counts()$$, '2i. anon cannot call admin_counts');
:as_c
select tt.eq((select count(*) from profiles), 5, '2j. admin sees all profiles');

-- ═══ 3. تسجيل نشاط ═══
:as_anon
select tt.fails($$insert into businesses (category_id, village_id, name, type_label, description, phone, address, hours) values ('shops',1,'محل زائر','تجارة','وصف كافٍ للنشاط','01012345678','عنوان','9-5')$$, '3a. anon cannot create business');
:as_e
select tt.fails($$insert into businesses (category_id, village_id, name, type_label, description, phone, address, hours) values ('shops',1,'محل محظور','تجارة','وصف كافٍ للنشاط','01012345678','عنوان','9-5')$$, '3b. banned user cannot create business');
:as_a
select tt.fails($$insert into businesses (category_id, village_id, name, type_label, description, phone, address, hours, status) values ('shops',1,'محل مخالف','تجارة','وصف كافٍ للنشاط','01012345678','عنوان','9-5','approved')$$, '3c. owner cannot insert status directly');
select tt.fails($$insert into businesses (category_id, village_id, name, type_label, description, phone, address, hours, is_demo) values ('shops',1,'محل مخالف','تجارة','وصف كافٍ للنشاط','01012345678','عنوان','9-5', true)$$, '3d. owner cannot insert is_demo');
select tt.fails($$insert into businesses (category_id, village_id, name, type_label, description, phone, address, hours) values ('shops',1,'مح','تجارة','وصف كافٍ للنشاط','01012345678','عنوان','9-5')$$, '3e. name too short rejected');
select tt.fails($$insert into businesses (category_id, village_id, name, type_label, description, phone, address, hours) values ('shops',1,'محل صحيح','تجارة','وصف كافٍ للنشاط','123','عنوان','9-5')$$, '3f. bad phone rejected');
select tt.fails($$insert into businesses (owner_id, category_id, village_id, name, type_label, description, phone, address, hours) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','shops',1,'محل منتحل','تجارة','وصف كافٍ للنشاط','01012345678','عنوان','9-5')$$, '3g. cannot create business as another owner');

insert into businesses (category_id, village_id, name, type_label, description, phone, address, hours, lat, lng, show_phone)
values ('shops', 6, 'محل النخيل للعطارة', 'عطارة وتوابل', 'أعشاب وتوابل وبهارات طازجة', '01098765432', 'بجوار المدرسة الإعدادية', '٩ ص – ٩ م', 29.30, 31.20, false);
select id as biz1 from businesses where name = 'محل النخيل للعطارة' \gset
select tt.eqt((select status from businesses where id = :'biz1'), 'pending', '3h. new business is pending');
:as_su
select tt.eqt((select role from profiles where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 'owner', '3i. user promoted to owner');

-- ═══ 4. الخصوصية: قيد المراجعة لا يظهر لأحد ═══
:as_anon
select tt.eq((select count(*) from business_public), 0, '4a. pending hidden from anon (view)');
select tt.fails($$select count(*) from businesses$$, '4b. anon cannot read businesses table');
select tt.eq((select count(*) from search_businesses()), 0, '4c. pending hidden from search');
:as_b
select tt.eq((select count(*) from businesses), 0, '4d. other user cannot read pending business');
select tt.eq(tt.affected(format($$update businesses set name = 'تم اختراقه' where id = %L$$, :'biz1')), 0, '4e. other user cannot update business');
select tt.eq(tt.affected(format($$delete from businesses where id = %L$$, :'biz1')), 0, '4f. other user cannot delete business');
:as_a
select tt.eq((select count(*) from businesses), 1, '4g. owner sees own pending business');
-- المالك لا يستطيع الموافقة بنفسه
select tt.fails(format($$update businesses set rating_avg = 5 where id = %L$$, :'biz1'), '4h1. owner cannot edit rating');
select tt.fails(format($$update businesses set review_note = 'x' where id = %L$$, :'biz1'), '4h2. owner cannot edit review note');
update businesses set status = 'approved' where id = :'biz1';
select tt.eqt((select status from businesses where id = :'biz1'), 'pending', '4h. owner cannot self-approve');
select tt.fails(format($$update businesses set is_demo = true where id = %L$$, :'biz1'), '4i. owner cannot edit is_demo');
select tt.fails(format($$update businesses set owner_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' where id = %L$$, :'biz1'), '4j. owner cannot transfer ownership');

-- ═══ 5. المراجعة (المشرف) ═══
:as_c
select tt.eq((select pending_businesses from admin_counts()), 1, '5a. admin sees pending count');
select tt.fails_with(format($$select admin_moderate_business(%L, 'reject')$$, :'biz1'), 'note_required', '5b. reject requires a reason');
select admin_moderate_business(:'biz1', 'request_changes', 'أضف صورة للمحل');
:as_a
select tt.eqt((select status from businesses where id = :'biz1'), 'changes_requested', '5c. status changes_requested');
select tt.eqt((select review_note from businesses where id = :'biz1'), 'أضف صورة للمحل', '5d. note visible to owner');
select tt.ok((select count(*) from notifications where kind = 'business_changes') = 1, '5e. owner notified of changes request');
-- إعادة الإرسال
update businesses set status = 'pending', description = 'أعشاب وتوابل وبهارات طازجة مع صورة' where id = :'biz1';
select tt.eqt((select status from businesses where id = :'biz1'), 'pending', '5f. owner can resubmit');
:as_c
select admin_moderate_business(:'biz1', 'approve');
:as_a
select tt.ok((select count(*) from notifications where kind = 'business_approved') = 1, '5g. owner notified of approval');

-- ═══ 6. بعد الموافقة: ظهور عام مع حجب الهاتف حسب الإعداد ═══
:as_anon
select tt.eq((select count(*) from business_public), 1, '6a. approved visible to anon');
select tt.ok((select phone from business_public limit 1) is null, '6b. phone hidden when show_phone=false');
select tt.ok((select address from business_public limit 1) is not null, '6c. address visible when show_address=true');
:as_a
update businesses set show_phone = true, show_address = false where id = :'biz1';
select tt.eqt((select status from businesses where id = :'biz1'), 'approved', '6d. contact toggles do not require re-review');
:as_anon
select tt.eqt((select phone from business_public limit 1), '01098765432', '6e. phone shown when allowed');
select tt.ok((select address from business_public limit 1) is null, '6f. address hidden when show_address=false');
select tt.ok((select lat from business_public limit 1) is null, '6g. coordinates hidden when address hidden');
-- تعديل جوهري يعيد للمراجعة
:as_a
update businesses set name = 'محل النخيل للأعشاب' where id = :'biz1';
select tt.eqt((select status from businesses where id = :'biz1'), 'pending', '6h. material edit returns to pending');
:as_anon
select tt.eq((select count(*) from business_public), 0, '6i. re-pending hidden from public again');
:as_c
select admin_moderate_business(:'biz1', 'approve');

-- ═══ 7. البحث ═══
:as_anon
select tt.eq((select count(*) from search_businesses('عطاره')), 1, '7a. search normalises ة/ه');
select tt.eq((select count(*) from search_businesses('اعشاب')), 1, '7b. search normalises أ/ا');
select tt.eq((select count(*) from search_businesses('بني احمد')), 1, '7c. search by village (multi-word)');
select tt.eq((select count(*) from search_businesses('مطعم')), 0, '7d. non-matching word returns nothing');
select tt.eq((select count(*) from search_businesses(null, 'shops')), 1, '7e. category filter');
select tt.eq((select count(*) from search_businesses(null, 'pharmacies')), 0, '7f. category filter excludes');
select tt.eq((select count(*) from search_businesses(p_region => 'الواسطى')), 1, '7g. region filter');
select tt.eq((select count(*) from search_businesses(p_region => 'ميدوم')), 0, '7h. region filter excludes');
select tt.eq((select count(*) from search_businesses(p_min_rating => 4)), 0, '7i. min rating filter');
select tt.ok((select distance_km from search_businesses(p_lat => 29.31, p_lng => 31.21, p_sort => 'nearest') limit 1) is null, '7j. no distance leaked when address is hidden');
select tt.ok((select lat from search_businesses() limit 1) is null, '7k. search respects hidden coordinates');
:as_a
update businesses set show_address = true where id = :'biz1';
:as_anon
select tt.ok((select distance_km from search_businesses(p_lat => 29.31, p_lng => 31.21, p_sort => 'nearest') limit 1) between 1 and 2, '7k2. distance computed (haversine) when allowed');
select tt.eq((select count(*) from search_businesses(q => '%')), 0, '7l. LIKE wildcards are not interpreted');

-- ═══ 8. التقييمات ═══
:as_a
select tt.fails(format($$insert into reviews (business_id, rating) values (%L, 5)$$, :'biz1'), '8a. owner cannot review own business');
:as_anon
select tt.fails(format($$insert into reviews (business_id, rating) values (%L, 5)$$, :'biz1'), '8b. anon cannot review');
:as_e
select tt.fails(format($$insert into reviews (business_id, rating) values (%L, 5)$$, :'biz1'), '8c. banned user cannot review');
:as_b
select tt.fails(format($$insert into reviews (business_id, rating) values (%L, 9)$$, :'biz1'), '8d. rating out of range rejected');
insert into reviews (business_id, rating, comment) values (:'biz1', 4, 'خدمة ممتازة');
select tt.fails(format($$insert into reviews (business_id, rating) values (%L, 5)$$, :'biz1'), '8e. duplicate review blocked');
select tt.fails(format($$update reviews set status = 'hidden' where business_id = %L$$, :'biz1'), '8f. user cannot change review status');
:as_d
insert into reviews (business_id, rating) values (:'biz1', 5);
:as_anon
select tt.eqt((select rating_avg::text from business_public limit 1), '4.5', '8g. rating average recomputed');
select tt.eq((select rating_count from business_public limit 1), 2, '8h. rating count');
select tt.eqt((select author from reviews_public where comment is not null), 'أحمد', '8i. public review shows first name only');
select tt.fails($$select user_id from reviews_public limit 1$$, '8j. public review hides user id');
select tt.eq((select count(*) from search_businesses(p_min_rating => 4.5)), 1, '8k. min-rating filter finds it now');
:as_d
select tt.eq(tt.affected(format($$update reviews set rating = 1 where business_id = %L and user_id <> auth.uid()$$, :'biz1')), 0, '8l. cannot edit other users reviews');

-- ═══ 9. المفضلة ═══
:as_b
insert into favorites (business_id) values (:'biz1');
:as_d
select tt.eq((select count(*) from favorites), 0, '9a. favorites are private');
:as_anon
select tt.fails($$select count(*) from favorites$$, '9b. anon cannot read favorites');

-- ═══ 10. المحادثات (خاصة بين الطرفين) ═══
:as_a
select tt.fails_with(format($$select start_conversation(%L)$$, :'biz1'), 'cannot_contact', '10a. owner cannot chat with self');
:as_anon
select tt.fails(format($$select start_conversation(%L)$$, :'biz1'), '10b. anon cannot start chat');
:as_b
select start_conversation(:'biz1') as conv1 \gset
select tt.eqt(start_conversation(:'biz1')::text, :'conv1', '10c. start_conversation is idempotent');
insert into messages (conversation_id, body) values (:'conv1', 'السلام عليكم، متاح توصيل؟');
:as_a
select tt.eq((select count(*) from messages), 1, '10d. owner sees the message');
select tt.ok((select count(*) from notifications where kind = 'message') = 1, '10e. owner notified of message');
select tt.eq((select unread from my_conversations() limit 1), 1, '10f. unread count');
select mark_conversation_read(:'conv1');
select tt.eq((select unread from my_conversations() limit 1), 0, '10g. mark read');
insert into messages (conversation_id, body) values (:'conv1', 'أهلًا، نعم متاح');
select tt.eqt((select title from my_conversations() limit 1), 'أحمد', '10h. owner sees customer first name as title');
:as_b
select tt.eqt((select title from my_conversations() limit 1), 'محل النخيل للأعشاب', '10i. customer sees business name as title');
:as_d
select tt.eq((select count(*) from messages), 0, '10j. third party cannot read messages');
select tt.eq((select count(*) from conversations), 0, '10k. third party cannot see conversation');
select tt.fails(format($$insert into messages (conversation_id, body) values (%L, 'تدخل')$$, :'conv1'), '10l. third party cannot post');
select tt.fails(format($$select mark_conversation_read(%L)$$, :'conv1'), '10m. third party cannot mark read');
:as_c
select tt.eq((select count(*) from messages), 0, '10n. even admin cannot read private chats');
:as_b
select tt.fails(format($$insert into messages (conversation_id, body, sender_id) values (%L, 'مزوّر', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$$, :'conv1'), '10o. cannot spoof sender_id');
select tt.fails(format($$update messages set body = 'تعديل' where conversation_id = %L$$, :'conv1'), '10p. messages cannot be edited');
select tt.fails(format($$insert into messages (conversation_id, body) values (%L, repeat('ا', 1001))$$, :'conv1'), '10q. message length limit');

-- ═══ 11. الطلبات ═══
:as_b
insert into service_requests (business_id, kind, message, share_phone) values (:'biz1', 'service', 'أريد ١ كيلو كمون', true);
select id as req1 from service_requests \gset
select tt.eqt((select status from service_requests where id = :'req1'), 'new', '11a. request starts as new');
:as_d
select tt.eq((select count(*) from service_requests), 0, '11b. other user cannot see request');
:as_a
select tt.eq((select count(*) from service_requests), 1, '11c. business owner sees incoming request');
select tt.eqt((select contact_phone from service_requests limit 1), '201000000002', '11d. shared phone provided when consented');
select tt.eqt((select requester_name from service_requests limit 1), 'أحمد', '11e. requester first name');
select tt.eqt((select business_name from service_requests limit 1), 'محل النخيل للأعشاب', '11e2. business name snapshot stored');
select tt.ok((select count(*) from notifications where kind = 'request_new') = 1, '11f. owner notified of new request');
update service_requests set status = 'completed' where id = :'req1';
select tt.eqt((select status from service_requests where id = :'req1'), 'new', '11g. invalid transition new→completed ignored');
update service_requests set status = 'accepted' where id = :'req1';
select tt.eqt((select status from service_requests where id = :'req1'), 'accepted', '11h. owner can accept');
select tt.fails(format($$update service_requests set message = 'x' where id = %L$$, :'req1'), '11i. owner cannot edit message column');
:as_b
select tt.ok((select count(*) from notifications where kind = 'request_update') = 1, '11j. requester notified of update');
update service_requests set status = 'completed' where id = :'req1';
select tt.eqt((select status from service_requests where id = :'req1'), 'accepted', '11k. requester cannot complete');
update service_requests set status = 'cancelled' where id = :'req1';
select tt.eqt((select status from service_requests where id = :'req1'), 'cancelled', '11l. requester can cancel');
:as_a
select tt.fails(format($$insert into service_requests (business_id, message) values (%L, 'طلب لنفسي')$$, :'biz1'), '11m. owner cannot request own business');

-- ═══ 12. الإشعارات ═══
:as_b
select tt.fails($$insert into notifications (user_id, kind, title) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'x', 'مزوّر')$$, '12a. clients cannot create notifications');
select tt.eq((select count(*) from notifications where user_id <> auth.uid()), 0, '12b. cannot see others notifications');
select tt.fails($$update notifications set title = 'x'$$, '12c. only is_read editable');
select tt.ok(tt.affected($$update notifications set is_read = true$$) >= 0, '12d. can mark read');

-- ═══ 13. البلاغات ═══
:as_b
insert into reports (target_type, target_id, reason, details) values ('business', :'biz1', 'wrong_info', 'العنوان غير صحيح');
select id as rep1 from reports \gset
select tt.fails(format($$insert into reports (target_type, target_id, reason) values ('business', %L, 'spam')$$, :'biz1'), '13a. duplicate report blocked');
:as_d
select tt.eq((select count(*) from reports), 0, '13b. other users cannot see reports');
:as_a
select tt.eq((select count(*) from reports), 0, '13c. business owner cannot see reports about them');
:as_c
select tt.eq((select open_reports from admin_counts()), 1, '13d. admin sees open reports');
select tt.fails_with(format($$select admin_handle_report(%L, 'suspend')$$, :'rep1'), 'note_required', '13e. suspend requires reason');
select admin_handle_report(:'rep1', 'suspend', 'معلومات مضللة');
select tt.eqt((select status from reports where id = :'rep1'), 'resolved', '13f. report resolved');
:as_anon
select tt.eq((select count(*) from business_public), 0, '13g. suspended business hidden');
select tt.eq((select count(*) from search_businesses()), 0, '13h. suspended business out of search');
:as_a
select tt.eqt((select status from businesses where id = :'biz1'), 'suspended', '13i. owner sees suspended status');
update businesses set status = 'pending' where id = :'biz1';
select tt.eqt((select status from businesses where id = :'biz1'), 'suspended', '13j. owner cannot un-suspend');
:as_c
select admin_moderate_business(:'biz1', 'approve');

-- ═══ 14. الوظائف ═══
:as_b
insert into job_posts (title, employer_name, description, village_id, job_type, contact_phone)
values ('مطلوب محاسب', 'شركة الدلتا', 'خبرة سنتين على الأقل وإجادة إكسل', 4, 'full', '01012345678');
select id as job1 from job_posts \gset
select tt.fails($$insert into job_posts (title, employer_name, description, village_id, job_type, contact_phone, status) values ('وظيفة','جهة','وصف الوظيفة كامل',4,'full','01012345678','approved')$$, '14a. cannot insert approved status');
:as_anon
select tt.eq((select count(*) from jobs_public), 0, '14b. pending job hidden');
:as_c
select admin_moderate_job(:'job1', 'approve');
:as_anon
select tt.eq((select count(*) from jobs_public), 1, '14c. approved job visible');
:as_b
update job_posts set title = 'مطلوب محاسب أول' where id = :'job1';
select tt.eqt((select status from job_posts where id = :'job1'), 'pending', '14d. edit returns job to review');
:as_su
update job_posts set status = 'approved', expires_at = now() - interval '1 day' where id = (select id from job_posts limit 1);
:as_anon
select tt.eq((select count(*) from jobs_public), 0, '14e. expired job hidden');
:as_d
select tt.eq((select count(*) from job_posts), 0, '14f. others cannot see job drafts');

-- ═══ 15. الأقسام والقرى (إدارة المشرف) ═══
:as_anon
select tt.ok((select count(*) from categories) = 14, '15a. anon reads active categories');
select tt.fails($$insert into categories (id, name) values ('hack', 'قسم مخترق')$$, '15b. anon cannot add category');
:as_b
select tt.fails($$insert into categories (id, name) values ('hack', 'قسم مخترق')$$, '15c. user cannot add category');
select tt.eq(tt.affected($$update categories set is_active = false where id = 'shops'$$), 0, '15d. user cannot hide category');
:as_c
insert into categories (id, name, emoji) values ('bakery', 'المخابز', '🥖');
update categories set is_active = false where id = 'events';
:as_anon
select tt.eq((select count(*) from categories where id = 'events'), 0, '15e. hidden category invisible to public');
select tt.eq((select count(*) from categories where id = 'bakery'), 1, '15f. admin-added category visible');
:as_c
update categories set is_active = true where id = 'events';

-- ═══ 16. تخزين الصور ═══
:as_a
insert into storage.objects (bucket_id, name) values ('business-photos', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/shop1.jpg');
select tt.fails($$insert into storage.objects (bucket_id, name) values ('business-photos', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/evil.jpg')$$, '16a. cannot upload into another users folder');
select tt.fails($$insert into storage.objects (bucket_id, name) values ('business-photos', 'loose.jpg')$$, '16b. cannot upload to bucket root');
:as_b
select tt.eq(tt.affected($$delete from storage.objects where name like 'aaaaaaaa%'$$), 0, '16c. cannot delete another users photos');
:as_e
select tt.fails($$insert into storage.objects (bucket_id, name) values ('business-photos', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee/x.jpg')$$, '16d. banned user cannot upload');
:as_su
select tt.eq((select file_size_limit from storage.buckets where id = 'business-photos'), 2097152, '16e. bucket size limit 2MB');
select tt.ok((select 'image/jpeg' = any(allowed_mime_types) and not ('image/svg+xml' = any(allowed_mime_types)) from storage.buckets where id = 'business-photos'), '16f. only safe image types allowed');

-- ═══ 17. حدود الإرسال والحظر ═══
:as_d
insert into businesses (category_id, village_id, name, type_label, description, phone, address, hours) values
  ('shops',1,'محل رقم ١','تجارة','وصف كافٍ للنشاط','01012345678','عنوان','9-5'),
  ('shops',1,'محل رقم ٢','تجارة','وصف كافٍ للنشاط','01012345678','عنوان','9-5'),
  ('shops',1,'محل رقم ٣','تجارة','وصف كافٍ للنشاط','01012345678','عنوان','9-5');
select tt.fails_with($$insert into businesses (category_id, village_id, name, type_label, description, phone, address, hours) values ('shops',1,'محل رقم ٤','تجارة','وصف كافٍ للنشاط','01012345678','عنوان','9-5')$$, 'rate_limit_business', '17a. daily business submission limit');
:as_c
select admin_set_banned('dddddddd-dddd-dddd-dddd-dddddddddddd', true);
select tt.fails_with($$select admin_set_banned('cccccccc-cccc-cccc-cccc-cccccccccccc', true)$$, 'cannot_ban_self', '17b. admin cannot ban self');
:as_d
select tt.fails(format($$insert into reviews (business_id, rating) values (%L, 3)$$, :'biz1'), '17c. banned user blocked from reviewing');
select tt.fails(format($$insert into favorites (business_id) values (%L)$$, :'biz1'), '17d. banned user blocked from favorites');
:as_c
select admin_set_banned('dddddddd-dddd-dddd-dddd-dddddddddddd', false);
select tt.ok((select count(*) from moderation_log) >= 5, '17e. moderation actions are logged');
:as_b
select tt.eq((select count(*) from moderation_log), 0, '17f. moderation log not readable by users');

-- ═══ 18. الرسائل: حد المعدل ═══
:as_b
do $$ begin
  for i in 1..19 loop
    insert into messages (conversation_id, body) select id, 'رسالة ' || i from conversations limit 1;
  end loop;
end $$;
select tt.fails_with($$insert into messages (conversation_id, body) select id, 'زائدة' from conversations limit 1$$, 'rate_limit_message', '18a. message rate limit (20/min)');

-- ═══ 19. حذف الحساب ═══
:as_c
select tt.fails_with($$select delete_my_account()$$, 'last_admin', '19a. last admin cannot delete own account');
:as_anon
select tt.fails($$select delete_my_account()$$, '19b. anon cannot delete accounts');
:as_su
select tt.ok((select count(*) from businesses where owner_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') > 0, '19c. precondition: user A owns businesses');
:as_a
select delete_my_account();
:as_su
select tt.eq((select count(*) from auth.users where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 0, '19d. auth user removed');
select tt.eq((select count(*) from profiles where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 0, '19e. profile removed');
select tt.eq((select count(*) from businesses where owner_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 0, '19f. businesses removed with the account');
select tt.eq((select count(*) from conversations c where not exists (select 1 from businesses b where b.id = c.business_id)), 0, '19g. no orphan conversations');

:as_su
\echo ALL_SECURITY_TESTS_PASSED
