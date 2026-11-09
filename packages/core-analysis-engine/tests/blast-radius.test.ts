import { describe, expect, it } from 'vitest';
import { DependencyGraph } from '../src/domain/analysis/graph/dependency-graph.js';
import { calculateBlastRadius } from '../src/domain/analysis/blast-radius/traversal.js';

describe('Blast-Radius Calculation and Graph Traversal', () => {
  it('correctly constructs graph and traverses downstream dependents from prompt example', () => {
    const graph = new DependencyGraph();

    // Add nodes
    graph.addOrUpdateNode('auth.js', { language: 'javascript' });
    graph.addOrUpdateNode('users.js', { language: 'javascript' });
    graph.addOrUpdateNode('orders.js', { language: 'javascript' });
    graph.addOrUpdateNode('profile.js', { language: 'javascript' });
    graph.addOrUpdateNode('checkout.js', { language: 'javascript' });
    graph.addOrUpdateNode('unrelated.js', { language: 'javascript' });

    // Edge direction: importer -> imported (importer depends on imported)
    // users.js imports auth.js
    graph.addDependencyEdge('users.js', 'auth.js', './auth.js');
    // orders.js imports auth.js
    graph.addDependencyEdge('orders.js', 'auth.js', './auth.js');
    // profile.js imports users.js
    graph.addDependencyEdge('profile.js', 'users.js', './users.js');
    // checkout.js imports orders.js
    graph.addDependencyEdge('checkout.js', 'orders.js', './orders.js');

    // Run blast-radius traversal when auth.js changes
    const traversal = calculateBlastRadius(graph, ['auth.js']);

    // Changed files
    expect(traversal.changedFiles).toEqual(['auth.js']);

    // Direct affected (depth 1)
    expect(traversal.directAffected).toContain('users.js');
    expect(traversal.directAffected).toContain('orders.js');
    expect(traversal.impactDepth.get('users.js')).toBe(1);
    expect(traversal.impactDepth.get('orders.js')).toBe(1);

    // Indirect affected (depth 2)
    expect(traversal.indirectAffected).toContain('profile.js');
    expect(traversal.indirectAffected).toContain('checkout.js');
    expect(traversal.impactDepth.get('profile.js')).toBe(2);
    expect(traversal.impactDepth.get('checkout.js')).toBe(2);

    // Changed file must NOT be in affected set
    expect(traversal.directAffected).not.toContain('auth.js');
    expect(traversal.indirectAffected).not.toContain('auth.js');

    // Unrelated file remains unaffected
    expect(traversal.unaffected).toContain('unrelated.js');
    expect(traversal.directAffected).not.toContain('unrelated.js');
    expect(traversal.indirectAffected).not.toContain('unrelated.js');

    // Max impact depth
    expect(traversal.maxImpactDepth).toBe(2);
  });

  it('safely terminates on cyclic dependencies without infinite recursion', () => {
    const graph = new DependencyGraph();

    // Cyclic dependency: A imports B, B imports C, C imports A
    graph.addOrUpdateNode('a.ts', { language: 'typescript' });
    graph.addOrUpdateNode('b.ts', { language: 'typescript' });
    graph.addOrUpdateNode('c.ts', { language: 'typescript' });

    graph.addDependencyEdge('a.ts', 'b.ts', './b');
    graph.addDependencyEdge('b.ts', 'c.ts', './c');
    graph.addDependencyEdge('c.ts', 'a.ts', './a');

    // Traversal from changed file 'c.ts'
    const traversal = calculateBlastRadius(graph, ['c.ts']);

    expect(traversal.changedFiles).toEqual(['c.ts']);
    // Who imports c.ts? b.ts imports c.ts (direct)
    expect(traversal.directAffected).toContain('b.ts');
    // Who imports b.ts? a.ts imports b.ts (indirect)
    expect(traversal.indirectAffected).toContain('a.ts');
    // c.ts is changed, so it cannot be affected
    expect(traversal.directAffected).not.toContain('c.ts');
    expect(traversal.indirectAffected).not.toContain('c.ts');
  });

  it('handles multiple changed files simultaneously', () => {
    const graph = new DependencyGraph();

    graph.addOrUpdateNode('core.js', { language: 'javascript' });
    graph.addOrUpdateNode('db.js', { language: 'javascript' });
    graph.addOrUpdateNode('serviceA.js', { language: 'javascript' });
    graph.addOrUpdateNode('serviceB.js', { language: 'javascript' });

    graph.addDependencyEdge('serviceA.js', 'core.js', './core');
    graph.addDependencyEdge('serviceB.js', 'db.js', './db');

    const traversal = calculateBlastRadius(graph, ['core.js', 'db.js']);

    expect(traversal.changedFiles).toHaveLength(2);
    expect(traversal.directAffected).toContain('serviceA.js');
    expect(traversal.directAffected).toContain('serviceB.js');
  });
});
