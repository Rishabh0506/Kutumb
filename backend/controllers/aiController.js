const personService = require('../services/personService');
const relationshipService = require('../services/relationshipService');

/**
 * Auto-generate a biography summary from a person's existing data
 * @route POST /api/ai/generate-biography
 */
const generateBiography = async (req, res, next) => {
  try {
    const { person_id, save } = req.body;
    if (!person_id) {
      return res.status(400).json({ error: true, message: 'person_id is required' });
    }

    // Fetch person details
    const person = await personService.getPersonById(person_id, req.user.id);
    if (!person) {
      return res.status(404).json({ error: true, message: 'Person not found' });
    }

    const relationships = await relationshipService.getRelationshipsByPerson(person_id, req.user.id);

    const relSummary = relationships.length > 0
      ? `had ${relationships.length} closely documented relationships`
      : 'had a quiet documented relationship history';

    const origin = person.birth_place ? ` in ${person.birth_place}` : '';
    const birthStr = person.birth_date ? `born on ${new Date(person.birth_date).getFullYear()}${origin}` : 'with an unknown birthdate';

    const generatedBio = `${person.first_name} ${person.last_name || ''} was ${birthStr}. Working as a ${person.occupation || 'dedicated family member'}, they ${relSummary}. Their legacy continues to live on within the documented nodes of this family tree.`;

    // This endpoint previews a generated biography — it only overwrites the
    // person's saved bio when the caller explicitly opts in via `save`.
    if (save) {
      await personService.updatePerson(person_id, { bio: generatedBio }, req.user.id);
    }

    res.status(200).json({ biography: generatedBio });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  generateBiography
};
