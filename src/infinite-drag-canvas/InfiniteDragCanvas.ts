import * as THREE from "three";
import { gsap } from "gsap";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import type {
  Card,
  Vector2Like,
  GridConfig,
  UniqueCardDataItem,
} from "@/types/types";
import { WarpShader } from "./WarpShader";
import { CardRenderer } from "./CardRenderer";
import { VignetteShader } from "./VignetteShader";
import { projects } from "../data/projectData";

export class InfiniteDragCanvas {
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private container: HTMLElement;
  private composer!: EffectComposer;
  private warpPass!: ShaderPass;
  private vignettePass!: ShaderPass;

  private initialCameraZ!: number;
  private zoomedOutCameraZ!: number;

  private tileGridRoot = new THREE.Group();
  private gridCurrentOffset = new THREE.Vector2(0, 0);
  private gridTargetOffset = new THREE.Vector2(0, 0);
  private previousGridCurrentOffset = new THREE.Vector2(0, 0);
  private smoothingFactor = 0.4;

  private velocity: Vector2Like = { x: 0, y: 0 };
  private currentDampingFactor = 0.85;
  private minVelocity = 0.05;
  private dragMultiplier = 0.2;
  private currentMomentumDistanceMultiplier = 4.0;

  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private hoveredCard: Card | null = null;

  private images: Card[] = [];
  private gridConfig: GridConfig = {
    rows: 4,
    cols: 7,
    imageSize: 200,
    spacing: 0,
    gridWidth: 0,
    gridHeight: 0,
  };

  private isDragging = false;
  private previousMouse: Vector2Like = { x: 0, y: 0 };

  constructor(containerId: string) {
    const containerElement = document.getElementById(containerId);
    if (!containerElement) {
      throw new Error(`Container with id "${containerId}" not found.`);
    }
    this.container = containerElement;

    this.initScene();
    this.createCardGrid();
    this.setupEventListeners();
    this.animate();
  }

  private initScene(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a1a);

    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(70, aspect, 0.1, 1000);
    this.camera.position.set(0, 0, 400);

    this.initialCameraZ = this.camera.position.z;
    this.zoomedOutCameraZ = this.initialCameraZ * 1.25;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(
      this.container.clientWidth,
      this.container.clientHeight
    );
    this.container.appendChild(this.renderer.domElement);

    this.scene.add(this.tileGridRoot);

    this.initPostProcessing();
  }

  private initPostProcessing(): void {
    this.composer = new EffectComposer(this.renderer);

    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    // Add Vignette Pass
    this.vignettePass = new ShaderPass(VignetteShader);
    this.vignettePass.uniforms["aspectRatio"].value =
      this.container.clientWidth / this.container.clientHeight;
    this.composer.addPass(this.vignettePass);

    this.warpPass = new ShaderPass(WarpShader);
    this.warpPass.uniforms["aspectRatio"].value =
      this.container.clientWidth / this.container.clientHeight;
    this.warpPass.renderToScreen = true;
    this.composer.addPass(this.warpPass);
  }

  private createCardGrid(): void {
    const { rows, cols, imageSize } = this.gridConfig;
    const tileWidth = cols * imageSize;
    const tileHeight = rows * imageSize;

    this.images.forEach((image) => {
      if (image.geometry) image.geometry.dispose();
      if (image.material && image.material.map)
        (image.material.map as THREE.CanvasTexture).dispose();
      if (image.material) image.material.dispose();
    });
    this.images = [];
    while (this.tileGridRoot.children.length > 0) {
      this.tileGridRoot.remove(this.tileGridRoot.children[0]);
    }

    const uniqueCardData: UniqueCardDataItem[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cardIndex = r * cols + c;
        const x = c * imageSize - tileWidth / 2 + imageSize / 2;
        const y = tileHeight / 2 - r * imageSize - imageSize / 2;
        uniqueCardData.push({ localX: x, localY: y, cardIndex });
      }
    }

    for (let tileRow = -1; tileRow <= 1; tileRow++) {
      for (let tileCol = -1; tileCol <= 1; tileCol++) {
        const tileGroup = new THREE.Group();
        tileGroup.position.set(tileCol * tileWidth, -tileRow * tileHeight, 0);

        uniqueCardData.forEach((data) => {
          const project = projects[data.cardIndex % projects.length];
          if (!project) {
            console.warn(
              `No project data found for cardIndex ${data.cardIndex}`
            );
            return;
          }

          const texture = CardRenderer.createCardTexture(
            project,
            data.cardIndex,
            null
          );
          const material = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.DoubleSide,
            transparent: true,
          });
          const geometry = new THREE.PlaneGeometry(imageSize, imageSize);
          const cardClone = new THREE.Mesh(geometry, material) as Card;
          cardClone.cardIndex = data.cardIndex;
          cardClone.position.set(data.localX, data.localY, 0);

          tileGroup.add(cardClone);
          this.images.push(cardClone);
        });
        this.tileGridRoot.add(tileGroup);
      }
    }
  }

  private setupEventListeners(): void {
    this.container.addEventListener(
      "pointerdown",
      this.onPointerDown.bind(this)
    );
    this.container.addEventListener(
      "pointermove",
      this.onPointerMove.bind(this)
    );
    this.container.addEventListener("pointerup", this.onPointerUp.bind(this));
    this.container.addEventListener(
      "pointerleave",
      this.onPointerUp.bind(this)
    );
    this.container.addEventListener("pointermove", this.handleHover.bind(this));
    window.addEventListener("resize", this.onWindowResize.bind(this));
  }

  private onPointerDown(event: PointerEvent): void {
    this.isDragging = true;
    this.velocity = { x: 0, y: 0 };
    this.previousMouse.x = event.clientX;
    this.previousMouse.y = event.clientY;
    this.container.style.cursor = "grabbing";

    this.gridTargetOffset.copy(this.gridCurrentOffset);

    gsap.to(this.camera.position, {
      z: this.zoomedOutCameraZ,
      duration: 0.15,
      ease: "power2.out",
    });
  }

  private onPointerMove(event: PointerEvent): void {
    if (!this.isDragging) return;
    const rawDeltaX = event.clientX - this.previousMouse.x;
    const rawDeltaY = event.clientY - this.previousMouse.y;
    this.gridTargetOffset.x += rawDeltaX * this.dragMultiplier;
    this.gridTargetOffset.y -= rawDeltaY * this.dragMultiplier;
    this.velocity = { x: rawDeltaX, y: rawDeltaY };
    this.previousMouse.x = event.clientX;
    this.previousMouse.y = event.clientY;
  }

  private onPointerUp(): void {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.container.style.cursor = "grab";

    const releaseSpeed = Math.sqrt(
      this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y
    );
    const epsilonSpeed = 0.01; // Threshold for very slow movements
    const slowSpeedThreshold = 5.0; // Upper limit for a "slow" release
    const mediumSpeedThreshold = 20.0; // Upper limit for a "medium" release
    const fastSpeedThreshold = 50.0; // Upper limit for "fast" release, above is "very fast"

    const minCoastingDampingFactor = 0.9; // Increase damping overall for shorter coasts
    const slowSpeedDamping = 0.93;
    const mediumSpeedDamping = 0.95;
    const fastSpeedDamping = 0.95;

    if (releaseSpeed < epsilonSpeed) {
      this.currentDampingFactor = minCoastingDampingFactor;
    } else if (releaseSpeed < slowSpeedThreshold) {
      const range = slowSpeedThreshold - epsilonSpeed;
      const fraction = Math.max(
        0,
        Math.min(1, (releaseSpeed - epsilonSpeed) / range)
      );
      this.currentDampingFactor =
        minCoastingDampingFactor +
        fraction * (slowSpeedDamping - minCoastingDampingFactor);
    } else if (releaseSpeed < mediumSpeedThreshold) {
      const range = mediumSpeedThreshold - slowSpeedThreshold;
      const fraction = Math.max(
        0,
        Math.min(1, (releaseSpeed - slowSpeedThreshold) / range)
      );
      this.currentDampingFactor =
        slowSpeedDamping + fraction * (mediumSpeedDamping - slowSpeedDamping);
    } else if (releaseSpeed < fastSpeedThreshold) {
      const range = fastSpeedThreshold - mediumSpeedThreshold;
      const fraction = Math.max(
        0,
        Math.min(1, (releaseSpeed - mediumSpeedThreshold) / range)
      );
      this.currentDampingFactor =
        mediumSpeedDamping + fraction * (fastSpeedDamping - mediumSpeedDamping);
    } else {
      this.currentDampingFactor = fastSpeedDamping;
    }
    this.currentDampingFactor = Math.max(
      minCoastingDampingFactor,
      Math.min(this.currentDampingFactor, 0.99)
    );

    const lowSpeedMomentumMult = 2.0; // Reduce coast distance across the board
    const midSpeedMomentumMult = 1.2;
    const highSpeedMomentumMult = 0.8;

    if (releaseSpeed < epsilonSpeed) {
      this.currentMomentumDistanceMultiplier = lowSpeedMomentumMult;
    } else if (releaseSpeed < slowSpeedThreshold) {
      // 0.01 to 5.0
      const fraction =
        (releaseSpeed - epsilonSpeed) / (slowSpeedThreshold - epsilonSpeed);
      this.currentMomentumDistanceMultiplier =
        lowSpeedMomentumMult +
        fraction * (midSpeedMomentumMult - lowSpeedMomentumMult);
    } else if (releaseSpeed < mediumSpeedThreshold) {
      // 5.0 to 20.0
      const fraction =
        (releaseSpeed - slowSpeedThreshold) /
        (mediumSpeedThreshold - slowSpeedThreshold);
      this.currentMomentumDistanceMultiplier =
        midSpeedMomentumMult +
        fraction * (highSpeedMomentumMult - midSpeedMomentumMult);
    } else {
      // 20.0+
      this.currentMomentumDistanceMultiplier = highSpeedMomentumMult;
    }
    // Ensure a minimum sensible multiplier if needed, e.g., Math.max(1.0, this.currentMomentumDistanceMultiplier)

    gsap.to(this.camera.position, {
      z: this.initialCameraZ,
      duration: 0.35, // Reduced from 0.5 for faster zoom
      ease: "power2.out",
      onUpdate: () => {
        this.wrapCards();
      },
    });
  }

  private handleAxisWrapping(axis: "x" | "y", dimension: number): void {
    const rootPosition = this.tileGridRoot.position;
    const targetOffset = this.gridTargetOffset;
    const currentOffset = this.gridCurrentOffset;
    const prevOffset = this.previousGridCurrentOffset;

    if (rootPosition[axis] > dimension / 2) {
      rootPosition[axis] -= dimension;
      if (this.isDragging) {
        targetOffset[axis] -= dimension;
        currentOffset[axis] -= dimension;
        prevOffset[axis] -= dimension;
      }
    } else if (rootPosition[axis] < -dimension / 2) {
      rootPosition[axis] += dimension;
      if (this.isDragging) {
        targetOffset[axis] += dimension;
        currentOffset[axis] += dimension;
        prevOffset[axis] += dimension;
      }
    }
  }

  private wrapCards(): void {
    const { cols, rows, imageSize } = this.gridConfig;
    const tileWidth = cols * imageSize;
    const tileHeight = rows * imageSize;

    this.handleAxisWrapping("x", tileWidth);
    this.handleAxisWrapping("y", tileHeight);
  }

  private animate(): void {
    requestAnimationFrame(this.animate.bind(this));

    if (
      !this.isDragging &&
      (Math.abs(this.velocity.x) > this.minVelocity ||
        Math.abs(this.velocity.y) > this.minVelocity)
    ) {
      this.gridTargetOffset.x +=
        this.velocity.x * this.currentMomentumDistanceMultiplier;
      this.gridTargetOffset.y -=
        this.velocity.y * this.currentMomentumDistanceMultiplier;

      this.velocity.x *= this.currentDampingFactor;
      this.velocity.y *= this.currentDampingFactor;

      if (Math.abs(this.velocity.x) <= this.minVelocity) this.velocity.x = 0;
      if (Math.abs(this.velocity.y) <= this.minVelocity) this.velocity.y = 0;
    }

    let currentActiveSmoothingFactor = this.smoothingFactor;

    if (this.isDragging) {
      const currentDragSpeed = Math.sqrt(
        this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y
      );

      const fastDragThreshold = 25;
      const highSpeedSmoothingFactor = 0.6;

      if (currentDragSpeed > fastDragThreshold) {
        currentActiveSmoothingFactor = highSpeedSmoothingFactor;
      }
    }

    this.gridCurrentOffset.lerp(
      this.gridTargetOffset,
      currentActiveSmoothingFactor
    );

    const deltaMoveX =
      this.gridCurrentOffset.x - this.previousGridCurrentOffset.x;
    const deltaMoveY =
      this.gridCurrentOffset.y - this.previousGridCurrentOffset.y;

    if (Math.abs(deltaMoveX) > 0.001 || Math.abs(deltaMoveY) > 0.001) {
      this.tileGridRoot.position.x += deltaMoveX;
      this.tileGridRoot.position.y += deltaMoveY;
    }
    this.previousGridCurrentOffset.copy(this.gridCurrentOffset);

    this.wrapCards();
    this.composer.render();
  }

  private onWindowResize(): void {
    const newWidth = this.container.clientWidth;
    const newHeight = this.container.clientHeight;

    this.camera.aspect = newWidth / newHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(newWidth, newHeight);
    this.composer.setSize(newWidth, newHeight);

    if (this.warpPass) {
      this.warpPass.uniforms["aspectRatio"].value = newWidth / newHeight;
    }
    if (this.vignettePass) {
      this.vignettePass.uniforms["aspectRatio"].value = newWidth / newHeight;
    }
  }

  private updateCardTexture(
    card: Card | null,
    backgroundColor: string | null
  ): void {
    if (card && card.cardIndex !== undefined) {
      const project = projects[card.cardIndex % projects.length];
      if (!project) {
        console.warn(
          `No project data for hover on cardIndex ${card.cardIndex}`
        );
        return;
      }
      const texture = CardRenderer.createCardTexture(
        project,
        card.cardIndex,
        backgroundColor
      );
      if (card.material.map) {
        (card.material.map as THREE.CanvasTexture).dispose();
      }
      card.material.map = texture;
      card.material.needsUpdate = true;
    }
  }

  private handleHover(event: PointerEvent): void {
    if (this.isDragging) {
      if (this.hoveredCard) {
        this.updateCardTexture(this.hoveredCard, null);
        this.hoveredCard = null;
      }
      return;
    }

    this.mouse.x = (event.clientX / this.container.clientWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / this.container.clientHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.images, false);

    let newHoveredCard: Card | null = null;
    if (intersects.length > 0) {
      const firstIntersect = intersects[0].object as Card;
      if (firstIntersect.isMesh && firstIntersect.cardIndex !== undefined) {
        newHoveredCard = firstIntersect;
      } else if (
        firstIntersect.parent &&
        (firstIntersect.parent as Card).cardIndex !== undefined
      ) {
        newHoveredCard = firstIntersect.parent as Card;
      }
    }

    if (this.hoveredCard !== newHoveredCard) {
      if (this.hoveredCard) {
        this.updateCardTexture(this.hoveredCard, null);
      }

      this.hoveredCard = newHoveredCard;

      if (this.hoveredCard) {
        this.updateCardTexture(this.hoveredCard, "#111");
      }
    }
  }

  // Public method to clean up resources if the canvas is destroyed
  public dispose(): void {
    window.removeEventListener("resize", this.onWindowResize.bind(this));
    this.container.removeEventListener(
      "pointerdown",
      this.onPointerDown.bind(this)
    );
    this.container.removeEventListener(
      "pointermove",
      this.onPointerMove.bind(this)
    );
    this.container.removeEventListener(
      "pointerup",
      this.onPointerUp.bind(this)
    );
    this.container.removeEventListener(
      "pointerleave",
      this.onPointerUp.bind(this)
    );

    this.images.forEach((image) => {
      if (image.geometry) image.geometry.dispose();

      // Type guard for material and map disposal
      const disposeMaterial = (material: THREE.Material | THREE.Material[]) => {
        if (Array.isArray(material)) {
          material.forEach((mat) => {
            const basicMat = mat as THREE.MeshBasicMaterial;
            if (basicMat.map) basicMat.map.dispose(); // CanvasTexture also has dispose
            basicMat.dispose();
          });
        } else {
          const basicMat = material as THREE.MeshBasicMaterial;
          if (basicMat.map) basicMat.map.dispose(); // CanvasTexture also has dispose
          basicMat.dispose();
        }
      };

      if (image.material) {
        disposeMaterial(image.material);
      }

      this.scene.remove(image);
    });
    this.images = [];

    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement.parentElement) {
        this.renderer.domElement.parentElement.removeChild(
          this.renderer.domElement
        );
      }
    }
  }
}
