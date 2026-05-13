REVOKE EXECUTE ON FUNCTION public.credit_topup_atomic(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purchase_game_atomic(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_topup_atomic(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.purchase_game_atomic(UUID, TEXT) TO service_role;