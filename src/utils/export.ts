import { toPng, toSvg } from 'html-to-image';
import type { CardEdge, CardNode, PersistedGraph } from '../types';

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadDataUrl(filename: string, dataUrl: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function exportJson(nodes: CardNode[], edges: CardEdge[]): void {
  const payload: PersistedGraph = { version: 1, nodes, edges };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  downloadBlob(`project-tree-${timestamp()}.json`, blob);
}

function getCanvasElement(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.react-flow__viewport')
    ? (document.querySelector<HTMLElement>('.react-flow') as HTMLElement | null)
    : null;
}

export async function exportSvg(): Promise<void> {
  const el = getCanvasElement();
  if (!el) throw new Error('Canvas element not found');
  const dataUrl = await toSvg(el, {
    backgroundColor: '#fafafa',
    filter: (node) => {
      if (!(node instanceof Element)) return true;
      if (node.classList.contains('react-flow__controls')) return false;
      if (node.classList.contains('react-flow__minimap')) return false;
      if (node.classList.contains('react-flow__attribution')) return false;
      if (node.classList.contains('react-flow__panel')) return false;
      return true;
    },
  });
  downloadDataUrl(`project-tree-${timestamp()}.svg`, dataUrl);
}

export async function exportPng(): Promise<void> {
  const el = getCanvasElement();
  if (!el) throw new Error('Canvas element not found');
  const dataUrl = await toPng(el, {
    backgroundColor: '#fafafa',
    pixelRatio: 2,
    filter: (node) => {
      if (!(node instanceof Element)) return true;
      if (node.classList.contains('react-flow__controls')) return false;
      if (node.classList.contains('react-flow__minimap')) return false;
      if (node.classList.contains('react-flow__attribution')) return false;
      if (node.classList.contains('react-flow__panel')) return false;
      return true;
    },
  });
  downloadDataUrl(`project-tree-${timestamp()}.png`, dataUrl);
}

export async function importJsonFile(file: File): Promise<{ nodes: CardNode[]; edges: CardEdge[] }> {
  const text = await file.text();
  const parsed = JSON.parse(text) as PersistedGraph;
  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
    throw new Error('Unrecognized JSON format');
  }
  return { nodes: parsed.nodes, edges: parsed.edges };
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}
