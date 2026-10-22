-- Runs crm-send every 5 minutes on weekdays. It drafts due sequence emails at any
-- time and only sends approved ones inside 8-11 AM Central (the function checks).
-- Before running: store the same CRON_SECRET you set on the function in the vault:
--   select vault.create_secret('<CRON_SECRET>', 'crm_cron_secret');
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('crm-send') where exists (select 1 from cron.job where jobname = 'crm-send');
select cron.schedule(
  'crm-send',
  '*/5 * * * 1-5',
  $$
  select net.http_post(
    url := 'https://fqlgfmuiedrdowxnvcjv.supabase.co/functions/v1/crm-send',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'crm_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
