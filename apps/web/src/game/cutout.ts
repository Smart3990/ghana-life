// See-through for the player: anything standing between the camera and the player (a kiosk, a
// tree, a building's corner, a billboard leg) is cut away in a soft-edged tube along the line of
// sight, so the player is never hidden. Works inside the existing materials (a few lines of shader),
// so it costs almost nothing.
import type * as THREE from 'three';

export const CUT = {
  camera: { value: [0, 50, 0] as [number, number, number] },
  player: { value: [0, 1, 0] as [number, number, number] },
  radius: { value: 1.5 },
};

/** Give a material the see-through cut. Call before it is first drawn. */
export function addCutout(m: THREE.Material) {
  const before = m.onBeforeCompile;
  m.onBeforeCompile = (shader, renderer) => {
    before?.call(m, shader, renderer);
    shader.uniforms.uCutCam = CUT.camera;
    shader.uniforms.uCutPlayer = CUT.player;
    shader.uniforms.uCutR = CUT.radius;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCutWorld;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
  {
    vec4 cw = vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
      cw = instanceMatrix * cw;
    #endif
    vCutWorld = (modelMatrix * cw).xyz;
  }`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCutWorld;\nuniform vec3 uCutCam;\nuniform vec3 uCutPlayer;\nuniform float uCutR;')
      .replace(
        'void main() {',
        `void main() {
  {
    vec3 seg = uCutPlayer - uCutCam;
    float len2 = dot(seg, seg);
    float t = dot(vCutWorld - uCutCam, seg) / max(len2, 0.0001);
    // Only between the camera and just in front of the player, and not the ground.
    if (t > 0.0 && t < 0.97 && vCutWorld.y > 0.12) {
      float d = length(vCutWorld - (uCutCam + seg * t));
      // The tube widens towards the player, so the whole body shows.
      float r = uCutR * mix(0.35, 1.0, t);
      if (d < r) discard;
    }
  }`,
      );
  };
  const key = m.customProgramCacheKey?.bind(m);
  m.customProgramCacheKey = () => (key ? key() : '') + '-cut';
}
