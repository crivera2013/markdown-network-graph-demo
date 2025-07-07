import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useLocation } from '@docusaurus/router';

interface NetworkNode {
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
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  vx?: number;
  vy?: number;
  index?: number;
}

interface NetworkLink {
  source: string | NetworkNode;
  target: string | NetworkNode;
  type: 'parent-child' | 'reference';
  strength?: number;
}

interface NetworkGraphData {
  nodes: NetworkNode[];
  links: NetworkLink[];
  metadata: {
    generatedAt: string;
    totalNodes: number;
    totalLinks: number;
  };
}

interface NetworkGraphEmbedProps {
  width?: number;
  height?: number;
  nodeSize?: number;
  linkDistance?: number;
  chargeStrength?: number;
  showLabels?: boolean;
  showTooltips?: boolean;
  showStats?: boolean;
  onNodeClick?: (node: NetworkNode) => void;
}

export const NetworkGraphEmbed: React.FC<NetworkGraphEmbedProps> = ({
  width = 800,
  height = 600,
  nodeSize = 8,
  linkDistance = 80,
  chargeStrength = -300,
  showLabels = true,
  showTooltips = true,
  showStats = true,
  onNodeClick,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [data, setData] = useState<NetworkGraphData | null>(null);
  const [filteredData, setFilteredData] = useState<NetworkGraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
  const location = useLocation();

  // Function to filter data to show only current page and directly connected nodes
  const filterDataForCurrentPage = (fullData: NetworkGraphData): NetworkGraphData => {
    const currentPath = location.pathname;

    // Find the current page node
    const currentNode = fullData.nodes.find(node =>
      node.path === currentPath ||
      node.path === currentPath.replace(/\/$/, '') ||
      currentPath.includes(node.path)
    );

    if (!currentNode) {
      // If current page not found, return empty data
      return {
        nodes: [],
        links: [],
        metadata: {
          ...fullData.metadata,
          totalNodes: 0,
          totalLinks: 0,
        },
      };
    }

    // Find all nodes that have direct links to/from the current node
    const connectedNodeIds = new Set<string>([currentNode.id]);

    fullData.links.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;

      if (sourceId === currentNode.id) {
        connectedNodeIds.add(targetId);
      }
      if (targetId === currentNode.id) {
        connectedNodeIds.add(sourceId);
      }
    });

    // Filter nodes to include only current node and directly connected nodes
    const filteredNodes = fullData.nodes.filter(node => connectedNodeIds.has(node.id));

    // Filter links to include only links between the filtered nodes
    const filteredLinks = fullData.links.filter(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      return connectedNodeIds.has(sourceId) && connectedNodeIds.has(targetId);
    });

    return {
      nodes: filteredNodes,
      links: filteredLinks,
      metadata: {
        ...fullData.metadata,
        totalNodes: filteredNodes.length,
        totalLinks: filteredLinks.length,
      },
    };
  };

  // Load graph data
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
        setError('Failed to load network graph data');
        // Create empty fallback data
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

  // Filter data when full data or location changes
  useEffect(() => {
    if (data) {
      const filtered = filterDataForCurrentPage(data);
      setFilteredData(filtered);
    }
  }, [data, location.pathname]);

  // Render D3 visualization
  useEffect(() => {
    if (!svgRef.current || !filteredData || filteredData.nodes.length === 0) return;

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current);
    const container = svg.append('g');

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 3])
      .on('zoom', (event) => {
        container.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Create simulation
    const simulation = d3.forceSimulation(filteredData.nodes)
      .force('link', d3.forceLink(filteredData.links)
        .id((d: any) => d.id)
        .distance(linkDistance)
        .strength(d => d.strength || 0.5)
      )
      .force('charge', d3.forceManyBody().strength(chargeStrength))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(nodeSize + 2));

    // Create node color scale
    const colorScale = d3.scaleOrdinal<string>()
      .domain(['doc', 'blog', 'page'])
      .range(['#3b82f6', '#8b5cf6', '#10b981']); // Blue, Purple, Green

    // Highlight current page node
    const currentPath = location.pathname;
    const isCurrentPage = (node: NetworkNode) =>
      node.path === currentPath ||
      node.path === currentPath.replace(/\/$/, '') ||
      currentPath.includes(node.path);

    // Create links
    const link = container.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(filteredData.links)
      .enter()
      .append('line')
      .attr('stroke', d => {
        if (d.type === 'parent-child') {
          // Check if this is a link TO a parent (current node is child) or FROM a parent (current node is parent)
          const sourceNode = filteredData.nodes.find(n => n.id === d.source);
          const targetNode = filteredData.nodes.find(n => n.id === d.target);

          if (sourceNode && targetNode) {
            const sourceIsCurrentPage = isCurrentPage(sourceNode);
            const targetIsCurrentPage = isCurrentPage(targetNode);

            if (sourceIsCurrentPage && !targetIsCurrentPage) {
              // Current page is source, target is child - green
              return '#10b981';
            } else if (!sourceIsCurrentPage && targetIsCurrentPage) {
              // Current page is target, source is parent - purple
              return '#8b5cf6';
            }
          }
          // Default parent-child color
          return '#64748b';
        } else {
          // Reference links - darker for better visibility
          return '#6b7280';
        }
      })
      .attr('stroke-width', d => d.type === 'parent-child' ? 2.5 : 2)
      .attr('stroke-dasharray', d => d.type === 'reference' ? '6,3' : null)
      .attr('opacity', d => d.type === 'reference' ? 0.8 : 0.7);

    // Create nodes
    const node = container.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(filteredData.nodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .call(d3.drag<SVGGElement, NetworkNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
      );

    // Helper function to check if a node is connected via reference link
    const isConnectedByReference = (node: NetworkNode): boolean => {
      const currentNode = filteredData.nodes.find(n => isCurrentPage(n));
      if (!currentNode) return false;
      
      return filteredData.links.some(link => {
        const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
        const targetId = typeof link.target === 'string' ? link.target : link.target.id;
        
        return link.type === 'reference' && (
          (sourceId === currentNode.id && targetId === node.id) ||
          (targetId === currentNode.id && sourceId === node.id)
        );
      });
    };

    // Add circles to nodes
    node.append('circle')
      .attr('r', d => isCurrentPage(d) ? nodeSize * 1.3 : nodeSize)
      .attr('fill', d => {
        if (isCurrentPage(d)) {
          return '#ef4444'; // Red for current page
        } else if (isConnectedByReference(d)) {
          return '#8b5cf6'; // Purple for nodes connected by reference links
        } else {
          return colorScale(d.type); // Default colors based on type
        }
      })
      .attr('stroke', d => isCurrentPage(d) ? '#dc2626' : '#ffffff')
      .attr('stroke-width', d => isCurrentPage(d) ? 3 : 2)
      .style('filter', d => isCurrentPage(d) ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' : null)
      .on('click', (event, d) => {
        event.stopPropagation();
        setSelectedNode(d);
        if (onNodeClick) {
          onNodeClick(d);
        } else {
          // Default behavior: navigate to the page
          window.location.href = d.path;
        }
      })
      .on('mouseover', function(event, hoveredNode) {
        // Find all nodes connected to the hovered node
        const connectedNodeIds = new Set<string>([hoveredNode.id]);
        
        filteredData.links.forEach(link => {
          const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
          const targetId = typeof link.target === 'string' ? link.target : link.target.id;
          
          if (sourceId === hoveredNode.id) {
            connectedNodeIds.add(targetId);
          }
          if (targetId === hoveredNode.id) {
            connectedNodeIds.add(sourceId);
          }
        });

        // Show tooltip if enabled
        if (showTooltips && tooltip) {
          tooltip
            .style('opacity', 1)
            .html(`
              <div style="font-weight: bold; margin-bottom: 4px;">${hoveredNode.title}</div>
              ${hoveredNode.metadata?.description ? `<div style="color: #d1d5db; margin-top: 4px;">${hoveredNode.metadata.description}</div>` : ''}
              ${hoveredNode.metadata?.tags?.length ? `<div style="color: #d1d5db; margin-top: 4px;">Tags: ${hoveredNode.metadata.tags.join(', ')}</div>` : ''}
            `)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px');
        }

        // Highlight connected nodes and grey out others
        node.transition()
          .duration(200)
          .style('opacity', d => connectedNodeIds.has(d.id) ? 1 : 0.3)
          .attr('r', d => {
            if (d.id === hoveredNode.id) return nodeSize * 1.5; // Enlarge hovered node
            if (connectedNodeIds.has(d.id)) return nodeSize * 1.1; // Slightly enlarge connected nodes
            return nodeSize; // Keep others normal size
          })
          .attr('stroke-width', d => connectedNodeIds.has(d.id) ? 3 : 2);

        // Highlight connected links and grey out others
        link.transition()
          .duration(200)
          .style('opacity', d => {
            const sourceId = typeof d.source === 'string' ? d.source : d.source.id;
            const targetId = typeof d.target === 'string' ? d.target : d.target.id;
            return (sourceId === hoveredNode.id || targetId === hoveredNode.id) ? 1 : 0.2;
          })
          .attr('stroke-width', d => {
            const sourceId = typeof d.source === 'string' ? d.source : d.source.id;
            const targetId = typeof d.target === 'string' ? d.target : d.target.id;
            const isConnected = sourceId === hoveredNode.id || targetId === hoveredNode.id;
            return isConnected ? (d.type === 'parent-child' ? 3.5 : 3) : (d.type === 'parent-child' ? 2.5 : 2);
          });

        // Highlight connected labels and grey out others if labels are enabled
        if (showLabels) {
          node.selectAll('text')
            .transition()
            .duration(200)
            .style('opacity', d => connectedNodeIds.has(d.id) ? 1 : 0.3)
            .style('font-weight', d => {
              if (d.id === hoveredNode.id) return '700';
              if (connectedNodeIds.has(d.id)) return '600';
              if (isCurrentPage(d)) return '600';
              return '400';
            });
        }
      })
      .on('mouseout', function(event, d) {
        // Hide tooltip if enabled
        if (showTooltips && tooltip) {
          tooltip.style('opacity', 0);
        }

        // Reset all nodes to normal state
        node.transition()
          .duration(200)
          .style('opacity', 1)
          .attr('r', nodeSize)
          .attr('stroke-width', d => isCurrentPage(d) ? 3 : 2);

        // Reset all links to normal state
        link.transition()
          .duration(200)
          .style('opacity', d => d.type === 'reference' ? 0.8 : 0.7)
          .attr('stroke-width', d => d.type === 'parent-child' ? 2.5 : 2);

        // Reset all labels to normal state if labels are enabled
        if (showLabels) {
          node.selectAll('text')
            .transition()
            .duration(200)
            .style('opacity', 1)
            .style('font-weight', d => isCurrentPage(d) ? '600' : '400');
        }
      });

    // Add labels if enabled
    if (showLabels) {
      node.append('text')
        .text(d => {
          // Increased character limits for better readability
          const maxLength = width < 280 ? 18 : 30;
          return d.title.length > maxLength ? d.title.substring(0, maxLength) + '...' : d.title;
        })
        .attr('x', nodeSize + 3)
        .attr('y', 3)
        .style('font-size', width < 280 ? '9px' : '10px')
        .style('font-family', 'system-ui, -apple-system, sans-serif')
        .style('fill', 'var(--ifm-color-emphasis-800)')
        .style('pointer-events', 'none')
        .style('user-select', 'none')
        .attr('text-anchor', 'start')
        .style('font-weight', d => isCurrentPage(d) ? '600' : '400');
    }

    // Add tooltip if enabled
    let tooltip: any;
    if (showTooltips) {
      tooltip = d3.select('body').append('div')
        .attr('class', 'network-graph-tooltip')
        .style('position', 'absolute')
        .style('background', 'rgba(0, 0, 0, 0.9)')
        .style('color', 'white')
        .style('padding', '8px 12px')
        .style('border-radius', '6px')
        .style('font-size', '12px')
        .style('font-family', 'system-ui, -apple-system, sans-serif')
        .style('pointer-events', 'none')
        .style('opacity', 0)
        .style('z-index', '1000')
        .style('box-shadow', '0 4px 6px -1px rgba(0, 0, 0, 0.1)');

      node.on('mouseover', (event, hoveredNode) => {
        // Show tooltip if enabled
        if (showTooltips && tooltip) {
          tooltip
            .style('opacity', 1)
            .html(`
              <div style="font-weight: bold; margin-bottom: 4px;">${hoveredNode.title}</div>
              ${hoveredNode.metadata?.description ? `<div style="color: #d1d5db; margin-top: 4px;">${hoveredNode.metadata.description}</div>` : ''}
              ${hoveredNode.metadata?.tags?.length ? `<div style="color: #d1d5db; margin-top: 4px;">Tags: ${hoveredNode.metadata.tags.join(', ')}</div>` : ''}
            `)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px');
        }
      })
      .on('mouseout', () => {
        // Hide tooltip if enabled
        if (showTooltips && tooltip) {
          tooltip.style('opacity', 0);
        }
      });
    }

    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as any).x || 0)
        .attr('y1', d => (d.source as any).y || 0)
        .attr('x2', d => (d.target as any).x || 0)
        .attr('y2', d => (d.target as any).y || 0);

      node
        .attr('transform', d => `translate(${d.x || 0},${d.y || 0})`);
    });

    // Clear background click
    svg.on('click', () => {
      setSelectedNode(null);
    });

    // Cleanup tooltip on component unmount
    return () => {
      if (tooltip) {
        tooltip.remove();
      }
    };
  }, [filteredData, width, height, nodeSize, linkDistance, chargeStrength, showLabels, showTooltips, onNodeClick, location.pathname]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: height,
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        background: '#f9fafb',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '8px', fontSize: '14px', color: '#6b7280' }}>
            Loading network graph...
          </div>
          <div style={{
            width: '24px',
            height: '24px',
            border: '2px solid #e5e7eb',
            borderTop: '2px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto'
          }}></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: height,
        border: '1px solid #fca5a5',
        borderRadius: '8px',
        background: '#fef2f2',
        color: '#dc2626',
        textAlign: 'center',
        padding: '20px',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div>
          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Error loading network graph</div>
          <div style={{ fontSize: '14px' }}>{error}</div>
        </div>
      </div>
    );
  }

  if (!filteredData || filteredData.nodes.length === 0) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: height,
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        background: '#f9fafb',
        textAlign: 'center',
        padding: '20px',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div>
          <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}>No connected pages found</div>
          <div style={{ fontSize: '14px', color: '#6b7280' }}>This page has no direct links to or from other documentation pages.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {showStats && filteredData && (
        <div style={{
          marginBottom: '16px',
          padding: '12px',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '6px',
          fontSize: '14px',
          color: '#64748b'
        }}>
          <strong>Local Graph:</strong> {filteredData.metadata.totalNodes} nodes, {filteredData.metadata.totalLinks} links
          <span style={{ marginLeft: '16px', color: '#ef4444', fontWeight: 'bold' }}>
            • Current page and directly connected pages
          </span>
          {data && (
            <div style={{ marginTop: '4px', fontSize: '12px' }}>
              Total site: {data.metadata.totalNodes} nodes, {data.metadata.totalLinks} links
            </div>
          )}
        </div>
      )}

      <div style={{ position: 'relative' }}>
        <svg
          ref={svgRef}
          width={width}
          height={height}
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            background: '#ffffff',
            display: 'block'
          }}
        />

        {selectedNode && (
          <div style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            background: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '12px',
            maxWidth: '200px',
            fontSize: '13px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '6px', color: '#111827' }}>
              {selectedNode.title}
            </div>
            {selectedNode.metadata?.description && (
              <div style={{ color: '#374151', marginTop: '8px', fontSize: '12px' }}>
                {selectedNode.metadata.description}
              </div>
            )}
            {selectedNode.metadata?.tags?.length > 0 && (
              <div style={{ color: '#6b7280', marginTop: '6px', fontSize: '12px' }}>
                Tags: {selectedNode.metadata.tags.join(', ')}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
