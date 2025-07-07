import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { NetworkGraphData, NetworkNode, NetworkLink } from '../../plugins/docusaurus-plugin-network-graph/types';

interface NetworkGraphProps {
  data: NetworkGraphData;
  width?: number;
  height?: number;
  onNodeClick?: (node: NetworkNode) => void;
}

export const NetworkGraph: React.FC<NetworkGraphProps> = ({
  data,
  width = 800,
  height = 600,
  onNodeClick,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
  const [clickTimeout, setClickTimeout] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!svgRef.current || !data.nodes.length) return;

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

    // Identify main category nodes
    const isMainCategoryNode = (node: NetworkNode): boolean => {
      const title = node.title.toLowerCase();
      return title === 'trading' || title === 'insights' || title === 'portfolio management';
    };

    // Get node size based on whether it's a main category
    const getNodeSize = (node: NetworkNode): number => {
      return isMainCategoryNode(node) ? 15 : 8;
    };

    // Create simulation with fixed positioning for main category nodes
    const simulation = d3.forceSimulation(data.nodes)
      .force('link', d3.forceLink(data.links)
        .id((d: any) => d.id)
        .distance(d => d.type === 'parent-child' ? 50 : 100)
        .strength(d => d.strength || 0.5)
      )
      .force('charge', d3.forceManyBody().strength((d: any) => isMainCategoryNode(d) ? -800 : -300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius((d: any) => getNodeSize(d) + 20));

    // Add fixed positioning force for main category nodes
    const mainCategoryNodes = data.nodes.filter(isMainCategoryNode);
    if (mainCategoryNodes.length > 0) {
      simulation.force('mainCategories', d3.forceRadial(150, width / 2, height / 2)
        .strength((d: any) => isMainCategoryNode(d) ? 0.8 : 0));
    }

    // Create node color based on folder structure
    const getNodeColor = (node: NetworkNode): string => {
      const path = node.id.toLowerCase();
      
      if (path.includes('/trading/')) {
        return '#22c55e'; // Green for Trading subfolder
      } else if (path.includes('/portfolio management/') || path.includes('/portfolio-management/')) {
        return '#8b5cf6'; // Purple for Portfolio Management subfolder
      } else if (path.includes('/insights/')) {
        return '#f97316'; // Orange for Insights subfolder
      } else {
        return '#000000'; // Black for everything else
      }
    };

    // Create links
    const link = container.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(data.links)
      .enter()
      .append('line')
      .attr('stroke', d => d.type === 'parent-child' ? '#94a3b8' : '#e2e8f0')
      .attr('stroke-width', d => d.type === 'parent-child' ? 2 : 1)
      .attr('stroke-dasharray', d => d.type === 'reference' ? '3,3' : null);

    // Function to handle single click: center node and highlight connections
    const handleSingleClick = (clickedNode: NetworkNode, nodeSelection: any, linkSelection: any, sim: any) => {
      setSelectedNode(clickedNode);
      
      // Find all connected nodes
      const connectedNodeIds = new Set<string>([clickedNode.id]);
      data.links.forEach(link => {
        const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
        const targetId = typeof link.target === 'string' ? link.target : link.target.id;
        
        if (sourceId === clickedNode.id) {
          connectedNodeIds.add(targetId);
        }
        if (targetId === clickedNode.id) {
          connectedNodeIds.add(sourceId);
        }
      });

      // Center the clicked node
      sim.force('center', d3.forceCenter(clickedNode.x || width / 2, clickedNode.y || height / 2));
      sim.alpha(0.3).restart();

      // Highlight connected nodes and grey out others
      nodeSelection
        .style('opacity', (d: any) => connectedNodeIds.has(d.id) ? 1 : 0.3)
        .attr('stroke-width', (d: any) => d.id === clickedNode.id ? 4 : 2);

      // Highlight connected links and grey out others
      linkSelection
        .style('opacity', (d: any) => {
          const sourceId = typeof d.source === 'string' ? d.source : d.source.id;
          const targetId = typeof d.target === 'string' ? d.target : d.target.id;
          return (sourceId === clickedNode.id || targetId === clickedNode.id) ? 1 : 0.2;
        });
    };

    // Create nodes
    const node = container.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(data.nodes)
      .enter()
      .append('g')
      .attr('class', 'node')
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

    // Add circles to nodes
    node.append('circle')
      .attr('r', d => getNodeSize(d))
      .attr('fill', d => getNodeColor(d))
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.preventDefault();
        
        // Clear any existing timeout
        if (clickTimeout) {
          clearTimeout(clickTimeout);
          setClickTimeout(null);
        }
        
        // Set a timeout for single click
        const timeout = setTimeout(() => {
          // Single click: center node and highlight connections
          handleSingleClick(d, node, link, simulation);
          setClickTimeout(null);
        }, 250);
        
        setClickTimeout(timeout);
      })
      .on('dblclick', (event, d) => {
        event.preventDefault();
        
        // Clear the single click timeout
        if (clickTimeout) {
          clearTimeout(clickTimeout);
          setClickTimeout(null);
        }
        
        // Double click: navigate to page
        if (onNodeClick) {
          onNodeClick(d);
        } else {
          window.location.href = d.path;
        }
      })
      .on('mouseover', function(event, hoveredNode) {
        // Find all nodes connected to the hovered node
        const connectedNodeIds = new Set<string>([hoveredNode.id]);
        
        data.links.forEach(link => {
          const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
          const targetId = typeof link.target === 'string' ? link.target : link.target.id;
          
          if (sourceId === hoveredNode.id) {
            connectedNodeIds.add(targetId);
          }
          if (targetId === hoveredNode.id) {
            connectedNodeIds.add(sourceId);
          }
        });

        // Show tooltip
        tooltip
          .style('opacity', 1)
          .html(`
            <div style="font-weight: bold; margin-bottom: 4px;">${hoveredNode.title}</div>
            ${hoveredNode.metadata?.description ? `<div style="color: #d1d5db; margin-top: 4px;">${hoveredNode.metadata.description}</div>` : ''}
            ${hoveredNode.metadata?.tags?.length ? `<div style="color: #d1d5db; margin-top: 4px;">Tags: ${hoveredNode.metadata.tags.join(', ')}</div>` : ''}
          `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px');

        // Highlight connected nodes and grey out others
        node.transition()
          .duration(200)
          .style('opacity', d => connectedNodeIds.has(d.id) ? 1 : 0.3)
          .attr('r', d => {
            const baseSize = getNodeSize(d);
            if (d.id === hoveredNode.id) return baseSize + 4; // Enlarge hovered node
            if (connectedNodeIds.has(d.id)) return baseSize + 1; // Slightly enlarge connected nodes
            return baseSize; // Keep others normal size
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

        // Highlight connected labels and grey out others
        node.selectAll('text')
          .transition()
          .duration(200)
          .style('opacity', (d: any) => connectedNodeIds.has(d.id) ? 1 : 0.3)
          .style('font-weight', (d: any) => {
            if (d.id === hoveredNode.id) return 'bold';
            if (connectedNodeIds.has(d.id)) return '600';
            return 'normal';
          });
      })
      .on('mouseout', function(event, d) {
        // Hide tooltip
        tooltip.style('opacity', 0);

        // Reset all nodes to normal state
        node.transition()
          .duration(200)
          .style('opacity', 1)
          .attr('r', d => getNodeSize(d))
          .attr('stroke-width', 2);

        // Reset all links to normal state
        link.transition()
          .duration(200)
          .style('opacity', 1)
          .attr('stroke-width', d => d.type === 'parent-child' ? 2.5 : 2);

        // Reset all labels to normal state
        node.selectAll('text')
          .transition()
          .duration(200)
          .style('opacity', 1)
          .style('font-weight', 'normal');
      });

    // Add labels to nodes
    node.append('text')
      .text(d => d.title.length > 20 ? d.title.substring(0, 20) + '...' : d.title)
      .attr('x', 12)
      .attr('y', 4)
      .style('font-size', '12px')
      .style('font-family', 'system-ui, -apple-system, sans-serif')
      .style('fill', '#374151')
      .style('pointer-events', 'none');

    // Add tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'network-graph-tooltip')
      .style('position', 'absolute')
      .style('background', 'rgba(0, 0, 0, 0.8)')
      .style('color', 'white')
      .style('padding', '8px')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('opacity', 0);

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

    // Add background click to reset highlighting
    svg.on('click', (event) => {
      // Only reset if clicking on the background (not on a node)
      if (event.target === svg.node()) {
        setSelectedNode(null);
        
        // Reset all nodes and links to normal state
        node
          .style('opacity', 1)
          .attr('stroke-width', 2);
        
        link
          .style('opacity', 1);
        
        // Reset center force
        simulation.force('center', d3.forceCenter(width / 2, height / 2));
        simulation.alpha(0.1).restart();
      }
    });

    // Cleanup tooltip on component unmount
    return () => {
      d3.select('.network-graph-tooltip').remove();
      if (clickTimeout) {
        clearTimeout(clickTimeout);
      }
    };
  }, [data, width, height, onNodeClick]);

  return (
    <div className="network-graph-container">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          background: '#ffffff'
        }}
      />
      {selectedNode && (
        <div className="network-graph-info" style={{
          marginTop: '16px',
          padding: '12px',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          background: '#f8fafc'
        }}>
          <h4 style={{ margin: '0 0 8px 0' }}>{selectedNode.title}</h4>
          <p style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#6b7280' }}>
            Type: <span style={{ textTransform: 'capitalize' }}>{selectedNode.type}</span>
          </p>
          <p style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#6b7280' }}>
            Path: {selectedNode.path}
          </p>
          {selectedNode.metadata?.description && (
            <p style={{ margin: '0 0 4px 0', fontSize: '14px' }}>
              {selectedNode.metadata.description}
            </p>
          )}
          {selectedNode.metadata?.tags?.length > 0 && (
            <p style={{ margin: '0', fontSize: '14px', color: '#6b7280' }}>
              Tags: {selectedNode.metadata.tags.join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
