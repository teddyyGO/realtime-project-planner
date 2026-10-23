import type { Edge, Node } from 'reactflow';

export type BorderStyle = 'none' | 'thin' | 'thick';

export interface CardData {
  label: string;
  bgColor: string;
  textColor: string;
  textColorAuto: boolean;
  borderStyle: BorderStyle;
  [key: string]: unknown;
}

export type CardNode = Node<CardData>;
export type CardEdge = Edge;

export interface GraphState {
  nodes: CardNode[];
  edges: CardEdge[];
}

export interface PersistedGraph {
  version: 1;
  nodes: CardNode[];
  edges: CardEdge[];
}

export const PRESET_SWATCHES: { name: string; value: string }[] = [
  { name: 'White', value: '#ffffff' },
  { name: 'Light Gray', value: '#f3f4f6' },
  { name: 'Blue', value: '#dbeafe' },
  { name: 'Green', value: '#dcfce7' },
  { name: 'Amber', value: '#fef3c7' },
  { name: 'Red', value: '#fee2e2' },
  { name: 'Purple', value: '#ede9fe' },
];

export const DEFAULT_CARD_DATA: CardData = {
  label: 'New card',
  bgColor: '#ffffff',
  textColor: '#1f2937',
  textColorAuto: true,
  borderStyle: 'thin',
};

export const CARD_WIDTH = 180;
export const CARD_HEIGHT = 36;
export const GRID_SIZE = 8;
