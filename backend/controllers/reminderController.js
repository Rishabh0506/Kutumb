const pool = require('../config/db');
const { getFamilyRole } = require('../models/collaboratorModel');

/**
 * Fetch upcoming events (birthdays, death anniversaries, memories) for a specific family.
 * @route GET /api/reminders/:family_id
 */
const getUpcomingReminders = async (req, res) => {
  try {
    const { family_id } = req.params;

    const my_role = await getFamilyRole(family_id, req.user.id);
    if (!my_role) {
      return res.status(404).json({ message: 'Family not found' });
    }

    // We query Postgres to find events where the month and day fall within the next 30 days
    // A simpler approximation: sort by relative day of year. 
    // For exact SQLite/Postgres cross-compatibility or pure Postgres:
    const upcomingQuery = `
      SELECT id, first_name, last_name, birth_date, 'Birthday' as event_type
      FROM persons 
      WHERE family_id = $1 AND birth_date IS NOT NULL
      
      UNION ALL
      
      SELECT id, first_name, last_name, death_date, 'Death Anniversary' as event_type
      FROM persons 
      WHERE family_id = $1 AND death_date IS NOT NULL
      
      UNION ALL
      
      SELECT m.id, p.first_name, p.last_name, m.event_date, m.title as event_type
      FROM memories m
      LEFT JOIN persons p ON m.person_id = p.id
      WHERE m.family_id = $1 AND m.event_date IS NOT NULL
    `;
    
    // We execute the payload
    const result = await pool.query(upcomingQuery, [family_id]);

    // Format dates and filter for upcoming within next 30 days in JS for simplicity
    const today = new Date();
    today.setHours(0,0,0,0);
    const in30Days = new Date();
    in30Days.setDate(today.getDate() + 30);

    const upcomingEvents = result.rows.map(row => {
      const eventDate = new Date(row.birth_date);
      // Construct this year's occurrence
      const thisYearEvent = new Date(today.getFullYear(), eventDate.getMonth(), eventDate.getDate());
      
      // If it already passed this year, look at next year
      if (thisYearEvent < today) {
        thisYearEvent.setFullYear(today.getFullYear() + 1);
      }
      
      return {
        ...row,
        original_date: row.birth_date,
        next_occurrence: thisYearEvent,
        days_away: Math.ceil((thisYearEvent - today) / (1000 * 60 * 60 * 24))
      };
    }).filter(event => event.days_away <= 45).sort((a,b) => a.days_away - b.days_away);

    res.status(200).json({ success: true, data: upcomingEvents });
  } catch (error) {
    console.error('Error fetching reminders:', error);
    res.status(500).json({ message: 'Server error parsing reminders' });
  }
};

module.exports = {
  getUpcomingReminders
};
