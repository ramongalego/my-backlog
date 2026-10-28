-- handle_new_user only runs as the trigger that creates a profile on sign-up.
-- Postgres functions are executable by everyone by default, so the API
-- exposed it at /rest/v1/rpc/handle_new_user (calling it there fails, since
-- it only works as a trigger, but there's no reason it should be callable).
-- A trigger doesn't need its caller to have EXECUTE, so sign-up still works.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
