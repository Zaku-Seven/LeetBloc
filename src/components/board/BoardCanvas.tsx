"use client";

import { Text } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Plane, Raycaster, Vector2, Vector3, type DirectionalLight, type Group } from "three";
import {
  BODY_H,
  DEPTH,
  HAT_H,
  NOTCH_INSET,
  TOP_BAR,
  layoutScript,
  nearestSocket,
  scriptSpan,
  type LayoutBlock,
  type LayoutSocket,
  type ScriptBlock,
} from "./layout";
import { locate, takePiece } from "./script";
import { blockGeometry, hatGeometry, markerGeometry, pillGeometry } from "./shapes";
import { CREAM, toonGradient } from "./theme";

type SocketId = { parentId: string | null; index: number };

type Drag = {
  id: string;
  dx: number;
  dy: number;
  x: number;
  y: number;
  moved: number;
};

type BoardCanvasProps = {
  script: ScriptBlock[];
  selectedId: string | null;
  socket: SocketId;
  onSelect: (id: string) => void;
  onAim: (id: string) => void;
  onSocket: (socket: SocketId) => void;
  onMove: (id: string, socket: SocketId) => void;
};

export function BoardCanvas(props: BoardCanvasProps) {
  return (
    <Canvas
      orthographic
      shadows="basic"
      style={{ width: "100%", height: "100%", touchAction: "none" }}
      dpr={[1, 2]}
      camera={{ position: [2.4, 3.2, 12], zoom: 102, near: 0.1, far: 40 }}
      gl={{ antialias: true }}
      onCreated={({ camera }) => camera.lookAt(0, 0.1, 0)}
    >
      <color attach="background" args={[CREAM]} />
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </Canvas>
  );
}

function Scene({ script, selectedId, socket, onSelect, onAim, onSocket, onMove }: BoardCanvasProps) {
  const gradient = useMemo(() => toonGradient(), []);
  const { camera, gl } = useThree();
  const [drag, setDrag] = useState<Drag | null>(null);
  const [hover, setHover] = useState<LayoutSocket | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const handlers = useRef({ onSelect, onAim, onMove });
  const ray = useMemo(() => new Raycaster(), []);
  const pointer = useRef(new Vector2());
  const hit = useRef(new Vector3());
  const plane = useMemo(() => new Plane(new Vector3(0, 0, 1), -0.5), []);

  const span = scriptSpan(script);
  const left = -span.width / 2;
  const top = 0.12 + span.height / 2;
  const visible = drag ? takePiece(script, drag.id).script : script;
  const laid = layoutScript(visible, left, top);
  const socketsRef = useRef(laid.sockets);
  const dragged = drag ? locate(script, drag.id)?.node ?? null : null;
  const ghostLayout = dragged ? layoutScript([dragged], 0, HAT_H) : null;

  useEffect(() => {
    handlers.current = { onSelect, onAim, onMove };
    socketsRef.current = laid.sockets;
  });

  function worldPoint(event: PointerEvent): Vector3 | null {
    const rect = gl.domElement.getBoundingClientRect();
    pointer.current.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    ray.setFromCamera(pointer.current, camera);
    return ray.ray.intersectPlane(plane, hit.current);
  }

  function beginDrag(id: string, event: PointerEvent, x: number, y: number) {
    const point = worldPoint(event);
    if (!point) return;
    const next = { id, dx: point.x - x, dy: point.y - y, x, y, moved: 0 };
    dragRef.current = next;
    setDrag(next);
  }

  useEffect(() => {
    if (!drag) return;
    function move(event: PointerEvent) {
      const point = worldPoint(event);
      const current = dragRef.current;
      if (!point || !current) return;
      const x = point.x - current.dx;
      const y = point.y - current.dy;
      const next = {
        ...current,
        x,
        y,
        moved: current.moved + Math.abs(x - current.x) + Math.abs(y - current.y),
      };
      dragRef.current = next;
      setDrag(next);
      const nearest = nearestSocket(socketsRef.current, x, y);
      setHover((prev) => {
        if (!nearest) return prev;
        if (prev && prev.parentId === nearest.parentId && prev.index === nearest.index) return prev;
        return nearest;
      });
    }
    function up() {
      const current = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      setHover(null);
      if (!current) return;
      const block = locate(script, current.id);
      if (current.moved < 0.08) {
        if (block?.node.piece.shape === "c") handlers.current.onAim(current.id);
        else handlers.current.onSelect(current.id);
        return;
      }
      const next = nearestSocket(socketsRef.current, current.x, current.y);
      if (next) handlers.current.onMove(current.id, next);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      document.body.style.cursor = "";
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    // Listeners stay up for the whole drag. The latest script and handlers are read from refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.id]);

  const active =
    hover ??
    laid.sockets.find((item) => item.parentId === socket.parentId && item.index === socket.index) ??
    laid.sockets[laid.sockets.length - 1];

  function aimRoot() {
    const roots = laid.sockets.filter((item) => item.parentId === null);
    const last = roots[roots.length - 1];
    if (last) onSocket(last);
  }

  return (
    <>
      <hemisphereLight args={["#fff6ea", "#c4b29a", 0.55]} />
      <KeyLight />
      <mesh position={[0, 0.1, -0.2]} receiveShadow>
        <planeGeometry args={[9, 11]} />
        <meshToonMaterial color="#F7F1E6" gradientMap={gradient} />
      </mesh>
      <Hat x={left} y={top} gradient={gradient} onAim={aimRoot} />
      {laid.blocks.map((block) => (
        <SettledBlock
          key={block.id}
          block={block}
          selected={block.id === selectedId}
          gradient={gradient}
          onGrab={(event, x, y) => beginDrag(block.id, event, x, y)}
        />
      ))}
      {ghostLayout && drag ? (
        <group position={[drag.x, drag.y, 0.62]}>
          {ghostLayout.blocks.map((block) => (
            <BlockBody key={block.id} block={block} selected={false} gradient={gradient} />
          ))}
        </group>
      ) : null}
      {active ? <SocketMark socket={active} /> : null}
    </>
  );
}

function Hat({
  x,
  y,
  gradient,
  onAim,
}: {
  x: number;
  y: number;
  gradient: ReturnType<typeof toonGradient>;
  onAim: () => void;
}) {
  const geom = useMemo(() => hatGeometry(), []);
  const nums = useMemo(() => pillGeometry(0.36, 0.15), []);
  const target = useMemo(() => pillGeometry(0.46, 0.15), []);
  return (
    <group
      position={[x, y, 0.06]}
      onPointerDown={(event) => {
        event.stopPropagation();
        onAim();
      }}
    >
      <mesh geometry={geom} castShadow>
        <meshToonMaterial color="#1060A0" gradientMap={gradient} />
      </mesh>
      <Text
        position={[0.22, -HAT_H * 0.4, DEPTH + 0.04]}
        fontSize={0.2}
        color={CREAM}
        anchorX="left"
        anchorY="middle"
      >
        twoSum
      </Text>
      <Pill geometry={nums} label="nums" x={1.62} />
      <Pill geometry={target} label="target" x={2.55} />
    </group>
  );
}

function Pill({
  geometry,
  label,
  x,
}: {
  geometry: ReturnType<typeof pillGeometry>;
  label: string;
  x: number;
}) {
  return (
    <group position={[x, -HAT_H * 0.4, DEPTH - 0.02]}>
      <mesh geometry={geometry} castShadow>
        <meshToonMaterial color={CREAM} />
      </mesh>
      <Text position={[0, 0, 0.1]} fontSize={0.12} color="#104070" anchorX="center" anchorY="middle">
        {label}
      </Text>
    </group>
  );
}

function SettledBlock({
  block,
  selected,
  gradient,
  onGrab,
}: {
  block: LayoutBlock;
  selected: boolean;
  gradient: ReturnType<typeof toonGradient>;
  onGrab: (event: PointerEvent, x: number, y: number) => void;
}) {
  const group = useRef<Group>(null);
  const pos = useRef({ x: block.x, y: block.y + 0.4 });
  useFrame((_, delta) => {
    pos.current.x = damp(pos.current.x, block.x, 14, delta);
    pos.current.y = damp(pos.current.y, block.y, 14, delta);
    group.current?.position.set(pos.current.x, pos.current.y, 0.06);
  });
  return (
    <group
      ref={group}
      position={[block.x, block.y + 0.4, 0.06]}
      onPointerOver={() => {
        document.body.style.cursor = "grab";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "";
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
        document.body.style.cursor = "grabbing";
        onGrab(event.nativeEvent, group.current?.position.x ?? block.x, group.current?.position.y ?? block.y);
      }}
    >
      <BlockBody block={block} selected={selected} gradient={gradient} />
    </group>
  );
}

function BlockBody({
  block,
  selected,
  gradient,
}: {
  block: LayoutBlock;
  selected: boolean;
  gradient: ReturnType<typeof toonGradient>;
}) {
  const geom = blockGeometry(block);
  const textY = block.piece.shape === "c" ? -TOP_BAR / 2 : -BODY_H / 2;
  const textX = NOTCH_INSET + 0.5 + 0.1;
  const lift = selected ? 0.04 : 0;
  return (
    <>
      <mesh geometry={geom} position={[0, 0, lift]} castShadow>
        <meshToonMaterial color={block.piece.color} gradientMap={gradient} />
      </mesh>
      {block.piece.shape === "c" ? (
        <mesh position={[(block.width + 0.42) / 2, -(TOP_BAR + block.inner / 2), DEPTH / 2]}>
          <planeGeometry args={[Math.max(0.2, block.width - 0.5), Math.max(0.2, block.inner - 0.08)]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      ) : null}
      <Text
        position={[textX, textY, DEPTH + 0.03 + lift]}
        fontSize={0.15}
        color={block.piece.ink}
        anchorX="left"
        anchorY="middle"
        maxWidth={Math.max(0.4, block.width - textX - 0.12)}
      >
        {block.piece.label}
      </Text>
    </>
  );
}

function SocketMark({ socket }: { socket: LayoutSocket }) {
  const group = useRef<Group>(null);
  const geom = useMemo(() => markerGeometry(), []);
  useFrame(({ clock }) => {
    if (!group.current) return;
    const scale = 1 + Math.sin(clock.elapsedTime * 5) * 0.07;
    group.current.scale.set(scale, scale, 1);
  });
  return (
    <group ref={group} position={[socket.x + NOTCH_INSET, socket.y, 0.5]}>
      <mesh geometry={geom} raycast={() => null}>
        <meshToonMaterial color="#F0B040" />
      </mesh>
    </group>
  );
}

function KeyLight() {
  const light = useRef<DirectionalLight>(null);
  const configured = useRef(false);
  const { scene } = useThree();
  useFrame(() => {
    if (configured.current || !light.current) return;
    const shadowCamera = light.current.shadow.camera;
    shadowCamera.near = 0.5;
    shadowCamera.far = 28;
    shadowCamera.left = -8;
    shadowCamera.right = 8;
    shadowCamera.top = 8;
    shadowCamera.bottom = -8;
    shadowCamera.updateProjectionMatrix();
    light.current.shadow.radius = 0;
    light.current.shadow.bias = -0.001;
    light.current.target.position.set(0, 0.1, 0);
    scene.add(light.current.target);
    configured.current = true;
  });
  return (
    <directionalLight
      ref={light}
      position={[5.5, 8, 6]}
      intensity={1.55}
      castShadow
      shadow-mapSize-width={2048}
      shadow-mapSize-height={2048}
    />
  );
}

function damp(current: number, target: number, lambda: number, delta: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * delta));
}
