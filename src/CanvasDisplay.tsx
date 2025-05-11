import React, { useEffect, useRef } from "react";
import { InfiniteDragCanvas } from "./infinite-drag-canvas/InfiniteDragCanvas";
import "./App.css"; // Assuming some styles might be relevant, or remove if not

interface CanvasDisplayProps {
  isVisible: boolean;
}

const CanvasDisplay: React.FC<CanvasDisplayProps> = ({ isVisible }) => {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasInstanceRef = useRef<InfiniteDragCanvas | null>(null);

  useEffect(() => {
    // Initialize canvas only if the container exists and canvas hasn't been initialized yet
    if (canvasContainerRef.current && !canvasInstanceRef.current) {
      canvasContainerRef.current.innerHTML = ""; // Clear previous content if any
      try {
        canvasInstanceRef.current = new InfiniteDragCanvas(
          canvasContainerRef.current.id
        );
      } catch (error) {
        console.error(
          "Failed to initialize InfiniteDragCanvas in React component:",
          error
        );
        if (canvasContainerRef.current) {
          canvasContainerRef.current.innerHTML =
            "<p>Error initializing 3D canvas. See console for details.</p>";
        }
      }
    }

    // Cleanup function: Called when CanvasDisplay unmounts
    return () => {
      if (
        canvasInstanceRef.current &&
        typeof canvasInstanceRef.current.dispose === "function"
      ) {
        canvasInstanceRef.current.dispose();
      }
      canvasInstanceRef.current = null;
      if (canvasContainerRef.current) {
        canvasContainerRef.current.innerHTML = ""; // Clean up container
      }
    };
  }, []); // Empty dependency array: runs once on mount, cleanup on unmount

  return (
    <div
      id="react-canvas-container"
      ref={canvasContainerRef}
      style={{
        position: "fixed", // Make it fixed to cover the viewport
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh", // Full viewport height
        margin: 0,
        padding: 0,
        overflow: "hidden",
        display: isVisible ? "block" : "none", // Control visibility via CSS
        zIndex: 1, // Ensure it's behind the nav (which is zIndex: 1000)
      }}
    ></div>
  );
};

export default CanvasDisplay;
