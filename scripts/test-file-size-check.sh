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
  local label="$1" size="$2" expect="$3"   # expect: ok | reject
  local id="${TEST_PREFIX}_$(echo "$label" | tr -c 'a-zA-Z0-9' '_')"
  local sql_size
  if [ "$size" = "NULL" ]; then sql_size="NULL"; else sql_size="$size"; fi

  local out
  out=$(psql -v ON_ERROR_STOP=1 -q -c \
    "INSERT INTO public.games (id, title, category, price_coins, visible, file_size_bytes)
     VALUES ('${id}', 't', 'c', 0, false, ${sql_size});" 2>&1)
  local rc=$?

  if [ "$expect" = "ok" ] && [ $rc -eq 0 ]; then
    echo "PASS  $label  (size=$size accepted)"; PASS=$((PASS+1))
  elif [ "$expect" = "reject" ] && [ $rc -ne 0 ] && echo "$out" | grep -q "games_file_size_bytes_range"; then
    echo "PASS  $label  (size=$size rejected by CHECK)"; PASS=$((PASS+1))
  else
    echo "FAIL  $label  (size=$size, rc=$rc, expect=$expect)"
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

echo
echo "=============================="
echo "PASSED: $PASS    FAILED: $FAIL"
echo "=============================="
[ $FAIL -eq 0 ]
