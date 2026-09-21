import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { ImageryLayer } from '../LayerManager'
import { ImageryOverlayFactory } from '../tiles/ImageryOverlayFactory'
import {
  applyOverlayDayNightStyle,
  applyOverlayDayNightToObject,
  createOverlayDayNightParams,
  getOverlayDayNightParams,
  mixOverlayLightingOpacity,
  syncOverlayDayNightOpacities,
  wrapOverlayDayNightMaterial,
  type OverlayDayNightFields
} from '../tiles/overlayDayNight'

function createMesh(material = new THREE.MeshStandardMaterial()) {
  return new THREE.Mesh(new THREE.PlaneGeometry(), material)
}

function compileShader(material: THREE.Material) {
  const shader = {
    uniforms: {} as Record<string, THREE.IUniform>,
    vertexShader: `
void main() {
  vec3 transformed = position;
  #include <project_vertex>
}
`,
    fragmentShader: `
uniform vec3 diffuse;
uniform float opacity;
void main() {
  vec4 diffuseColor = vec4( diffuse, opacity );
  #include <color_fragment>
}
`
  }
  material.onBeforeCompile(shader as THREE.WebGLProgramParametersWithUniforms, null as never)
  return shader
}

function wrapFakeOverlay(material: THREE.Material) {
  const previousOnBeforeCompile = material.onBeforeCompile
  material.onBeforeCompile = (shader, renderer) => {
    previousOnBeforeCompile.call(material, shader, renderer)
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
#if LAYER_COUNT != 0
struct LayerInfo {
  vec3 color;
  float opacity;
  int alphaMask;
  int alphaInvert;
};
uniform sampler2D layerMaps[ LAYER_COUNT ];
uniform LayerInfo layerInfo[ LAYER_COUNT ];
{
  vec4 tint;
  float wOpacity;
  #pragma unroll_loop_start
  for ( int i = 0; i < 10; i ++ ) {
    tint.rgba *= layerInfo[ i ].opacity * wOpacity;
  }
  #pragma unroll_loop_end
}
#endif`
    )
  }
}

function simulateUnrollLoops(source: string, layerCount = 2) {
  return source.replace(
    /#pragma unroll_loop_start([\s\S]*?)#pragma unroll_loop_end/g,
    (_match, body: string) =>
      Array.from({ length: layerCount }, (_, index) =>
        body.replace(/\bi\b/g, String(index))
      ).join('\n')
  )
}

describe('overlay day/night opacity', () => {
  it('mixes night opacity on the dark side and day opacity on the lit side', () => {
    expect(mixOverlayLightingOpacity(0, 1, 1)).toBe(0)
    expect(mixOverlayLightingOpacity(0, 1, -1)).toBe(1)
    expect(mixOverlayLightingOpacity(1, 1, -0.5)).toBe(1)
  })

  it('copies dayOpacity and nightOpacity onto overlay objects', () => {
    const factory = new ImageryOverlayFactory({
      renderer: {} as never,
      transparentOverlayTexture: {} as never
    })
    const overlay = factory.createOverlay(
      {
        type: 'xyz',
        url: 'https://example.test/tiles/{z}/{y}/{x}.jpg'
      },
      {
        opacity: 0.8,
        dayOpacity: 0,
        nightOpacity: 0.4
      }
    )

    expect(overlay?.opacity).toBe(0.8)
    expect((overlay as unknown as OverlayDayNightFields).dayOpacity).toBe(0)
    expect((overlay as unknown as OverlayDayNightFields).nightOpacity).toBe(0.4)
  })

  it('defaults dayOpacity and nightOpacity to 1', () => {
    const overlay = { opacity: 1 } as never
    applyOverlayDayNightStyle(overlay, {})
    expect((overlay as OverlayDayNightFields).dayOpacity).toBe(1)
    expect((overlay as OverlayDayNightFields).nightOpacity).toBe(1)
  })

  it('applies setStyle day/night values onto an existing overlay', () => {
    const factory = new ImageryOverlayFactory({
      renderer: {} as never,
      transparentOverlayTexture: {} as never
    })
    const overlay = factory.createOverlay({
      type: 'xyz',
      url: 'https://example.test/tiles/{z}/{y}/{x}.jpg'
    })
    const layer = new ImageryLayer({
      id: 'night',
      source: {
        type: 'xyz',
        url: 'https://example.test/tiles/{z}/{y}/{x}.jpg'
      },
      style: { dayOpacity: 0.2 }
    }, {
      remove: () => true,
      move: () => true,
      update: () => {}
    })

    layer.setStyle({ dayOpacity: 0, nightOpacity: 0.6 })
    factory.applyLayerStyleToOverlay(layer, overlay!)

    expect((overlay as unknown as OverlayDayNightFields).dayOpacity).toBe(0)
    expect((overlay as unknown as OverlayDayNightFields).nightOpacity).toBe(0.6)
  })

  it('syncs per-layer uniforms from overlay objects', () => {
    const params = createOverlayDayNightParams()
    syncOverlayDayNightOpacities(params, [
      { dayOpacity: 0, nightOpacity: 1 },
      { dayOpacity: 1, nightOpacity: 0.25 }
    ])

    expect(params.telluxDayOpacities.value[0]).toBe(0)
    expect(params.telluxNightOpacities.value[0]).toBe(1)
    expect(params.telluxDayOpacities.value[1]).toBe(1)
    expect(params.telluxNightOpacities.value[1]).toBe(0.25)
    expect(params.telluxDayOpacities.value[2]).toBe(1)
  })

  it('multiplies overlay opacity by day/night lighting after overlay compositing', () => {
    const mesh = createMesh()
    const params = createOverlayDayNightParams()
    wrapFakeOverlay(mesh.material as THREE.Material)
    wrapOverlayDayNightMaterial(mesh.material as THREE.Material, params)

    const shader = compileShader(mesh.material as THREE.Material)
    const overlayIndex = shader.fragmentShader.indexOf('uniform LayerInfo layerInfo[ LAYER_COUNT ];')
    const factorIndex = shader.fragmentShader.indexOf('float telluxDayFactor')
    const unrollIndex = shader.fragmentShader.indexOf('#pragma unroll_loop_start')
    const applyIndex = shader.fragmentShader.indexOf(
      'tint.rgba *= layerInfo[ i ].opacity * mix(telluxNightOpacities[ i ], telluxDayOpacities[ i ], telluxDayFactor) * wOpacity;'
    )

    expect(getOverlayDayNightParams(mesh.material as THREE.Material)).toBe(params)
    expect(shader.uniforms.telluxSunDirection).toBe(params.telluxSunDirection)
    expect(shader.vertexShader).toContain('vTelluxWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    expect(overlayIndex).toBeGreaterThan(-1)
    expect(factorIndex).toBeGreaterThan(overlayIndex)
    expect(factorIndex).toBeLessThan(unrollIndex)
    expect(applyIndex).toBeGreaterThan(unrollIndex)
    expect(shader.fragmentShader).not.toContain(
      'tint.rgba *= layerInfo[ i ].opacity * wOpacity;'
    )
  })

  it('does not redeclare day/night locals after overlay loop unroll', () => {
    const mesh = createMesh()
    const params = createOverlayDayNightParams()
    wrapFakeOverlay(mesh.material as THREE.Material)
    wrapOverlayDayNightMaterial(mesh.material as THREE.Material, params)

    const unrolled = simulateUnrollLoops(
      compileShader(mesh.material as THREE.Material).fragmentShader
    )

    expect(unrolled.match(/float telluxSunDot/g)).toHaveLength(1)
    expect(unrolled.match(/float telluxDayFactor/g)).toHaveLength(1)
    expect(unrolled).toContain('telluxDayOpacities[ 0 ]')
    expect(unrolled).toContain('telluxDayOpacities[ 1 ]')
  })

  it('wraps materials found on a tile scene', () => {
    const mesh = createMesh()
    const params = createOverlayDayNightParams()
    applyOverlayDayNightToObject(mesh, params)
    expect(getOverlayDayNightParams(mesh.material as THREE.Material)).toBe(params)
  })
})
