const personService = require('../services/personService');

/**
 * Add a new person
 * @route POST /api/persons
 */
const addPerson = async (req, res) => {
  try {
    const personData = req.body;
    const newPerson = await personService.addPerson(personData, req.user.id);

    if (!newPerson) {
      return res.status(404).json({ message: 'Family not found' });
    }

    res.status(201).json(newPerson);
  } catch (error) {
    console.error('Error adding person:', error);
    if (error.message.includes('required')) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Failed to add person' });
  }
};

/**
 * Get all persons in a family
 * @route GET /api/persons/family/:family_id
 */
const getPersonsByFamily = async (req, res) => {
  try {
    const { family_id } = req.params;
    const persons = await personService.getPersonsByFamily(family_id, req.user.id);
    res.status(200).json(persons);
  } catch (error) {
    console.error('Error getting persons by family:', error);
    res.status(500).json({ message: 'Failed to retrieve persons' });
  }
};

/**
 * Get a specific person by ID
 * @route GET /api/persons/:person_id
 */
const getPersonById = async (req, res) => {
  try {
    const { person_id } = req.params;
    const person = await personService.getPersonById(person_id, req.user.id);

    if (!person) {
      return res.status(404).json({ message: 'Person not found' });
    }

    res.status(200).json(person);
  } catch (error) {
    console.error('Error getting person by ID:', error);
    res.status(500).json({ message: 'Failed to retrieve person' });
  }
};

/**
 * Update a person's details
 * @route PUT /api/persons/:person_id
 */
const updatePerson = async (req, res) => {
  try {
    const { person_id } = req.params;
    const updatedData = req.body;

    const updatedPerson = await personService.updatePerson(person_id, updatedData, req.user.id);

    if (!updatedPerson) {
      return res.status(404).json({ message: 'Person not found or no valid fields to update' });
    }

    res.status(200).json(updatedPerson);
  } catch (error) {
    console.error('Error updating person:', error);
    res.status(500).json({ message: 'Failed to update person' });
  }
};

/**
 * Delete a person
 * @route DELETE /api/persons/:person_id
 */
const deletePerson = async (req, res) => {
  try {
    const { person_id } = req.params;
    const success = await personService.deletePerson(person_id, req.user.id);

    if (!success) {
      return res.status(404).json({ message: 'Person not found' });
    }

    res.status(200).json({ message: 'Person deleted successfully' });
  } catch (error) {
    console.error('Error deleting person:', error);
    res.status(500).json({ message: 'Failed to delete person' });
  }
};

/**
 * Search persons by name within the requesting user's families
 * @route GET /api/persons/search?q=...
 */
const searchPersons = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ message: 'Search query must be at least 2 characters' });
    }
    const results = await personService.searchPersons(q, req.user.id);
    res.status(200).json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ message: 'Search failed' });
  }
};

module.exports = {
  addPerson,
  getPersonsByFamily,
  getPersonById,
  updatePerson,
  deletePerson,
  searchPersons,
};
