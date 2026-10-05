const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Usage: node init_cloud_db.js "YOUR_EXTERNAL_DATABASE_URL"
const connectionString = process.argv[2];

if (!connectionString) {
  console.error('Error: Please provide your External Database URL as an argument.');
  console.error('Usage: node init_cloud_db.js "postgres://user:password@host:port/dbname"');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function initializeDatabase() {
  try {
    console.log('⏳ Connecting to cloud database...');
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('⏳ Executing schema.sql...');
    await pool.query(schemaSql);
    
    console.log('✅ Database initialized successfully!');
    console.log('🚀 You can now go to your Vercel site and Sign Up.');
  } catch (err) {
    console.error('❌ Error initializing database:', err.message);
  } finally {
    await pool.end();
  }
}

initializeDatabase();
