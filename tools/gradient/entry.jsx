import React from "react";
import { createRoot } from "react-dom/client";
import { ShaderGradientCanvas, ShaderGradient } from "@shadergradient/react";

// Gradient presets. window.TallyGradient.mount(el, name) draws one into el and returns a function that removes it.
const BASE = {
  animate: "on", axesHelper: "off", brightness: 1, cAzimuthAngle: 180, cDistance: 2.8, cPolarAngle: 80, cameraZoom: 9.1,
  destination: "onCanvas", embedMode: "off", envPreset: "city", format: "gif", fov: 45, frameRate: 10, gizmoHelper: "hide",
  grain: "on", lightType: "3d", pixelDensity: 1, positionX: 0, positionY: 0, positionZ: 0, range: "disabled",
  rangeEnd: 40, rangeStart: 0, reflection: 0.1, rotationX: 50, rotationY: 0, rotationZ: -60, shader: "defaults",
  uAmplitude: 0, uDensity: 1.5, uFrequency: 0, uSpeed: 0.3, uStrength: 1.5, uTime: 8, wireframe: false,
};

const PRESETS = {
  // landing page: slow dark purple wave
  landing: { ...BASE, bgColor1: "#000000", bgColor2: "#000000", color1: "#606080", color2: "#8d7dca", color3: "#212121", type: "waterPlane", uStrength: 1.5 },
  // help window: purple sphere
  help: { ...BASE, color1: "#4d0f80", color2: "#8d7dca", color3: "#212121", type: "sphere", uStrength: 1.5 },
};

function mount(el, name) {
  const props = PRESETS[name] || PRESETS.landing;
  const root = createRoot(el);
  root.render(
    <ShaderGradientCanvas
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      pixelDensity={1}
      fov={45}
      pointerEvents="none"
      envBasePath="/vendor/hdr/"
    >
      <ShaderGradient {...props} />
    </ShaderGradientCanvas>
  );
  return () => root.unmount();
}
window.TallyGradient = { mount };
