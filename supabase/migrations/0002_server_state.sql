-- Служебное хранилище сервера: состояние (задачи, вишлисты для слежки за ценой, цены, распродажи) и файлы
-- (кадры, фото, результаты). Доступ только у сервера (secret / service_role ключ): RLS включён, политик нет —
-- ключи приложения (anon, authenticated) сюда не достают.

create table public.server_state (
  key text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.server_state enable row level security;
revoke all on public.server_state from anon, authenticated;

-- закрытая папка файлов сервера; удаление через 48 часов делает сам сервер
insert into storage.buckets (id, name, public, file_size_limit)
values ('server-files', 'server-files', false, 52428800)
on conflict (id) do nothing;
