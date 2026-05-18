#!/usr/bin/env bash
# Backend tests for games.file_size_bytes CHECK constraint.
# Boundaries: NULL allowed, [1 MiB .. 1000 GiB] allowed, anything outside rejected.
set -u

PASS=0
FAIL=0
TEST_PREFIX="__sizecheck_$(date +%s%N)"

cleanup() {
  psql -q -c "DELETE FROM public.games WHERE id LIKE '${TEST_PREFIX}%'" >/dev/null 2>&1
}
trap cleanup EXIT

run_case() {
  local label="$1" size="$2" expect="$3" provider="${4:-supabase}" file_path="${5:-}"
  local id="${TEST_PREFIX}_$(echo "$label" | tr -c 'a-zA-Z0-9' '_')"
  local sql_size
  if [ "$size" = "NULL" ]; then sql_size="NULL"; else sql_size="$size"; fi
  local sql_path
  if [ -z "$file_path" ]; then sql_path="NULL"; else sql_path="'$(echo "$file_path" | sed "s/'/''/g")'"; fi

  local out
  out=$(psql -v ON_ERROR_STOP=1 -q -c \
    "INSERT INTO public.games (id, title, category, price_coins, visible, file_size_bytes, storage_provider, file_path)
     VALUES ('${id}', 't', 'c', 0, false, ${sql_size}, '${provider}', ${sql_path});" 2>&1)
  local rc=$?

  if [ "$expect" = "ok" ] && [ $rc -eq 0 ]; then
    echo "PASS  $label  (size=$size provider=$provider accepted)"; PASS=$((PASS+1))
  elif [ "$expect" = "reject" ] && [ $rc -ne 0 ] && echo "$out" | grep -q "games_file_size_bytes_range"; then
    echo "PASS  $label  (size=$size provider=$provider rejected by CHECK)"; PASS=$((PASS+1))
  else
    echo "FAIL  $label  (size=$size provider=$provider, rc=$rc, expect=$expect)"
    echo "      $out"
    FAIL=$((FAIL+1))
  fi
}

#                label                       size                       expect
run_case "null_allowed"                     "NULL"                      "ok"
run_case "below_1mib_zero"                  "0"                         "reject"
run_case "below_1mib_one_byte"              "1"                         "reject"
run_case "below_1mib_just_under"            "1048575"                   "reject"   # 1 MiB - 1
run_case "exactly_1mib"                     "1048576"                   "ok"       # 1 MiB
run_case "midrange_500mb"                   "524288000"                 "ok"
run_case "exactly_1000gib"                  "1073741824000"             "ok"       # 1000 GiB
run_case "above_1000gib_just_over"          "1073741824001"             "reject"
run_case "way_above_1000gib"                "9999999999999"             "reject"


# --- MiB/GiB semantics: prove binary thresholds, not decimal ---
run_case "mib_semantics_1MB_decimal"        "1000000"                   "reject"   # 1 MB (10^6) < 1 MiB → must reject
run_case "mib_semantics_999999"             "999999"                    "reject"
run_case "gib_semantics_1000GB_decimal"     "1000000000000"             "ok"       # 1000 GB (10^12) < 1000 GiB → accept
run_case "gib_semantics_1TiB"               "1099511627776"             "reject"   # 1 TiB > 1000 GiB → reject
run_case "gib_semantics_999GiB"             "1072693248000"             "ok"       # 999 GiB → accept
echo
echo "=============================="
echo "PASSED: $PASS    FAILED: $FAIL"
echo "=============================="
[ $FAIL -eq 0 ]
