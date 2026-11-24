drop policy if exists "HealthX authenticated realtime subscriptions" on realtime.messages;
drop policy if exists "HealthX public bed inventory subscriptions" on realtime.messages;
drop policy if exists "Swasth Saathi authenticated realtime subscriptions" on realtime.messages;
drop policy if exists "Swasth Saathi public bed inventory subscriptions" on realtime.messages;

create policy "Swasth Saathi public bed inventory subscriptions"
on realtime.messages
for select
to anon, authenticated
using (
  realtime.topic() = 'bed-inventory-live'
);

create policy "Swasth Saathi authenticated realtime subscriptions"
on realtime.messages
for select
to authenticated
using (
  realtime.topic() = 'patient-appointments-' || (select auth.uid()::text)
  or realtime.topic() = 'doctor-appointments-' || (select auth.uid()::text)
  or (
    (realtime.topic() like 'bed-requests-%'
      or realtime.topic() like 'bed-request-%'
      or realtime.topic() like 'appointment-%')
    and (select auth.uid()) is not null
  )
);
