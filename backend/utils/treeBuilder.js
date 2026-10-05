const pool = require('../config/db');

/**
 * Generates formatted nodes and edges for ReactFlow given a family_id.
 * @param {string} family_id 
 * @returns {Object} { nodes: [], edges: [] }
 */
const buildFamilyTreeData = async (family_id) => {
  const personsRes = await pool.query('SELECT * FROM persons WHERE family_id = $1', [family_id]);
  const persons = personsRes.rows;

  const relsRes = await pool.query(`
    SELECT r.* FROM relationships r
    JOIN persons p1 ON r.person1_id = p1.id
    WHERE p1.family_id = $1
  `, [family_id]);
  const relationships = relsRes.rows;

  const nodes = persons.map(p => ({
    id: p.id,
    position: { x: 0, y: 0 }, // Dagre layout overrides this on frontend
    data: { 
      label: `${p.first_name} ${p.last_name || ''}`.trim(), 
      person: p 
    }
  }));

  const edges = relationships.map(r => {
    let source = r.person1_id;
    let target = r.person2_id;
    let label = r.relationship_type;

    // Enforce strictly Top-Down DAG hierarchy for generational layouts
    if (r.relationship_type.toLowerCase() === 'child') {
      source = r.person2_id; // Parent
      target = r.person1_id; // Child
      label = 'Parent'; // Rename topological label to match visual flow
    } else if (r.relationship_type.toLowerCase() === 'parent') {
      label = 'Parent';
    }

    return {
      id: r.id,
      source,
      target,
      label,
      data: { relationship_type: r.relationship_type }
    };
  });

  return { nodes, edges };
};

module.exports = {
  buildFamilyTreeData
};
