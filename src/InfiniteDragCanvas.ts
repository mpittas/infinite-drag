import * as THREE from "three";
import { gsap } from "gsap"; // Import GSAP
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

interface Card extends THREE.Mesh {
  material: THREE.MeshBasicMaterial; // Each card will have a unique material
  cardIndex?: number; // Make cardIndex optional in the interface
}

// Define the Warp Shader directly in the file
const WarpShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    strength: { value: -0.05 }, // Reduced from -0.15 for smaller warping effect
    aspectRatio: { value: 1.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float strength; // k1 in lens distortion
    uniform float aspectRatio;
    varying vec2 vUv;

    void main() {
      vec2 p = vUv * 2.0 - 1.0; // Normalize to -1.0 to 1.0 screen space coordinates

      // Adjust coordinates to make the space isotropic (circular) before distortion
      vec2 pAspectCorrected = p;
      if (aspectRatio > 1.0) { // Landscape: scale down y
          pAspectCorrected.y *= aspectRatio;
      } else { // Portrait or Square: scale down x
          pAspectCorrected.x /= aspectRatio;
      }

      // Calculate squared radial distance in this isotropic space
      float r2 = dot(pAspectCorrected, pAspectCorrected);
      
      // Apply radial distortion: p_d = p * (1 + strength * r^2)
      // The distortion is applied to the coordinates in the isotropic space
      vec2 pDistortedIsotropic = pAspectCorrected * (1.0 + strength * r2);

      // Convert distorted coordinates back to original screen aspect ratio
      vec2 pDistortedScreen = pDistortedIsotropic;
      if (aspectRatio > 1.0) { // Landscape: unscale y
          pDistortedScreen.y /= aspectRatio;
      } else { // Portrait or Square: unscale x
          pDistortedScreen.x *= aspectRatio;
      }

      // Convert back to 0.0 to 1.0 UV range for texture sampling
      vec2 distortedUv = pDistortedScreen * 0.5 + 0.5;

      // Clamp or discard if UVs are out of bounds
      if (distortedUv.x < 0.0 || distortedUv.x > 1.0 || distortedUv.y < 0.0 || distortedUv.y > 1.0) {
         // Option 1: Discard (transparent) - useful if background is visible behind composer
         // gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
         // Option 2: Clamp to edge (effectively done by texture2D default, but can be explicit)
         // distortedUv = clamp(distortedUv, vec2(0.0), vec2(1.0));
         // gl_FragColor = texture2D(tDiffuse, distortedUv);
         // Option 3: Show a debug color or the scene background color if desired
         gl_FragColor = vec4(0.0,0.0,0.0,1.0); // Render black for out-of-bounds (matches dark theme)
      } else {
         gl_FragColor = texture2D(tDiffuse, distortedUv);
      }
    }`,
};

export class InfiniteDragCanvas {
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private container: HTMLElement;
  private composer!: EffectComposer;
  private warpPass!: ShaderPass;

  private initialCameraZ!: number;
  private zoomedOutCameraZ!: number;

  private gridCurrentOffset = new THREE.Vector2(0, 0);
  private gridTargetOffset = new THREE.Vector2(0, 0);
  private previousGridCurrentOffset = new THREE.Vector2(0, 0);
  private smoothingFactor = 0.15; // Adjust for more (0.1) or less (0.3) smoothing

  private velocity = { x: 0, y: 0 };
  private dampingFactor = 0.85; // Increased from 0.9 for more sustained momentum
  private minVelocity = 0.1;
  private dragMultiplier = 1.35; // Increased from 1 for faster dragging

  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private hoveredCard: Card | null = null;

  private images: Card[] = [];
  private gridConfig = {
    rows: 7,
    cols: 13,
    imageSize: 200,
    spacing: 0, // No space between items
    gridWidth: 0,
    gridHeight: 0,
  };

  private isDragging = false;
  private previousMouse = { x: 0, y: 0 };

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
    this.camera = new THREE.PerspectiveCamera(90, aspect, 0.1, 1000);
    this.camera.position.set(0, 0, 300); // Initial Z position

    this.initialCameraZ = this.camera.position.z;
    this.zoomedOutCameraZ = this.initialCameraZ * 1.25; // Reduced from 1.5 to zoom out less

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(
      this.container.clientWidth,
      this.container.clientHeight
    );
    this.container.appendChild(this.renderer.domElement);

    // Initialize Post-Processing
    this.initPostProcessing();
  }

  private initPostProcessing(): void {
    this.composer = new EffectComposer(this.renderer);

    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    this.warpPass = new ShaderPass(WarpShader);
    this.warpPass.uniforms["aspectRatio"].value =
      this.container.clientWidth / this.container.clientHeight;
    this.warpPass.renderToScreen = true; // Ensure this is the last pass that renders to screen
    this.composer.addPass(this.warpPass);
  }

  private createCardTexture(
    cardIndex: number,
    backgroundColor: string | null
  ): THREE.CanvasTexture {
    const baseTextCanvasSize = 256;
    const dpr = window.devicePixelRatio || 1;
    const actualCanvasSize = baseTextCanvasSize * dpr;

    const canvas = document.createElement("canvas");
    canvas.width = actualCanvasSize;
    canvas.height = actualCanvasSize;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      console.error("Failed to get 2D context for card texture generation.");
      // Return a fallback texture or throw error
      return new THREE.CanvasTexture(document.createElement("canvas"));
    }

    ctx.scale(dpr, dpr);

    if (backgroundColor) {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, baseTextCanvasSize, baseTextCanvasSize);
    } else {
      ctx.clearRect(0, 0, baseTextCanvasSize, baseTextCanvasSize); // Transparent background
    }

    ctx.strokeStyle = "#555555";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, baseTextCanvasSize - 1, baseTextCanvasSize - 1);

    ctx.fillStyle = "#cccccc";
    const fontSize = baseTextCanvasSize / 5;
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      cardIndex.toString(),
      baseTextCanvasSize / 2,
      baseTextCanvasSize / 2
    );

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  private createCardGrid(): void {
    const { rows, cols, imageSize } = this.gridConfig;
    this.gridConfig.gridWidth = cols * imageSize;
    this.gridConfig.gridHeight = rows * imageSize;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cardIndexValue = row * cols + col;

        // Pass cardIndexValue which is a number
        const initialTexture = this.createCardTexture(cardIndexValue, null);

        const material = new THREE.MeshBasicMaterial({
          map: initialTexture,
          side: THREE.DoubleSide,
          transparent: true,
        });
        const geometry = new THREE.PlaneGeometry(imageSize, imageSize);
        const imageMesh = new THREE.Mesh(geometry, material) as Card; // Cast is now more acceptable

        imageMesh.cardIndex = cardIndexValue; // Assign the definite number

        const x =
          col * imageSize - this.gridConfig.gridWidth / 2 + imageSize / 2;
        const y =
          this.gridConfig.gridHeight / 2 - row * imageSize - imageSize / 2;

        imageMesh.position.set(x, y, 0);
        this.scene.add(imageMesh);
        this.images.push(imageMesh);
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

    // Update target offset based on mouse movement and multiplier
    this.gridTargetOffset.x += rawDeltaX * this.dragMultiplier;
    this.gridTargetOffset.y -= rawDeltaY * this.dragMultiplier; // Y-axis inverted for world space

    // Store raw velocity for momentum
    this.velocity = { x: rawDeltaX, y: rawDeltaY };

    this.previousMouse.x = event.clientX;
    this.previousMouse.y = event.clientY;
  }

  private onPointerUp(): void {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.container.style.cursor = "grab";

    // Keep the last velocity for momentum, but don't apply it here directly.
    // The animate loop will handle the momentum from this.velocity.

    // Zoom in camera to initial position
    gsap.to(this.camera.position, {
      z: this.initialCameraZ,
      duration: 0.25, // Reduced from 0.5 for faster zoom
      ease: "power2.out",
      onUpdate: () => {
        // Ensure wrapping logic keeps up during zoom animation
        this.wrapCards();
      },
    });
  }

  private wrapCards(): void {
    const { imageSize, rows, cols } = this.gridConfig;
    // Since spacing is 0, totalGridWidth is cols * imageSize
    const totalGridWidth = cols * imageSize;
    const totalGridHeight = rows * imageSize;

    // Calculate visible frustum height and width at z=0 plane
    // This gives us the boundaries of what the camera can see at the cards' depth
    const vFOV = THREE.MathUtils.degToRad(this.camera.fov);
    const visibleHeightAtZ = 2 * Math.tan(vFOV / 2) * this.camera.position.z;
    const visibleWidthAtZ = visibleHeightAtZ * this.camera.aspect;

    const halfVisibleWidth = visibleWidthAtZ / 2;
    const halfVisibleHeight = visibleHeightAtZ / 2;

    this.images.forEach((image) => {
      // Check if the card's left edge is beyond the right screen edge
      if (image.position.x - imageSize / 2 > halfVisibleWidth) {
        image.position.x -= totalGridWidth;
      }
      // Check if the card's right edge is beyond the left screen edge
      else if (image.position.x + imageSize / 2 < -halfVisibleWidth) {
        image.position.x += totalGridWidth;
      }

      // Check if the card's bottom edge is beyond the top screen edge
      if (image.position.y - imageSize / 2 > halfVisibleHeight) {
        image.position.y -= totalGridHeight;
      }
      // Check if the card's top edge is beyond the bottom screen edge
      else if (image.position.y + imageSize / 2 < -halfVisibleHeight) {
        image.position.y += totalGridHeight;
      }
    });
  }

  private animate(): void {
    requestAnimationFrame(this.animate.bind(this));

    if (
      !this.isDragging &&
      (Math.abs(this.velocity.x) > this.minVelocity ||
        Math.abs(this.velocity.y) > this.minVelocity)
    ) {
      // Apply momentum by continuing to move the target offset
      this.gridTargetOffset.x += this.velocity.x * this.dragMultiplier; // Momentum uses multiplier too for consistency
      this.gridTargetOffset.y -= this.velocity.y * this.dragMultiplier;

      this.velocity.x *= this.dampingFactor;
      this.velocity.y *= this.dampingFactor;

      if (Math.abs(this.velocity.x) <= this.minVelocity) this.velocity.x = 0;
      if (Math.abs(this.velocity.y) <= this.minVelocity) this.velocity.y = 0;
    }

    // Lerp current offset towards target offset
    this.gridCurrentOffset.lerp(this.gridTargetOffset, this.smoothingFactor);

    // Calculate the actual delta to move cards this frame
    const deltaMoveX =
      this.gridCurrentOffset.x - this.previousGridCurrentOffset.x;
    const deltaMoveY =
      this.gridCurrentOffset.y - this.previousGridCurrentOffset.y;

    // Apply this delta to all images
    if (Math.abs(deltaMoveX) > 0.001 || Math.abs(deltaMoveY) > 0.001) {
      // Avoid tiny movements
      this.images.forEach((image) => {
        image.position.x += deltaMoveX;
        image.position.y += deltaMoveY;
      });
    }

    // Update previous offset for next frame
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
    this.composer.setSize(newWidth, newHeight); // Resize composer

    if (this.warpPass) {
      // Update shader aspect ratio
      this.warpPass.uniforms["aspectRatio"].value = newWidth / newHeight;
    }
  }

  private handleHover(event: PointerEvent): void {
    if (this.isDragging) {
      if (this.hoveredCard && this.hoveredCard.cardIndex !== undefined) {
        // Check cardIndex exists
        const originalTexture = this.createCardTexture(
          this.hoveredCard.cardIndex!,
          null
        ); // Use non-null assertion
        if (this.hoveredCard.material.map) {
          (this.hoveredCard.material.map as THREE.CanvasTexture).dispose();
        }
        this.hoveredCard.material.map = originalTexture;
        this.hoveredCard.material.needsUpdate = true;
        this.hoveredCard = null;
      }
      return;
    }

    this.mouse.x = (event.clientX / this.container.clientWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / this.container.clientHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.images, false);

    if (intersects.length > 0) {
      const firstIntersect = intersects[0].object;
      if ((firstIntersect as Card).cardIndex !== undefined) {
        const newlyHoveredObject = firstIntersect as Card;
        if (this.hoveredCard !== newlyHoveredObject) {
          if (this.hoveredCard && this.hoveredCard.cardIndex !== undefined) {
            const originalTexture = this.createCardTexture(
              this.hoveredCard.cardIndex!,
              null
            );
            if (this.hoveredCard.material.map) {
              (this.hoveredCard.material.map as THREE.CanvasTexture).dispose();
            }
            this.hoveredCard.material.map = originalTexture;
            this.hoveredCard.material.needsUpdate = true;
          }

          this.hoveredCard = newlyHoveredObject;
          // newlyHoveredObject.cardIndex will be defined here due to the outer check
          const hoveredTexture = this.createCardTexture(
            this.hoveredCard.cardIndex!,
            "#111"
          );
          if (this.hoveredCard.material.map) {
            (this.hoveredCard.material.map as THREE.CanvasTexture).dispose();
          }
          this.hoveredCard.material.map = hoveredTexture;
          this.hoveredCard.material.needsUpdate = true;
        }
      } else {
        if (this.hoveredCard && this.hoveredCard.cardIndex !== undefined) {
          const originalTexture = this.createCardTexture(
            this.hoveredCard.cardIndex!,
            null
          );
          if (this.hoveredCard.material.map) {
            (this.hoveredCard.material.map as THREE.CanvasTexture).dispose();
          }
          this.hoveredCard.material.map = originalTexture;
          this.hoveredCard.material.needsUpdate = true;
          this.hoveredCard = null;
        }
      }
    } else {
      if (this.hoveredCard && this.hoveredCard.cardIndex !== undefined) {
        const originalTexture = this.createCardTexture(
          this.hoveredCard.cardIndex!,
          null
        );
        if (this.hoveredCard.material.map) {
          (this.hoveredCard.material.map as THREE.CanvasTexture).dispose();
        }
        this.hoveredCard.material.map = originalTexture;
        this.hoveredCard.material.needsUpdate = true;
        this.hoveredCard = null;
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
