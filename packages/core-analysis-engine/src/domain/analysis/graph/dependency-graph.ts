import graphologyPkg from 'graphology';
import {
  DependencyEdge,
  DependencyNode,
  FileImpactStatus,
  SupportedLanguage,
} from '../types.js';

// Graphology can be imported as default or named DirectedGraph
const GraphologyConstructor =
  (graphologyPkg as any).DirectedGraph ||
  (graphologyPkg as any).default?.DirectedGraph ||
  (graphologyPkg as any).Graph ||
  graphologyPkg;

export class DependencyGraph {
  public readonly graph: any;

  constructor() {
    this.graph = new GraphologyConstructor({ type: 'directed', multi: false });
  }

  /**
   * Adds or updates a file node in the dependency graph.
   */
  public addOrUpdateNode(
    filePath: string,
    attributes: {
      language: SupportedLanguage;
      status?: FileImpactStatus;
      exports?: string[];
      imports?: string[];
    }
  ): void {
    const existing = this.graph.hasNode(filePath);
    const nodeAttrs: DependencyNode = {
      id: filePath,
      filePath,
      language: attributes.language,
      status: attributes.status || 'unaffected',
      exports: attributes.exports || [],
      imports: attributes.imports || [],
    };

    if (existing) {
      this.graph.mergeNodeAttributes(filePath, nodeAttrs);
    } else {
      this.graph.addNode(filePath, nodeAttrs);
    }
  }

  /**
   * Adds a directed dependency edge: importer -> imported (target).
   * Meaning: `importer` depends on `importedTarget`.
   */
  public addDependencyEdge(
    importer: string,
    importedTarget: string,
    importPath: string
  ): void {
    if (!this.graph.hasNode(importer) || !this.graph.hasNode(importedTarget)) {
      return;
    }

    // Do not create self-loops
    if (importer === importedTarget) {
      return;
    }

    if (!this.graph.hasDirectedEdge(importer, importedTarget)) {
      this.graph.addDirectedEdge(importer, importedTarget, {
        source: importer,
        target: importedTarget,
        importPath,
      });
    }
  }

  public hasNode(filePath: string): boolean {
    return this.graph.hasNode(filePath);
  }

  public getNodeAttributes(filePath: string): DependencyNode | undefined {
    if (!this.graph.hasNode(filePath)) return undefined;
    return this.graph.getNodeAttributes(filePath) as DependencyNode;
  }

  public setNodeStatus(filePath: string, status: FileImpactStatus): void {
    if (this.graph.hasNode(filePath)) {
      this.graph.setNodeAttribute(filePath, 'status', status);
    }
  }

  /**
   * Returns all files that directly import the given file.
   * Because edge direction is `importer -> imported`,
   * incoming neighbors of `filePath` are the files that import it.
   */
  public getDirectDependents(filePath: string): string[] {
    if (!this.graph.hasNode(filePath)) return [];
    return this.graph.inNeighbors(filePath);
  }

  /**
   * Returns all files that the given file imports.
   */
  public getDirectDependencies(filePath: string): string[] {
    if (!this.graph.hasNode(filePath)) return [];
    return this.graph.outNeighbors(filePath);
  }

  /**
   * Returns all nodes in the graph.
   */
  public getAllNodes(): DependencyNode[] {
    const nodes: DependencyNode[] = [];
    this.graph.forEachNode((id: string, attributes: DependencyNode) => {
      nodes.push({ ...attributes, id });
    });
    return nodes;
  }

  /**
   * Returns all edges in the graph.
   */
  public getAllEdges(): DependencyEdge[] {
    const edges: DependencyEdge[] = [];
    this.graph.forEachDirectedEdge(
      (_edge: string, attributes: any, source: string, target: string) => {
        edges.push({
          source,
          target,
          importPath: attributes.importPath || target,
        });
      }
    );
    return edges;
  }

  /**
   * Returns graph summary metrics.
   */
  public getMetrics(): { nodeCount: number; edgeCount: number } {
    return {
      nodeCount: this.graph.order,
      edgeCount: this.graph.size,
    };
  }
}
