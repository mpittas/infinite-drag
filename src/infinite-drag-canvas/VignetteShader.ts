export const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    vignetteStart: { value: 0.8 },
    vignetteFalloff: { value: 0.8 },
    vignetteStrength: { value: 7.25 },
    aspectRatio: { value: 0.0 },
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
      vec2 uv = (vUv - vec2(0.5)) * vec2(aspectRatio, 1.75);
      float dist = length(uv);
      float poweredDist = pow(dist, 1.6);

      float intensity = smoothstep(vignetteStart, vignetteStart + vignetteFalloff, poweredDist);
      
      texel.rgb *= (1.0 - intensity * vignetteStrength);
      
      gl_FragColor = texel;
    }
  `,
};
