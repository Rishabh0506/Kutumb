const pool = require('./config/db');

(async () => {
  try {
    const res = await pool.query("SELECT id FROM users WHERE email = 'demo@demo.com'");
    if (res.rowCount === 0) {
      await pool.query(`
        INSERT INTO users (id, name, email, password_hash) 
        VALUES ('00000000-0000-0000-0000-000000000000', 'Demo User', 'demo@demo.com', 'demo_hash')
      `);
      console.log('Demo user seeded successfully.');
    } else {
      console.log('Demo user already exists.');
    }
  } catch (error) {
    console.error('Error seeding demo user:', error);
  } finally {
    process.exit(0);
  }
})();
