'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const PARTICLE_COUNT = 800;
const MAX_OPACITY = 0.75;

const vertexShader = `
  uniform float uTime;
  uniform float uScrollSpeed;

  attribute float aScale;
  attribute float aPhase;
  attribute float aSpeed;

  varying float vAlpha;
  varying float vPhase;
  varying float vSpeed;
  varying vec3 vPosition;

  void main() {
    vPhase = aPhase;
    vSpeed = aSpeed;

    vec3 pos = position;

    // Wave-like motion with multiple frequencies
    float waveX = sin(uTime * 0.15 * aSpeed + aPhase * 6.28) * 0.2;
    float waveY = cos(uTime * 0.12 * aSpeed + aPhase * 3.14) * 0.18;
    float waveZ = sin(uTime * 0.1 * aSpeed + aPhase * 4.71) * 0.25;

    // Pulsing effect
    float pulse = sin(uTime * 0.3 * aSpeed + aPhase * 6.28) * 0.5 + 0.5;
    float pulseScale = 0.7 + pulse * 0.3;

    pos.x += waveX * uScrollSpeed;
    pos.y += waveY * uScrollSpeed;
    pos.z += waveZ * uScrollSpeed;

    vPosition = pos;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

    // Size attenuation with pulse
    gl_PointSize = aScale * pulseScale * 320.0 / -mvPosition.z;

    // Fade based on distance
    float distanceFactor = smoothstep(18.0, 2.0, length(mvPosition.xyz));
    vAlpha = aScale * ${MAX_OPACITY.toFixed(2)} * distanceFactor * (0.6 + pulse * 0.4);

    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  uniform float uTime;

  varying float vAlpha;
  varying float vPhase;
  varying float vSpeed;
  varying vec3 vPosition;

  void main() {
    // Circular particle shape
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);

    if (dist > 0.5) discard;

    // Soft glow edge
    float glowEdge = smoothstep(0.5, 0.0, dist);
    float coreGlow = smoothstep(0.3, 0.0, dist);
    float alpha = glowEdge * vAlpha;

    // Violet/purple theme color shifts
    float colorPhase = vPhase + uTime * 0.05 * vSpeed;

    // Base colors: violet, purple, indigo variations
    vec3 color1 = vec3(0.55, 0.35, 0.95); // Violet
    vec3 color2 = vec3(0.75, 0.45, 0.95); // Light purple
    vec3 color3 = vec3(0.45, 0.25, 0.85); // Deep indigo
    vec3 color4 = vec3(0.65, 0.55, 0.95); // Lavender

    // Mix colors based on phase and position
    float colorMix1 = sin(colorPhase * 6.28) * 0.5 + 0.5;
    float colorMix2 = cos(colorPhase * 3.14 + vPosition.y * 0.1) * 0.5 + 0.5;
    float colorMix3 = sin(colorPhase * 1.57 + vPosition.x * 0.05) * 0.5 + 0.5;

    vec3 color = mix(color1, color2, colorMix1);
    color = mix(color, color3, colorMix2 * 0.5);
    color = mix(color, color4, colorMix3 * 0.3);

    // Core glow (brighter center)
    vec3 coreColor = color + vec3(0.2, 0.15, 0.25);
    color = mix(color, coreColor, coreGlow * 0.6);

    // Subtle shimmer
    float shimmer = sin(uTime * 0.8 * vSpeed + vPhase * 12.56) * 0.15 + 0.85;
    color *= shimmer;

    gl_FragColor = vec4(color, alpha);
  }
`;

// Connection lines between nearby particles
const lineVertexShader = `
  attribute float aAlpha;
  varying float vAlpha;

  void main() {
    vAlpha = aAlpha;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const lineFragmentShader = `
  varying float vAlpha;

  void main() {
    gl_FragColor = vec4(0.6, 0.4, 0.9, vAlpha * 0.15);
  }
`;

interface ParticleFieldProps {
  count?: number;
}

export function ParticleField({ count = PARTICLE_COUNT }: ParticleFieldProps) {
  const meshRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const linesRef = useRef<THREE.LineSegments>(null);

  const { positions, scales, phases, speeds } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    const phases = new Float32Array(count);
    const speeds = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Distribute in a spherical volume
      const radius = 6 + Math.random() * 14;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);

      scales[i] = 0.2 + Math.random() * 0.8;
      phases[i] = Math.random() * Math.PI * 2;
      speeds[i] = 0.5 + Math.random() * 1.5;
    }

    return { positions, scales, phases, speeds };
  }, [count]);

  // Generate connection lines between nearby particles
  const { linePositions, lineAlphas } = useMemo(() => {
    const linePositions = new Float32Array(count * 6 * 3); // max 6 connections per particle
    const lineAlphas = new Float32Array(count * 6 * 2);
    let lineIndex = 0;

    const threshold = 2.5;

    for (let i = 0; i < count; i++) {
      const ix = positions[i * 3];
      const iy = positions[i * 3 + 1];
      const iz = positions[i * 3 + 2];
      let connectionCount = 0;

      for (let j = i + 1; j < count && connectionCount < 6; j++) {
        const jx = positions[j * 3];
        const jy = positions[j * 3 + 1];
        const jz = positions[j * 3 + 2];

        const dx = ix - jx;
        const dy = iy - jy;
        const dz = iz - jz;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < threshold) {
          const alpha = 1.0 - dist / threshold;

          linePositions[lineIndex * 6] = ix;
          linePositions[lineIndex * 6 + 1] = iy;
          linePositions[lineIndex * 6 + 2] = iz;
          linePositions[lineIndex * 6 + 3] = jx;
          linePositions[lineIndex * 6 + 4] = jy;
          linePositions[lineIndex * 6 + 5] = jz;

          lineAlphas[lineIndex * 2] = alpha;
          lineAlphas[lineIndex * 2 + 1] = alpha;

          lineIndex++;
          connectionCount++;
        }
      }
    }

    return {
      linePositions: linePositions.slice(0, lineIndex * 6),
      lineAlphas: lineAlphas.slice(0, lineIndex * 2),
    };
  }, [positions, count]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uScrollSpeed: { value: 1.0 },
    }),
    []
  );

  const lineUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
    }),
    []
  );

  const positionAttribute = useMemo(() => new THREE.BufferAttribute(positions, 3), [positions]);
  const sizeAttribute = useMemo(() => new THREE.BufferAttribute(scales, 1), [scales]);
  const phaseAttribute = useMemo(() => new THREE.BufferAttribute(phases, 1), [phases]);
  const speedAttribute = useMemo(() => new THREE.BufferAttribute(speeds, 1), [speeds]);

  const linePositionAttribute = useMemo(
    () => new THREE.BufferAttribute(linePositions, 3),
    [linePositions]
  );
  const lineAlphaAttribute = useMemo(() => new THREE.BufferAttribute(lineAlphas, 1), [lineAlphas]);

  useFrame((state) => {
    if (!materialRef.current || !meshRef.current) return;

    const time = state.clock.getElapsedTime();

    materialRef.current.uniforms.uTime.value = time;

    // Gentle animation based on time
    const timeOffset = time * 0.01;
    const scrollSpeed = 1.0 + Math.sin(timeOffset) * 0.5 + 0.5;
    materialRef.current.uniforms.uScrollSpeed.value = THREE.MathUtils.lerp(
      materialRef.current.uniforms.uScrollSpeed.value,
      scrollSpeed,
      0.015
    );

    // Very slow rotation
    meshRef.current.rotation.y = time * 0.02;
    meshRef.current.rotation.x = Math.sin(time * 0.015) * 0.04;
    meshRef.current.rotation.z = Math.cos(time * 0.012) * 0.03;

    // Update lines
    if (linesRef.current) {
      linesRef.current.rotation.y = meshRef.current.rotation.y;
      linesRef.current.rotation.x = meshRef.current.rotation.x;
      const lineMat = linesRef.current.material as THREE.ShaderMaterial;
      if (lineMat.uniforms && lineMat.uniforms.uTime) {
        lineMat.uniforms.uTime.value = time;
      }
    }
  });

  return (
    <group>
      {/* Connection lines */}
      {linePositions.length > 0 && (
        <lineSegments ref={linesRef}>
          <bufferGeometry>
            <primitive attach="attributes-position" object={linePositionAttribute} />
            <primitive attach="attributes-aAlpha" object={lineAlphaAttribute} />
          </bufferGeometry>
          <shaderMaterial
            vertexShader={lineVertexShader}
            fragmentShader={lineFragmentShader}
            uniforms={lineUniforms}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </lineSegments>
      )}

      {/* Particles */}
      <points ref={meshRef}>
        <bufferGeometry>
          <primitive attach="attributes-position" object={positionAttribute} />
          <primitive attach="attributes-aScale" object={sizeAttribute} />
          <primitive attach="attributes-aPhase" object={phaseAttribute} />
          <primitive attach="attributes-aSpeed" object={speedAttribute} />
        </bufferGeometry>
        <shaderMaterial
          ref={materialRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}