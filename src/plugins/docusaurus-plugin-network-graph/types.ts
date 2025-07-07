export interface PluginOptions {
  /** Include blog posts in the graph */
  includeBlog?: boolean;
  /** Include documentation pages in the graph */
  includeDocs?: boolean;
  /** Include standalone pages in the graph */
  includePages?: boolean;
  /** Custom path patterns to include */
  includePatterns?: string[];
  /** Custom path patterns to exclude */
  excludePatterns?: string[];
  /** Maximum depth for parent-child relationships */
  maxDepth?: number;
}

export interface NetworkNode {
  id: string;
  title: string;
  path: string;
  type: 'doc' | 'blog' | 'page';
  metadata?: {
    tags?: string[];
    category?: string;
    description?: string;
    date?: string;
    author?: string;
  };
  // D3.js simulation properties
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  vx?: number;
  vy?: number;
  index?: number;
}

export interface NetworkLink {
  source: string | NetworkNode;
  target: string | NetworkNode;
  type: 'parent-child' | 'reference';
  strength?: number;
}

export interface NetworkGraphData {
  nodes: NetworkNode[];
  links: NetworkLink[];
  metadata: {
    generatedAt: string;
    totalNodes: number;
    totalLinks: number;
  };
}
