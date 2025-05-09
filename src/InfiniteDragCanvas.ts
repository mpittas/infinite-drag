import * as THREE from "three";
import { gsap } from "gsap"; // Import GSAP
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

interface Card extends THREE.Mesh {
  material: THREE.MeshBasicMaterial; // Each card will have a unique material
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
    this.zoomedOutCameraZ = this.initialCameraZ * 1.5; // Zoom out by 50%

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

  private createCardGrid(): void {
    const { rows, cols, imageSize, spacing } = this.gridConfig;
    this.gridConfig.gridWidth = cols * (imageSize + spacing) - spacing;
    this.gridConfig.gridHeight = rows * (imageSize + spacing) - spacing;

    const baseTextCanvasSize = 256; // Increased base size for the texture canvas

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cardIndex = row * cols + col;

        // Create an offscreen canvas for the texture
        // const dpr = window.devicePixelRatio || 1; // Removed DPR scaling for canvas dimensions
        const actualCanvasSize = baseTextCanvasSize; // Canvas dimensions will be baseTextCanvasSize

        const canvas = document.createElement("canvas");
        canvas.width = actualCanvasSize;
        canvas.height = actualCanvasSize;

        const ctx = canvas.getContext("2d");

        if (!ctx) {
          console.error("Failed to get 2D context for card texture");
          continue;
        }

        // Scale the context to draw with logical pixel sizes
        // ctx.scale(dpr, dpr); // Removed DPR scaling for drawing context

        // Transparent background for the card texture area
        ctx.clearRect(0, 0, baseTextCanvasSize, baseTextCanvasSize);

        // Draw 1px border (logical pixels)
        ctx.strokeStyle = "#555555";
        ctx.lineWidth = 1; // This will be 1 logical pixel, scaled by DPR to be crisp
        ctx.strokeRect(
          0.5,
          0.5,
          baseTextCanvasSize - 1,
          baseTextCanvasSize - 1
        );

        // Add card index number (light color)
        ctx.fillStyle = "#cccccc";
        // Font size is in logical pixels, will be scaled by DPR
        const fontSize = baseTextCanvasSize / 5; // Adjusted font size relative to canvas
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          cardIndex.toString(),
          baseTextCanvasSize / 2,
          baseTextCanvasSize / 2
        );

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true; // Ensure texture updates

        const material = new THREE.MeshBasicMaterial({
          map: texture,
          side: THREE.DoubleSide,
        });
        const geometry = new THREE.PlaneGeometry(imageSize, imageSize);

        const imageMesh = new THREE.Mesh(geometry, material) as Card;

        const x =
          col * (imageSize + spacing) -
          this.gridConfig.gridWidth / 2 +
          imageSize / 2;
        const y =
          this.gridConfig.gridHeight / 2 -
          row * (imageSize + spacing) -
          imageSize / 2;

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
    window.addEventListener("resize", this.onWindowResize.bind(this));
  }

  private onPointerDown(event: PointerEvent): void {
    this.isDragging = true;
    this.previousMouse.x = event.clientX;
    this.previousMouse.y = event.clientY;
    this.container.style.cursor = "grabbing";

    // Zoom out camera
    gsap.to(this.camera.position, {
      z: this.zoomedOutCameraZ,
      duration: 0.5, // Adjust duration as needed
      ease: "power2.out", // Adjust ease as needed
    });
  }

  private onPointerMove(event: PointerEvent): void {
    if (!this.isDragging) return;

    const deltaX = event.clientX - this.previousMouse.x;
    const deltaY = event.clientY - this.previousMouse.y;

    this.images.forEach((image) => {
      image.position.x += deltaX;
      image.position.y -= deltaY; // Screen Y is inverted relative to Three.js Y
    });

    this.previousMouse.x = event.clientX;
    this.previousMouse.y = event.clientY;
  }

  private onPointerUp(): void {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.container.style.cursor = "grab";

    // Zoom in camera to initial position
    gsap.to(this.camera.position, {
      z: this.initialCameraZ,
      duration: 0.5, // Adjust duration as needed
      ease: "power2.out", // Adjust ease as needed
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

    if (this.isDragging) {
      this.wrapCards();
    } else {
      this.wrapCards();
    }

    // this.renderer.render(this.scene, this.camera); // Old rendering path
    this.composer.render(); // New rendering path with post-processing
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
