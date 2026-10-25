// Advert faces that change by themselves, like digital billboards: every few seconds the next
// advert slides in from the side. One picture holds all the adverts (one row each); each board
// starts at its own advert (aAd) and its own moment, so the city's boards don't all change together.
import * as THREE from 'three';

export const AD_CLOCK = { value: 0 };

/** A material for instanced advert faces. rows: adverts in the picture; period: seconds per advert. */
export function slidingAdMaterial(map: THREE.Texture, rows: number, period = 7, basic = false) {
  const m = basic ? new THREE.MeshBasicMaterial({ map, toneMapped: false }) : new THREE.MeshStandardMaterial({ map, roughness: 0.55 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uAdClock = AD_CLOCK;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aAd;\nvarying float vAd;\nvarying vec2 vAdUv;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvAd = aAd;\nvAdUv = uv;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uAdClock;\nvarying float vAd;\nvarying vec2 vAdUv;')
      .replace(
        '#include <map_fragment>',
        `{
    float R = ${rows.toFixed(1)};
    float P = ${period.toFixed(1)};
    float tt = uAdClock + vAd * 2.9;
    float k = floor(tt / P);
    float f = tt - k * P;            // seconds into this advert
    float slide = clamp(f / 0.7, 0.0, 1.0);
    slide = slide * slide * (3.0 - 2.0 * slide);
    float rowNow = mod(vAd + k, R);
    float rowOld = mod(vAd + k - 1.0, R);
    // The new advert slides in from the right, pushing the old one out to the left.
    float x = vAdUv.x;
    vec2 uv;
    if (x < 1.0 - slide) uv = vec2(x + slide, (vAdUv.y + rowOld) / R);
    else uv = vec2(x - (1.0 - slide), (vAdUv.y + rowNow) / R);
    vec4 sampledDiffuseColor = texture2D(map, uv);
    diffuseColor *= sampledDiffuseColor;
  }`,
      );
  };
  m.customProgramCacheKey = () => `sliding-ad-${rows}-${period}-${basic}`;
  return m;
}

/** A two-sided advert face (reads the right way round from the front and from the back). */
export function twoSidedFace(w: number, h: number, y: number, z = 0, gap = 0.04) {
  const pos: number[] = [];
  const uv: number[] = [];
  const nor: number[] = [];
  for (const side of [1, -1]) {
    const zz = z + side * gap;
    const q = [[-w / 2, y - h / 2], [w / 2, y - h / 2], [w / 2, y + h / 2], [-w / 2, y + h / 2]];
    const u = side > 0 ? [0, 1, 1, 0] : [1, 0, 0, 1];
    const order = side > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
    for (const k of order) {
      pos.push(q[k][0], q[k][1], zz);
      uv.push(u[k], k >= 2 ? 1 : 0);
      nor.push(0, 0, side);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}
