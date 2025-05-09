import * as THREE from "three";
import { gsap } from "gsap"; // Import GSAP

interface Card extends THREE.Mesh {
  material: THREE.MeshBasicMaterial; // Each card will have a unique material
}

export class InfiniteDragCanvas {
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private container: HTMLElement;

  private initialCameraZ!: number;
  private zoomedOutCameraZ!: number;

  private images: Card[] = [];
  private gridConfig = {
    rows: 5,
    cols: 8,
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
    this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    this.camera.position.set(0, 0, 300); // Initial Z position

    this.initialCameraZ = this.camera.position.z;
    this.zoomedOutCameraZ = this.initialCameraZ * 1.5; // Zoom out by 50%

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(
      this.container.clientWidth,
      this.container.clientHeight
    );
    this.container.appendChild(this.renderer.domElement);
  }

  private createCardGrid(): void {
    const { rows, cols, imageSize, spacing } = this.gridConfig;
    this.gridConfig.gridWidth = cols * (imageSize + spacing) - spacing;
    this.gridConfig.gridHeight = rows * (imageSize + spacing) - spacing;

    const textCanvasSize = 128; // Power of 2 for texture size is good practice

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cardIndex = row * cols + col;

        // Create an offscreen canvas for the texture
        const canvas = document.createElement("canvas");
        canvas.width = textCanvasSize;
        canvas.height = textCanvasSize;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          console.error("Failed to get 2D context for card texture");
          continue; // Skip this card if context fails
        }

        // Transparent background for the card texture area
        ctx.clearRect(0, 0, textCanvasSize, textCanvasSize);

        // Draw 1px border (light gray)
        ctx.strokeStyle = "#555555"; // Darker gray for border on dark theme
        ctx.lineWidth = 1; // For a 1px border, this should be 1, but ensure scaling doesn't make it disappear
        // To ensure crisp 1px line, consider drawing at half-pixel coordinates if not scaling texture much
        // or ensure textCanvasSize maps well to imageSize.
        // For simplicity, let's try direct strokeRect.
        ctx.strokeRect(0.5, 0.5, textCanvasSize - 1, textCanvasSize - 1); // Offset by 0.5 for sharper lines

        // Add card index number (light color)
        ctx.fillStyle = "#cccccc"; // Light gray for numbers
        ctx.font = "bold 48px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          cardIndex.toString(),
          textCanvasSize / 2,
          textCanvasSize / 2
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
    });
  }

  private wrapCards(): void {
    const { imageSize, spacing, gridWidth, gridHeight } = this.gridConfig;
    const totalGridWidth = gridWidth + spacing; // Effective width for wrapping one full grid cycle
    const totalGridHeight = gridHeight + spacing; // Effective height

    const halfTotalGridWidth = totalGridWidth / 2;
    const halfTotalGridHeight = totalGridHeight / 2;

    // More precise wrapping boundaries relative to camera view and card center
    // These boundaries define when a card is considered "fully out" of the central grid area.
    const boundaryX = this.gridConfig.gridWidth / 2 + imageSize / 2;
    const boundaryY = this.gridConfig.gridHeight / 2 + imageSize / 2;

    this.images.forEach((image) => {
      if (image.position.x > boundaryX) {
        image.position.x -= totalGridWidth;
      } else if (image.position.x < -boundaryX) {
        image.position.x += totalGridWidth;
      }

      if (image.position.y > boundaryY) {
        image.position.y -= totalGridHeight;
      } else if (image.position.y < -boundaryY) {
        image.position.y += totalGridHeight;
      }
    });
  }

  private animate(): void {
    requestAnimationFrame(this.animate.bind(this));

    if (this.isDragging) {
      // Only wrap when actively dragging or if momentum is implemented
      this.wrapCards();
    } else {
      // If not dragging, still good to call wrap in case of residual movement or
      // if you implement momentum and want cards to settle correctly.
      // For a simple drag-and-stop, this might not be strictly needed if onPointerUp resets positions.
      // However, continuous wrapping ensures consistency.
      this.wrapCards();
    }

    this.renderer.render(this.scene, this.camera);
  }

  private onWindowResize(): void {
    const newWidth = this.container.clientWidth;
    const newHeight = this.container.clientHeight;

    this.camera.aspect = newWidth / newHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(newWidth, newHeight);
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
