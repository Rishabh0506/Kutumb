const cron = require('node-cron');
const pool = require('../config/db');

// Skip scheduling in tests — an active cron timer is an open handle that
// keeps the process (and Jest) alive indefinitely after tests complete.
if (process.env.NODE_ENV !== 'test') {
  // Schedule job to run every day at 8:00 AM server time
  cron.schedule('0 8 * * *', async () => {
    console.log('⏰ Running daily Family Day Reminders Cron Job...');

    try {
      // We get all events that are occurring TODAY across the entire platform
      const todayQuery = `
        SELECT p.id, p.first_name, p.last_name, p.birth_date AS event_date, 'Birthday' as event_type, f.family_name, u.email as admin_email
        FROM persons p
        JOIN families f ON p.family_id = f.id
        JOIN users u ON f.created_by = u.id
        WHERE EXTRACT(MONTH FROM p.birth_date) = EXTRACT(MONTH FROM CURRENT_DATE)
          AND EXTRACT(DAY FROM p.birth_date) = EXTRACT(DAY FROM CURRENT_DATE)

        UNION ALL

        SELECT p.id, p.first_name, p.last_name, p.death_date AS event_date, 'Death Anniversary' as event_type, f.family_name, u.email as admin_email
        FROM persons p
        JOIN families f ON p.family_id = f.id
        JOIN users u ON f.created_by = u.id
        WHERE EXTRACT(MONTH FROM p.death_date) = EXTRACT(MONTH FROM CURRENT_DATE)
          AND EXTRACT(DAY FROM p.death_date) = EXTRACT(DAY FROM CURRENT_DATE)

        UNION ALL

        SELECT p.id, p.first_name, p.last_name, m.event_date AS event_date, m.title as event_type, f.family_name, u.email as admin_email
        FROM memories m
        LEFT JOIN persons p ON m.person_id = p.id
        JOIN families f ON m.family_id = f.id
        JOIN users u ON f.created_by = u.id
        WHERE EXTRACT(MONTH FROM m.event_date) = EXTRACT(MONTH FROM CURRENT_DATE)
          AND EXTRACT(DAY FROM m.event_date) = EXTRACT(DAY FROM CURRENT_DATE)
      `;

      const result = await pool.query(todayQuery);

      if (result.rowCount === 0) {
        console.log('No family events today.');
        return;
      }

      // Process and send simulated emails
      result.rows.forEach(event => {
        // In a real production app, this would use nodemailer or SendGrid to blast an email
        console.log(`\n======================================================`);
        console.log(`📧 MOCK EMAIL DISPATCHED TO: ${event.admin_email}`);
        console.log(`SUBJECT: 📅 Family Reminder: ${event.first_name}'s ${event.event_type} is today!`);
        console.log(`BODY: Don't forget, today marks a special day for the ${event.family_name} family!`);
        console.log(`Celebrate ${event.first_name} ${event.last_name}'s ${event.event_type} today!`);
        console.log(`======================================================\n`);
      });

    } catch (error) {
      console.error('Error executing daily reminders cron job:', error);
    }
  });

  console.log('✅ Daily Reminders Cron Job actively scheduled.');
}
