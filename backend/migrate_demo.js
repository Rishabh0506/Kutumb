const pool = require('./config/db');
const bcrypt = require('bcryptjs');

async function migrate() {
    try {
        const demoId = '00000000-0000-0000-0000-000000000000';
        let res = await pool.query('SELECT * FROM users WHERE id = $1', [demoId]);
        const hash = await bcrypt.hash('password123', 10);
        
        if (res.rows.length === 0) {
            await pool.query(
                'INSERT INTO users (id, name, email, password_hash) VALUES ($1, $2, $3, $4)',
                [demoId, 'Demo User', 'demo@demo.com', hash]
            );
            console.log("Created demo@demo.com");
        } else {
            await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, demoId]);
            console.log("Updated demo@demo.com");
        }
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

migrate();
