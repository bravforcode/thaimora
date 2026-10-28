-- Forward migration: Enable broker and owner registration with default approved terms version
update private.broker_config
set terms_version = '2026-10-v1'
where singleton and terms_version is null;
