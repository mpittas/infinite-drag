import * as THREE from "three";

export interface Card extends THREE.Mesh {
  material: THREE.MeshBasicMaterial; // Each card will have a unique material
  cardIndex?: number; // Make cardIndex optional in the interface
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
