import * as THREE from "three";
import type { Project } from "@/types/types";

export class CardRenderer {
  private static readonly BASE_TEXT_CANVAS_SIZE = 160;
  private static imageCache: Map<string, HTMLImageElement> = new Map();

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
  }

  public static createCardTexture(
    project: Project,
    originalCardIndex: number,
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

    ctx.fillStyle = backgroundColor || "#0A0A0A";
    ctx.fillRect(0, 0, baseTextCanvasSize, baseTextCanvasSize);

    const padding = baseTextCanvasSize * 0.06;
    const titleFontSize = baseTextCanvasSize * 0.025;
    const categoryFontSize = baseTextCanvasSize * 0.023;
    const badgeHeight = categoryFontSize + padding * 0.3;
    const badgePaddingHorizontal = baseTextCanvasSize * 0.03;
    const badgeBorderWidth = 0.1;

    const imagePlaceholderColor = "#444444";
    const titleColor = "#F0F0F0";
    const categoryTextColor = "#FFFFFF";
    const imagePlaceholderWidth = baseTextCanvasSize * 0.7;
    const imagePlaceholderHeight = imagePlaceholderWidth * (9 / 16);
    const imageX = (baseTextCanvasSize - imagePlaceholderWidth) / 2;
    const imageY =
      (baseTextCanvasSize - imagePlaceholderHeight) / 2.5 + padding * 0.5;

    ctx.fillStyle = imagePlaceholderColor;
    ctx.fillRect(imageX, imageY, imagePlaceholderWidth, imagePlaceholderHeight);
    ctx.fillStyle = "#777777";
    ctx.font = `bold ${baseTextCanvasSize * 0.12}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const placeholderText = "Loading...";
    ctx.fillText(
      placeholderText,
      imageX + imagePlaceholderWidth / 2,
      imageY + imagePlaceholderHeight / 2
    );

    if (project.imageUrl) {
      const cachedImage = CardRenderer.imageCache.get(project.imageUrl);

      if (cachedImage && cachedImage.complete) {
        CardRenderer.drawImageOntoCanvas(
          ctx,
          cachedImage,
          imageX,
          imageY,
          imagePlaceholderWidth,
          imagePlaceholderHeight,
          imagePlaceholderColor
        );
      } else {
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
            imagePlaceholderColor
          );
          texture.needsUpdate = true;
        };
        img.onerror = () => {
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
    }
    ctx.fillStyle = titleColor;
    ctx.font = `bold ${titleFontSize}px Arial`;
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    const displayTitle = (
      project.title || `Project ${originalCardIndex + 1}`
    ).toUpperCase();
    ctx.fillText(displayTitle, baseTextCanvasSize - padding, padding * 0.5);

    const categories =
      project.categories.length > 0 ? project.categories : ["N/A"];
    let currentBadgeX = padding;
    const badgeY = baseTextCanvasSize - padding / 2 - badgeHeight;
    const badgeRadius = badgeHeight / 1.6;

    ctx.font = `normal ${categoryFontSize}px Arial`;
    ctx.textBaseline = "middle";

    categories.forEach((category) => {
      const textMetrics = ctx.measureText(category);
      const badgeWidth = textMetrics.width + badgePaddingHorizontal * 2;

      if (currentBadgeX + badgeWidth < baseTextCanvasSize - padding) {
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

        ctx.fillStyle = categoryTextColor;
        ctx.textAlign = "center";
        ctx.fillText(
          category.toUpperCase(),
          currentBadgeX + badgeWidth / 2,
          badgeY + badgeHeight / 2 + badgeBorderWidth / 2
        );
        currentBadgeX += badgeWidth + padding / 4;
      }
    });

    ctx.strokeStyle = "#555555";
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

  private static drawImageOntoCanvas(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    imageX: number,
    imageY: number,
    placeholderWidth: number,
    placeholderHeight: number,
    placeholderBgColor: string
  ): void {
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
  }
}
