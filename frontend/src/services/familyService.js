import api from '../api/api';

// Unwraps the { success, data } envelope used by newer controllers.
const unwrap = (response) => (response.data.success !== undefined ? response.data.data : response.data);

/**
 * Creates a new family
 * @param {Object} data - { family_name }
 */
export const createFamily = async (data) => {
  const response = await api.post('/families', data);
  return response.data.success !== undefined ? response.data.data : response.data;
};

/**
 * Gets all user families
 */
export const getFamilies = async () => {
  const response = await api.get('/families');
  return response.data.success !== undefined ? response.data.data : response.data;
};

/**
 * Creates a new person in a family
 * @param {Object} data 
 */
export const createPerson = async (data) => {
  const response = await api.post('/persons', data);
  return response.data;
};

/**
 * Creates a new relationship between persons
 * @param {Object} data 
 */
export const createRelationship = async (data) => {
  const response = await api.post('/relationships', data);
  return response.data;
};

/**
 * Note: The instruction mentions GET /family-tree/:family_id 
 * The current backend hasn't implemented this exact unified endpoint yet,
 * but assuming it handles aggregation of nodes/edges or we adapt it.
 */
export const getFamilyTree = async (familyId) => {
  const response = await api.get(`/family-tree/${familyId}`);
  return response.data;
};

// --- Update & Delete Commands ---

export const updateFamily = async (familyId, data) => {
  const response = await api.put(`/families/${familyId}`, data);
  return response.data;
};

export const deleteFamily = async (familyId) => {
  const response = await api.delete(`/families/${familyId}`);
  return response.data;
};

export const updatePerson = async (personId, data) => {
  const response = await api.put(`/persons/${personId}`, data);
  return response.data;
};

export const deletePerson = async (personId) => {
  const response = await api.delete(`/persons/${personId}`);
  return response.data;
};

export const updateRelationship = async (relationshipId, data) => {
  const response = await api.put(`/relationships/${relationshipId}`, data);
  return response.data;
};

export const deleteRelationship = async (relationshipId) => {
  const response = await api.delete(`/relationships/${relationshipId}`);
  return response.data;
};

// --- Collaborators ---

export const getCollaborators = async (familyId) => {
  const response = await api.get(`/families/${familyId}/collaborators`);
  return unwrap(response);
};

export const inviteCollaborator = async (familyId, { email, role }) => {
  const response = await api.post(`/families/${familyId}/collaborators`, { email, role });
  return unwrap(response);
};

export const updateCollaboratorRole = async (familyId, userId, role) => {
  const response = await api.put(`/families/${familyId}/collaborators/${userId}`, { role });
  return unwrap(response);
};

export const removeCollaborator = async (familyId, userId) => {
  const response = await api.delete(`/families/${familyId}/collaborators/${userId}`);
  return response.data;
};
