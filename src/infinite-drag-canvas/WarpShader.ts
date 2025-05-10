import * as THREE from "three";

export const WarpShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    strength: { value: -0.05 }, // Reduced from -0.15 for smaller warping effect
    aspectRatio: { value: 1.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float strength; // k1 in lens distortion
    uniform float aspectRatio;
    varying vec2 vUv;

    void main() {
      vec2 p = vUv * 2.0 - 1.0; // Normalize to -1.0 to 1.0 screen space coordinates

      // Adjust coordinates to make the space isotropic (circular) before distortion
      vec2 pAspectCorrected = p;
      if (aspectRatio > 1.0) { // Landscape: scale down y
          pAspectCorrected.y *= aspectRatio;
      } else { // Portrait or Square: scale down x
          pAspectCorrected.x /= aspectRatio;
      }

      // Calculate squared radial distance in this isotropic space
      float r2 = dot(pAspectCorrected, pAspectCorrected);
      
      // Apply radial distortion: p_d = p * (1 + strength * r^2)
      // The distortion is applied to the coordinates in the isotropic space
      vec2 pDistortedIsotropic = pAspectCorrected * (1.0 + strength * r2);

      // Convert distorted coordinates back to original screen aspect ratio
      vec2 pDistortedScreen = pDistortedIsotropic;
      if (aspectRatio > 1.0) { // Landscape: unscale y
          pDistortedScreen.y /= aspectRatio;
      } else { // Portrait or Square: unscale x
          pDistortedScreen.x *= aspectRatio;
      }

      // Convert back to 0.0 to 1.0 UV range for texture sampling
      vec2 distortedUv = pDistortedScreen * 0.5 + 0.5;

      // Apply toroidal wrapping
      gl_FragColor = texture2D(tDiffuse, fract(distortedUv));
    }`,
};
