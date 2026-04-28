'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const FLOAT_AMPLITUDE = 0.18;
const ROTATION_SPEED = 0.00008;

// Edge glow shader
const edgeGlowVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const edgeGlowFragmentShader = `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uPhaseOffset;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    // Edge detection based on UV distance from center
    vec2 center = abs(vUv - 0.5) * 2.0;
    float edge = max(center.x, center.y);

    // Edge glow intensity
    float edgeGlow = smoothstep(0.7, 1.0, edge);

    // Pulsing edge glow
    float pulse = sin(uTime * 0.15 + uPhaseOffset) * 0.3 + 0.7;
    edgeGlow *= pulse;

    // Base transparency (very low)
    float baseAlpha = uOpacity * 0.3;

    // Edge alpha (brighter)
    float edgeAlpha = uOpacity + edgeGlow * 0.15;

    // Final alpha
    float alpha = mix(baseAlpha, edgeAlpha, edgeGlow);

    // Color with slight variation
    vec3 color = uColor;
    color += vec3(0.05, 0.03, 0.08) * sin(uTime * 0.1 + uPhaseOffset);

    // Add shimmer
    float shimmer = sin(vPosition.x * 10.0 + uTime * 0.2) * 0.05 + 0.95;
    color *= shimmer;

    gl_FragColor = vec4(color, alpha);
  }
`;

interface GlassPanelItemProps {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  phaseOffset: number;
  color: string;
  parallaxFactor: number;
  opacity: number;
}

function GlassPanelItem({
  position,
  rotation,
  scale,
  phaseOffset,
  color,
  parallaxFactor,
  opacity,
}: GlassPanelItemProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const basePosition = useRef(new THREE.Vector3(...position));
  const baseRotation = useRef(new THREE.Euler(...rotation));

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uPhaseOffset: { value: phaseOffset },
    }),
    [color, opacity, phaseOffset]
  );

  useFrame((state) => {
    if (!meshRef.current || !materialRef.current) return;

    const time = state.clock.getElapsedTime();

    // Slow floating motion
    const floatX = Math.sin(time * 0.12 + phaseOffset) * FLOAT_AMPLITUDE;
    const floatY = Math.cos(time * 0.1 + phaseOffset * 0.8) * FLOAT_AMPLITUDE * 0.6;
    const floatZ = Math.sin(time * 0.08 + phaseOffset * 1.2) * FLOAT_AMPLITUDE * 0.4;

    // Gentle time-based parallax
    const parallaxX = Math.sin(time * 0.05 + phaseOffset) * parallaxFactor * 0.3;
    const parallaxY = Math.cos(time * 0.04 + phaseOffset) * parallaxFactor * 0.2;

    meshRef.current.position.x = basePosition.current.x + floatX + parallaxX;
    meshRef.current.position.y = basePosition.current.y + floatY + parallaxY;
    meshRef.current.position.z = basePosition.current.z + floatZ;

    // Extremely slow rotation
    meshRef.current.rotation.x = baseRotation.current.x + time * ROTATION_SPEED * 300;
    meshRef.current.rotation.y = baseRotation.current.y + time * ROTATION_SPEED * 1200;
    meshRef.current.rotation.z = baseRotation.current.z + time * ROTATION_SPEED * 500;

    // Update shader time
    materialRef.current.uniforms.uTime.value = time;
  });

  return (
    <mesh ref={meshRef} scale={scale}>
      <planeGeometry args={[1, 1, 32, 32]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={edgeGlowVertexShader}
        fragmentShader={edgeGlowFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export function GlassPanel() {
  const panels = [
    // Back layer - distant, subtle
    {
      position: [-5.0, 1.0, -10] as [number, number, number],
      rotation: [0.1, 0.35, 0.05] as [number, number, number],
      scale: [5.0, 3.5, 1] as [number, number, number],
      phaseOffset: 0,
      color: '#3730a3',
      parallaxFactor: 0.3,
      opacity: 0.18,
    },
    {
      position: [5.5, -0.5, -11] as [number, number, number],
      rotation: [0.05, -0.25, 0.06] as [number, number, number],
      scale: [4.2, 2.8, 1] as [number, number, number],
      phaseOffset: 2.3,
      color: '#4f46e5',
      parallaxFactor: 0.4,
      opacity: 0.15,
    },
    // Middle layer
    {
      position: [-2.5, 0.2, -7] as [number, number, number],
      rotation: [0.08, 0.15, -0.03] as [number, number, number],
      scale: [4.5, 3.0, 1] as [number, number, number],
      phaseOffset: 4.8,
      color: '#4338ca',
      parallaxFactor: 0.6,
      opacity: 0.24,
    },
    {
      position: [3.0, 1.5, -8] as [number, number, number],
      rotation: [0.04, -0.18, 0.07] as [number, number, number],
      scale: [3.5, 2.2, 1] as [number, number, number],
      phaseOffset: 6.5,
      color: '#6366f1',
      parallaxFactor: 0.7,
      opacity: 0.20,
    },
    // Front layer - closer, more visible
    {
      position: [-3.5, -1.0, -5] as [number, number, number],
      rotation: [-0.06, 0.25, -0.04] as [number, number, number],
      scale: [4.8, 3.2, 1] as [number, number, number],
      phaseOffset: 8.2,
      color: '#5b21b6',
      parallaxFactor: 0.9,
      opacity: 0.28,
    },
    {
      position: [2.0, -1.5, -6] as [number, number, number],
      rotation: [0.05, -0.12, 0.08] as [number, number, number],
      scale: [3.0, 2.0, 1] as [number, number, number],
      phaseOffset: 9.8,
      color: '#7c3aed',
      parallaxFactor: 1.0,
      opacity: 0.26,
    },
    // Small accent panels
    {
      position: [0.5, 2.8, -9] as [number, number, number],
      rotation: [-0.03, 0.0, 0.02] as [number, number, number],
      scale: [2.5, 1.5, 1] as [number, number, number],
      phaseOffset: 11.0,
      color: '#8b5cf6',
      parallaxFactor: 0.5,
      opacity: 0.17,
    },
    {
      position: [-1.0, -2.5, -7] as [number, number, number],
      rotation: [0.02, 0.3, -0.05] as [number, number, number],
      scale: [3.2, 2.0, 1] as [number, number, number],
      phaseOffset: 12.5,
      color: '#4f46e5',
      parallaxFactor: 0.8,
      opacity: 0.22,
    },
    {
      position: [4.0, 2.0, -9] as [number, number, number],
      rotation: [-0.04, -0.2, 0.03] as [number, number, number],
      scale: [2.8, 1.8, 1] as [number, number, number],
      phaseOffset: 14.0,
      color: '#6366f1',
      parallaxFactor: 0.55,
      opacity: 0.20,
    },
  ];

  return (
    <group>
      {panels.map((panel, index) => (
        <GlassPanelItem key={index} {...panel} />
      ))}
    </group>
  );
}