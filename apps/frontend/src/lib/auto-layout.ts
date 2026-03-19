import dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';

const NODE_WIDTH = 200;
const NODE_HEIGHT = 80;
const STICKY_WIDTH = 200;
const STICKY_HEIGHT = 150;

export function getAutoLayout(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return nodes;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', ranksep: 100, nodesep: 80 });

  // Separate sticky notes — they don't participate in layout
  const layoutNodes: Node[] = [];
  const stickyNodes: Node[] = [];

  nodes.forEach((node) => {
    if (node.type === 'stickyNote') {
      stickyNodes.push(node);
    } else {
      layoutNodes.push(node);
      g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
    }
  });

  edges.forEach((edge) => {
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      g.setEdge(edge.source, edge.target);
    }
  });

  dagre.layout(g);

  const positioned = layoutNodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
    };
  });

  return [...positioned, ...stickyNodes];
}
