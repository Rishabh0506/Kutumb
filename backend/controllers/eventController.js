const personService = require('../services/personService');
const memoryService = require('../services/memoryService');

/**
 * Get unified timeline events for a family
 * @route GET /api/events?family_id=
 */
const getFamilyEvents = async (req, res, next) => {
  try {
    const { family_id } = req.query;
    if (!family_id) {
      return res.status(400).json({ error: true, message: 'family_id query parameter is required' });
    }

    const persons = await personService.getPersonsByFamily(family_id, req.user.id);
    
    // For a real production app we would query all memories for the family.
    // Currently memoryService.getMemoriesByPerson is defined, but we need all memories.
    // We will simulate the timeline by extracting strictly from person definitions
    const events = [];

    for (const person of persons) {
      if (person.birth_date) {
        events.push({
          id: `birth-${person.id}`,
          type: 'birth',
          title: `Birth of ${person.first_name} ${person.last_name || ''}`,
          date: person.birth_date,
          person_id: person.id,
          description: `Born in ${person.birth_place || 'an unknown location'}`,
        });
      }
      if (person.death_date) {
        events.push({
          id: `death-${person.id}`,
          type: 'death',
          title: `Death of ${person.first_name} ${person.last_name || ''}`,
          date: person.death_date,
          person_id: person.id,
          description: `Passed away.`,
        });
      }
      
      // Pull memories for each person to append to the family timeline
      try {
        const memories = await memoryService.getMemoriesByPerson(person.id);
        if (memories && memories.length > 0) {
          memories.forEach(mem => {
            if (mem.event_date) {
              events.push({
                id: `memory-${mem.id}`,
                type: 'memory',
                title: mem.title,
                date: mem.event_date,
                person_id: person.id,
                description: mem.description,
              });
            }
          });
        }
      } catch(err) {
         // handle silently to keep processing
      }
    }

    // Sort chronologically ascending
    events.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.status(200).json(events);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getFamilyEvents
};
