-- Trigger functions are invoked by table triggers, never through the public RPC API.
-- Keep the public RLS predicates and existing service/owner grants unchanged.
revoke execute on function
  public.project_property_location(),
  public.inquiry_daily_stat(),
  public.review_content_guard(),
  public.review_audit_trigger(),
  public.review_property_source_guard(),
  public.review_gallery_revocation(),
  public.review_private_location_delete()
from public, anon, authenticated;
