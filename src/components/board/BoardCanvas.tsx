"use client";

import { RoundedBox, Text } from "@react-three/drei";
import { Canvas, type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useMemo, useRef } from "react";
import { Plane, Vector3, type DirectionalLight, type Group } from "three";
import type { TrayPiece } from "./pieces";
import { CREAM, PIECE_D, PIECE_H, PIECE_W, slotY, toonGradient } from "./theme";

type BoardCanvasProps = {
  pieces: TrayPiece[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReorder: (from: number, to: number) => void;
};

export function BoardCanvas(props: BoardCanvasProps) {
  return (
    <Canvas
      orthographic
      shadows="basic"
      style={{ width: "100%", height: "100%" }}
      dpr={[1, 2]}
      camera={{ position: [4.2, 3.4, 9], zoom: 78, near: 0.1, far: 40 }}
      gl={{ antialias: true }}
      onCreated={({ camera }) => camera.lookAt(0, 0.2, 0)}
    >
      <color attach="background" args={[CREAM]} />
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </Canvas>
  );
}

function Scene({ pieces, selectedId, onSelect, onReorder }: BoardCanvasProps) {
  const gradient = useMemo(() => toonGradient(), []);

  return (
    <>
      <hemisphereLight args={["#fff6ea", "#c4b29a", 0.55]} />
      <KeyLight />
      <mesh position={[0, 0.15, -0.08]} receiveShadow>
        <planeGeometry args={[6.4, 7.6]} />
        <meshToonMaterial color="#F7F1E6" gradientMap={gradient} />
      </mesh>
      <group position={[0, 2.35, 0.22]}>
        <RoundedBox args={[PIECE_W, PIECE_H, PIECE_D]} radius={0.08} smoothness={3} castShadow>
          <meshToonMaterial color="#1060A0" gradientMap={gradient} />
        </RoundedBox>
        <Text
          position={[0, 0, PIECE_D / 2 + 0.02]}
          fontSize={0.2}
          color={CREAM}
          anchorX="center"
          anchorY="middle"
        >
          twoSum
        </Text>
      </group>
      {pieces.map((piece, index) => (
        <PieceMesh
          key={piece.id}
          piece={piece}
          index={index}
          count={pieces.length}
          selected={piece.id === selectedId}
          gradient={gradient}
          onSelect={onSelect}
          onReorder={onReorder}
        />
      ))}
    </>
  );
}

function KeyLight() {
  const light = useRef<DirectionalLight>(null);
  const configured = useRef(false);
  const { scene } = useThree();

  useFrame(() => {
    if (configured.current || !light.current) return;
    const camera = light.current.shadow.camera;
    camera.near = 0.5;
    camera.far = 28;
    camera.left = -8;
    camera.right = 8;
    camera.top = 8;
    camera.bottom = -8;
    camera.updateProjectionMatrix();
    light.current.shadow.radius = 0;
    light.current.shadow.bias = -0.001;
    light.current.target.position.set(0, 0.2, 0);
    scene.add(light.current.target);
    configured.current = true;
  });

  return (
    <directionalLight
      ref={light}
      position={[5.5, 8, 6]}
      intensity={1.55}
      castShadow
      shadow-mapSize-width={1024}
      shadow-mapSize-height={1024}
    />
  );
}

function PieceMesh({
  piece,
  index,
  count,
  selected,
  gradient,
  onSelect,
  onReorder,
}: {
  piece: TrayPiece;
  index: number;
  count: number;
  selected: boolean;
  gradient: ReturnType<typeof toonGradient>;
  onSelect: (id: string) => void;
  onReorder: (from: number, to: number) => void;
}) {
  const group = useRef<Group>(null);
  const displayY = useRef(slotY(index));
  const dragY = useRef<number | null>(null);
  const moved = useRef(false);
  const plane = useMemo(() => new Plane(new Vector3(0, 0, 1), -0.35), []);
  const hit = useRef(new Vector3());

  useFrame((_, delta) => {
    const target = dragY.current ?? slotY(index);
    displayY.current = damp(displayY.current, target, dragY.current ? 22 : 9, delta);
    if (!group.current) return;
    group.current.position.y = displayY.current;
    group.current.position.z = dragY.current ? 0.62 : 0.22;
  });

  function pointerY(event: ThreeEvent<PointerEvent>): number | null {
    const point = event.ray.intersectPlane(plane, hit.current);
    return point ? point.y : null;
  }

  return (
    <group ref={group} position={[0, slotY(index), 0.22]} scale={selected ? 1.04 : 1}>
      <RoundedBox
        args={[PIECE_W, PIECE_H, PIECE_D]}
        radius={0.08}
        smoothness={3}
        castShadow
        onPointerDown={(event) => {
          event.stopPropagation();
          moved.current = false;
          const y = pointerY(event);
          dragY.current = y ?? displayY.current;
          const element = event.nativeEvent.target as Element | null;
          element?.setPointerCapture?.(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (dragY.current === null) return;
          const y = pointerY(event);
          if (y === null) return;
          if (Math.abs(y - displayY.current) > 0.08) moved.current = true;
          dragY.current = y;
        }}
        onPointerUp={(event) => {
          event.stopPropagation();
          if (dragY.current === null) return;
          const from = index;
          const y = dragY.current;
          dragY.current = null;
          if (!moved.current) {
            onSelect(piece.id);
            return;
          }
          onReorder(from, nearestIndex(y, count));
        }}
      >
        <meshToonMaterial color={piece.color} gradientMap={gradient} />
      </RoundedBox>
      <Text
        position={[0, 0, PIECE_D / 2 + 0.03]}
        fontSize={0.18}
        color={piece.ink}
        anchorX="center"
        anchorY="middle"
        maxWidth={2.3}
      >
        {piece.label}
      </Text>
    </group>
  );
}

function nearestIndex(y: number, count: number): number {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let slot = 0; slot < count; slot += 1) {
    const distance = Math.abs(slotY(slot) - y);
    if (distance < bestDistance) {
      best = slot;
      bestDistance = distance;
    }
  }
  return best;
}

function damp(current: number, target: number, lambda: number, delta: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * delta));
}
