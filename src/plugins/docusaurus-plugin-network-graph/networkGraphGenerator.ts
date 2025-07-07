import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';
import matter from 'gray-matter';
import type { PluginOptions, NetworkGraphData, NetworkNode, NetworkLink } from './types';

export async function generateNetworkGraph(
  siteDir: string,
  options: PluginOptions = {}
): Promise<NetworkGraphData> {
  const {
    includeBlog = true,
    includeDocs = true,
    includePages = true,
    includePatterns = [],
    excludePatterns = [],
    maxDepth = 10,
  } = options;

  const nodes: NetworkNode[] = [];
  const links: NetworkLink[] = [];
  const fileMap = new Map<string, NetworkNode>();

  // Define search patterns based on options
  const searchPatterns: string[] = [];

  if (includeDocs) {
    searchPatterns.push('docs/**/*.{md,mdx}');
    console.log('Including docs files in network graph');
  }
  if (includeBlog) {
    searchPatterns.push('blog/**/*.{md,mdx}');
    console.log('Including blog files in network graph');
  }
  if (includePages) {
    searchPatterns.push('src/pages/**/*.{md,mdx}');
    console.log('Including page files in network graph');
  }

  // Add custom include patterns
  searchPatterns.push(...includePatterns);

  console.log('Search patterns:', searchPatterns);

  // Find all markdown files
  const allFiles: string[] = [];
  for (const pattern of searchPatterns) {
    const files = await glob(pattern, {
      cwd: siteDir,
      ignore: excludePatterns
    });
    allFiles.push(...files);
  }

  // Process each file to create nodes
  for (const filePath of allFiles) {
    const fullPath = path.join(siteDir, filePath);

    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      const { data: frontmatter, content: markdownContent } = matter(content);

      const node = await createNodeFromFile(filePath, frontmatter, markdownContent);
      nodes.push(node);
      fileMap.set(filePath, node);
    } catch (error) {
      console.warn(`Failed to process file ${filePath}:`, error);
    }
  }

  // Generate parent-child relationships based on directory structure
  generateParentChildLinks(nodes, links, maxDepth);

  // Generate reference links based on markdown links
  await generateReferenceLinks(nodes, links, siteDir, fileMap);

  return {
    nodes,
    links,
    metadata: {
      generatedAt: new Date().toISOString(),
      totalNodes: nodes.length,
      totalLinks: links.length,
    },
  };
}

async function createNodeFromFile(
  filePath: string,
  frontmatter: any,
  content: string
): Promise<NetworkNode> {
  // Determine node type based on path
  let type: 'doc' | 'blog' | 'page' = 'page';
  if (filePath.startsWith('docs/')) {
    type = 'doc';
  } else if (filePath.startsWith('blog/')) {
    type = 'blog';
  }

  // Extract title from frontmatter or H1 heading
  let title = frontmatter.title || frontmatter.sidebar_label;
  if (!title) {
    const h1Match = content.match(/^#\s+(.+)$/m);
    title = h1Match ? h1Match[1] : path.basename(filePath, path.extname(filePath));
  }

  // Create URL path
  let urlPath = filePath
    .replace(/\.(md|mdx)$/, '')
    .replace(/\/index$/, '')
    .replace(/^src\/pages/, '');

  if (type === 'doc') {
    urlPath = `/docs/${urlPath.replace(/^docs\//, '')}`;
  } else if (type === 'blog') {
    urlPath = `/${urlPath}`;
  } else {
    urlPath = urlPath || '/';
  }

  return {
    id: filePath,
    title,
    path: urlPath,
    type,
    metadata: {
      tags: frontmatter.tags || [],
      category: frontmatter.category,
      description: frontmatter.description,
      date: frontmatter.date,
      author: frontmatter.author,
    },
  };
}

function generateParentChildLinks(
  nodes: NetworkNode[],
  links: NetworkLink[],
  maxDepth: number
): void {
  // Create a hierarchy based on file paths
  const pathHierarchy = new Map<string, string[]>();

  nodes.forEach(node => {
    const pathParts = node.id.split('/');
    for (let i = 1; i < pathParts.length && i <= maxDepth; i++) {
      const parentPath = pathParts.slice(0, i).join('/');
      const childPath = pathParts.slice(0, i + 1).join('/');

      if (parentPath !== childPath) {
        if (!pathHierarchy.has(parentPath)) {
          pathHierarchy.set(parentPath, []);
        }
        pathHierarchy.get(parentPath)!.push(childPath);
      }
    }
  });

  // Create parent-child links
  pathHierarchy.forEach((children, parent) => {
    const parentNode = nodes.find(n => n.id.startsWith(parent));
    if (parentNode) {
      children.forEach(childPath => {
        const childNode = nodes.find(n => n.id === childPath || n.id.startsWith(childPath));
        if (childNode && childNode.id !== parentNode.id) {
          links.push({
            source: parentNode.id,
            target: childNode.id,
            type: 'parent-child',
            strength: 0.8,
          });
        }
      });
    }
  });
}

async function generateReferenceLinks(
  nodes: NetworkNode[],
  links: NetworkLink[],
  siteDir: string,
  fileMap: Map<string, NetworkNode>
): Promise<void> {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

  for (const node of nodes) {
    try {
      const fullPath = path.join(siteDir, node.id);
      const content = await fs.readFile(fullPath, 'utf-8');
      const { content: markdownContent } = matter(content);

      let match;
      while ((match = linkRegex.exec(markdownContent)) !== null) {
        const [, , linkPath] = match;

        // Skip external links
        if (linkPath.startsWith('http') || linkPath.startsWith('mailto:')) {
          continue;
        }

        // Resolve relative links
        const resolvedPath = resolveLinkPath(node.id, linkPath);
        const targetNode = findTargetNode(resolvedPath, fileMap);

        if (targetNode && targetNode.id !== node.id) {
          // Check if link already exists
          const existingLink = links.find(
            l => l.source === node.id && l.target === targetNode.id && l.type === 'reference'
          );

          if (!existingLink) {
            links.push({
              source: node.id,
              target: targetNode.id,
              type: 'reference',
              strength: 0.5,
            });
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to process links for ${node.id}:`, error);
    }
  }
}

function resolveLinkPath(currentFilePath: string, linkPath: string): string {
  // Remove hash fragments and query parameters
  const cleanLinkPath = linkPath.split('#')[0].split('?')[0];

  if (cleanLinkPath.startsWith('/')) {
    // Absolute path
    return cleanLinkPath.substring(1);
  } else {
    // Relative path
    const currentDir = path.dirname(currentFilePath);
    return path.normalize(path.join(currentDir, cleanLinkPath));
  }
}

function findTargetNode(
  resolvedPath: string,
  fileMap: Map<string, NetworkNode>
): NetworkNode | undefined {
  // Try exact match first
  let targetNode = fileMap.get(resolvedPath);
  if (targetNode) return targetNode;

  // Try with .md extension
  targetNode = fileMap.get(`${resolvedPath}.md`);
  if (targetNode) return targetNode;

  // Try with .mdx extension
  targetNode = fileMap.get(`${resolvedPath}.mdx`);
  if (targetNode) return targetNode;

  // Try with index.md
  targetNode = fileMap.get(`${resolvedPath}/index.md`);
  if (targetNode) return targetNode;

  // Try with index.mdx
  targetNode = fileMap.get(`${resolvedPath}/index.mdx`);
  if (targetNode) return targetNode;

  // Try to find by URL path
  return Array.from(fileMap.values()).find(node =>
    node.path === `/${resolvedPath}` ||
    node.path === resolvedPath ||
    node.path.endsWith(resolvedPath)
  );
}
