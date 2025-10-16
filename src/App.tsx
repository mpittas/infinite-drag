import React, { useEffect, useRef, useState } from "react";
import "./App.css";
import NavigationSwitch from "./components/NavigationSwitch";
import ProjectsScreen from "./components/ProjectsScreen";

interface CanvasDisplayProps {
  isVisible: boolean;
}

const CanvasDisplay: React.FC<CanvasDisplayProps> = ({ isVisible }) => {
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible && canvasContainerRef.current) {
      import("./infinite-drag-canvas/InfiniteDragCanvas")
        .then(({ InfiniteDragCanvas }) => {
          if (
            canvasContainerRef.current &&
            !canvasContainerRef.current.querySelector("canvas")
          ) {
            new InfiniteDragCanvas("canvas-container-unique");
          }
        })
        .catch((error) =>
          console.error("Failed to load InfiniteDragCanvas", error)
        );
    }
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

  const navHeight = 60;

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
        {currentScreen === "hello" && <ProjectsScreen navHeight={0} />}
      </div>
    </div>
  );
}

export default App;
