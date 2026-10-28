-- Pin search_path on the owner approval helper (Supabase advisor: function_search_path_mutable).
-- Follow-up to 202610270001, which is already applied to hosted, so it is not edited in place.
begin;
alter function private.broker_approval_satisfied(private.broker_config,private.broker_profiles) set search_path=pg_catalog,private;
commit;
