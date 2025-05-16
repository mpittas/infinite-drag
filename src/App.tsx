import { useState } from "react";
import "./App.css";
import CanvasDisplay from "./CanvasDisplay";
import ProjectListItem from "./ProjectListItem";
import { projects } from "./data/projectData";
import type { Project } from "@/types/types";

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
          Show Hello World (Projects)
        </button>
      </nav>

      <div className="screen-content">
        <CanvasDisplay isVisible={currentScreen === "canvas"} />
        {currentScreen === "hello" && (
          <div
            style={{
              textAlign: "center",
              paddingTop: navHeight,
              paddingBottom: "20px",
            }}
          >
            <h1>Project List</h1>
            {projects.length > 0 ? (
              <ul style={{ padding: 0, margin: "0 auto", maxWidth: "800px" }}>
                {projects.map((project: Project) => (
                  <ProjectListItem key={project.id} project={project} />
                ))}
              </ul>
            ) : (
              <p>No projects to display.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
