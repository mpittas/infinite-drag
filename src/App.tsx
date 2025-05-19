import React, { useState, useEffect, useRef } from "react";
import "./App.css";
// import { InfiniteDragCanvas } from "./infinite-drag-canvas/InfiniteDragCanvas"; // Corrected import
import NavigationSwitch from "./components/NavigationSwitch";
// import ProjectListItem from "./ProjectListItem"; // Moved to ProjectsScreen
// import { projects } from "./data/projectData"; // Moved to ProjectsScreen
import ProjectsScreen from "./components/ProjectsScreen"; // Import the new ProjectsScreen component

// Type for screen state if you prefer more explicit typing
// type Screen = "canvas" | "hello";

// Interface for the props of CanvasDisplay (or InfiniteDragCanvas wrapper)
interface CanvasDisplayProps {
  isVisible: boolean;
}

// This component will manage the InfiniteDragCanvas instance
const CanvasDisplay: React.FC<CanvasDisplayProps> = ({ isVisible }) => {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  // const dragCanvasInstanceRef = useRef<InfiniteDragCanvas | null>(null); // Store instance

  useEffect(() => {
    if (
      isVisible &&
      canvasContainerRef.current /* && !dragCanvasInstanceRef.current */
    ) {
      // Dynamically import InfiniteDragCanvas only when needed and on client-side
      import("./infinite-drag-canvas/InfiniteDragCanvas")
        .then(({ InfiniteDragCanvas }) => {
          if (
            canvasContainerRef.current &&
            !canvasContainerRef.current.querySelector("canvas")
          ) {
            // dragCanvasInstanceRef.current = new InfiniteDragCanvas("canvas-container-unique");
            new InfiniteDragCanvas("canvas-container-unique");
          }
        })
        .catch((error) =>
          console.error("Failed to load InfiniteDragCanvas", error)
        );
    }
    // Cleanup logic if needed when component unmounts or is hidden
    // return () => {
    //   if (dragCanvasInstanceRef.current) {
    //     dragCanvasInstanceRef.current.dispose();
    //     dragCanvasInstanceRef.current = null;
    //     if (canvasContainerRef.current) {
    //       canvasContainerRef.current.innerHTML = ''; // Clear the container
    //     }
    //   }
    // };
  }, [isVisible]);

  return (
    <div
      id="canvas-container-unique"
      ref={canvasContainerRef}
      style={{
        width: "100%",
        height: "100%",
        display: isVisible ? "block" : "none",
      }}
    />
  );
};

function App() {
  const [currentScreen, setCurrentScreen] = useState<"canvas" | "hello">(
    "canvas"
  );

  const switchToCanvas = () => setCurrentScreen("canvas");
  const switchToHello = () => setCurrentScreen("hello");

  // Estimate nav height for padding. Adjust if button sizes/padding changes.
  // This is a rough estimate. For more accuracy, you might measure the nav element.
  const navHeight = 60; // Approximate height of the new NavigationSwitch (top 20px + 40px height)

  return (
    <div
      className="App"
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <NavigationSwitch
        currentScreen={currentScreen}
        switchToCanvas={switchToCanvas}
        switchToHello={switchToHello}
      />

      <div
        className="screen-content"
        style={{
          width: "100%",
          height: "100%",
          paddingTop: currentScreen === "hello" ? `${navHeight}px` : 0,
        }}
      >
        <CanvasDisplay isVisible={currentScreen === "canvas"} />
        {
          currentScreen === "hello" && (
            <ProjectsScreen navHeight={0} />
          ) /* navHeight handled by screen-content padding */
        }
      </div>
    </div>
  );
}

export default App;
