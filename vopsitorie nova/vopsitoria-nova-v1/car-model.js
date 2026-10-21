import * as THREE from 'three';

// Car Concept (Khronos glTF Sample Assets, CC BY 4.0), optimised for the web:
// logos removed, material variants dropped, meshopt + WebP. Front is +Z, left is +X, ground at y=0.
export const PAINT_MATERIAL = 'Paint 1 Carmine';
export const WHEELS = ['WheelFrontL', 'WheelFrontR', 'WheelRearL', 'WheelRearR'];
export const WHEEL_RADIUS = .385;
// Points on the body the camera tour pins its labels to, in car space.
export const PARTS = {
  door: [1.02, .72, .2],
  fender: [.88, .7, 1.95],
  wheel: [1.04, .38, 1.49],
  roof: [.15, 1.13, -.1],
};

const waveVertex = `
uniform mat4 novaWorldToCar;
varying vec3 novaCarPosition;`;
const waveFragment = `
uniform vec3 novaFrom;
uniform float novaWave;
varying vec3 novaCarPosition;`;

// The new colour sweeps over the body from the nose to the tail, with a faint wet edge.
export function addPaintWave(material) {
  const uniforms = {
    novaFrom: { value: material.color.clone() },
    novaWave: { value: 1 },
    novaWorldToCar: { value: new THREE.Matrix4() },
  };
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>${waveVertex}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
novaCarPosition = (novaWorldToCar * modelMatrix * vec4(transformed, 1.0)).xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>${waveFragment}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float novaEdge = mix(2.75, -2.3, novaWave);
float novaNoise = sin(novaCarPosition.y * 11.0 + novaCarPosition.x * 7.0) * .06;
float novaMix = smoothstep(novaEdge - .16, novaEdge + .16, novaCarPosition.z + novaNoise);
diffuseColor.rgb = mix(novaFrom, diffuseColor.rgb, novaMix);
diffuseColor.rgb += (1.0 - abs(novaMix * 2.0 - 1.0)) * .06 * step(novaWave, .999);`);
  };
  material.customProgramCacheKey = () => 'nova-paint-wave';
  return uniforms;
}

// Prepares the loaded glTF scene: body paint, cheaper glass, shadows.
export function prepareCar(scene, color) {
  let paint = null;
  const materials = {};
  scene.traverse(object => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    const list = Array.isArray(object.material) ? object.material : [object.material];
    list.forEach((material, index) => {
      if (material.name === 'Glass') {
        // Transmission costs an extra render pass; tinted transparent glass reads the same at this scale.
        materials.Glass ??= new THREE.MeshPhysicalMaterial({ name: 'Glass', color: '#0d1418', metalness: .1, roughness: .05, transparent: true, opacity: .45, clearcoat: 1, envMapIntensity: 1.2 });
        if (Array.isArray(object.material)) object.material[index] = materials.Glass; else object.material = materials.Glass;
        object.castShadow = false;
        return;
      }
      if (material.name === PAINT_MATERIAL) {
        paint = material;
        material.color.set(color);
        material.metalness = .55;
        material.roughness = .24;
        material.envMapIntensity = 1.25;
        // The metallic-flake normal map reads as sandpaper up close; keep a hint of flake under a clean clear coat.
        material.normalScale?.set(.12, .12);
        material.clearcoatNormalMap = null;
        material.clearcoat = 1;
        material.clearcoatRoughness = .04;
      }
      materials[material.name] = material;
    });
  });
  if (!paint) throw new Error('Paint material missing from car model');
  const wheels = WHEELS.map(name => scene.getObjectByName(name)).filter(Boolean);
  return { paint, materials, wheels };
}
