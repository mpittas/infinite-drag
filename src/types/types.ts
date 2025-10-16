import * as THREE from "three";

export interface Card extends THREE.Mesh {
  material: THREE.MeshBasicMaterial;
  cardIndex?: number;
}

export interface Vector2Like {
  x: number;
  y: number;
}

export interface GridConfig {
  rows: number;
  cols: number;
  imageSize: number;
  spacing: number;
  gridWidth: number;
  gridHeight: number;
}

export interface UniqueCardDataItem {
  localX: number;
  localY: number;
  cardIndex: number;
}

export interface Project {
  id: string; // Or number
  title: string;
  categories: string[];
  imageUrl?: string; // Optional for now, for future image loading
  description?: string; // Optional
}
