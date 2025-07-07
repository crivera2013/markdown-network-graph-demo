import React, { useState, useEffect } from 'react';
import { NetworkGraph } from './NetworkGraph';
import type { NetworkGraphData } from '../../plugins/docusaurus-plugin-network-graph/types';

interface NetworkGraphLoaderProps {
  width?: number;
  height?: number;
  onNodeClick?: (node: any) => void;
}

export const NetworkGraphLoader: React.FC<NetworkGraphLoaderProps> = (props) => {
  const [data, setData] = useState<NetworkGraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadGraphData = async () => {
      try {
        // Try multiple possible paths for the network graph data
        const possiblePaths = [
          '/total-graph.json', // Static directory (development)
          '/.docusaurus/docusaurus-plugin-network-graph/default/total-graph.json', // Build directory (production)
        ];

        let graphData = null;
        let lastError = null;

        for (const path of possiblePaths) {
          try {
            const response = await fetch(path);
            if (response.ok) {
              graphData = await response.json();
              break;
            }
          } catch (err) {
            lastError = err;
            continue;
          }
        }

        if (!graphData) {
          throw lastError || new Error('Failed to load network graph data from any path');
        }

        setData(graphData);
      } catch (err) {
        console.warn('Failed to load network graph data:', err);
        setError('Failed to load network graph data. Make sure the plugin is properly configured and the site has been built.');
        // Fallback to empty data
        setData({
          nodes: [],
          links: [],
          metadata: {
            generatedAt: new Date().toISOString(),
            totalNodes: 0,
            totalLinks: 0,
          },
        });
      } finally {
        setLoading(false);
      }
    };

    loadGraphData();
  }, []);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: props.height || 600,
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        background: '#f8fafc'
      }}>
        <div>Loading network graph...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: props.height || 600,
        border: '1px solid #fecaca',
        borderRadius: '8px',
        background: '#fef2f2',
        color: '#dc2626',
        textAlign: 'center',
        padding: '20px'
      }}>
        <div>{error}</div>
      </div>
    );
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: props.height || 600,
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        background: '#f8fafc',
        textAlign: 'center',
        padding: '20px'
      }}>
        <div>
          <h3>No network data available</h3>
          <p>Build your site to generate the network graph data.</p>
        </div>
      </div>
    );
  }

  return <NetworkGraph data={data} {...props} />;
};
