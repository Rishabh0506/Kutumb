import { computeLayout } from '../components/FamilyTree';

const H_SPACING = 300;
const V_SPACING = 220;

const node = (id) => ({ id });
const edge = (source, target, relationship_type) => ({ source, target, data: { relationship_type } });

describe('computeLayout', () => {
  test('an empty tree produces no positions', () => {
    expect(computeLayout([], [])).toEqual({ positions: {}, genMap: {} });
  });

  test('a single node is placed at generation 0', () => {
    const { positions, genMap } = computeLayout([node('a')], []);
    expect(genMap.a).toBe(0);
    expect(positions.a.y).toBe(0);
  });

  test('a parent/child edge places the child one generation below the parent', () => {
    const nodes = [node('parent'), node('child')];
    const edges = [edge('parent', 'child', 'parent')];
    const { positions, genMap } = computeLayout(nodes, edges);

    expect(genMap.parent).toBe(0);
    expect(genMap.child).toBe(1);
    expect(positions.child.y - positions.parent.y).toBe(V_SPACING);
  });

  test('a "child" edge type is equivalent to a "parent" edge (both mean source is the parent)', () => {
    // treeBuilder.js on the backend already normalizes 'child' edges so that
    // source=parent, target=child — the layout algorithm relies on that.
    const nodes = [node('parent'), node('child')];
    const viaParentType = computeLayout(nodes, [edge('parent', 'child', 'parent')]);
    const viaChildType = computeLayout(nodes, [edge('parent', 'child', 'child')]);

    expect(viaChildType.genMap).toEqual(viaParentType.genMap);
  });

  test('spouses in the same generation are placed exactly one horizontal slot apart', () => {
    const nodes = [node('a'), node('b')];
    const edges = [edge('a', 'b', 'spouse')];
    const { positions, genMap } = computeLayout(nodes, edges);

    expect(genMap.a).toBe(genMap.b);
    expect(Math.abs(positions.a.x - positions.b.x)).toBe(H_SPACING);
  });

  test('siblings in the same generation never overlap', () => {
    const nodes = [node('parent'), node('sib1'), node('sib2'), node('sib3')];
    const edges = [
      edge('parent', 'sib1', 'parent'),
      edge('parent', 'sib2', 'parent'),
      edge('parent', 'sib3', 'parent'),
      edge('sib1', 'sib2', 'sibling'),
      edge('sib2', 'sib3', 'sibling'),
    ];
    const { positions, genMap } = computeLayout(nodes, edges);

    expect(genMap.sib1).toBe(1);
    expect(genMap.sib2).toBe(1);
    expect(genMap.sib3).toBe(1);

    const xs = [positions.sib1.x, positions.sib2.x, positions.sib3.x].sort((a, b) => a - b);
    expect(xs[1] - xs[0]).toBeGreaterThanOrEqual(H_SPACING - 1);
    expect(xs[2] - xs[1]).toBeGreaterThanOrEqual(H_SPACING - 1);
  });

  test('a three-generation chain is assigned strictly increasing generations', () => {
    const nodes = [node('grandparent'), node('parent'), node('child')];
    const edges = [
      edge('grandparent', 'parent', 'parent'),
      edge('parent', 'child', 'parent'),
    ];
    const { genMap } = computeLayout(nodes, edges);

    expect(genMap.grandparent).toBe(0);
    expect(genMap.parent).toBe(1);
    expect(genMap.child).toBe(2);
  });

  test('edges referencing an id not present in nodes are ignored rather than throwing', () => {
    const nodes = [node('a')];
    const edges = [edge('a', 'ghost', 'parent')];
    expect(() => computeLayout(nodes, edges)).not.toThrow();
    const { genMap } = computeLayout(nodes, edges);
    expect(genMap).toEqual({ a: 0 });
  });
});
