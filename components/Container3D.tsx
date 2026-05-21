
import React, { useEffect, useMemo, Suspense, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Text, PerspectiveCamera, Edges, Loader, RoundedBox, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { Container, PlacedItem } from '../types';

const EV_TRUCK_GLB_URL = '/models/ev-truck.glb';
const USE_GLB_TRUCK = false;

// Opción A: Modelo Proxy Ligero (Optimizado para web)

// Pre-cargar para mejorar experiencia
// Escena procedimental local para evitar depender de assets GLB remotos.

  
  // Posicionamiento Ajustado para este modelo específico

interface Container3DProps {
  container: Container;
  placedItems: PlacedItem[];
  showWeightHeatmap?: boolean;
  cameraView?: 'iso' | 'front';
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const shadeHex = (hex: string, amount: number) => {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return hex;
  const parts = [0, 2, 4].map((start) => {
    const channel = Number.parseInt(normalized.slice(start, start + 2), 16);
    return clamp(channel + amount, 0, 255).toString(16).padStart(2, '0');
  });
  return `#${parts.join('')}`;
};

const TruckImageFallback: React.FC<{ container: Container; placedItems: PlacedItem[] }> = ({ container, placedItems }) => {
  const [rotation, setRotation] = useState({ x: -12, y: -24 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number; rotationX: number; rotationY: number } | null>(null);

  if (container.type !== 'truck') return null;

  const trailer = { width: 560, height: 190, depth: 170 };

  const visibleItems = useMemo(() => {
    return placedItems
      .slice(0, 140)
      .map((item, index) => {
        const xRatio = clamp(item.position[0] / container.width, 0, 1);
        const zRatio = clamp(item.position[2] / container.length, 0, 1);
        const width = clamp((item.length / container.length) * trailer.width, 18, 82);
        const height = clamp((item.height / container.height) * trailer.height, 16, 64);
        const depth = clamp((item.width / container.width) * trailer.depth, 22, 82);
        const left = clamp(zRatio * (trailer.width - width), 0, trailer.width - width);
        const top = clamp(trailer.height - ((item.position[1] + item.height) / container.height) * trailer.height, 0, trailer.height - height);
        const z = clamp((xRatio - 0.5) * (trailer.depth - depth), -trailer.depth / 2, trailer.depth / 2);
        return {
          item,
          index,
          left,
          top,
          width,
          height,
          depth,
          z,
        };
      })
      .sort((a, b) => a.z - b.z || a.top - b.top || a.index - b.index);
  }, [container, placedItems]);

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragStart({ x: event.clientX, y: event.clientY, rotationX: rotation.x, rotationY: rotation.y });
  };

  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStart) return;
    const nextY = dragStart.rotationY + (event.clientX - dragStart.x) * 0.35;
    const nextX = clamp(dragStart.rotationX - (event.clientY - dragStart.y) * 0.24, -42, 10);
    setRotation({ x: nextX, y: nextY });
  };

  const stopDrag = () => setDragStart(null);

  return (
    <div
      className="absolute inset-0 z-20 overflow-hidden bg-[radial-gradient(circle_at_40%_20%,#f3f7f4_0%,#c8cfcb_42%,#aeb7b2_100%)] cursor-grab active:cursor-grabbing"
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
      onDoubleClick={() => setRotation({ x: -12, y: -24 })}
    >
      <div
        className="absolute left-1/2 top-1/2 h-[460px] w-[820px] -translate-x-1/2 -translate-y-1/2"
        style={{ perspective: '1200px' }}
      >
        <div
          className="absolute left-1/2 top-1/2"
          style={{
            transformStyle: 'preserve-3d',
            transform: `translate3d(-50%, -45%, 0) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
            transition: dragStart ? 'none' : 'transform 180ms ease-out',
          }}
        >
          <div className="absolute left-[-370px] top-[18px] h-[132px] w-[168px] rounded-[48px_28px_20px_24px] bg-[#f8fafc] shadow-2xl border border-white/80" style={{ transform: 'translateZ(28px)', transformStyle: 'preserve-3d' }}>
            <div className="absolute left-[22px] top-[20px] h-[50px] w-[118px] rounded-[28px_20px_8px_8px] bg-slate-950/85 shadow-inner" />
            <div className="absolute bottom-[18px] left-[26px] h-[12px] w-[112px] rounded-full bg-slate-950/80" />
            <div className="absolute right-[-18px] top-[42px] h-[50px] w-[30px] rounded-r-xl bg-slate-900" />
            <div className="absolute bottom-[28px] right-[18px] h-[3px] w-[74px] rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.9)]" />
          </div>

          <div
            className="absolute left-[-210px] top-[-35px]"
            style={{
              width: trailer.width,
              height: trailer.height,
              transformStyle: 'preserve-3d',
            }}
          >
            <div
              className="absolute left-0 top-0 border border-emerald-500/70 bg-emerald-100/10 shadow-[inset_0_0_32px_rgba(16,185,129,0.16)]"
              style={{
                width: trailer.width,
                height: trailer.height,
                transform: `translateZ(${trailer.depth / 2}px)`,
              }}
            />
            <div
              className="absolute left-0 top-0 border border-emerald-900/40 bg-slate-950/18"
              style={{
                width: trailer.width,
                height: trailer.depth,
                transformOrigin: 'top left',
                transform: `rotateX(90deg) translateY(-${trailer.depth / 2}px) translateZ(0px)`,
              }}
            />
            <div
              className="absolute left-0 top-0 border border-white/60 bg-white/20"
              style={{
                width: trailer.width,
                height: trailer.depth,
                transformOrigin: 'top left',
                transform: `rotateX(90deg) translateY(-${trailer.depth / 2}px) translateZ(${trailer.height}px)`,
              }}
            />
            <div
              className="absolute left-0 top-0 border border-emerald-700/45 bg-white/14"
              style={{
                width: trailer.depth,
                height: trailer.height,
                transformOrigin: 'top left',
                transform: `rotateY(90deg) translateX(-${trailer.depth / 2}px)`,
              }}
            />
            <div
              className="absolute right-0 top-0 border border-emerald-700/45 bg-white/10"
              style={{
                width: trailer.depth,
                height: trailer.height,
                transformOrigin: 'top right',
                transform: `rotateY(90deg) translateX(-${trailer.depth / 2}px)`,
              }}
            />
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="absolute top-0 h-full w-[3px] bg-slate-700/45"
                style={{ left: `${(index / 7) * 100}%`, transform: `translateZ(${trailer.depth / 2 + 2}px)` }}
              />
            ))}

            {visibleItems.map(({ item, left, top, width, height, depth, z }, index) => {
              const topColor = shadeHex(item.color, 28);
              const sideColor = shadeHex(item.color, -38);
              const backColor = shadeHex(item.color, -18);
              return (
                <div
                  key={`${item.id}-${index}`}
                  className="absolute"
                  style={{
                    left,
                    top,
                    width,
                    height,
                    transformStyle: 'preserve-3d',
                    transform: `translateZ(${z}px)`,
                  }}
                >
                  <div className="absolute inset-0 border border-black/35 shadow-[0_8px_12px_rgba(0,0,0,0.16)]" style={{ backgroundColor: item.color, transform: `translateZ(${depth / 2}px)` }} />
                  <div className="absolute inset-0 border border-black/15" style={{ backgroundColor: backColor, transform: `rotateY(180deg) translateZ(${depth / 2}px)` }} />
                  <div
                    className="absolute top-0 border border-black/25"
                    style={{
                      width: depth,
                      height,
                      right: -depth,
                      backgroundColor: sideColor,
                      transformOrigin: 'left center',
                      transform: 'rotateY(90deg)',
                    }}
                  />
                  <div
                    className="absolute left-0 border border-black/25"
                    style={{
                      width,
                      height: depth,
                      top: -depth,
                      backgroundColor: topColor,
                      transformOrigin: 'bottom center',
                      transform: 'rotateX(90deg)',
                    }}
                  />
                </div>
              );
            })}

            {[-0.18, 1.18].map((side) =>
              [80, 180, 460, 520].map((x, index) => (
                <div
                  key={`${side}-${x}-${index}`}
                  className="absolute h-[42px] w-[42px] rounded-full border-[9px] border-slate-950 bg-slate-500 shadow-xl"
                  style={{
                    left: x,
                    top: trailer.height + 18,
                    transform: `translateZ(${(side - 0.5) * trailer.depth}px) rotateY(90deg)`,
                  }}
                />
              ))
            )}
          </div>

          <div
            className="absolute left-[-378px] top-[155px] h-[24px] w-[758px] rounded bg-slate-950 shadow-xl"
            style={{ transform: 'translateZ(0px)' }}
          />
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/12 to-transparent" />
    </div>
  );
};

const CanvasAutoSizer: React.FC = () => {
  const { gl, setSize } = useThree();

  useEffect(() => {
    const parent = gl.domElement.parentElement;
    if (!parent) return;

    const syncSize = () => {
      const { width, height } = parent.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      setSize(width, height);
    };

    syncSize();
    const observer = new ResizeObserver(syncSize);
    observer.observe(parent);
    window.addEventListener('resize', syncSize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', syncSize);
    };
  }, [gl, setSize]);

  return null;
};

class GlbErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

const CargoBox: React.FC<{ item: PlacedItem; container: Container }> = ({ item, container }) => {
  // Posicionamiento relativo al centro del contenedor (Three.js coordenadas)
  const xPos = (item.position[0] - container.width / 2) / 100;
  const yPos = item.position[1] / 100;
  const zPos = (item.position[2] - container.length / 2) / 100;

  const w = item.width / 100;
  const h = item.height / 100;
  const l = item.length / 100;

  return (
    <group position={[xPos, yPos, zPos]}>
      <mesh receiveShadow castShadow>
        <boxGeometry args={[w, h, l]} />
        <meshStandardMaterial 
          color={item.color} 
          roughness={0.4} 
          metalness={0.05} 
          emissive={item.color}
          emissiveIntensity={0.1}
        />
        <Edges color="#000000" threshold={15} />
      </mesh>
      {/* Etiqueta de ID o Nombre en la cara superior */}
      <Text
        position={[0, h / 2 + 0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={Math.min(w, l) * 0.2}
        color="black"
        anchorX="center"
        anchorY="middle"
        maxWidth={w * 0.8}
      >
        {item.name.slice(0, 10)}
      </Text>
    </group>
  );
};

const Wheel: React.FC<{ position: [number, number, number]; side?: -1 | 1; dual?: boolean }> = ({ position, side = 1, dual = false }) => {
  const tireOffsets = dual ? [0, side * 0.16] : [0];

  return (
    <group position={position}>
      {tireOffsets.map((offset, tireIndex) => (
        <group key={tireIndex} position={[offset, 0, 0]}>
          <mesh rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow>
            <torusGeometry args={[0.31, 0.1, 16, 36]} />
            <meshStandardMaterial color="#101214" roughness={0.78} metalness={0.08} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.2, 0.2, 0.13, 32]} />
            <meshStandardMaterial color="#d8dee6" metalness={0.85} roughness={0.18} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]} position={[side * 0.01, 0, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 0.16, 24]} />
            <meshStandardMaterial color="#5b6470" metalness={0.7} roughness={0.22} />
          </mesh>
          {Array.from({ length: 8 }).map((_, index) => {
            const angle = (index / 8) * Math.PI * 2;
            return (
              <mesh key={index} position={[side * 0.08, Math.sin(angle) * 0.12, Math.cos(angle) * 0.12]} castShadow>
                <sphereGeometry args={[0.018, 8, 8]} />
                <meshStandardMaterial color="#f8fafc" metalness={0.9} roughness={0.2} />
              </mesh>
            );
          })}
        </group>
      ))}
    </group>
  );
};

const EvTruckGlbModel: React.FC<{ container: Container }> = ({ container }) => {
  const gltf = useGLTF(EV_TRUCK_GLB_URL);

  const scene = useMemo(() => {
    const applyGreenFinish = (material: THREE.Material) => {
      if ('color' in material && material.color instanceof THREE.Color) {
        material.color.set('#0f8f5f');
      }
      if ('metalness' in material) {
        (material as THREE.MeshStandardMaterial).metalness = 0.55;
      }
      if ('roughness' in material) {
        (material as THREE.MeshStandardMaterial).roughness = 0.38;
      }
      if ('envMapIntensity' in material) {
        (material as THREE.MeshStandardMaterial).envMapIntensity = 1.25;
      }
      material.needsUpdate = true;
    };

    const cloned = gltf.scene.clone(true);
    cloned.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
        if (Array.isArray(object.material)) {
          object.material = object.material.map((material) => {
            const clonedMaterial = material.clone();
            applyGreenFinish(clonedMaterial);
            return clonedMaterial;
          });
        } else if (object.material) {
          object.material = object.material.clone();
          applyGreenFinish(object.material);
        }
      }
    });
    return cloned;
  }, [gltf.scene]);

  const targetLength = container.length / 100 + 2.8;
  const scale = targetLength / 1.1418512038667852;
  const yOffset = -0.36;
  const zOffset = 0.65;

  return (
    <group position={[0, yOffset, zOffset]} scale={[scale, scale, scale]}>
      <primitive object={scene} />
    </group>
  );
};

const GlbTruckPlaceholder: React.FC<{ container: Container }> = ({ container }) => {
  const w = container.width / 100;
  const h = (container.height || 240) / 100;
  const l = container.length / 100;
  const cabZ = l / 2 + 1.25;

  return (
    <group>
      <mesh position={[0, -0.18, 0]} castShadow receiveShadow>
        <boxGeometry args={[w + 0.22, 0.18, l + 0.24]} />
        <meshStandardMaterial color="#12372f" metalness={0.35} roughness={0.4} />
      </mesh>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, l]} />
        <meshStandardMaterial color="#16a34a" transparent opacity={0.11} side={THREE.DoubleSide} />
        <Edges color="#047857" />
      </mesh>
      <RoundedBox args={[w * 0.92, 1.35, 1.75]} radius={0.18} smoothness={8} position={[0, 0.48, cabZ]} castShadow receiveShadow>
        <meshStandardMaterial color="#0f8f5f" metalness={0.45} roughness={0.32} />
      </RoundedBox>
      <RoundedBox args={[w * 0.72, 0.52, 0.08]} radius={0.04} smoothness={6} position={[0, 0.9, cabZ + 0.9]} castShadow>
        <meshStandardMaterial color="#0f172a" metalness={0.15} roughness={0.18} transparent opacity={0.7} />
      </RoundedBox>
      {[-w / 2 - 0.18, w / 2 + 0.18].map((x, sideIndex) =>
        [cabZ + 0.45, l / 2 - 0.3, -l / 2 + 0.45].map((z) => (
          <Wheel key={`${sideIndex}-${z}`} position={[x, -0.34, z]} side={sideIndex === 0 ? -1 : 1} dual={z < l / 2} />
        ))
      )}
    </group>
  );
};

const TruckModelWithGlb: React.FC<{ container: Container }> = ({ container }) => {
  if (!USE_GLB_TRUCK) return <GlbTruckPlaceholder container={container} />;

  return (
    <GlbErrorBoundary>
      <Suspense fallback={<GlbTruckPlaceholder container={container} />}>
        <EvTruckGlbModel container={container} />
      </Suspense>
    </GlbErrorBoundary>
  );
};

const WoodPalletModel: React.FC<{ container: Container }> = ({ container }) => {
  const w = container.width / 100;
  const l = container.length / 100;
  const deckY = 0.08;
  const plankCount = 5;

  return (
    <group>
      {Array.from({ length: plankCount }).map((_, index) => {
        const x = -w / 2 + (index + 0.5) * (w / plankCount);
        return (
          <mesh key={`top-${index}`} position={[x, deckY, 0]} castShadow receiveShadow>
            <boxGeometry args={[w / plankCount - 0.04, 0.08, l]} />
            <meshStandardMaterial color="#b7793b" roughness={0.75} metalness={0.02} />
            <Edges color="#6b3f1f" />
          </mesh>
        );
      })}
      {[-l / 2 + 0.18, 0, l / 2 - 0.18].map((z, row) =>
        [-w / 2 + 0.18, 0, w / 2 - 0.18].map((x, col) => (
          <mesh key={`block-${row}-${col}`} position={[x, -0.05, z]} castShadow receiveShadow>
            <boxGeometry args={[0.18, 0.18, 0.18]} />
            <meshStandardMaterial color="#8b5a2b" roughness={0.85} />
          </mesh>
        ))
      )}
      {[-l / 2 + 0.18, 0, l / 2 - 0.18].map((z, index) => (
        <mesh key={`runner-${index}`} position={[0, -0.18, z]} castShadow receiveShadow>
          <boxGeometry args={[w, 0.07, 0.1]} />
          <meshStandardMaterial color="#6f4423" roughness={0.85} />
        </mesh>
      ))}
      <mesh position={[0, container.height / 200, 0]}>
        <boxGeometry args={[w, container.height / 100, l]} />
        <meshStandardMaterial color="#10b981" transparent opacity={0.06} side={THREE.DoubleSide} />
        <Edges color="#059669" />
      </mesh>
    </group>
  );
};

const TrailerModel: React.FC<{ container: Container }> = ({ container }) => {
  const w = container.width / 100;
  const h = (container.height || 240) / 100;
  const l = container.length / 100;

  return (
    <group>
      <mesh position={[0, -0.08, 0]} castShadow receiveShadow>
        <boxGeometry args={[w + 0.18, 0.16, l + 0.25]} />
        <meshStandardMaterial color="#263238" metalness={0.45} roughness={0.35} />
      </mesh>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, l]} />
        <meshStandardMaterial color="#e5e7eb" transparent opacity={0.16} side={THREE.DoubleSide} />
        <Edges color="#047857" />
      </mesh>
      {[-w / 2, w / 2].map((x, side) => (
        <group key={`side-${side}`} position={[x, h / 2, 0]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.05, h, l]} />
            <meshStandardMaterial color="#dbe4df" metalness={0.25} roughness={0.45} transparent opacity={0.55} />
          </mesh>
          {Array.from({ length: 10 }).map((_, index) => (
            <mesh key={index} position={[0, 0, -l / 2 + index * (l / 9)]}>
              <boxGeometry args={[0.07, h, 0.035]} />
              <meshStandardMaterial color="#8aa39a" roughness={0.45} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[0, h + 0.03, 0]} castShadow>
        <boxGeometry args={[w, 0.06, l]} />
        <meshStandardMaterial color="#f8fafc" metalness={0.15} roughness={0.55} />
      </mesh>
      <mesh position={[0, h / 2, l / 2 + 0.04]} castShadow>
        <boxGeometry args={[w, h, 0.08]} />
        <meshStandardMaterial color="#eef2f7" roughness={0.45} />
        <Edges color="#64748b" />
      </mesh>
      {[-w / 2 - 0.08, w / 2 + 0.08].map((x) =>
        [-l / 2 + 0.8, -l / 2 + 1.3].map((z, index) => <Wheel key={`${x}-${z}-${index}`} position={[x, -0.35, z]} />)
      )}
      {[-0.3, 0.3].map((x) => (
        <mesh key={x} position={[x, 0.08, l / 2 + 0.1]}>
          <sphereGeometry args={[0.06, 12, 12]} />
          <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={1.5} />
        </mesh>
      ))}
    </group>
  );
};

const ContainerShellModel: React.FC<{ container: Container }> = ({ container }) => {
  const w = container.width / 100;
  const h = (container.height || 240) / 100;
  const l = container.length / 100;

  return (
    <group>
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, 0.08, l]} />
        <meshStandardMaterial color="#0f766e" metalness={0.35} roughness={0.4} />
      </mesh>
      {[-w / 2, w / 2].map((x, side) => (
        <group key={`container-side-${side}`} position={[x, h / 2, 0]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.06, h, l]} />
            <meshStandardMaterial color="#0f766e" transparent opacity={0.34} metalness={0.25} roughness={0.45} />
          </mesh>
          {Array.from({ length: 18 }).map((_, index) => (
            <mesh key={index} position={[0, 0, -l / 2 + index * (l / 17)]}>
              <boxGeometry args={[0.08, h, 0.035]} />
              <meshStandardMaterial color="#064e3b" roughness={0.5} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[0, h / 2, -l / 2]} castShadow receiveShadow>
        <boxGeometry args={[w, h, 0.06]} />
        <meshStandardMaterial color="#047857" transparent opacity={0.4} />
      </mesh>
      <group position={[0, h / 2, l / 2]}>
        {[-w / 4, w / 4].map((x, index) => (
          <mesh key={index} position={[x, 0, 0.04]} castShadow receiveShadow>
            <boxGeometry args={[w / 2 - 0.03, h, 0.08]} />
            <meshStandardMaterial color="#ecfdf5" metalness={0.2} roughness={0.35} transparent opacity={0.7} />
            <Edges color="#065f46" />
          </mesh>
        ))}
      </group>
      <mesh position={[0, h + 0.03, 0]} castShadow>
        <boxGeometry args={[w, 0.06, l]} />
        <meshStandardMaterial color="#064e3b" roughness={0.45} />
      </mesh>
    </group>
  );
};

const TruckBody: React.FC<{ container: Container }> = ({ container }) => {
  const w = container.width / 100;
  const h = (container.height || 240) / 100;
  const l = container.length / 100;

  return (
    <group>
      {/* Paredes del remolque - Diseño Industrial Estilizado */}
      {/* Estructura base (Vigas longitudinales) */}
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, 0.1, l]} />
        <meshStandardMaterial color="#1f2937" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Lados - Paneles Corrugados */}
      {[-w / 2, w / 2].map((x, i) => (
        <group key={i} position={[x, h / 2, 0]}>
          <boxGeometry args={[0.05, h, l]} />
          <meshStandardMaterial color="#d1d5db" metalness={0.6} roughness={0.4} />
          {/* Ribbing (refuerzos verticales) */}
          {Array.from({ length: 15 }).map((_, j) => (
            <mesh key={j} position={[0, 0, -l / 2 + j * (l / 14)]}>
              <boxGeometry args={[0.07, h, 0.05]} />
              <meshStandardMaterial color="#9ca3af" />
            </mesh>
          ))}
        </group>
      ))}

      {/* Frontal (con refuerzo) */}
      <mesh position={[0, h / 2, -l / 2]} castShadow receiveShadow>
        <boxGeometry args={[w, h, 0.05]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.5} roughness={0.5} />
      </mesh>

      {/* Techo */}
      <mesh position={[0, h, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, 0.05, l]} />
        <meshStandardMaterial color="#111827" metalness={0.2} roughness={0.8} />
      </mesh>

      {/* Puertas traseras */}
      <group position={[0, h / 2, l / 2]}>
        <mesh position={[-w / 4, 0, 0]} castShadow>
          <boxGeometry args={[w / 2 - 0.02, h, 0.05]} />
          <meshStandardMaterial color="#d1d5db" />
        </mesh>
        <mesh position={[w / 4, 0, 0]} castShadow>
          <boxGeometry args={[w / 2 - 0.02, h, 0.05]} />
          <meshStandardMaterial color="#d1d5db" />
        </mesh>
      </group>
      {(container.type === 'truck') && (
        <group>
          {/* Chasis del tractor (desde el acople hasta el parachoques) */}
          <mesh position={[0, -0.1, l / 2 + 1.6]} receiveShadow>
            <boxGeometry args={[w - 0.4, 0.2, 3.2]} />
            <meshStandardMaterial color="#111111" />
          </mesh>

          {/* Quinta Rueda (Acople) */}
          <group position={[0, 0.1, l / 2 + 0.2]}>
            <mesh receiveShadow>
              <cylinderGeometry args={[0.4, 0.45, 0.1, 32]} />
              <meshStandardMaterial color="#222222" metalness={0.8} roughness={0.2} />
            </mesh>
            <mesh position={[0, 0, -0.2]}>
              <boxGeometry args={[0.1, 0.1, 0.4]} />
              <meshStandardMaterial color="#111111" />
            </mesh>
          </group>

          {/* Pasos laterales / Estribos Chrome */}
          <mesh position={[-w / 2 - 0.05, 0.1, l / 2 + 1.2]} castShadow>
            <boxGeometry args={[0.2, 0.05, 1.0]} />
            <meshStandardMaterial color="#e2e8f0" metalness={1} roughness={0.1} />
          </mesh>
          <mesh position={[w / 2 + 0.05, 0.1, l / 2 + 1.2]} castShadow>
            <boxGeometry args={[0.2, 0.05, 1.0]} />
            <meshStandardMaterial color="#e2e8f0" metalness={1} roughness={0.1} />
          </mesh>

          {/* Faldones laterales (Side Skirts) del tractor */}
          <mesh position={[-w / 2, 0.2, l / 2 + 0.5]} castShadow>
            <boxGeometry args={[0.1, 0.6, 1.8]} />
            <meshStandardMaterial color="#111111" />
          </mesh>
          <mesh position={[w / 2, 0.2, l / 2 + 0.5]} castShadow>
            <boxGeometry args={[0.1, 0.6, 1.8]} />
            <meshStandardMaterial color="#111111" />
          </mesh>

          {/* Cabina Estilo Americano (Kenworth/Peterbilt) */}
          <group position={[0, 0, l / 2 + 1.6]}>
            {/* Capó (Nose) */}
            <mesh position={[0, 0.5, 0.8]} castShadow>
              <boxGeometry args={[w - 0.2, 1.0, 1.6]} />
              <meshStandardMaterial color="#111111" roughness={0.2} metalness={0.5} />
            </mesh>

            {/* Parrilla Chrome */}
            <mesh position={[0, 0.5, 1.61]} castShadow>
              <boxGeometry args={[w - 0.4, 0.9, 0.05]} />
              <meshStandardMaterial color="#e2e8f0" metalness={1} roughness={0.1} />
            </mesh>
            {/* Detalles de la parrilla (Líneas verticales) */}
            <group position={[0, 0.5, 1.63]}>
              {[-0.2, -0.1, 0, 0.1, 0.2].map((x, i) => (
                <mesh key={i} position={[x, 0, 0]}>
                  <boxGeometry args={[0.02, 0.8, 0.01]} />
                  <meshStandardMaterial color="#444444" />
                </mesh>
              ))}
            </group>

            {/* Parachoques (Bumper) Chrome */}
            <mesh position={[0, 0.1, 1.65]} castShadow>
              <boxGeometry args={[w + 0.1, 0.3, 0.1]} />
              <meshStandardMaterial color="#e2e8f0" metalness={1} roughness={0.1} />
            </mesh>

            {/* Cabina Principal */}
            <mesh position={[0, 1.2, -0.2]} castShadow>
              <boxGeometry args={[w + 0.05, 1.4, 1.2]} />
              <meshStandardMaterial color="#111111" roughness={0.2} metalness={0.5} />
            </mesh>

            {/* Sleeper (Parte trasera de la cabina) */}
            <mesh position={[0, 1.4, -1.2]} castShadow>
              <boxGeometry args={[w + 0.1, 1.8, 1.0]} />
              <meshStandardMaterial color="#111111" roughness={0.2} metalness={0.5} />
            </mesh>

            {/* Deflectores de aire laterales (Fairings) */}
            <mesh position={[-w / 2 - 0.05, 1.4, -1.2]} castShadow>
              <boxGeometry args={[0.05, 1.8, 1.0]} />
              <meshStandardMaterial color="#111111" roughness={0.2} metalness={0.5} />
            </mesh>
            <mesh position={[w / 2 + 0.05, 1.4, -1.2]} castShadow>
              <boxGeometry args={[0.05, 1.8, 1.0]} />
              <meshStandardMaterial color="#111111" roughness={0.2} metalness={0.5} />
            </mesh>

            {/* Deflector de Techo (Roof Fairing) */}
            <mesh position={[0, 2.1, -0.2]} castShadow>
              <boxGeometry args={[w - 0.2, 0.4, 1.2]} />
              <meshStandardMaterial color="#111111" roughness={0.2} metalness={0.5} />
            </mesh>

            {/* Interior - Asientos (visibles por el parabrisas) */}
            <mesh position={[-0.4, 0.8, -0.2]} castShadow>
              <boxGeometry args={[0.4, 0.6, 0.4]} />
              <meshStandardMaterial color="#222222" />
            </mesh>
            <mesh position={[0.4, 0.8, -0.2]} castShadow>
              <boxGeometry args={[0.4, 0.6, 0.4]} />
              <meshStandardMaterial color="#222222" />
            </mesh>

            {/* Mangueras de aire (Air Hoses) detrás del sleeper */}
            <group position={[0, 0.8, -1.75]}>
              {[-0.1, 0, 0.1].map((x, i) => (
                <mesh key={i} position={[x, 0, 0]}>
                  <cylinderGeometry args={[0.02, 0.02, 0.8, 8]} />
                  <meshStandardMaterial color={i === 0 ? "#ef4444" : i === 1 ? "#3b82f6" : "#222222"} />
                </mesh>
              ))}
            </group>

            {/* Suelo de la cabina / Tractor Floor */}
            <mesh position={[0, 0.4, -0.2]} receiveShadow>
              <boxGeometry args={[w + 0.2, 0.1, 3.2]} />
              <meshStandardMaterial color="#0a0a0a" />
            </mesh>

            {/* Parabrisas */}
            <mesh position={[0, 1.4, 0.41]}>
              <boxGeometry args={[w - 0.1, 0.6, 0.05]} />
              <meshStandardMaterial color="#1e293b" transparent opacity={0.7} metalness={0.9} roughness={0.1} />
            </mesh>

            {/* Visera Chrome */}
            <mesh position={[0, 1.75, 0.45]} rotation={[0.2, 0, 0]}>
              <boxGeometry args={[w + 0.15, 0.1, 0.3]} />
              <meshStandardMaterial color="#e2e8f0" metalness={1} roughness={0.1} />
            </mesh>

            {/* Luces de techo */}
            <group position={[0, 1.9, 0.4]}>
              {[-0.3, -0.15, 0, 0.15, 0.3].map((x, i) => (
                <mesh key={i} position={[x, 0, 0]}>
                  <sphereGeometry args={[0.03, 8, 8]} />
                  <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={2} />
                </mesh>
              ))}
            </group>

            {/* Espejos Retrovisores */}
            <group position={[-w / 2 - 0.15, 1.4, 0.2]}>
              <mesh castShadow>
                <boxGeometry args={[0.05, 0.4, 0.15]} />
                <meshStandardMaterial color="#e2e8f0" metalness={1} roughness={0.1} />
              </mesh>
              <mesh position={[0.05, 0, 0]}>
                <boxGeometry args={[0.1, 0.02, 0.02]} />
                <meshStandardMaterial color="#e2e8f0" metalness={1} roughness={0.1} />
              </mesh>
            </group>
            <group position={[w / 2 + 0.15, 1.4, 0.2]}>
              <mesh castShadow>
                <boxGeometry args={[0.05, 0.4, 0.15]} />
                <meshStandardMaterial color="#e2e8f0" metalness={1} roughness={0.1} />
              </mesh>
              <mesh position={[-0.05, 0, 0]}>
                <boxGeometry args={[0.1, 0.02, 0.02]} />
                <meshStandardMaterial color="#e2e8f0" metalness={1} roughness={0.1} />
              </mesh>
            </group>

            {/* Chimeneas (Exhaust Pipes) */}
            <group position={[-w / 2 - 0.1, 1.5, -0.2]}>
              <mesh castShadow>
                <cylinderGeometry args={[0.08, 0.08, 2.5, 16]} />
                <meshStandardMaterial color="#e2e8f0" metalness={1} roughness={0.1} />
              </mesh>
              {/* Punta curva */}
              <mesh position={[0, 1.25, 0.05]} rotation={[0.5, 0, 0]}>
                <cylinderGeometry args={[0.08, 0.08, 0.3, 16]} />
                <meshStandardMaterial color="#e2e8f0" metalness={1} roughness={0.1} />
              </mesh>
            </group>
            <group position={[w / 2 + 0.1, 1.5, -0.2]}>
              <mesh castShadow>
                <cylinderGeometry args={[0.08, 0.08, 2.5, 16]} />
                <meshStandardMaterial color="#e2e8f0" metalness={1} roughness={0.1} />
              </mesh>
              {/* Punta curva */}
              <mesh position={[0, 1.25, 0.05]} rotation={[0.5, 0, 0]}>
                <cylinderGeometry args={[0.08, 0.08, 0.3, 16]} />
                <meshStandardMaterial color="#e2e8f0" metalness={1} roughness={0.1} />
              </mesh>
            </group>

            {/* Tanques de combustible Chrome */}
            <mesh position={[-w / 2 - 0.1, 0.2, -1.5]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.25, 0.25, 1.2, 16]} />
              <meshStandardMaterial color="#e2e8f0" metalness={1} roughness={0.1} />
            </mesh>
            <mesh position={[w / 2 + 0.1, 0.2, -1.5]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.25, 0.25, 1.2, 16]} />
              <meshStandardMaterial color="#e2e8f0" metalness={1} roughness={0.1} />
            </mesh>
          </group>
        </group>
      )}

      {/* Ruedas - Configuración de camión pesado */}
      {/* Eje delantero */}
      <Wheel position={[-w / 2 - 0.05, -0.35, l / 2 + 2.4]} />
      <Wheel position={[w / 2 + 0.05, -0.35, l / 2 + 2.4]} />
      
      {/* Ejes traseros (Tandem) */}
      <Wheel position={[-w / 2 - 0.05, -0.35, l / 2 - 0.5]} />
      <Wheel position={[w / 2 + 0.05, -0.35, l / 2 - 0.5]} />
      <Wheel position={[-w / 2 - 0.05, -0.35, l / 2 - 1.1]} />
      <Wheel position={[w / 2 + 0.05, -0.35, l / 2 - 1.1]} />

      {/* Ruedas traseras del remolque */}
      <Wheel position={[-w / 2 - 0.05, -0.35, -l / 2 + 1]} />
      <Wheel position={[w / 2 + 0.05, -0.35, -l / 2 + 1]} />
      <Wheel position={[-w / 2 - 0.05, -0.35, -l / 2 + 1.6]} />
      <Wheel position={[w / 2 + 0.05, -0.35, -l / 2 + 1.6]} />
    </group>
  );
};

const TeslaInspiredCab: React.FC<{ width: number; baseZ: number }> = ({ width, baseZ }) => {
  const cabW = Math.min(width + 0.28, 2.85);

  return (
    <group position={[0, 0, baseZ]}>
      <mesh position={[0, 0.02, -0.08]} castShadow receiveShadow>
        <boxGeometry args={[cabW - 0.36, 0.14, 2.75]} />
        <meshStandardMaterial color="#111827" metalness={0.55} roughness={0.24} />
      </mesh>

      <RoundedBox args={[cabW - 0.18, 0.78, 1.42]} radius={0.22} smoothness={5} position={[0, 0.5, 0.72]} rotation={[-0.08, 0, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#f8fafc" metalness={0.22} roughness={0.18} />
      </RoundedBox>
      <RoundedBox args={[cabW, 1.5, 1.5]} radius={0.24} smoothness={5} position={[0, 1.08, 0.16]} castShadow receiveShadow>
        <meshStandardMaterial color="#f1f5f9" metalness={0.18} roughness={0.16} />
      </RoundedBox>
      <RoundedBox args={[cabW - 0.18, 1.45, 1.1]} radius={0.26} smoothness={5} position={[0, 1.62, -0.72]} rotation={[-0.16, 0, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#e5e7eb" metalness={0.2} roughness={0.17} />
      </RoundedBox>
      <RoundedBox args={[cabW - 0.3, 0.24, 1.92]} radius={0.18} smoothness={5} position={[0, 2.22, -0.05]} rotation={[-0.08, 0, 0]} castShadow>
        <meshStandardMaterial color="#f8fafc" metalness={0.2} roughness={0.14} />
      </RoundedBox>

      <RoundedBox args={[cabW - 0.36, 0.92, 0.06]} radius={0.08} smoothness={8} position={[0, 1.42, 0.78]} rotation={[0.18, 0, 0]}>
        <meshPhysicalMaterial color="#0f172a" transparent opacity={0.78} roughness={0.02} metalness={0.35} transmission={0.08} />
        <Edges color="#93c5fd" threshold={12} />
      </RoundedBox>
      {[-cabW / 2 - 0.01, cabW / 2 + 0.01].map((x, index) => (
        <mesh key={index} position={[x, 1.35, 0.08]} rotation={[0, 0, index === 0 ? -0.06 : 0.06]}>
          <boxGeometry args={[0.055, 0.78, 0.74]} />
          <meshPhysicalMaterial color="#111827" transparent opacity={0.72} roughness={0.02} transmission={0.06} />
          <Edges color="#bfdbfe" threshold={12} />
        </mesh>
      ))}

      <RoundedBox args={[cabW - 0.42, 0.18, 0.08]} radius={0.06} smoothness={8} position={[0, 0.48, 1.42]} castShadow>
        <meshStandardMaterial color="#111827" metalness={0.35} roughness={0.2} />
      </RoundedBox>
      <RoundedBox args={[cabW + 0.08, 0.22, 0.16]} radius={0.08} smoothness={8} position={[0, 0.2, 1.5]} castShadow>
        <meshStandardMaterial color="#0f172a" metalness={0.55} roughness={0.18} />
      </RoundedBox>
      <mesh position={[0, 0.62, 1.51]}>
        <boxGeometry args={[cabW - 0.76, 0.035, 0.025]} />
        <meshStandardMaterial color="#34d399" emissive="#10b981" emissiveIntensity={0.8} />
      </mesh>

      {[-0.58, 0.58].map((x) => (
        <mesh key={x} position={[x, 0.43, 1.5]}>
          <boxGeometry args={[0.34, 0.055, 0.04]} />
          <meshStandardMaterial color="#e0f2fe" emissive="#93c5fd" emissiveIntensity={1.25} />
        </mesh>
      ))}

      {[-cabW / 2 - 0.11, cabW / 2 + 0.11].map((x, index) => (
        <group key={index} position={[x, 1.26, 0.54]}>
          <mesh castShadow>
            <boxGeometry args={[0.035, 0.42, 0.075]} />
            <meshStandardMaterial color="#111827" metalness={0.45} roughness={0.18} />
          </mesh>
          <mesh position={[index === 0 ? -0.08 : 0.08, 0.06, 0.04]}>
            <boxGeometry args={[0.2, 0.1, 0.025]} />
            <meshStandardMaterial color="#020617" metalness={0.55} roughness={0.16} />
          </mesh>
        </group>
      ))}

      <mesh position={[0, 0.34, -0.64]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.19, 0.19, 1.25, 32]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.12} />
      </mesh>
      <RoundedBox args={[cabW - 0.5, 0.18, 0.62]} radius={0.1} smoothness={8} position={[0, 0.16, -0.08]} castShadow>
        <meshStandardMaterial color="#111827" metalness={0.45} roughness={0.22} />
      </RoundedBox>
    </group>
  );
};

const EnhancedTruckBody: React.FC<{ container: Container }> = ({ container }) => {
  const w = container.width / 100;
  const h = (container.height || 240) / 100;
  const l = container.length / 100;
  const sideX = w / 2 + 0.02;
  const ribCount = 8;
  const tractorBaseZ = l / 2 + 1.1;
  const rearWheelZ = -l / 2 + 1.15;

  return (
    <group>
      <mesh position={[0, -0.08, 0]} castShadow receiveShadow>
        <boxGeometry args={[w + 0.32, 0.16, l + 0.28]} />
        <meshStandardMaterial color="#18212b" metalness={0.45} roughness={0.32} />
      </mesh>

      {[-0.38, 0.38].map((x) => (
        <mesh key={x} position={[x, -0.01, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.12, 0.14, l + 0.55]} />
          <meshStandardMaterial color="#0f172a" metalness={0.65} roughness={0.25} />
        </mesh>
      ))}

      <mesh position={[0, 0.04, 0]} receiveShadow>
        <boxGeometry args={[w, 0.06, l]} />
        <meshStandardMaterial color="#1f2937" metalness={0.25} roughness={0.5} />
      </mesh>

      {[-sideX, sideX].map((x, sideIndex) => (
        <group key={sideIndex} position={[x, h / 2, 0]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.045, h, l]} />
            <meshPhysicalMaterial color="#f8fafc" transparent opacity={0.26} roughness={0.02} metalness={0.08} transmission={0.24} side={THREE.DoubleSide} />
            <Edges color="#6b7280" threshold={12} />
          </mesh>
          <mesh position={[0, -h / 2 + 0.18, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.08, 0.34, l]} />
            <meshStandardMaterial color="#1f2937" metalness={0.35} roughness={0.3} />
          </mesh>
          {Array.from({ length: ribCount }).map((_, index) => (
            <mesh key={index} position={[0, 0, -l / 2 + (index * l) / (ribCount - 1)]} castShadow>
              <boxGeometry args={[0.055, h + 0.02, 0.03]} />
              <meshStandardMaterial color="#4b5563" transparent opacity={0.78} metalness={0.35} roughness={0.22} />
            </mesh>
          ))}
          <mesh position={[0, h / 2 - 0.06, 0]} castShadow>
            <boxGeometry args={[0.1, 0.12, l + 0.06]} />
            <meshStandardMaterial color="#111827" metalness={0.45} roughness={0.24} />
          </mesh>
          <mesh position={[0, -h / 2 + 0.43, 0.02]}>
            <boxGeometry args={[0.095, 0.035, l - 0.2]} />
            <meshStandardMaterial color="#44d62c" emissive="#22c55e" emissiveIntensity={0.35} />
          </mesh>
        </group>
      ))}

      <mesh position={[0, h + 0.04, 0]} castShadow receiveShadow>
        <boxGeometry args={[w + 0.12, 0.055, l + 0.1]} />
        <meshPhysicalMaterial color="#f8fafc" transparent opacity={0.24} roughness={0.02} metalness={0.05} transmission={0.3} side={THREE.DoubleSide} />
        <Edges color="#4b5563" />
      </mesh>

      <group position={[0, h / 2, -l / 2]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[w, h, 0.06]} />
          <meshStandardMaterial color="#ecfdf5" transparent opacity={0.28} metalness={0.15} roughness={0.2} />
          <Edges color="#047857" />
        </mesh>
        <Text position={[0, h / 2 - 0.18, -0.035]} fontSize={0.12} color="#065f46" anchorX="center" anchorY="middle">
          CUBICAJE VISIBLE
        </Text>
      </group>

      <group position={[0, h / 2, l / 2]}>
        {[-w / 4, w / 4].map((x, index) => (
          <mesh key={index} position={[x, 0, 0.04]} castShadow receiveShadow>
            <boxGeometry args={[w / 2 - 0.02, h, 0.08]} />
            <meshStandardMaterial color="#dff7ea" transparent opacity={0.34} metalness={0.18} roughness={0.18} />
            <Edges color="#065f46" />
          </mesh>
        ))}
        <mesh position={[0, 0, 0.09]}>
          <boxGeometry args={[0.035, h * 0.86, 0.03]} />
          <meshStandardMaterial color="#0f172a" metalness={0.55} roughness={0.22} />
        </mesh>
      </group>

      {false && <group position={[0, 0, tractorBaseZ]}>
        <mesh position={[0, 0.02, 0.1]} castShadow receiveShadow>
          <boxGeometry args={[w - 0.34, 0.18, 2.6]} />
          <meshStandardMaterial color="#101820" metalness={0.55} roughness={0.28} />
        </mesh>

        <group position={[0, 0.15, -0.65]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.38, 0.45, 0.1, 36]} />
            <meshStandardMaterial color="#111827" metalness={0.75} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.02, -0.12]} castShadow>
            <boxGeometry args={[0.85, 0.06, 0.22]} />
            <meshStandardMaterial color="#374151" metalness={0.7} roughness={0.25} />
          </mesh>
        </group>

        <mesh position={[0, 0.48, 0.82]} castShadow receiveShadow>
          <boxGeometry args={[w - 0.28, 0.62, 1.15]} />
          <meshStandardMaterial color="#0f766e" metalness={0.42} roughness={0.24} />
        </mesh>
        <mesh position={[0, 0.82, 0.28]} castShadow receiveShadow>
          <boxGeometry args={[w + 0.02, 1.25, 1.02]} />
          <meshStandardMaterial color="#064e3b" metalness={0.5} roughness={0.22} />
        </mesh>
        <mesh position={[0, 1.23, -0.58]} castShadow receiveShadow>
          <boxGeometry args={[w + 0.08, 1.62, 0.9]} />
          <meshStandardMaterial color="#0b3b33" metalness={0.45} roughness={0.24} />
        </mesh>
        <mesh position={[0, 1.9, -0.18]} rotation={[-0.12, 0, 0]} castShadow>
          <boxGeometry args={[w - 0.16, 0.22, 1.5]} />
          <meshStandardMaterial color="#0f766e" metalness={0.38} roughness={0.2} />
        </mesh>

        <mesh position={[0, 1.02, 0.82]} rotation={[0.15, 0, 0]}>
          <boxGeometry args={[w - 0.32, 0.5, 0.05]} />
          <meshPhysicalMaterial color="#c7f9ff" transparent opacity={0.5} roughness={0.02} transmission={0.2} />
          <Edges color="#e0f2fe" />
        </mesh>
        {[-w / 2 - 0.02, w / 2 + 0.02].map((x, index) => (
          <mesh key={index} position={[x, 1.05, 0.26]}>
            <boxGeometry args={[0.045, 0.46, 0.56]} />
            <meshPhysicalMaterial color="#bff4ff" transparent opacity={0.42} roughness={0.02} transmission={0.18} />
            <Edges color="#e0f2fe" />
          </mesh>
        ))}

        <mesh position={[0, 0.46, 1.42]} castShadow>
          <boxGeometry args={[w - 0.38, 0.64, 0.08]} />
          <meshStandardMaterial color="#f1f5f9" metalness={0.9} roughness={0.12} />
        </mesh>
        {Array.from({ length: 7 }).map((_, index) => (
          <mesh key={index} position={[-0.42 + index * 0.14, 0.46, 1.47]}>
            <boxGeometry args={[0.028, 0.56, 0.02]} />
            <meshStandardMaterial color="#334155" metalness={0.45} roughness={0.25} />
          </mesh>
        ))}
        <mesh position={[0, 0.12, 1.5]} castShadow>
          <boxGeometry args={[w + 0.18, 0.24, 0.18]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.95} roughness={0.1} />
        </mesh>
        {[-0.52, 0.52].map((x) => (
          <mesh key={x} position={[x, 0.42, 1.51]}>
            <sphereGeometry args={[0.09, 16, 16]} />
            <meshStandardMaterial color="#fef3c7" emissive="#fde68a" emissiveIntensity={1.6} />
          </mesh>
        ))}

        {[-w / 2 - 0.18, w / 2 + 0.18].map((x, index) => (
          <group key={index} position={[x, 0.92, 0.62]}>
            <mesh castShadow>
              <boxGeometry args={[0.05, 0.32, 0.1]} />
              <meshStandardMaterial color="#e5e7eb" metalness={0.9} roughness={0.12} />
            </mesh>
            <mesh position={[index === 0 ? -0.08 : 0.08, 0.03, 0.05]}>
              <boxGeometry args={[0.18, 0.12, 0.025]} />
              <meshStandardMaterial color="#0f172a" metalness={0.5} roughness={0.2} />
            </mesh>
          </group>
        ))}

        {[-w / 2 - 0.16, w / 2 + 0.16].map((x) => (
          <mesh key={x} position={[x, 0.28, -0.52]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.19, 0.19, 0.95, 24]} />
            <meshStandardMaterial color="#d9e2ec" metalness={0.95} roughness={0.1} />
          </mesh>
        ))}

        {[-w / 2 - 0.12, w / 2 + 0.12].map((x, index) => (
          <mesh key={index} position={[x, 1.08, -0.56]} castShadow>
            <cylinderGeometry args={[0.055, 0.055, 1.9, 18]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.12} />
          </mesh>
        ))}
      </group>}

      <TeslaInspiredCab width={w} baseZ={tractorBaseZ} />

      <Wheel position={[-w / 2 - 0.14, -0.34, l / 2 + 2.1]} side={-1} />
      <Wheel position={[w / 2 + 0.14, -0.34, l / 2 + 2.1]} side={1} />
      <Wheel position={[-w / 2 - 0.14, -0.34, l / 2 + 0.05]} side={-1} dual />
      <Wheel position={[w / 2 + 0.14, -0.34, l / 2 + 0.05]} side={1} dual />
      <Wheel position={[-w / 2 - 0.14, -0.34, l / 2 - 0.55]} side={-1} dual />
      <Wheel position={[w / 2 + 0.14, -0.34, l / 2 - 0.55]} side={1} dual />

      {[rearWheelZ, rearWheelZ + 0.62].map((z) => (
        <React.Fragment key={z}>
          <Wheel position={[-w / 2 - 0.14, -0.34, z]} side={-1} dual />
          <Wheel position={[w / 2 + 0.14, -0.34, z]} side={1} dual />
        </React.Fragment>
      ))}
    </group>
  );
};

const ContainerModel: React.FC<{ container: Container }> = ({ container }) => {
  const w = container.width / 100;
  const h = (container.height || 240) / 100;
  const l = container.length / 100;
  const Model =
    container.type === 'pallet'
      ? WoodPalletModel
      : container.type === 'trailer' || container.type === 'platform'
        ? TrailerModel
        : container.type === 'container'
          ? ContainerShellModel
          : EnhancedTruckBody;

  return (
    <group>
      {container.type === 'truck' && USE_GLB_TRUCK ? (
        <TruckModelWithGlb container={container} />
      ) : (
        <Model container={container} />
      )}
      
      {/* Guía visual del espacio de carga siempre presente para referencia */}
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, l]} />
        <meshStandardMaterial color="#10b981" transparent opacity={0.08} side={THREE.DoubleSide} />
        <Edges color="#059669" />
      </mesh>
    </group>
  );
};

const CenterOfGravity: React.FC<{ items: PlacedItem[]; container: Container }> = ({ items, container }) => {
  const cog = useMemo(() => {
    if (items.length === 0) return null;
    let totalWeight = 0;
    let weightedX = 0;
    let weightedY = 0;
    let weightedZ = 0;
    items.forEach(item => {
      totalWeight += item.weight;
      weightedX += item.position[0] * item.weight;
      weightedY += item.position[1] * item.weight;
      weightedZ += item.position[2] * item.weight;
    });
    return [
      (weightedX / totalWeight - container.width / 2) / 100,
      (weightedY / totalWeight) / 100, 
      (weightedZ / totalWeight - container.length / 2) / 100
    ];
  }, [items, container]);

  if (!cog) return null;

  return (
    <group position={[cog[0], cog[1], cog[2]]}>
      <mesh>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={2} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -cog[1] + 0.01, 0]}>
        <ringGeometry args={[0.2, 0.25, 32]} />
        <meshStandardMaterial color="#ef4444" />
      </mesh>
    </group>
  );
};

export const Container3D: React.FC<Container3DProps> = ({ container, placedItems, showWeightHeatmap, cameraView = 'iso' }) => {
  const cameraPosition: [number, number, number] = cameraView === 'front' ? [0, 5, 14] : [10, 8, 12];

  return (
    <div className="canvas-container relative w-full h-full bg-[#bebebe]">
      <TruckImageFallback container={container} placedItems={placedItems} />
      <Canvas
        className={`canvas-container__surface relative z-0 ${container.type === 'truck' ? 'pointer-events-none' : ''}`}
        dpr={[1, 1]}
        gl={{ antialias: false, alpha: true, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false }}
        style={{ display: 'block' }}
      >
        <CanvasAutoSizer />
        <PerspectiveCamera makeDefault position={cameraPosition} fov={40} />
        <OrbitControls 
          makeDefault 
          maxPolarAngle={Math.PI / 2 - 0.05}
          minDistance={2}
          maxDistance={50}
        />
        <ambientLight intensity={0.7} />
        <spotLight position={[10, 15, 10]} angle={0.25} penumbra={1} castShadow intensity={2} />
        <directionalLight position={[-10, 10, -5]} intensity={0.5} />
        
        <group>
          <ContainerModel container={container} />
          {placedItems.map((item, idx) => (
            <CargoBox key={`${item.id}-${idx}`} item={item} container={container} />
          ))}
          {showWeightHeatmap && <CenterOfGravity items={placedItems} container={container} />}
        </group>

        <Grid 
          infiniteGrid 
          cellSize={1} 
          sectionSize={5} 
          fadeDistance={50} 
          sectionColor="#999999" 
          cellColor="#bbbbbb" 
          position={[0, -0.05, 0]} 
        />
      </Canvas>
      <Loader />
      
      {placedItems.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/10 backdrop-blur-sm px-6 py-3 rounded-full border border-black/5">
            <span className="text-xs font-black uppercase tracking-widest text-gray-500 italic">No hay carga posicionada</span>
          </div>
        </div>
      )}
    </div>
  );
};
