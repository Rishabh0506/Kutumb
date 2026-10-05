const fs = require('fs');
const { parseGedcom } = require('../utils/gedcomParser');
const { buildFamilyTreeData } = require('../utils/treeBuilder');
const pool = require('../config/db');
const { writableFamilyIdsSubquery } = require('../models/collaboratorModel');

// We use direct pool queries here to handle bulk inserts, checking duplicates, and mappings efficiently.

/**
 * Handle GEDCOM file import
 * @route POST /api/gedcom/import
 */
const importGedcom = async (req, res, next) => {
  const client = await pool.connect();
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: true, message: 'No GEDCOM file uploaded.' });
    }

    const family_id = req.body.family_id;
    if (!family_id) {
       return res.status(400).json({ error: true, message: 'Family ID is required to import members.' });
    }

    const canWriteFamily = await pool.query(
      `SELECT id FROM families WHERE id = $1 AND id IN ${writableFamilyIdsSubquery(2)}`,
      [family_id, req.user.id]
    );
    if (canWriteFamily.rows.length === 0) {
      return res.status(404).json({ error: true, message: 'Family not found.' });
    }

    const fileContent = fs.readFileSync(req.file.path, 'utf-8');
    const { persons, relationships } = await parseGedcom(fileContent);

    await client.query('BEGIN');

    // Map GEDCOM IDs (e.g. @I1@) to database UUIDs
    const gedcomToDbMap = {};

    // 1. Insert Persons, skipping duplicates based on name and birth_date
    for (const p of persons) {
      // Check duplicate
      const duplicateQuery = `
        SELECT id FROM persons 
        WHERE family_id = $1 AND first_name = $2 AND last_name = $3 
          ${p.birth_date ? 'AND birth_date = $4' : ""}
        LIMIT 1;
      `;
      let dupVals = [family_id, p.first_name, p.last_name];
      if (p.birth_date) dupVals.push(p.birth_date);
      
      const dupRes = await client.query(duplicateQuery, dupVals);
      
      if (dupRes.rows.length > 0) {
        gedcomToDbMap[p.id] = dupRes.rows[0].id;
        continue;
      }

      // Insert new
      const insertQuery = `
        INSERT INTO persons (family_id, first_name, last_name, gender, birth_date, birth_place)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id;
      `;
      const insertVals = [family_id, p.first_name, p.last_name, p.gender, p.birth_date || null, p.birth_place || null];
      const newPersonRes = await client.query(insertQuery, insertVals);
      
      gedcomToDbMap[p.id] = newPersonRes.rows[0].id;
    }

    // 2. Insert Relationships
    for (const rel of relationships) {
      const dbId1 = gedcomToDbMap[rel.person1];
      const dbId2 = gedcomToDbMap[rel.person2];

      if (dbId1 && dbId2) {
        // Simple duplicate guard check (very basic)
        const relDupCheck = `
            SELECT id FROM relationships 
            WHERE (person1_id = $1 AND person2_id = $2 AND relationship_type = $3)
            OR (person1_id = $2 AND person2_id = $1 AND relationship_type = $3)
            LIMIT 1;
        `;
        const relDupRes = await client.query(relDupCheck, [dbId1, dbId2, rel.type]);

        if (relDupRes.rows.length === 0) {
            const relInsert = `
              INSERT INTO relationships (person1_id, person2_id, relationship_type)
              VALUES ($1, $2, $3);
            `;
            await client.query(relInsert, [dbId1, dbId2, rel.type]);
        }
      }
    }

    await client.query('COMMIT');
    
    // Cleanup file
    fs.unlinkSync(req.file.path);

    // Return exact nodes and edges required by frontend
    const treeData = await buildFamilyTreeData(family_id);

    res.status(200).json(treeData);
  } catch (error) {
    await client.query('ROLLBACK');
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    console.error('GEDCOM Import Error:', error);
    next(error);
  } finally {
    client.release();
  }
};

module.exports = {
  importGedcom
};
