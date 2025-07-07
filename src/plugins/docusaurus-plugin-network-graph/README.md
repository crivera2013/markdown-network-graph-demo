# Docusaurus Network Graph Plugin

A TypeScript Node.js plugin for Docusaurus that generates interactive network graph visualizations of all markdown files in your site, showing relationships between pages based on directory structure and internal links.

## Features

- 🗂️ **Automatic Discovery**: Scans all markdown files in docs, blog, and pages directories
- 📊 **JSON Generation**: Creates `total-graph.json` during build with complete site graph data
- 🎯 **Metadata Extraction**: Extracts titles, tags, descriptions, and other frontmatter
- 🔗 **Relationship Mapping**: Identifies parent-child and reference relationships between pages
- 🎨 **Interactive Visualization**: Provides React components with D3.js force-directed graphs
- 🖱️ **Click Navigation**: Click nodes to navigate to corresponding pages
- 🎛️ **Drag & Drop**: Drag nodes to explore network structure
- 🔍 **Zoom & Pan**: Full zoom and pan support for large graphs

## Installation

The plugin is already included in this Docusaurus site. To use it in your own site:

1. Copy the plugin directory:
   ```
   src/plugins/docusaurus-plugin-network-graph/
   ```

2. Install dependencies:
   ```bash
   npm install --save-dev gray-matter d3 @types/d3 fs-extra @types/fs-extra
   ```

3. Copy the React components:
   ```
   src/components/NetworkGraph/
   ```

## Configuration

Add the plugin to your `docusaurus.config.ts`:

```typescript
export default {
  // ... other config
  plugins: [
    [
      './src/plugins/docusaurus-plugin-network-graph',
      {
        includeBlog: true,      // Include blog posts
        includeDocs: true,      // Include documentation pages  
        includePages: true,     // Include standalone pages
        maxDepth: 5,           // Maximum depth for parent-child relationships
        includePatterns: [],   // Additional glob patterns to include
        excludePatterns: [],   // Glob patterns to exclude
      },
    ],
  ],
};
```

## Usage

### Using the NetworkGraphLoader Component

The easiest way to display the network graph:

```jsx
import { NetworkGraphLoader } from '../components/NetworkGraph';

<NetworkGraphLoader width={900} height={700} />
```

### Using the NetworkGraph Component Directly

For more control, load the data yourself:

```jsx
import { NetworkGraph } from '../components/NetworkGraph';
import graphData from '@network-graph/data';

<NetworkGraph 
  data={graphData} 
  width={800} 
  height={600}
  onNodeClick={(node) => {
    // Custom click handler
    console.log('Clicked node:', node);
  }}
/>
```

## Graph Data Structure

The plugin generates a JSON file with the following structure:

```typescript
interface NetworkGraphData {
  nodes: NetworkNode[];
  links: NetworkLink[];
  metadata: {
    generatedAt: string;
    totalNodes: number;
    totalLinks: number;
  };
}

interface NetworkNode {
  id: string;           // File path relative to site root
  title: string;        // Page title from frontmatter or H1
  path: string;         // URL path for navigation
  type: 'doc' | 'blog' | 'page';
  metadata?: {
    tags?: string[];
    category?: string;
    description?: string;
    date?: string;
    author?: string;
  };
}

interface NetworkLink {
  source: string;       // Source node ID
  target: string;       // Target node ID
  type: 'parent-child' | 'reference';
  strength?: number;    // Link strength for simulation
}
```

## Relationship Types

### Parent-Child Relationships
- Based on directory structure
- Shows hierarchical organization of content
- Represented as solid lines in the visualization

### Reference Relationships  
- Based on markdown links between files
- Shows content connections and cross-references
- Represented as dashed lines in the visualization

## Visualization Features

### Node Colors
- 🔵 **Blue**: Documentation pages (`docs/` directory)
- 🟣 **Purple**: Blog posts (`blog/` directory)  
- 🟢 **Green**: Standalone pages (`src/pages/` directory)

### Interactions
- **Click**: Navigate to the page
- **Hover**: Show tooltip with page details
- **Drag**: Move nodes to explore relationships
- **Zoom**: Mouse wheel to zoom in/out
- **Pan**: Drag background to move around

### Tooltips
Hovering over nodes shows:
- Page title
- Page type (doc/blog/page)
- URL path
- Description (if available)
- Tags (if available)

## Build Process

The plugin runs during the Docusaurus build process and:

1. Scans specified directories for markdown files
2. Parses frontmatter and content using gray-matter
3. Extracts titles from frontmatter or H1 headings
4. Analyzes directory structure for parent-child relationships
5. Parses markdown content for internal links
6. Generates network graph data structure
7. Saves `total-graph.json` to the build output

## File Structure

```
src/
├── plugins/
│   └── docusaurus-plugin-network-graph/
│       ├── index.ts                    # Main plugin entry point
│       ├── types.ts                    # TypeScript type definitions
│       ├── networkGraphGenerator.ts    # Core graph generation logic
│       └── client/
│           └── networkGraphClient.js   # Client-side module
└── components/
    └── NetworkGraph/
        ├── index.ts                    # Component exports
        ├── NetworkGraph.tsx            # D3.js visualization component
        └── NetworkGraphLoader.tsx      # Data loading wrapper
```

## Development

To modify the plugin:

1. **Graph Generation**: Edit `networkGraphGenerator.ts` to change how files are processed
2. **Visualization**: Edit `NetworkGraph.tsx` to customize the D3.js visualization
3. **Types**: Update `types.ts` to add new data fields
4. **Plugin Logic**: Modify `index.ts` to change build-time behavior

## Performance Considerations

- Graph generation runs only during build time, not at runtime
- Large sites (>1000 pages) may need performance optimizations
- The D3.js visualization handles moderate node counts well (100-500 nodes)
- For very large graphs, consider filtering or pagination

## Troubleshooting

### Common Issues

1. **No graph data**: Ensure the plugin is configured and the site has been built
2. **Missing nodes**: Check file patterns and exclusion rules
3. **Broken links**: Verify markdown link syntax and file paths
4. **Build errors**: Check console for specific error messages

### Debug Mode

Enable debug logging by setting the environment variable:
```bash
DEBUG=docusaurus-plugin-network-graph npm run build
```

## License

This plugin is part of the Docusaurus site project and follows the same license terms.
