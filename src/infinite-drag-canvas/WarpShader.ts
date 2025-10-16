import * as THREE from "three";

export const WarpShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    strength: { value: -0.05 }, // Reduced from -0.15 for smaller warping effect
    aspectRatio: { value: 1.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float strength;
    uniform float aspectRatio;
    varying vec2 vUv;

    void main() {
      vec2 p = vUv * 2.0 - 1.0;

      vec2 pAspectCorrected = p;
      if (aspectRatio > 1.0) {
          pAspectCorrected.y *= aspectRatio;
      } else {
          pAspectCorrected.x /= aspectRatio;
      }

      float r2 = dot(pAspectCorrected, pAspectCorrected);
      
      vec2 pDistortedIsotropic = pAspectCorrected * (1.0 + strength * r2);

      vec2 pDistortedScreen = pDistortedIsotropic;
      if (aspectRatio > 1.0) {
          pDistortedScreen.y /= aspectRatio;
      } else {
          pDistortedScreen.x *= aspectRatio;
      }

      vec2 distortedUv = pDistortedScreen * 0.5 + 0.5;

      gl_FragColor = texture2D(tDiffuse, fract(distortedUv));
    }`,
};
