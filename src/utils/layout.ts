import dagre from '@dagrejs/dagre';
import type { CardEdge, CardNode } from '../types';
import { CARD_HEIGHT, CARD_WIDTH, GRID_SIZE } from '../types';

function snap(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

export function autoLayout(nodes: CardNode[], edges: CardEdge[]): CardNode[] {
  if (nodes.length === 0) return nodes;

  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: 'LR', nodesep: 32, ranksep: 80, marginx: 16, marginy: 16 });
  graph.setDefaultEdgeLabel(() => ({}));

  for (const node of nodes) {
    graph.setNode(node.id, {
      width: node.width ?? CARD_WIDTH,
      height: node.height ?? CARD_HEIGHT,
    });
  }
  for (const edge of edges) {
    if (nodes.some((n) => n.id === edge.source) && nodes.some((n) => n.id === edge.target)) {
      graph.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(graph);

  return nodes.map((node) => {
    const layoutNode = graph.node(node.id);
    if (!layoutNode) return node;
    const w = node.width ?? CARD_WIDTH;
    const h = node.height ?? CARD_HEIGHT;
    return {
      ...node,
      position: {
        x: snap(layoutNode.x - w / 2),
        y: snap(layoutNode.y - h / 2),
      },
    };
  });
}
