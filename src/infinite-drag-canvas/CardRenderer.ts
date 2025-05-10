import * as THREE from "three";

export class CardRenderer {
  private static readonly BASE_TEXT_CANVAS_SIZE = 160; // Reduced size

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
    cardIndex: number,
    backgroundColor: string | null
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
    const imagePlaceholderColor = "#444444"; // Darker placeholder
    const titleColor = "#F0F0F0"; // Brighter title
    const categoryTextColor = "#FFFFFF";
    // categoryBadgeColor is not used for fill, border will be categoryTextColor

    // 2. Image Placeholder (16:9 aspect ratio, 70% width, centered)
    const imagePlaceholderWidth = baseTextCanvasSize * 0.7;
    const imagePlaceholderHeight = imagePlaceholderWidth * (9 / 16);
    const imageX = (baseTextCanvasSize - imagePlaceholderWidth) / 2;
    const imageY =
      (baseTextCanvasSize - imagePlaceholderHeight) / 2.5 + padding * 0.5; // Shift down slightly for title space

    ctx.fillStyle = imagePlaceholderColor;
    ctx.fillRect(imageX, imageY, imagePlaceholderWidth, imagePlaceholderHeight);

    ctx.fillStyle = "#777777";
    ctx.font = `bold ${baseTextCanvasSize * 0.12}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      "16:9",
      imageX + imagePlaceholderWidth / 2,
      imageY + imagePlaceholderHeight / 2
    );

    // 3. Title (Top-right, Uppercase)
    ctx.fillStyle = titleColor;
    ctx.font = `bold ${titleFontSize}px Arial`;
    ctx.textAlign = "right"; // Align to the right
    ctx.textBaseline = "top";
    const projectTitle = `Project ${cardIndex + 1}`.toUpperCase(); // Make uppercase
    ctx.fillText(projectTitle, baseTextCanvasSize - padding, padding * 0.5); // Adjusted Y for title to be higher

    // 4. Category Badges (Bottom, pill-shaped, transparent with white border & text)
    const categories = ["UI/UX", "Motion", "Dev"]; // Shorter categories
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
}
