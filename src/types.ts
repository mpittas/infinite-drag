import * as THREE from "three";

export interface Card extends THREE.Mesh {
  material: THREE.MeshBasicMaterial; // Each card will have a unique material
  cardIndex?: number; // Make cardIndex optional in the interface
}
