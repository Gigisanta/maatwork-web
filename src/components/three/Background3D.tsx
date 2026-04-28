'use client';

import { Suspense, useEffect, useState, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { Vector2 } from 'three';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

import { ParticleField } from './ParticleField';
import { FloatingGeometry } from './FloatingGeometry';
import { GlassPanel } from './GlassPanel';

function AnimatedScene({ scrollY }: { scrollY: number }) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useFrame((state) => {
    if (!groupRef.current) return;
    const time = state.clock.getElapsedTime();

    // Gentle rotation based on scroll
    const scrollProgress = scrollY / (typeof window !== 'undefined' ? window.innerHeight * 3 : 1000);
    groupRef.current.rotation.y = time * 0.015 + scrollProgress * 0.4;
    groupRef.current.rotation.x = Math.sin(time * 0.08) * 0.04;
  });

  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight position={[5, 5, 5]} intensity={0.5} />
      <directionalLight position={[-5, -5, -5]} intensity={0.15} />
      <pointLight position={[0, 0, 5]} intensity={0.25} color="#8b5cf6" />
      <pointLight position={[3, -2, 4]} intensity={0.15} color="#6366f1" />
      <pointLight position={[-3, 2, 3]} intensity={0.12} color="#a855f7" />

      <group ref={groupRef}>
        <ParticleField count={prefersReducedMotion ? 300 : 700} />
        <FloatingGeometry />
        <GlassPanel />
      </group>

      <EffectComposer>
        <Bloom
          intensity={0.5}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.85}
          mipmapBlur
          radius={0.8}
        />
        <ChromaticAberration
          offset={new Vector2(0.0005, 0.0005)}
          blendFunction={BlendFunction.ADD}
        />
        <Vignette
          offset={0.35}
          darkness={0.35}
          blendFunction={BlendFunction.NORMAL}
        />
      </EffectComposer>
    </>
  );
}

export default function Background3D() {
  const [mounted, setMounted] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    setMounted(true);

    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: -1,
        pointerEvents: 'none',
        mixBlendMode: 'screen',
      }}
    >
      <Canvas
        camera={{
          position: [0, 0, 8],
          fov: 50,
          near: 0.1,
          far: 100,
        }}
        dpr={[1, 1.5]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
        }}
        style={{ background: 'transparent', pointerEvents: 'none', display: 'block' }}
      >
        <Suspense fallback={null}>
          <AnimatedScene scrollY={scrollY} />
        </Suspense>
      </Canvas>
    </div>
  );
}