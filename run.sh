#!/usr/bin/env bash
# تشغيل اختبارات الأمان على Postgres محلي (لا يلمس Supabase).
# الاستخدام: PGHOST=... PGPORT=... PGUSER=postgres ./run.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
psql_() { psql -q -v ON_ERROR_STOP=1 "$@"; }
psql_ -d postgres -c "drop database if exists midum_test" -c "create database midum_test"
for f in "$here/00_supabase_stub.sql" "$here/../migrations/20261015000000_init.sql" "$here/../migrations/20261015000100_account_deletion.sql" "$here/../seed.sql"; do
  psql_ -d midum_test -f "$f" 2>&1 | grep -v -e wal_level -e HINT || true
done
psql_ -d midum_test -o /dev/null -f "$here/01_security_tests.sql"
echo "ALL SECURITY TESTS PASSED"
