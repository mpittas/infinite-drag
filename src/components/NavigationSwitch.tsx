import React from "react";
import { CiGrid41, CiMenuBurger } from "react-icons/ci";

interface NavigationSwitchProps {
  currentScreen: "canvas" | "hello";
  switchToCanvas: () => void;
  switchToHello: () => void;
}

const styles = {
  nav: {
    position: "absolute" as const,
    bottom: "20px",
    left: "20px",
    zIndex: 1000,
    background: "#333",
    borderRadius: "25px",
    padding: "5px",
    display: "inline-flex",
  },
  buttonContainer: {
    display: "flex",
    position: "relative" as const,
    height: "40px",
  },
  buttonSlot: {
    width: "40px",
    height: "40px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: 0,
    outline: "none",
    color: "#f0f0f0",
    zIndex: 1,
  },
  movingCircleBase: {
    position: "absolute" as const,
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
    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
  },
  iconInCircleBase: {
    position: "absolute" as const,
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    transition: "opacity 0.2s ease-in-out",
    color: "#333",
  },
};

const NavigationSwitch: React.FC<NavigationSwitchProps> = ({
  currentScreen,
  switchToCanvas,
  switchToHello,
}) => {
  const movingCircleStyle: React.CSSProperties = {
    ...styles.movingCircleBase,
    transform:
      currentScreen === "canvas" ? "translateX(0px)" : "translateX(40px)",
  };

  return (
    <nav style={styles.nav}>
      <div style={styles.buttonContainer}>
        <button
          onClick={switchToCanvas}
          style={styles.buttonSlot}
          title="Show Canvas"
          tabIndex={0}
        >
          {currentScreen !== "canvas" && <CiGrid41 size={24} />}
        </button>
        <button
          onClick={switchToHello}
          style={styles.buttonSlot}
          title="Show Projects"
          tabIndex={0}
        >
          {currentScreen !== "hello" && <CiMenuBurger size={24} />}
        </button>
        <div style={movingCircleStyle}>
          <div style={{ position: "relative", width: "100%", height: "100%" }}>
            <CiGrid41
              size={24}
              style={{
                ...styles.iconInCircleBase,
                opacity: currentScreen === "canvas" ? 1 : 0,
              }}
            />
            <CiMenuBurger
              size={24}
              style={{
                ...styles.iconInCircleBase,
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
