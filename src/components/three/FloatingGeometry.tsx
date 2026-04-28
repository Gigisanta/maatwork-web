'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const MAX_OPACITY = 0.55;
const ROTATION_SPEED_MIN = 0.00006;
const ROTATION_SPEED_MAX = 0.00018;
const FLOAT_AMPLITUDE_MIN = 0.12;
const FLOAT_AMPLITUDE_MAX = 0.28;

// Custom shader for gradient color shift
const gradientVertexShader = `
  varying vec3 vPosition;
  varying vec3 vNormal;

  void main() {
    vPosition = position;
    vNormal = normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const gradientFragmentShader = `
  uniform float uTime;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform float uPhaseOffset;
  uniform float uOpacity;

  varying vec3 vPosition;
  varying vec3 vNormal;

  void main() {
    // Position-based gradient
    float posGradient = (vPosition.y + 1.0) * 0.5;

    // Time-based color cycling
    float timeCycle = uTime * 0.08 + uPhaseOffset;

    // Multi-color blend
    vec3 color = uColor1;
    color = mix(color, uColor2, sin(timeCycle + posGradient * 3.14) * 0.5 + 0.5);
    color = mix(color, uColor3, cos(timeCycle * 0.7 + vPosition.x * 0.5) * 0.3 + 0.3);

    // Edge glow effect
    float edgeGlow = pow(1.0 - abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0))), 2.0);
    color += edgeGlow * 0.15;

    // Subtle shimmer
    float shimmer = sin(uTime * 0.3 + uPhaseOffset * 6.28) * 0.1 + 0.9;
    color *= shimmer;

    gl_FragColor = vec4(color, uOpacity);
  }
`;

interface FloatingShapeProps {
  geometry: THREE.BufferGeometry;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  phaseOffset: number;
  color1: string;
  color2: string;
  color3: string;
  rotationSpeed: number;
  parallaxFactor: number;
  isWireframe: boolean;
}

function FloatingShape({
  geometry,
  position,
  rotation,
  scale,
  phaseOffset,
  color1,
  color2,
  color3,
  rotationSpeed,
  parallaxFactor,
  isWireframe,
}: FloatingShapeProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const basePosition = useRef(new THREE.Vector3(...position));
  const baseRotation = useRef(new THREE.Euler(...rotation));

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor1: { value: new THREE.Color(color1) },
      uColor2: { value: new THREE.Color(color2) },
      uColor3: { value: new THREE.Color(color3) },
      uPhaseOffset: { value: phaseOffset },
      uOpacity: { value: MAX_OPACITY },
    }),
    [color1, color2, color3, phaseOffset]
  );

  useFrame((state) => {
    if (!meshRef.current) return;

    const time = state.clock.getElapsedTime();

    // Organic floating motion with layered sine waves
    const floatX =
      Math.sin(time * 0.12 + phaseOffset) * FLOAT_AMPLITUDE_MAX +
      Math.sin(time * 0.07 + phaseOffset * 1.7) * FLOAT_AMPLITUDE_MIN;
    const floatY =
      Math.cos(time * 0.1 + phaseOffset * 0.6) * FLOAT_AMPLITUDE_MIN +
      Math.sin(time * 0.16 + phaseOffset * 2.3) * FLOAT_AMPLITUDE_MAX * 0.6;
    const floatZ =
      Math.sin(time * 0.08 + phaseOffset * 1.1) * FLOAT_AMPLITUDE_MAX * 0.7 +
      Math.cos(time * 0.05 + phaseOffset) * FLOAT_AMPLITUDE_MIN * 0.4;

    // Gentle parallax based on time
    const parallaxX = Math.sin(time * 0.05 + phaseOffset) * parallaxFactor * 0.3;
    const parallaxY = Math.cos(time * 0.04 + phaseOffset) * parallaxFactor * 0.2;

    meshRef.current.position.x = basePosition.current.x + floatX + parallaxX;
    meshRef.current.position.y = basePosition.current.y + floatY + parallaxY;
    meshRef.current.position.z = basePosition.current.z + floatZ;

    // Slow rotation with varying speeds per axis
    meshRef.current.rotation.x = baseRotation.current.x + time * rotationSpeed * 0.25;
    meshRef.current.rotation.y = baseRotation.current.y + time * rotationSpeed * 0.8;
    meshRef.current.rotation.z = baseRotation.current.z + time * rotationSpeed * 0.4;

    // Update shader uniforms
    if (meshRef.current.material instanceof THREE.ShaderMaterial) {
      meshRef.current.material.uniforms.uTime.value = time;
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometry} scale={scale}>
      {isWireframe ? (
        <shaderMaterial
          vertexShader={gradientVertexShader}
          fragmentShader={gradientFragmentShader}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      ) : (
        <meshStandardMaterial
          color={color1}
          emissive={color1}
          emissiveIntensity={0.08}
          transparent
          opacity={MAX_OPACITY}
          depthWrite={false}
          wireframe
        />
      )}
    </mesh>
  );
}

export function FloatingGeometry() {
  const geometries = {
    octahedron: new THREE.OctahedronGeometry(0.7, 0),
    icosahedron: new THREE.IcosahedronGeometry(0.6, 0),
    dodecahedron: new THREE.DodecahedronGeometry(0.55, 0),
    torus: new THREE.TorusGeometry(0.45, 0.12, 8, 16),
    torusKnot: new THREE.TorusKnotGeometry(0.35, 0.1, 64, 8),
    tetrahedron: new THREE.TetrahedronGeometry(0.65, 0),
  };

  const shapes = [
    // Primary shapes (larger, more prominent)
    {
      geometry: geometries.torusKnot,
      position: [-3.2, 1.5, -2] as [number, number, number],
      rotation: [0.3, 0.5, 0.2] as [number, number, number],
      scale: 1.0,
      phaseOffset: 0,
      color1: '#6366f1',
      color2: '#8b5cf6',
      color3: '#a855f7',
      rotationSpeed: ROTATION_SPEED_MIN + Math.random() * (ROTATION_SPEED_MAX - ROTATION_SPEED_MIN),
      parallaxFactor: 1.4,
      isWireframe: true,
    },
    {
      geometry: geometries.icosahedron,
      position: [3.5, 0.8, -3] as [number, number, number],
      rotation: [0.8, 0.2, 0.4] as [number, number, number],
      scale: 1.1,
      phaseOffset: 1.3,
      color1: '#7c3aed',
      color2: '#6366f1',
      color3: '#4f46e5',
      rotationSpeed: ROTATION_SPEED_MIN + Math.random() * (ROTATION_SPEED_MAX - ROTATION_SPEED_MIN),
      parallaxFactor: 1.0,
      isWireframe: true,
    },
    {
      geometry: geometries.dodecahedron,
      position: [2.0, 2.2, -4] as [number, number, number],
      rotation: [0.2, 0.7, 0.1] as [number, number, number],
      scale: 0.85,
      phaseOffset: 2.6,
      color1: '#8b5cf6',
      color2: '#a855f7',
      color3: '#6366f1',
      rotationSpeed: ROTATION_SPEED_MIN + Math.random() * (ROTATION_SPEED_MAX - ROTATION_SPEED_MIN),
      parallaxFactor: 1.6,
      isWireframe: true,
    },
    {
      geometry: geometries.octahedron,
      position: [-2.5, -0.8, -2.5] as [number, number, number],
      rotation: [0.5, 0.3, 0.6] as [number, number, number],
      scale: 1.0,
      phaseOffset: 3.9,
      color1: '#4f46e5',
      color2: '#7c3aed',
      color3: '#5b21b6',
      rotationSpeed: ROTATION_SPEED_MIN + Math.random() * (ROTATION_SPEED_MAX - ROTATION_SPEED_MIN),
      parallaxFactor: 1.1,
      isWireframe: false,
    },
    // Secondary shapes (smaller, supporting)
    {
      geometry: geometries.torus,
      position: [0.8, -1.8, -5] as [number, number, number],
      rotation: [0.1, 0.9, 0.3] as [number, number, number],
      scale: 0.9,
      phaseOffset: 5.1,
      color1: '#6366f1',
      color2: '#4f46e5',
      color3: '#7c3aed',
      rotationSpeed: ROTATION_SPEED_MIN + Math.random() * (ROTATION_SPEED_MAX - ROTATION_SPEED_MIN),
      parallaxFactor: 1.3,
      isWireframe: true,
    },
    {
      geometry: geometries.tetrahedron,
      position: [-1.2, 2.8, -3.5] as [number, number, number],
      rotation: [0.4, 0.1, 0.8] as [number, number, number],
      scale: 0.75,
      phaseOffset: 6.3,
      color1: '#5b21b6',
      color2: '#8b5cf6',
      color3: '#6366f1',
      rotationSpeed: ROTATION_SPEED_MIN + Math.random() * (ROTATION_SPEED_MAX - ROTATION_SPEED_MIN),
      parallaxFactor: 0.9,
      isWireframe: true,
    },
    {
      geometry: geometries.icosahedron,
      position: [4.2, -1.2, -6] as [number, number, number],
      rotation: [0.6, 0.4, 0.2] as [number, number, number],
      scale: 0.65,
      phaseOffset: 7.5,
      color1: '#7c3aed',
      color2: '#4f46e5',
      color3: '#8b5cf6',
      rotationSpeed: ROTATION_SPEED_MIN + Math.random() * (ROTATION_SPEED_MAX - ROTATION_SPEED_MIN),
      parallaxFactor: 0.7,
      isWireframe: false,
    },
    {
      geometry: geometries.torusKnot,
      position: [-3.8, -2.0, -4] as [number, number, number],
      rotation: [0.2, 0.6, 0.4] as [number, number, number],
      scale: 0.55,
      phaseOffset: 8.7,
      color1: '#a855f7',
      color2: '#6366f1',
      color3: '#5b21b6',
      rotationSpeed: ROTATION_SPEED_MIN + Math.random() * (ROTATION_SPEED_MAX - ROTATION_SPEED_MIN),
      parallaxFactor: 1.2,
      isWireframe: true,
    },
  ];

  return (
    <group>
      {shapes.map((shape, index) => (
        <FloatingShape key={index} {...shape} />
      ))}
    </group>
  );
}