import "dotenv/config";
import { Client } from "pg";

const c = new Client({ connectionString: process.env.DIRECT_URL });
await c.connect();

const res = await c.query(`
  update sessions s set capacity = 2
  from offerings o
  where o.id = s.offering_id and o.name = 'Dr. Dish Self-Serve' and s.status = 'scheduled' and s.capacity = 1
`);
console.log(`Updated ${res.rowCount} sessions to capacity 2.`);

await c.end();
