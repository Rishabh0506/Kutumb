const legacyModel = require('../models/legacyModel');

exports.createLegacyMessage = async (req, res) => {
  try {
    const { person_id } = req.params;
    const { title, message, emotion_tag } = req.body;

    const created = await legacyModel.createLegacyMessage(
      person_id,
      { title, message, emotion_tag },
      req.user.id
    );

    if (!created) {
      return res.status(404).json({ error: 'Person not found' });
    }

    res.status(201).json(created);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error creating legacy message' });
  }
};

exports.getLegacyMessages = async (req, res) => {
  try {
    const { person_id } = req.params;
    const messages = await legacyModel.getLegacyMessages(person_id, req.user.id);
    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error fetching legacy messages' });
  }
};
