import type { Edge, Node } from '@xyflow/react';

interface ValidationResult {
  valid: boolean;
  reason?: string;
}

interface ConnectionLike {
  source: string | null;
  target: string | null;
}

/** DFS cycle detection — returns true if adding source→target creates a cycle */
export function wouldCreateCycle(
  edges: Edge[],
  source: string,
  target: string,
): boolean {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const list = adj.get(e.source) ?? [];
    list.push(e.target);
    adj.set(e.source, list);
  }

  // Add the proposed edge temporarily
  const list = adj.get(source) ?? [];
  list.push(target);
  adj.set(source, list);

  // DFS from target to see if we can reach source
  const visited = new Set<string>();
  const stack = [target];

  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node === source) return true;
    if (visited.has(node)) continue;
    visited.add(node);
    for (const neighbor of adj.get(node) ?? []) {
      stack.push(neighbor);
    }
  }

  return false;
}

/** Check if edge already exists */
export function isDuplicateEdge(
  edges: Edge[],
  source: string,
  target: string,
): boolean {
  return edges.some((e) => e.source === source && e.target === target);
}

/** Check if node type is a trigger */
export function isTriggerNode(nodeType: string | undefined): boolean {
  return nodeType === 'triggerNode';
}

/** Count trigger nodes in the graph */
export function countTriggerNodes(nodes: Node[]): number {
  return nodes.filter((n) => n.type === 'triggerNode').length;
}

/** Master connection validator */
export function validateConnection(
  connection: ConnectionLike,
  edges: Edge[],
  nodes: Node[],
): ValidationResult {
  const { source, target } = connection;

  if (!source || !target) {
    return { valid: false, reason: 'Missing source or target' };
  }

  // No self-loops
  if (source === target) {
    return { valid: false, reason: 'Cannot connect a node to itself' };
  }

  // No duplicate edges
  if (isDuplicateEdge(edges, source, target)) {
    return { valid: false, reason: 'Connection already exists' };
  }

  const sourceNode = nodes.find((n) => n.id === source);
  const targetNode = nodes.find((n) => n.id === target);

  // No trigger→trigger connections
  if (isTriggerNode(sourceNode?.type) && isTriggerNode(targetNode?.type)) {
    return { valid: false, reason: 'Cannot connect two triggers' };
  }

  // No incoming edges to trigger nodes
  if (isTriggerNode(targetNode?.type)) {
    return { valid: false, reason: 'Trigger nodes cannot have incoming connections' };
  }

  // No cycles
  if (wouldCreateCycle(edges, source, target)) {
    return { valid: false, reason: 'Connection would create a cycle' };
  }

  return { valid: true };
}
