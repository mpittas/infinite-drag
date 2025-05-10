// import * as THREE from "three"; // Removed as it's not used

export const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null }, // The texture from the previous pass
    vignetteStart: { value: 0.65 }, // Start for pow(dist, 2.0) (effective dist ~0.5)
    vignetteFalloff: { value: 0.6 }, // Falloff for pow(dist, 2.0) (effective end dist ~0.707)
    vignetteStrength: { value: 1.75 }, // Max darkness (0.0 to 1.0)
    aspectRatio: { value: 0.0 }, // To make the vignette circular
  },

  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float vignetteStart;
    uniform float vignetteFalloff;
    uniform float vignetteStrength;
    uniform float aspectRatio;
    varying vec2 vUv;

    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec2 uv = (vUv - vec2(0.5)) * vec2(aspectRatio, 1.0); // Correct for aspect ratio
      float dist = length(uv); // Distance from center
      float poweredDist = pow(dist, 1.0); // Emphasize corners by using distance squared

      // Calculate vignette intensity based on poweredDist
      float intensity = smoothstep(vignetteStart, vignetteStart + vignetteFalloff, poweredDist);
      
      // Apply vignette by reducing brightness
      texel.rgb *= (1.0 - intensity * vignetteStrength);
      
      gl_FragColor = texel;
    }
  `,
};
