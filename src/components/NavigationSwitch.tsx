import React from "react";
import { CiGrid41, CiMenuBurger } from "react-icons/ci"; // Import react-icons

interface NavigationSwitchProps {
  currentScreen: "canvas" | "hello";
  switchToCanvas: () => void;
  switchToHello: () => void;
}

const NAV_STYLE: React.CSSProperties = {
  position: "absolute",
  bottom: "20px",
  left: "20px",
  zIndex: 1000,
  background: "#333",
  borderRadius: "25px",
  padding: "5px",
  display: "inline-flex", // Fluid width for the nav container
};

const BUTTON_CONTAINER_STYLE: React.CSSProperties = {
  display: "flex",
  position: "relative",
  height: "40px", // Height of the track
};

const BUTTON_SLOT_STYLE: React.CSSProperties = {
  width: "40px", // Width of one segment/slot
  height: "40px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  padding: 0,
  outline: "none",
  color: "#f0f0f0", // Color for inactive icons on the dark background
  zIndex: 1, // Below the moving circle
};

const MOVING_CIRCLE_BASE_STYLE: React.CSSProperties = {
  position: "absolute",
  top: "0px",
  width: "40px",
  height: "40px",
  background: "#f0f0f0",
  borderRadius: "50%",
  transition: "transform 0.3s ease-in-out",
  zIndex: 2,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 1px 3px rgba(0,0,0,0.2)", // Optional: subtle shadow for depth
};

const ICON_IN_CIRCLE_STYLE_BASE: React.CSSProperties = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  transition: "opacity 0.2s ease-in-out", // Sightly faster than circle movement
  color: "#333", // Active icons are dark
};

const NavigationSwitch: React.FC<NavigationSwitchProps> = ({
  currentScreen,
  switchToCanvas,
  switchToHello,
}) => {
  const movingCircleStyle: React.CSSProperties = {
    ...MOVING_CIRCLE_BASE_STYLE,
    transform:
      currentScreen === "canvas" ? "translateX(0px)" : "translateX(40px)",
  };

  return (
    <nav style={NAV_STYLE}>
      <div style={BUTTON_CONTAINER_STYLE}>
        <button
          onClick={switchToCanvas}
          style={BUTTON_SLOT_STYLE}
          title="Show Canvas"
          tabIndex={0}
        >
          {currentScreen !== "canvas" && <CiGrid41 size={24} />}
        </button>
        <button
          onClick={switchToHello}
          style={BUTTON_SLOT_STYLE}
          title="Show Hello World (Projects)"
          tabIndex={0}
        >
          {currentScreen !== "hello" && <CiMenuBurger size={24} />}
        </button>
        <div style={movingCircleStyle}>
          <div style={{ position: "relative", width: "100%", height: "100%" }}>
            <CiGrid41
              size={24}
              style={{
                ...ICON_IN_CIRCLE_STYLE_BASE,
                opacity: currentScreen === "canvas" ? 1 : 0,
              }}
            />
            <CiMenuBurger
              size={24}
              style={{
                ...ICON_IN_CIRCLE_STYLE_BASE,
                opacity: currentScreen === "hello" ? 1 : 0,
              }}
            />
          </div>
        </div>
      </div>
    </nav>
  );
};

export default NavigationSwitch;
