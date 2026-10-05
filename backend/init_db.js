const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const setup = async () => {
  // Connect to the default 'postgres' database first to create 'family_tree'
  const client = new Client({
    host: 'localhost',
    user: 'postgres',
    password: '2306',
    database: 'postgres',
    port: 5432,
  });

  try {
    await client.connect();
    
    // Check if family_tree exists
    const res = await client.query("SELECT 1 FROM pg_database WHERE datname = 'family_tree'");
    if (res.rowCount === 0) {
      console.log("Creating database family_tree...");
      await client.query('CREATE DATABASE family_tree');
    } else {
      console.log("Database family_tree already exists.");
    }
  } catch (e) {
    console.error("Error creating database:", e);
  } finally {
    await client.end();
  }

  // Now connect to 'family_tree' and execute schema.sql
  const targetClient = new Client({
    host: 'localhost',
    user: 'postgres',
    password: '2306',
    database: 'family_tree',
    port: 5432,
  });

  try {
    await targetClient.connect();
    console.log("Connected to family_tree database.");
    
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await targetClient.query(schemaSql);
    console.log("Schema applied successfully.");
  } catch (e) {
    console.error("Error applying schema:", e);
  } finally {
    await targetClient.end();
  }
};

setup();
