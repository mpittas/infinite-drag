import { useState } from "react";
import "./App.css";
import CanvasDisplay from "./CanvasDisplay";

type Screen = "canvas" | "hello";

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>("canvas");

  const switchToHello = () => setCurrentScreen("hello");
  const switchToCanvas = () => setCurrentScreen("canvas");

  // Estimate nav height for padding. Adjust if button sizes/padding changes.
  const navHeight = "50px";

  return (
    <div className="App" style={{ position: "relative" }}>
      <nav
        style={{
          position: "absolute",
          top: "0",
          left: "0",
          width: "100%",
          padding: "10px 0", // Adjusted padding
          textAlign: "center",
          zIndex: 1000, // Ensure it's above other content
          // background: "#f0f0f0", // Removed background
        }}
      >
        <button
          onClick={switchToCanvas}
          disabled={currentScreen === "canvas"}
          style={{ margin: "0 5px" }}
        >
          Show Canvas
        </button>
        <button
          onClick={switchToHello}
          disabled={currentScreen === "hello"}
          style={{ margin: "0 5px" }}
        >
          Show Hello World
        </button>
      </nav>

      <div className="screen-content">
        <CanvasDisplay isVisible={currentScreen === "canvas"} />
        {currentScreen === "hello" && (
          <div style={{ textAlign: "center", paddingTop: navHeight }}>
            <h1>Hello World</h1>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
