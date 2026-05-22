
import React, { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Text, PerspectiveCamera, Edges, RoundedBox, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls as ThreeOrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Container, PlacedItem } from '../types';

const EV_TRUCK_GLB_URL = '/models/ev-truck-original.glb';
const DRACO_DECODER_PATH = '/draco/';
const USE_GLB_TRUCK = true;

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

const CanvasAutoSizer: React.FC = () => {
  const { gl, setSize } = useThree();

  useEffect(() => {
    const parent = gl.domElement.parentElement;
    if (!parent) return;

    const syncSize = () => {
      const { width, height } = parent.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      gl.setSize(width, height, false);
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

const SoftwareTruckFallback: React.FC<Container3DProps> = ({ container, placedItems }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const rotationRef = useRef({ x: -0.18, y: -0.72 });
  const dragRef = useRef<{ x: number; y: number; rx: number; ry: number } | null>(null);
  const geometryRef = useRef<{ positions: Float32Array; indices: Uint16Array | Uint32Array; center: THREE.Vector3; size: THREE.Vector3 } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(DRACO_DECODER_PATH);
    loader.setDRACOLoader(dracoLoader);
    loader.load(EV_TRUCK_GLB_URL, (gltf) => {
      if (cancelled) return;
      let sourceGeometry: THREE.BufferGeometry | null = null;
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse((object) => {
        if (!sourceGeometry && object instanceof THREE.Mesh) {
          sourceGeometry = object.geometry.clone();
          sourceGeometry.applyMatrix4(object.matrixWorld);
        }
      });
      if (!sourceGeometry) return;
      const position = sourceGeometry.getAttribute('position');
      const index = sourceGeometry.getIndex();
      if (!position || !index) return;
      sourceGeometry.computeBoundingBox();
      const box = sourceGeometry.boundingBox || new THREE.Box3();
      geometryRef.current = {
        positions: position.array as Float32Array,
        indices: index.array as Uint16Array | Uint32Array,
        center: box.getCenter(new THREE.Vector3()),
        size: box.getSize(new THREE.Vector3()),
      };
      draw();
    });

    return () => {
      cancelled = true;
      dracoLoader.dispose();
    };
  }, []);

  const projectScene = (point: THREE.Vector3, camera: THREE.PerspectiveCamera, matrix: THREE.Matrix4, scale: number, width: number, height: number) => {
    const projected = point.clone().multiplyScalar(scale).applyMatrix4(matrix).project(camera);
    return {
      x: (projected.x * 0.5 + 0.5) * width,
      y: (-projected.y * 0.5 + 0.5) * height,
      z: projected.z,
    };
  };

  const drawCargoBox = (
    ctx: CanvasRenderingContext2D,
    camera: THREE.PerspectiveCamera,
    matrix: THREE.Matrix4,
    scale: number,
    width: number,
    height: number,
    item: PlacedItem
  ) => {
    const cargoLength = container.length / 100;
    const cargoWidth = container.width / 100;
    const cargoHeight = (container.height || 240) / 100;
    const itemW = item.width / 100;
    const itemH = item.height / 100;
    const itemL = item.length / 100;
    const baseX = (item.position[0] - container.width / 2) / 100;
    const baseY = item.position[1] / 100;
    const baseZ = (item.position[2] - container.length / 2) / 100;
    const cargoScale = 0.13;
    const offset = new THREE.Vector3(0, -0.08, 0.02);
    const corners = [
      [baseX, baseY, baseZ], [baseX + itemW, baseY, baseZ], [baseX + itemW, baseY + itemH, baseZ], [baseX, baseY + itemH, baseZ],
      [baseX, baseY, baseZ + itemL], [baseX + itemW, baseY, baseZ + itemL], [baseX + itemW, baseY + itemH, baseZ + itemL], [baseX, baseY + itemH, baseZ + itemL],
    ].map(([x, y, z]) => new THREE.Vector3(
      (x / cargoWidth) * 0.24,
      (y / cargoHeight) * 0.24 - 0.18,
      (z / cargoLength) * 1.0
    ).multiplyScalar(cargoScale).add(offset));
    const faces = [
      [0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [3, 2, 6, 7], [1, 5, 6, 2], [0, 3, 7, 4],
    ];
    const projected = corners.map((corner) => projectScene(corner, camera, matrix, scale, width, height));
    faces
      .map((face) => ({ face, z: face.reduce((sum, idx) => sum + projected[idx].z, 0) / face.length }))
      .sort((a, b) => b.z - a.z)
      .forEach(({ face }, faceIndex) => {
        ctx.beginPath();
        face.forEach((idx, i) => {
          const p = projected[idx];
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
        ctx.fillStyle = faceIndex === 0 ? item.color : faceIndex === 1 ? item.color : `${item.color}dd`;
        ctx.strokeStyle = 'rgba(17, 24, 39, 0.45)';
        ctx.lineWidth = 1;
        ctx.fill();
        ctx.stroke();
      });
  };

  const draw = () => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    const geometry = geometryRef.current;
    if (!canvas || !host || !geometry) return;
    const rect = host.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = '#bebebe';
    ctx.fillRect(0, 0, rect.width, rect.height);

    const camera = new THREE.PerspectiveCamera(34, rect.width / rect.height, 0.1, 10);
    camera.position.set(0, 0, 2.9);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    const matrix = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rotationRef.current.x, rotationRef.current.y, 0));
    const maxSize = Math.max(geometry.size.x, geometry.size.z, geometry.size.y);
    const scale = 1.45 / maxSize;
    const triangles: Array<{ points: { x: number; y: number; z: number }[]; z: number; light: number }> = [];
    const pos = geometry.positions;
    const idx = geometry.indices;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const normal = new THREE.Vector3();
    for (let i = 0; i < idx.length; i += 3) {
      const ia = idx[i] * 3;
      const ib = idx[i + 1] * 3;
      const ic = idx[i + 2] * 3;
      a.set(pos[ia] - geometry.center.x, -(pos[ia + 2] - geometry.center.z), pos[ia + 1] - geometry.center.y);
      b.set(pos[ib] - geometry.center.x, -(pos[ib + 2] - geometry.center.z), pos[ib + 1] - geometry.center.y);
      c.set(pos[ic] - geometry.center.x, -(pos[ic + 2] - geometry.center.z), pos[ic + 1] - geometry.center.y);
      normal.subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize().applyMatrix4(matrix);
      const points = [a, b, c].map((point) => projectScene(point, camera, matrix, scale, rect.width, rect.height));
      triangles.push({
        points,
        z: (points[0].z + points[1].z + points[2].z) / 3,
        light: Math.max(0.35, Math.min(0.95, 0.52 + normal.z * 0.32 + normal.y * 0.16)),
      });
    }
    triangles.sort((left, right) => right.z - left.z);
    triangles.forEach(({ points, light }) => {
      const g = Math.round(105 + light * 70);
      const bColor = Math.round(82 + light * 70);
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      ctx.lineTo(points[1].x, points[1].y);
      ctx.lineTo(points[2].x, points[2].y);
      ctx.closePath();
      ctx.fillStyle = `rgb(14, ${g}, ${bColor})`;
      ctx.fill();
    });
    placedItems.slice(0, 120).forEach((item) => drawCargoBox(ctx, camera, matrix, scale, rect.width, rect.height, item));
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new ResizeObserver(draw);
    observer.observe(host);
    return () => observer.disconnect();
  }, [placedItems, container]);

  const startDrag = (event: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = { x: event.clientX, y: event.clientY, rx: rotationRef.current.x, ry: rotationRef.current.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    rotationRef.current = {
      x: Math.max(-0.9, Math.min(0.35, dragRef.current.rx - (event.clientY - dragRef.current.y) * 0.006)),
      y: dragRef.current.ry + (event.clientX - dragRef.current.x) * 0.008,
    };
    draw();
  };

  return (
    <div ref={hostRef} className="w-full h-full bg-[#bebebe]">
      <canvas
        ref={canvasRef}
        className="block w-full h-full cursor-grab active:cursor-grabbing"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={() => { dragRef.current = null; }}
        onPointerCancel={() => { dragRef.current = null; }}
      />
    </div>
  );
};

const DirectTruckViewer: React.FC<Container3DProps> = ({ container, placedItems, showWeightHeatmap, cameraView = 'iso' }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [webglFailed, setWebglFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    setWebglFailed(false);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#bebebe');

    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(...(cameraView === 'front' ? [0, 5, 14] as [number, number, number] : [10, 8, 12] as [number, number, number]));

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    } catch {
      setWebglFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.localClippingEnabled = true;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      setWebglFailed(true);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost, false);
    host.appendChild(renderer.domElement);
    const healthTimer = window.setTimeout(() => {
      if (renderer.getContext().isContextLost()) {
        setWebglFailed(true);
      }
    }, 600);

    const controls = new ThreeOrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance = 2;
    controls.maxDistance = 50;

    scene.add(new THREE.AmbientLight('#ffffff', 0.72));

    const keyLight = new THREE.SpotLight('#ffffff', 2, 0, 0.25, 1);
    keyLight.position.set(10, 15, 10);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight('#ffffff', 0.55);
    fillLight.position.set(-10, 10, -5);
    scene.add(fillLight);

    const grid = new THREE.GridHelper(60, 60, '#999999', '#bbbbbb');
    grid.position.y = -0.05;
    scene.add(grid);

    const w = container.width / 100;
    const h = (container.height || 240) / 100;
    const l = container.length / 100;
    const cargoLift = 0.22;
    const truckCutawayPlanes = [
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), w / 2 + 1.25),
      new THREE.Plane(new THREE.Vector3(1, 0, 0), w / 2 + 1.25),
    ];

    const volumeEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, l)),
      new THREE.LineBasicMaterial({ color: '#059669' })
    );
    volumeEdges.renderOrder = 4;
    volumeEdges.position.set(0, h / 2 + cargoLift, 0);
    scene.add(volumeEdges);

    const cargoGroup = new THREE.Group();
    cargoGroup.position.y = cargoLift;
    placedItems.forEach((item) => {
      const itemW = item.width / 100;
      const itemH = item.height / 100;
      const itemL = item.length / 100;
      const xPos = (item.position[0] + item.width / 2 - container.width / 2) / 100;
      const yPos = (item.position[1] + item.height / 2) / 100;
      const zPos = (item.position[2] + item.length / 2 - container.length / 2) / 100;
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(itemW, itemH, itemL),
        new THREE.MeshStandardMaterial({
          color: item.color,
          roughness: 0.4,
          metalness: 0.05,
          emissive: new THREE.Color(item.color),
          emissiveIntensity: 0.08,
        })
      );
      box.position.set(xPos, yPos, zPos);
      box.castShadow = true;
      box.receiveShadow = true;
      box.renderOrder = 3;
      cargoGroup.add(box);

      const boxEdges = new THREE.LineSegments(
        new THREE.EdgesGeometry(box.geometry),
        new THREE.LineBasicMaterial({ color: '#111111' })
      );
      boxEdges.position.copy(box.position);
      boxEdges.renderOrder = 4;
      cargoGroup.add(boxEdges);
    });
    scene.add(cargoGroup);

    if (showWeightHeatmap && placedItems.length > 0) {
      let totalWeight = 0;
      const weighted = new THREE.Vector3();
      placedItems.forEach((item) => {
        totalWeight += item.weight;
        weighted.x += (item.position[0] + item.width / 2) * item.weight;
        weighted.y += (item.position[1] + item.height / 2) * item.weight;
        weighted.z += (item.position[2] + item.length / 2) * item.weight;
      });
      weighted.divideScalar(totalWeight);
      const cog = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 16, 16),
        new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#ef4444', emissiveIntensity: 1.6 })
      );
      cog.position.set((weighted.x - container.width / 2) / 100, weighted.y / 100 + cargoLift, (weighted.z - container.length / 2) / 100);
      scene.add(cog);
    }

    let cancelled = false;
    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(DRACO_DECODER_PATH);
    loader.setDRACOLoader(dracoLoader);
    loader.load(
      EV_TRUCK_GLB_URL,
      (gltf) => {
        if (cancelled) return;
        const model = gltf.scene;
        model.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          object.castShadow = true;
          object.receiveShadow = true;
          object.renderOrder = 1;
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => {
            material.side = THREE.DoubleSide;
            material.depthTest = true;
            material.depthWrite = true;
            material.transparent = false;
            material.opacity = 1;
            material.clippingPlanes = truckCutawayPlanes;
            material.clipShadows = true;
            if ('color' in material && material.color instanceof THREE.Color) {
              material.color.lerp(new THREE.Color('#0f8f5f'), 0.72);
            }
            if ('emissive' in material && material.emissive instanceof THREE.Color) {
              material.emissive.set('#063f2c');
              material.emissiveIntensity = 0.12;
            }
            if ('metalness' in material && typeof material.metalness === 'number') {
              material.metalness = Math.max(material.metalness, 0.34);
            }
            if ('roughness' in material && typeof material.roughness === 'number') {
              material.roughness = Math.min(Math.max(material.roughness, 0.28), 0.48);
            }
            material.needsUpdate = true;
          });
        });

        const cabAllowance = Math.min(7.2, Math.max(4.5, l * 0.46));
        const targetLength = l + cabAllowance;
        const targetWidth = w + 2.2;
        const targetHeight = h + 1.45;

        const rotationCandidates = [
          new THREE.Euler(0, 0, 0),
          new THREE.Euler(0, Math.PI / 2, 0),
          new THREE.Euler(0, -Math.PI / 2, 0),
          new THREE.Euler(Math.PI / 2, 0, 0),
          new THREE.Euler(-Math.PI / 2, 0, 0),
          new THREE.Euler(0, 0, Math.PI / 2),
          new THREE.Euler(0, 0, -Math.PI / 2),
        ];

        let bestRotation = rotationCandidates[0];
        let bestSize = new THREE.Vector3(1, 1, 1);
        let bestScore = Number.POSITIVE_INFINITY;
        rotationCandidates.forEach((rotation) => {
          model.position.set(0, 0, 0);
          model.scale.set(1, 1, 1);
          model.rotation.copy(rotation);
          model.updateMatrixWorld(true);
          const candidateSize = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
          const lengthScore = Math.abs((candidateSize.z / Math.max(candidateSize.x, 0.001)) - (targetLength / targetWidth));
          const widthPenalty = candidateSize.x > candidateSize.z ? 6 : 0;
          const heightPenalty = candidateSize.y > candidateSize.z * 0.45 ? 4 : 0;
          const score = lengthScore + widthPenalty + heightPenalty;
          if (score < bestScore) {
            bestScore = score;
            bestRotation = rotation;
            bestSize = candidateSize;
          }
        });

        model.position.set(0, 0, 0);
        model.rotation.copy(bestRotation);
        model.rotateY(Math.PI);
        model.rotateZ(Math.PI / 2);
        model.updateMatrixWorld(true);
        const rotatedSize = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
        model.scale.set(
          targetWidth / Math.max(rotatedSize.x, 0.001),
          targetHeight / Math.max(rotatedSize.y, 0.001),
          targetLength / Math.max(rotatedSize.z, 0.001)
        );
        model.updateMatrixWorld(true);

        const fittedBox = new THREE.Box3().setFromObject(model);
        const fittedCenter = fittedBox.getCenter(new THREE.Vector3());
        const rearAlignment = l / 2 + 0.18;
        model.position.set(
          -fittedCenter.x,
          -fittedBox.min.y - 0.04,
          rearAlignment - fittedBox.max.z
        );

        scene.add(model);
        const modelMeta = {
          name: 'ev-truck-original',
          box: new THREE.Box3().setFromObject(model),
        };
        if (import.meta.env.DEV) {
          console.info('[ecotransport] GLB cargado', modelMeta.name, modelMeta.box.getSize(new THREE.Vector3()).toArray());
        }

        cargoGroup.position.z = -0.02;
        cargoGroup.traverse((object) => {
          if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
            object.renderOrder = Math.max(object.renderOrder, 5);
          }
        });
      },
      undefined,
      () => {
        scene.add(new THREE.AxesHelper(0.1));
      }
    );

    const syncSize = () => {
      const rect = host.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      camera.aspect = rect.width / rect.height;
      camera.updateProjectionMatrix();
      renderer.setSize(rect.width, rect.height, false);
    };

    const resizeObserver = new ResizeObserver(syncSize);
    resizeObserver.observe(host);
    syncSize();

    let frame = 0;
    const render = () => {
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelled = true;
      dracoLoader.dispose();
      window.clearTimeout(healthTimer);
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      controls.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
          object.geometry?.dispose();
          if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
          else object.material?.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.remove();
    };
  }, [cameraView, container, placedItems, showWeightHeatmap]);

  if (webglFailed) {
    return (
      <SoftwareTruckFallback
        container={container}
        placedItems={placedItems}
        showWeightHeatmap={showWeightHeatmap}
        cameraView={cameraView}
      />
    );
  }

  return <div ref={hostRef} className="w-full h-full bg-[#bebebe]" />;
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

  if (container.type === 'truck') {
    return (
      <DirectTruckViewer
        container={container}
        placedItems={placedItems}
        showWeightHeatmap={showWeightHeatmap}
        cameraView={cameraView}
      />
    );
  }

  return (
    <div className="canvas-container relative w-full h-full bg-[#bebebe]">
      <Canvas
        className="canvas-container__surface relative z-0"
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
