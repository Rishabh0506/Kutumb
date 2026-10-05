const parse = require('gedcom').parse;

/**
 * Parses a GEDCOM string and extracts structured persons and relationships.
 * @param {string} gedcomString - The raw GEDCOM file content
 * @returns {Object} { persons, relationships }
 */
const parseGedcom = async (gedcomString) => {
  const parsed = parse(gedcomString);
  const persons = [];
  const relationships = [];

  // Iterate over top-level nodes
  for (const node of parsed) {
    if (node.tag === 'INDI') {
      const personId = node.pointer; // e.g. @I1@
      let first_name = '';
      let last_name = '';
      let gender = '';
      let birth_date = '';
      let birth_place = '';

      for (const child of node.tree) {
        if (child.tag === 'NAME') {
          // Gedcom names are typically "First Middle /Last/"
          const nameParts = child.data.split('/');
          first_name = nameParts[0]?.trim() || '';
          last_name = nameParts[1]?.trim() || '';
        } else if (child.tag === 'SEX') {
          gender = child.data === 'M' ? 'Male' : child.data === 'F' ? 'Female' : 'Unknown';
        } else if (child.tag === 'BIRT') {
          for (const birtChild of child.tree) {
            if (birtChild.tag === 'DATE') {
              birth_date = birtChild.data;
            } else if (birtChild.tag === 'PLAC') {
              birth_place = birtChild.data;
            }
          }
        }
      }

      persons.push({
        id: personId,
        first_name,
        last_name,
        gender,
        birth_date,
        birth_place
      });

    } else if (node.tag === 'FAM') {
      let husb = null;
      let wife = null;
      const children = [];

      for (const child of node.tree) {
        if (child.tag === 'HUSB') {
          husb = child.data;
        } else if (child.tag === 'WIFE') {
          wife = child.data;
        } else if (child.tag === 'CHIL') {
          children.push(child.data);
        }
      }

      // Add spouse relationship
      if (husb && wife) {
        relationships.push({
          type: 'spouse',
          person1: husb,
          person2: wife
        });
      }

      // Add parent-child relationships
      for (const chil of children) {
        if (husb) {
          relationships.push({
            type: 'parent',
            person1: husb,
            person2: chil
          });
        }
        if (wife) {
          relationships.push({
            type: 'parent',
            person1: wife,
            person2: chil
          });
        }
      }
    }
  }

  return { persons, relationships };
};

module.exports = {
  parseGedcom
};
