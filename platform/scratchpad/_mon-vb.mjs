import fs from "node:fs";
import pg from "pg";
const env = Object.fromEntries(fs.readFileSync(".env","utf8").split("\n").filter(l=>/^[A-Z_]+=/.test(l)).map(l=>{const i=l.indexOf("=");return [l.slice(0,i), l.slice(i+1).replace(/^"|"$/g,"")]}));
const c = new pg.Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const offs = (await c.query(`select id,name,status,start_date,end_date,program_id from offerings where name ilike '%volleyball%'`)).rows;
console.log(offs);
const r = await c.query(`select s.id, s.offering_id, o.name, s.start_time, s.end_time, s.capacity, s.resource_id, s.series_id,
  (select count(*) from bookings b where b.session_id=s.id and b.status<>'cancelled') booked,
  (select string_agg(st.first_name,',') from session_coaches sc join staff_users st on st.id=sc.staff_user_id where sc.session_id=s.id) coaches
  from sessions s join offerings o on o.id=s.offering_id
  where o.name ilike '%volleyball%' and s.status='scheduled' and s.start_time >= '2026-10-26' and extract(dow from s.start_time)=1
  order by s.start_time limit 14`);
for (const x of r.rows) console.log(x.start_time.toISOString(), x.name, "cap",x.capacity,"booked",x.booked,"coach",x.coaches,"res",x.resource_id,"series",x.series_id);
const n = await c.query(`select o.name, count(*), max(s.start_time) from sessions s join offerings o on o.id=s.offering_id where o.name ilike '%volleyball%' and s.status='scheduled' and s.start_time>='2026-11-02' and extract(dow from s.start_time)=1 group by 1`);
console.log(n.rows);
await c.end();
