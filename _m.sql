-- Migration: roaming Gyanus (wild spawns + player drops)
-- ---------------------------------------------------------------- roaming Gyanus: wild spawns + player drops
alter table gh_config add column if not exists roam_on boolean not null default true;
alter table gh_config add column if not exists roam_tick timestamptz not null default 'epoch';
alter table gh_zones add column if not exists code text;                       -- optional printed zone code: when set, catching needs it (proves you are there)
alter table gh_players add column if not exists roam_catches int not null default 0;
alter table gh_players add column if not exists last_catch_at timestamptz;

create table if not exists gh_roamers (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('wild','golden','player')),
  zone text not null references gh_zones(id),
  hint text not null default '',
  by_player uuid references gh_players(id) on delete cascade,
  slots int not null default 4,
  born_at timestamptz not null default now(),
  ends_at timestamptz not null,
  hop_at timestamptz, hops int not null default 0,
  active boolean not null default true
);
create index if not exists gh_roamers_live on gh_roamers (active, ends_at);
create table if not exists gh_roam_catches (
  roam_id uuid not null references gh_roamers(id) on delete cascade,
  player_id uuid not null references gh_players(id) on delete cascade,
  ord int not null, points int not null, at timestamptz not null default now(),
  primary key (roam_id, player_id)
);
alter table gh_roamers enable row level security;
alter table gh_roam_catches enable row level security;


create or replace function gh_roam_tick() returns void language plpgsql security definer set search_path = public, extensions as $$
declare cfg gh_config; want int; live int; z text; k text; r gh_roamers; online int;
begin
  update gh_config set roam_tick = now() where id = 1 and roam_tick < now() - interval '4 seconds';
  if not found then return; end if;
  select * into cfg from gh_config where id = 1;
  update gh_roamers set active = false where active and ends_at < now();
  for r in select * from gh_roamers where active and kind in ('wild','golden') and hop_at is not null and hop_at < now() loop
    select id into z from gh_zones where crowd <> 'closed' and id <> r.zone order by random() limit 1;
    update gh_roamers set zone = coalesce(z, zone), hops = hops + 1, hop_at = now() + make_interval(secs => 70 + floor(random() * 50)) where id = r.id;
  end loop;
  if cfg.paused or cfg.ended or not cfg.roam_on then return; end if;
  select count(*) into online from gh_players where last_seen > now() - interval '5 minutes';
  want := least(4, greatest(2, ceil(online / 12.0)::int));
  select count(*) into live from gh_roamers where active and kind in ('wild','golden');
  if live < want and not exists (select 1 from gh_roamers where kind in ('wild','golden') and born_at > now() - interval '25 seconds') then
    select id into z from gh_zones zz where zz.crowd <> 'closed' and not exists (select 1 from gh_roamers x where x.active and x.kind in ('wild','golden') and x.zone = zz.id) order by random() limit 1;
    if z is null then select id into z from gh_zones where crowd <> 'closed' order by random() limit 1; end if;
    if z is null then return; end if;
    k := case when random() < 0.12 then 'golden' else 'wild' end;
    insert into gh_roamers (kind, zone, slots, ends_at, hop_at)
    values (k, z, case when k = 'golden' then 2 else 4 end, now() + make_interval(secs => case when k = 'golden' then 150 else 240 end), now() + make_interval(secs => 70 + floor(random() * 50)));
  end if;
end $$;

create or replace function gh_roam_catch(p_token text, p_roam uuid, p_code text default '') returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me gh_players := gh_me(p_token); cfg gh_config; r gh_roamers; zc text; ord int; pts int; per int[];
begin
  if me.id is null then raise exception 'Join first'; end if;
  select * into cfg from gh_config where id = 1;
  if me.banned then return jsonb_build_object('ok', false, 'reason', 'Your account is paused.'); end if;
  if cfg.paused or cfg.ended then return jsonb_build_object('ok', false, 'reason', 'The hunt is paused right now.'); end if;
  if me.last_catch_at > now() - interval '4 seconds' then return jsonb_build_object('ok', false, 'reason', 'Easy! One catch at a time.'); end if;
  if (select count(*) from gh_roam_catches where player_id = me.id and at > now() - interval '1 hour') >= 40 then return jsonb_build_object('ok', false, 'reason', 'That is a lot of Gyanus for one hour. Take a chai break.'); end if;
  select * into r from gh_roamers where id = p_roam and active for update;
  if r.id is null or r.ends_at < now() then return jsonb_build_object('ok', false, 'gone', true, 'reason', 'He dipped! Check the map for the next one.'); end if;
  if r.by_player = me.id then return jsonb_build_object('ok', false, 'reason', 'You hid this one. Let others find it.'); end if;
  if exists (select 1 from gh_roam_catches where roam_id = r.id and player_id = me.id) then return jsonb_build_object('ok', false, 'reason', 'You already got this one.'); end if;
  select code into zc from gh_zones where id = r.zone;
  if zc is not null and upper(btrim(coalesce(p_code,''))) <> upper(zc) then return jsonb_build_object('ok', false, 'needCode', true, 'reason', 'Wrong zone code. Look for the Gyanu poster in that zone.'); end if;
  select count(*) into ord from gh_roam_catches where roam_id = r.id;
  if ord >= r.slots then update gh_roamers set active = false where id = r.id; return jsonb_build_object('ok', false, 'gone', true, 'reason', 'Too slow, he is all caught out!'); end if;
  per := case r.kind when 'golden' then array[150, 60] when 'wild' then array[40, 25, 15, 10] else array[30, 20, 15, 10] end;
  pts := per[ord + 1];
  insert into gh_roam_catches (roam_id, player_id, ord, points) values (r.id, me.id, ord + 1, pts);
  update gh_players set score = score + pts, roam_catches = roam_catches + 1, last_catch_at = now() where id = me.id;
  if ord + 1 >= r.slots then update gh_roamers set active = false where id = r.id; end if;
  if r.kind = 'player' and r.by_player is not null then
    update gh_players set score = score + 10 + case when ord + 1 >= r.slots then 20 else 0 end,
      notices = notices || jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'kind', 'dropcaught', 'nick', me.nick, 'points', 10 + case when ord + 1 >= r.slots then 20 else 0 end, 'full', ord + 1 >= r.slots))
    where id = r.by_player;
  end if;
  return jsonb_build_object('ok', true, 'points', pts, 'order', ord + 1, 'slots', r.slots, 'kind', r.kind, 'zone', r.zone);
end $$;

create or replace function gh_roam_drop(p_token text, p_zone text, p_hint text default '') returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me gh_players := gh_me(p_token); cfg gh_config; h text := left(btrim(regexp_replace(coalesce(p_hint,''), '[<>]', '', 'g')), 40);
begin
  if me.id is null then raise exception 'Join first'; end if;
  select * into cfg from gh_config where id = 1;
  if me.banned then return jsonb_build_object('ok', false, 'reason', 'Your account is paused.'); end if;
  if cfg.paused or cfg.ended then return jsonb_build_object('ok', false, 'reason', 'The hunt is paused right now.'); end if;
  if not exists (select 1 from gh_zones where id = p_zone and crowd <> 'closed') then return jsonb_build_object('ok', false, 'reason', 'Pick an open zone.'); end if;
  if exists (select 1 from gh_roamers where by_player = me.id and active and ends_at > now()) then return jsonb_build_object('ok', false, 'reason', 'Your Gyanu is still out there. Wait for it to be found or fade.'); end if;
  if (select count(*) from gh_roamers where by_player = me.id and born_at > now() - interval '1 hour') >= 3 then return jsonb_build_object('ok', false, 'reason', 'Three drops an hour. Come back later, legend.'); end if;
  if gh_rude(h) then return jsonb_build_object('ok', false, 'reason', 'Keep the hint roast-y, not abusive.'); end if;
  if gh_pii(h) then return jsonb_build_object('ok', false, 'reason', 'No links, emails or phone numbers in a hint.'); end if;
  insert into gh_roamers (kind, zone, hint, by_player, slots, ends_at) values ('player', p_zone, h, me.id, 4, now() + interval '5 minutes');
  return jsonb_build_object('ok', true);
end $$;

create or replace function gh_admin2(p_key text, p_action text, p_args jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare cfg gh_config; a jsonb := coalesce(p_args, '{}');
begin
  select * into cfg from gh_config where id = 1;
  if cfg.admin_key_hash is null or gh_sha(p_key) <> cfg.admin_key_hash then perform pg_sleep(0.6); raise exception 'Not authorised'; end if;
  case p_action
  when 'roamState' then
    return jsonb_build_object('on', cfg.roam_on,
      'zones', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'code', code) order by id), '[]') from gh_zones),
      'roamers', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'kind', r.kind, 'zone', r.zone, 'hint', r.hint, 'left', r.slots - (select count(*) from gh_roam_catches c where c.roam_id = r.id), 'endsAt', gh_ms(r.ends_at),
          'by', (select nick from gh_players where id = r.by_player)) order by r.born_at desc), '[]') from gh_roamers r where r.active and r.ends_at > now()));
  when 'roamOn' then update gh_config set roam_on = coalesce((a->>'on')::boolean, true) where id = 1;
  when 'roamRemove' then update gh_roamers set active = false where id = (a->>'id')::uuid;
  when 'roamClear' then update gh_roamers set active = false where active;
  when 'zoneCode' then update gh_zones set code = nullif(upper(left(btrim(coalesce(a->>'code','')), 8)), '') where id = a->>'id';
  else raise exception 'Unknown action %', p_action;
  end case;
  return 'true'::jsonb;
end $$;

create or replace function gh_state(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me gh_players := gh_me(p_token); cfg gh_config; hunts jsonb; rank int; cnt int;
begin
  perform gh_roam_tick();
  select * into cfg from gh_config where id = 1;
  if me.id is not null and (me.last_seen is null or me.last_seen < now() - interval '20 seconds') then update gh_players set last_seen = now() where id = me.id; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', g.id, 'zone', g.zone, 'hint', g.hint, 'type', g.type, 'activatedAt', gh_ms(g.activated_at), 'finds', g.finds, 'points', g.points, 'verify', g.verify,
      'refs', (select coalesce(jsonb_agg(jsonb_build_object('hash', r->'hash', 'sig', r->'sig')), '[]') from jsonb_array_elements(g.refs) r),
      'found', exists(select 1 from gh_submissions s where s.player_id = me.id and s.gyanu_id = g.id and s.status = 'approved'),
      'pending', exists(select 1 from gh_submissions s where s.player_id = me.id and s.gyanu_id = g.id and s.status = 'pending'),
      'tries', (select count(*) from gh_submissions s where s.player_id = me.id and s.gyanu_id = g.id and s.status in ('rejected','duplicate'))
    )), '[]') into hunts
  from gh_gyanus g join gh_zones z on z.id = g.zone where g.active and z.crowd <> 'closed';
  if me.id is not null then
    select count(*) + 1 into rank from gh_players where not banned and (score > me.score or (score = me.score and created_at < me.created_at));
    select count(*) into cnt from gh_players where not banned and score > 0;
  end if;
  return jsonb_build_object(
    'serverNow', gh_ms(now()),
    'settings', jsonb_build_object('paused', cfg.paused, 'pauseReason', cfg.pause_reason, 'ended', cfg.ended, 'finalLive', cfg.final_live, 'winner', cfg.winner),
    'hype', gh_hype_view(me.id), 'stats', gh_stats(),
    'zones', (select jsonb_object_agg(id, jsonb_build_object('crowd', crowd)) from gh_zones),
    'hunts', hunts,
    'roamers', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'kind', r.kind, 'zone', r.zone, 'hint', r.hint, 'slots', r.slots, 'left', r.slots - c.n, 'endsAt', gh_ms(r.ends_at), 'hops', r.hops,
        'by', (select nick from gh_players where id = r.by_player), 'mine', r.by_player = me.id,
        'got', exists(select 1 from gh_roam_catches x where x.roam_id = r.id and x.player_id = me.id), 'needCode', z.code is not null) order by r.born_at), '[]')
      from gh_roamers r join gh_zones z on z.id = r.zone cross join lateral (select count(*) n from gh_roam_catches where roam_id = r.id) c
      where r.active and r.ends_at > now() and c.n < r.slots),
    'me', case when me.id is null then null else jsonb_build_object('id', me.id, 'nick', me.nick, 'slogan', me.slogan, 'score', me.score, 'finds', me.finds,
      'streak', me.streak, 'bestStreak', me.best_streak, 'banned', me.banned, 'rank', rank, 'players', cnt, 'lastSubmitAt', coalesce(gh_ms(me.last_submit_at),0),
      'notices', me.notices, 'homeBest', me.home_best, 'punchBest', me.punch_best, 'roach', me.roach, 'callsLeft', greatest(0, 5 + me.call_bonus - me.calls), 'pendingCalls', (select count(*) from gh_call_requests q where q.player_id = me.id and q.status = 'new'),
      'callCost', greatest(60, ceil(me.score * 0.55))::int, 'helps', me.helps, 'earnedCalls', me.earned_calls, 'boughtCalls', me.bought_calls,
      'roamCatches', me.roam_catches, 'dropsLeft', greatest(0, 3 - (select count(*) from gh_roamers where by_player = me.id and born_at > now() - interval '1 hour'))) end);
end $$;

revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
grant execute on function gh_register(text, text), gh_set_slogan(text, text), gh_set_roach(text, int), gh_call_crowd(text, text, text), gh_request_calls(text, text), gh_buy_call(text), gh_roam_catch(text, uuid, text), gh_roam_drop(text, text, text), gh_admin2(text, text, jsonb), gh_state(text), gh_ack(text, text[]),
  gh_submit(text, uuid, text, text, text, real, text, text), gh_hype(text, real), gh_home_score(text, int), gh_punch_score(text, int),
  gh_scene(text), gh_report(text, text, text, text), gh_vote(text, uuid, text), gh_leaderboard(text, text),
  gh_history(text), gh_delete_me(text), gh_admin(text, text, jsonb), gh_feedback(text, text, text, int, jsonb, text, text), gh_crowd() to anon, authenticated;

