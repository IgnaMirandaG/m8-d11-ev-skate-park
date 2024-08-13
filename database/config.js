import pg from 'pg'
const { Pool } = pg
 
const pool = new Pool({
  user: 'user_name',
  password: '****',
  host: 'localhost',
  port: 5432,
  database: 'db_skate_park',
});

export default pool;