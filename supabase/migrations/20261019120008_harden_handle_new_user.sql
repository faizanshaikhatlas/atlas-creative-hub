-- 0008 — harden handle_new_user(): remove the Data-API RPC surface.
-- The function is SECURITY DEFINER and lives in the `public` schema, so by
-- default it was callable by anon/authenticated via /rest/v1/rpc/handle_new_user
-- (flagged by advisors 0028/0029). Revoke EXECUTE so it can ONLY run as the
-- signup trigger (triggers invoke it as the owner, independent of these grants).
-- Additive and non-destructive: no data, policy, or trigger behavior changes.

revoke execute on function public.handle_new_user() from public, anon, authenticated;
