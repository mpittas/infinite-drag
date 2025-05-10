import * as THREE from "three";
import type { Project } from "./types"; // Import the Project type

export class CardRenderer {
  private static readonly BASE_TEXT_CANVAS_SIZE = 160; // Reduced size
  private static imageCache: Map<string, HTMLImageElement> = new Map(); // Image cache

  private static drawRoundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    // Removed ctx.fill(); -- Caller will fill or stroke
  }

  public static createCardTexture(
    project: Project, // Changed from cardIndex
    originalCardIndex: number, // Keep for fallback or unique ID if needed
    backgroundColor: string | null // This signals hover state for card background
  ): THREE.CanvasTexture {
    const baseTextCanvasSize = CardRenderer.BASE_TEXT_CANVAS_SIZE * 1.75;
    const dpr = window.devicePixelRatio || 1;
    const actualCanvasSize = baseTextCanvasSize * dpr;

    const canvas = document.createElement("canvas");
    canvas.width = actualCanvasSize;
    canvas.height = actualCanvasSize;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      console.error("Failed to get 2D context for card texture generation.");
      return new THREE.CanvasTexture(document.createElement("canvas"));
    }

    ctx.scale(dpr, dpr);

    // 1. Overall Card Background (Dark Black)
    ctx.fillStyle = backgroundColor || "#0A0A0A"; // Dark black background
    ctx.fillRect(0, 0, baseTextCanvasSize, baseTextCanvasSize);

    // Layout constants (will scale with baseTextCanvasSize)
    const padding = baseTextCanvasSize * 0.06;
    const titleFontSize = baseTextCanvasSize * 0.025; // Keeping user's font size
    const categoryFontSize = baseTextCanvasSize * 0.023; // Keeping user's font size
    const badgeHeight = categoryFontSize + padding * 0.3;
    const badgePaddingHorizontal = baseTextCanvasSize * 0.03;
    const badgeBorderWidth = 0.1; // Pixel width for badge border (adjust as needed)

    // Colors
    const imagePlaceholderColor = "#444444";
    const titleColor = "#F0F0F0";
    const categoryTextColor = "#FFFFFF";

    // Determine image overlay opacity based on hover state (inferred from backgroundColor)
    const imageOverlayOpacity = backgroundColor === null ? 0.3 : 0.0; // 0.3 default, 0.0 on hover

    // 2. Image Placeholder (16:9 aspect ratio, 70% width, centered)
    const imagePlaceholderWidth = baseTextCanvasSize * 0.7;
    const imagePlaceholderHeight = imagePlaceholderWidth * (9 / 16);
    const imageX = (baseTextCanvasSize - imagePlaceholderWidth) / 2;
    const imageY =
      (baseTextCanvasSize - imagePlaceholderHeight) / 2.5 + padding * 0.5;

    // Initially draw placeholder or background for image area
    ctx.fillStyle = imagePlaceholderColor;
    ctx.fillRect(imageX, imageY, imagePlaceholderWidth, imagePlaceholderHeight);
    ctx.fillStyle = "#777777";
    ctx.font = `bold ${baseTextCanvasSize * 0.12}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const placeholderText = "Loading..."; // Initial placeholder
    ctx.fillText(
      placeholderText,
      imageX + imagePlaceholderWidth / 2,
      imageY + imagePlaceholderHeight / 2
    );

    if (project.imageUrl) {
      const cachedImage = CardRenderer.imageCache.get(project.imageUrl);

      if (cachedImage && cachedImage.complete) {
        // Image is cached and loaded, draw immediately
        CardRenderer.drawImageOntoCanvas(
          ctx,
          cachedImage,
          imageX,
          imageY,
          imagePlaceholderWidth,
          imagePlaceholderHeight,
          imagePlaceholderColor,
          imageOverlayOpacity
        );
      } else {
        // Image not cached or not yet loaded, start loading
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
          CardRenderer.imageCache.set(project.imageUrl!, img);
          CardRenderer.drawImageOntoCanvas(
            ctx,
            img,
            imageX,
            imageY,
            imagePlaceholderWidth,
            imagePlaceholderHeight,
            imagePlaceholderColor,
            imageOverlayOpacity
          );
          texture.needsUpdate = true;
        };
        img.onerror = () => {
          // Draw error placeholder
          ctx.fillStyle = imagePlaceholderColor;
          ctx.fillRect(
            imageX,
            imageY,
            imagePlaceholderWidth,
            imagePlaceholderHeight
          );
          ctx.fillStyle = "#AA5555";
          ctx.font = `bold ${baseTextCanvasSize * 0.1}px Arial`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(
            "Error",
            imageX + imagePlaceholderWidth / 2,
            imageY + imagePlaceholderHeight / 2
          );
          texture.needsUpdate = true;
        };
        img.src = project.imageUrl;
      }
    } else {
      // No image URL, draw "No Image" placeholder
      ctx.fillStyle = imagePlaceholderColor;
      ctx.fillRect(
        imageX,
        imageY,
        imagePlaceholderWidth,
        imagePlaceholderHeight
      );
      ctx.fillStyle = "#777777";
      ctx.font = `bold ${baseTextCanvasSize * 0.1}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        "No Image",
        imageX + imagePlaceholderWidth / 2,
        imageY + imagePlaceholderHeight / 2
      );
      // texture.needsUpdate = true; // Only if you draw something new here
    }

    // 3. Title (Top-right, Uppercase)
    ctx.fillStyle = titleColor;
    ctx.font = `bold ${titleFontSize}px Arial`;
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    // Use project title, fallback to original card index
    const displayTitle = (
      project.title || `Project ${originalCardIndex + 1}`
    ).toUpperCase();
    ctx.fillText(displayTitle, baseTextCanvasSize - padding, padding * 0.5);

    // 4. Category Badges (Bottom, pill-shaped, transparent with white border & text)
    const categories =
      project.categories.length > 0 ? project.categories : ["N/A"]; // Use project categories, fallback
    let currentBadgeX = padding;
    const badgeY = baseTextCanvasSize - padding / 2 - badgeHeight;
    const badgeRadius = badgeHeight / 1.6; // Pill shape

    ctx.font = `normal ${categoryFontSize}px Arial`;
    ctx.textBaseline = "middle";

    categories.forEach((category) => {
      const textMetrics = ctx.measureText(category);
      const badgeWidth = textMetrics.width + badgePaddingHorizontal * 2;

      if (currentBadgeX + badgeWidth < baseTextCanvasSize - padding) {
        // Draw badge border (pill shape)
        ctx.strokeStyle = categoryTextColor;
        ctx.lineWidth = badgeBorderWidth;
        CardRenderer.drawRoundRect(
          ctx,
          currentBadgeX,
          badgeY,
          badgeWidth,
          badgeHeight,
          badgeRadius
        );
        ctx.stroke();

        // Draw badge text
        ctx.fillStyle = categoryTextColor;
        ctx.textAlign = "center";
        ctx.fillText(
          category.toUpperCase(),
          currentBadgeX + badgeWidth / 2,
          badgeY + badgeHeight / 2 + badgeBorderWidth / 2 // slight offset for text baseline with border
        );
        currentBadgeX += badgeWidth + padding / 4; // Reduced spacing between badges
      }
    });

    // 5. Outer Border (Subtle)
    ctx.strokeStyle = "#555555"; // Darker border for dark bg
    ctx.lineWidth = 0.1;
    ctx.strokeRect(
      0.05,
      0.05,
      baseTextCanvasSize - 0.1,
      baseTextCanvasSize - 0.1
    );

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  // Helper to encapsulate drawing logic for reuse
  private static drawImageOntoCanvas(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    imageX: number,
    imageY: number,
    placeholderWidth: number,
    placeholderHeight: number,
    placeholderBgColor: string,
    overlayOpacity: number // Added parameter for dynamic opacity
  ): void {
    // Clear placeholder area before drawing image
    ctx.fillStyle = placeholderBgColor;
    ctx.fillRect(imageX, imageY, placeholderWidth, placeholderHeight);

    const imgAspectRatio = img.width / img.height;
    const placeholderAspectRatio = placeholderWidth / placeholderHeight;
    let drawWidth, drawHeight, drawX, drawY;

    if (imgAspectRatio > placeholderAspectRatio) {
      drawHeight = placeholderHeight;
      drawWidth = drawHeight * imgAspectRatio;
      drawX = imageX - (drawWidth - placeholderWidth) / 2;
      drawY = imageY;
    } else {
      drawWidth = placeholderWidth;
      drawHeight = drawWidth / imgAspectRatio;
      drawX = imageX;
      drawY = imageY - (drawHeight - placeholderHeight) / 2;
    }
    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

    // Add dark overlay on top of the image with dynamic opacity
    if (overlayOpacity > 0) {
      // Only draw if opacity is greater than 0
      ctx.fillStyle = `rgba(0, 0, 0, ${overlayOpacity})`;
      ctx.fillRect(imageX, imageY, placeholderWidth, placeholderHeight);
    }
  }
}
