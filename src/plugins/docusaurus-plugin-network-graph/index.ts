import type { Plugin } from '@docusaurus/types';
import type { PluginOptions } from './types';
import { generateNetworkGraph } from './networkGraphGenerator';
import path from 'path';
import fs from 'fs-extra';

export default function pluginNetworkGraph(
  context: any,
  options: PluginOptions
): Plugin {
  const { siteDir, generatedFilesDir, outDir } = context;

  return {
    name: 'docusaurus-plugin-network-graph',
    
    async loadContent() {
      // Generate the network graph data during the build process
      console.log('Generating network graph data...');
      const graphData = await generateNetworkGraph(siteDir, options);
      console.log(`Generated network graph with ${graphData.nodes.length} nodes and ${graphData.links.length} links`);
      return graphData;
    },

    async contentLoaded({ content, actions }) {
      const { createData } = actions;
      
      // Create the total-graph.json file
      await createData('total-graph.json', JSON.stringify(content, null, 2));
      
      // Also copy to static directory for development server access
      const staticDir = path.join(siteDir, 'static');
      await fs.ensureDir(staticDir);
      await fs.writeFile(
        path.join(staticDir, 'total-graph.json'), 
        JSON.stringify(content, null, 2)
      );
      console.log('Network graph data copied to static directory for development');
    },

    async postBuild({ content, outDir }) {
      // Copy the generated data to the build directory for static access
      const targetDir = path.join(outDir, '.docusaurus', 'docusaurus-plugin-network-graph', 'default');
      await fs.ensureDir(targetDir);
      await fs.writeFile(
        path.join(targetDir, 'total-graph.json'), 
        JSON.stringify(content, null, 2)
      );
      console.log('Network graph data copied to build directory');
    },

    getClientModules() {
      return [path.resolve(__dirname, './client/networkGraphClient.js')];
    },

    configureWebpack() {
      return {
        resolve: {
          alias: {
            '@network-graph/data': path.join(
              generatedFilesDir,
              'docusaurus-plugin-network-graph',
              'total-graph.json'
            ),
          },
        },
      };
    },
  };
}

export { PluginOptions } from './types';
