
REVOKE EXECUTE ON FUNCTION public.credit_payment_atomic(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_payment_atomic(uuid) TO service_role;
