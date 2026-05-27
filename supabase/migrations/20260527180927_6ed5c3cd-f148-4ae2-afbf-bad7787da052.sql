REVOKE EXECUTE ON FUNCTION public.credit_topup_atomic(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_topup_atomic(uuid, jsonb) TO service_role;