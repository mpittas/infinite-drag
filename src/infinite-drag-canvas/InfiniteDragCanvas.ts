import * as THREE from "three";
import { gsap } from "gsap"; // Import GSAP
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import type {
  Card,
  Vector2Like,
  GridConfig,
  UniqueCardDataItem,
  // Project, // Removed as it's no longer directly used here
} from "@/types/types";
import { WarpShader } from "./WarpShader"; // Import WarpShader
import { CardRenderer } from "./CardRenderer"; // Import the new CardRenderer
import { VignetteShader } from "./VignetteShader"; // Import VignetteShader
import { projects } from "../data/projectData"; // Import projects from the new file

// Card interface removed (now in ./types)
// WarpShader object removed (now in ./WarpShader)

export class InfiniteDragCanvas {
  // private projects: Project[] = [ ... ]; // This line will be removed

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private container: HTMLElement;
  private composer!: EffectComposer;
  private warpPass!: ShaderPass;
  private vignettePass!: ShaderPass; // Add VignettePass property

  private initialCameraZ!: number;
  private zoomedOutCameraZ!: number;

  private tileGridRoot = new THREE.Group(); // This will hold all 9 tiles and be moved
  private gridCurrentOffset = new THREE.Vector2(0, 0); // Controls tileGridRoot.position
  private gridTargetOffset = new THREE.Vector2(0, 0); // Target for tileGridRoot.position
  private previousGridCurrentOffset = new THREE.Vector2(0, 0); // For calculating delta move of tileGridRoot
  private smoothingFactor = 0.5;

  private velocity: Vector2Like = { x: 0, y: 0 };
  private currentDampingFactor = 0.85; // Dynamically adjusted damping for momentum
  private minVelocity = 0.05;
  private dragMultiplier = 0.5; // User set, was 2.0, then 1.35
  private currentMomentumDistanceMultiplier = 4.0; // Dynamically set in onPointerUp

  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private hoveredCard: Card | null = null;

  private images: Card[] = []; // Will store all 252 cloned card meshes
  private gridConfig: GridConfig = {
    rows: 4,
    cols: 7,
    imageSize: 200,
    spacing: 0, // No space between items
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
    this.scene.background = new THREE.Color(0x1a1a1a); // Dark gray background

    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(70, aspect, 0.1, 1000);
    this.camera.position.set(0, 0, 400); // Reduced Z to show fewer columns

    this.initialCameraZ = this.camera.position.z;
    this.zoomedOutCameraZ = this.initialCameraZ * 1.25; // Reduced from 1.5 to zoom out less

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(
      this.container.clientWidth,
      this.container.clientHeight
    );
    this.container.appendChild(this.renderer.domElement);

    this.scene.add(this.tileGridRoot); // Add the main root for tiles to the scene

    // Initialize Post-Processing
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
    // this.vignettePass.renderToScreen = false; // Default, ensure it doesn't override warpPass
    this.composer.addPass(this.vignettePass);

    this.warpPass = new ShaderPass(WarpShader);
    this.warpPass.uniforms["aspectRatio"].value =
      this.container.clientWidth / this.container.clientHeight;
    this.warpPass.renderToScreen = true; // Ensure this is the last pass that renders to screen
    this.composer.addPass(this.warpPass);
  }

  private createCardGrid(): void {
    const { rows, cols, imageSize } = this.gridConfig;
    const tileWidth = cols * imageSize;
    const tileHeight = rows * imageSize;

    // Clear previous images if any (e.g., on a hot reload or recreation)
    this.images.forEach((image) => {
      if (image.geometry) image.geometry.dispose();
      if (image.material && image.material.map)
        (image.material.map as THREE.CanvasTexture).dispose();
      if (image.material) image.material.dispose();
      // this.scene.remove(image); // Cards are now added to tileGroups, then tileGridRoot
    });
    this.images = [];
    while (this.tileGridRoot.children.length > 0) {
      this.tileGridRoot.remove(this.tileGridRoot.children[0]);
    }

    // Define the 28 unique cards' local positions once
    const uniqueCardData: UniqueCardDataItem[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cardIndex = r * cols + c;
        const x = c * imageSize - tileWidth / 2 + imageSize / 2;
        const y = tileHeight / 2 - r * imageSize - imageSize / 2;
        uniqueCardData.push({ localX: x, localY: y, cardIndex });
      }
    }

    // Create a 3x3 grid of tiles
    for (let tileRow = -1; tileRow <= 1; tileRow++) {
      // -1 (top), 0 (middle), 1 (bottom)
      for (let tileCol = -1; tileCol <= 1; tileCol++) {
        // -1 (left), 0 (center), 1 (right)
        const tileGroup = new THREE.Group();
        tileGroup.position.set(tileCol * tileWidth, -tileRow * tileHeight, 0); // Note: -tileRow for Y up

        uniqueCardData.forEach((data) => {
          // Get the project for the current card index, cycling through the projects array
          const project = projects[data.cardIndex % projects.length];
          if (!project) {
            console.warn(
              `No project data found for cardIndex ${data.cardIndex}`
            );
            // Potentially use a default placeholder project or skip
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

          // Create and add overlay mesh
          const overlayGeo = new THREE.PlaneGeometry(
            this.gridConfig.imageSize * 0.7, // Match image placeholder width
            this.gridConfig.imageSize * 0.7 * (9 / 16) // Match image placeholder height (16:9)
          );
          const overlayMat = new THREE.MeshBasicMaterial({
            color: 0x000000,
            opacity: 0.3,
            transparent: true,
          });
          const overlayMesh = new THREE.Mesh(overlayGeo, overlayMat);

          // Calculate the Y offset for the overlay to match the image placeholder's position on the texture
          // Values from CardRenderer.ts (or should be passed/derived if dynamic):
          const baseTextCanvasSize_renderer = 160 * 1.75; // From CardRenderer
          const padding_renderer = baseTextCanvasSize_renderer * 0.06;
          const imagePlaceholderWidth_tex = baseTextCanvasSize_renderer * 0.7;
          const imagePlaceholderHeight_tex =
            imagePlaceholderWidth_tex * (9 / 16);
          const imageY_tex_top =
            (baseTextCanvasSize_renderer - imagePlaceholderHeight_tex) / 2.5 +
            padding_renderer * 0.5;
          const placeholderCenterY_tex =
            imageY_tex_top + imagePlaceholderHeight_tex / 2;
          const textureCenterY_tex = baseTextCanvasSize_renderer / 2;
          const offsetY_tex_from_center =
            placeholderCenterY_tex - textureCenterY_tex; // -ve if placeholder is above center
          const scaleFactor =
            this.gridConfig.imageSize / baseTextCanvasSize_renderer;
          const overlayYOffset_world = -offsetY_tex_from_center * scaleFactor; // Apply inverse for 3D Y-up

          overlayMesh.position.set(0, overlayYOffset_world, 0.1);
          cardClone.add(overlayMesh);
          cardClone.overlayMaterial = overlayMat; // Store reference to the material

          tileGroup.add(cardClone);
          this.images.push(cardClone); // For raycasting all visible cards
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
    ); // Stop dragging if pointer leaves container
    // Add new listener for hover effects if not dragging (also on pointermove)
    this.container.addEventListener("pointermove", this.handleHover.bind(this));
    window.addEventListener("resize", this.onWindowResize.bind(this));
  }

  private onPointerDown(event: PointerEvent): void {
    this.isDragging = true;
    this.velocity = { x: 0, y: 0 };
    this.previousMouse.x = event.clientX;
    this.previousMouse.y = event.clientY;
    this.container.style.cursor = "grabbing";

    // Snap target to current to avoid jump if a previous momentum was ongoing
    this.gridTargetOffset.copy(this.gridCurrentOffset);

    // Zoom out camera
    gsap.to(this.camera.position, {
      z: this.zoomedOutCameraZ,
      duration: 0.15, // Reduced from 0.5 for faster zoom
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

    // --- Damping Factor Logic (controls duration of coast) ---
    const epsilonSpeed = 0.01; // Threshold for very slow movements
    const slowSpeedThreshold = 5.0; // Upper limit for a "slow" release
    const mediumSpeedThreshold = 20.0; // Upper limit for a "medium" release
    const fastSpeedThreshold = 50.0; // Upper limit for "fast" release, above is "very fast"

    const minCoastingDampingFactor = 0.92;
    const slowSpeedDamping = 0.94;
    const mediumSpeedDamping = 0.96;
    const fastSpeedDamping = 0.96; // Kept from previous adjustment

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

    // --- Momentum Distance Multiplier Logic (controls speed/distance of coast) ---
    const lowSpeedMomentumMult = 4.0;
    const midSpeedMomentumMult = 3.0;
    const highSpeedMomentumMult = 2.0;

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
        // Ensure wrapping logic keeps up during zoom animation
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

    // Momentum logic for when not dragging
    if (
      !this.isDragging &&
      (Math.abs(this.velocity.x) > this.minVelocity ||
        Math.abs(this.velocity.y) > this.minVelocity)
    ) {
      this.gridTargetOffset.x +=
        this.velocity.x * this.currentMomentumDistanceMultiplier;
      this.gridTargetOffset.y -=
        this.velocity.y * this.currentMomentumDistanceMultiplier;

      // Use the dynamically calculated damping factor
      this.velocity.x *= this.currentDampingFactor;
      this.velocity.y *= this.currentDampingFactor;

      if (Math.abs(this.velocity.x) <= this.minVelocity) this.velocity.x = 0;
      if (Math.abs(this.velocity.y) <= this.minVelocity) this.velocity.y = 0;
    }

    // Determine smoothing factor (adaptive if dragging fast)
    let currentActiveSmoothingFactor = this.smoothingFactor; // Base smoothing factor (user set to 0.5)

    if (this.isDragging) {
      // this.velocity stores the {rawDeltaX, rawDeltaY} from the last onPointerMove event
      const currentDragSpeed = Math.sqrt(
        this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y
      );

      const fastDragThreshold = 25; // Pixels per pointer event for a "fast" drag
      const highSpeedSmoothingFactor = 0.75; // More responsive smoothing for fast drags

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

    // Move the entire tileGridRoot
    if (Math.abs(deltaMoveX) > 0.001 || Math.abs(deltaMoveY) > 0.001) {
      this.tileGridRoot.position.x += deltaMoveX;
      this.tileGridRoot.position.y += deltaMoveY;
    }
    this.previousGridCurrentOffset.copy(this.gridCurrentOffset);

    this.wrapCards(); // This now wraps tileGridRoot.position
    this.composer.render();
  }

  private onWindowResize(): void {
    const newWidth = this.container.clientWidth;
    const newHeight = this.container.clientHeight;

    this.camera.aspect = newWidth / newHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(newWidth, newHeight);
    this.composer.setSize(newWidth, newHeight); // Resize composer

    if (this.warpPass) {
      // Update shader aspect ratio
      this.warpPass.uniforms["aspectRatio"].value = newWidth / newHeight;
    }
    if (this.vignettePass) {
      // Update vignette shader aspect ratio
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
      if (this.hoveredCard && this.hoveredCard.overlayMaterial) {
        gsap.to(this.hoveredCard.overlayMaterial, {
          opacity: 0.3,
          duration: 0.1,
        }); // Reset quickly
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
      // Check if it's a main card (not an overlay mesh if overlays were also in intersectObjects)
      if (firstIntersect.isMesh && firstIntersect.cardIndex !== undefined) {
        newHoveredCard = firstIntersect;
      } else if (
        firstIntersect.parent &&
        (firstIntersect.parent as Card).cardIndex !== undefined
      ) {
        // If we intersected an overlay, get its parent card
        newHoveredCard = firstIntersect.parent as Card;
      }
    }

    if (this.hoveredCard !== newHoveredCard) {
      // Unhover previous card
      if (this.hoveredCard) {
        this.updateCardTexture(this.hoveredCard, null);
        if (this.hoveredCard.overlayMaterial) {
          gsap.to(this.hoveredCard.overlayMaterial, {
            opacity: 0.3,
            duration: 0.3,
          });
        }
      }
      // Hover new card
      this.hoveredCard = newHoveredCard;
      if (this.hoveredCard) {
        this.updateCardTexture(this.hoveredCard, "#111");
        if (this.hoveredCard.overlayMaterial) {
          gsap.to(this.hoveredCard.overlayMaterial, {
            opacity: 0.0,
            duration: 0.3,
          });
        }
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
    // Note: EffectComposer and ShaderPass don't have explicit dispose methods in the same way as materials/geometries.
    // The main thing is to stop rendering them and allow GC to collect if they are no longer referenced.
    // If ShaderPass creates internal textures or framebuffers not managed by EffectComposer, they might need disposal.
    // However, for standard ShaderPass usage, this is generally handled.
  }
}
