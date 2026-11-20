import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, ContactShadows, RoundedBox } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { board, tokenColors } from "../game/board";
import { boardArt, pos } from "./art";
import { loadFieldImages } from "../ui/companyLogos";
import { revealMs } from "../game/dice";
import { portraitSize } from "../game/portrait";
type Props = {
  pick: (id: number) => void;
  pieces: { pos: number; token: number; photo?: string }[];
  dice: number[];
  roll: number;
  cameraMode: string;
  quality: boolean;
  motion: boolean;
  levels?: number[];
  owners?: number[];
  active?: number;
  prices?: string;
  rents?: string;
  marks?: number[];
  rolledAt?: number;
};
const pips = [
  [],
  [[0, 0]],
  [
    [-1, -1],
    [1, 1],
  ],
  [
    [-1, -1],
    [0, 0],
    [1, 1],
  ],
  [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ],
  [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
    [0, 0],
  ],
  [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [1, -1],
    [1, 0],
    [1, 1],
  ],
];
const sides = [
  [0, 0, 0],
  [0, Math.PI, 0],
  [0, Math.PI / 2, 0],
  [0, -Math.PI / 2, 0],
  [-Math.PI / 2, 0, 0],
  [Math.PI / 2, 0, 0],
];
const tops = [0, -Math.PI / 2, Math.PI / 2, 0, 0, 0, Math.PI];
function Die({
  value,
  index,
  rolledAt,
  motion,
}: {
  value: number;
  index: number;
  rolledAt?: number;
  motion: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    const frac =
      rolledAt && motion
        ? Math.min(1, Math.max(0, 1 - (Date.now() - rolledAt) / revealMs))
        : 0;
    ref.current.position.y = 0.43 + Math.abs(Math.sin(frac * 10)) * frac * 1.65;
    ref.current.rotation.order = "YXZ";
    ref.current.rotation.set(
      tops[value] + frac * 9,
      index * 0.42 + frac * 8,
      (value === 3 ? Math.PI / 2 : value === 4 ? -Math.PI / 2 : 0) + frac * 6,
      "YXZ",
    );
  });
  return (
    <group
      ref={ref}
      position={[-1.25 + index * 0.8, 0.43, 2.95 - index * 0.23]}
    >
      <RoundedBox
        args={[0.68, 0.68, 0.68]}
        radius={0.095}
        smoothness={3}
        castShadow
      >
        <meshStandardMaterial
          color={index === 2 ? "#f0b462" : "#f6ecd7"}
          roughness={0.3}
        />
      </RoundedBox>
      {sides.map((rotation, indexSide) => (
        <group key={indexSide} rotation={rotation as [number, number, number]}>
          {index === 2 && indexSide >= 3 ? (
            <SymbolFace free={indexSide === 5} />
          ) : (
            pips[indexSide + 1].map(([xx, yy]) => (
              <mesh
                key={`${xx},${yy}`}
                position={[xx * 0.16, yy * 0.16, 0.342]}
              >
                <circleGeometry args={[0.048, 14]} />
                <meshBasicMaterial color="#263731" />
              </mesh>
            ))
          )}
        </group>
      ))}
    </group>
  );
}
export function PhotoDice({values,at,motion}:{values:number[];at:number;motion:boolean}) {
  return <Canvas camera={{position:[0,5.6,3.5],fov:24}} dpr={[1,1.5]} gl={{alpha:true,antialias:true,preserveDrawingBuffer:true}}><ambientLight intensity={1.6}/><directionalLight position={[2,6,3]} intensity={2.2}/><group position={[1.25-(values.length-1)*.4,-.6,-2.8]}>{values.map((value,index)=><Die key={index} value={value} index={index} rolledAt={at} motion={motion}/>)}</group></Canvas>;
}
function SymbolFace({ free }: { free: boolean }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 96;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#192e29";
    if (free) {
      ctx.font = "bold 54px Arial";
      ctx.textAlign = "center";
      ctx.fillText("→", 48, 54);
      ctx.font = "bold 16px Arial";
      ctx.fillText("FREI", 48, 77);
    } else {
      ctx.fillRect(15, 26, 66, 34);
      ctx.clearRect(21, 31, 20, 13);
      ctx.clearRect(46, 31, 27, 13);
      for (const left of [28, 67]) {
        ctx.beginPath();
        ctx.arc(left, 63, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    return new THREE.CanvasTexture(canvas);
  }, [free]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={[0, 0, 0.344]}>
      <planeGeometry args={[0.59, 0.59]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  );
}
function PhotoHead({ photo }: { photo: string }) {
  const map = useMemo(() => {
    const bytes = atob(photo),
      side = portraitSize,
      data = new Uint8Array(side * side * 4);
    for (let index = 0; index < side * side; index++) {
      const radius = Math.hypot(
        (index % side) - (side - 1) / 2,
        Math.floor(index / side) - (side - 1) / 2,
      );
      const rgb =
        radius > side / 2 - 3
          ? [255, 238, 188]
          : [
              bytes.charCodeAt(index * 3),
              bytes.charCodeAt(index * 3 + 1),
              bytes.charCodeAt(index * 3 + 2),
            ];
      data.set([...rgb, radius < side / 2 ? 255 : 0], index * 4);
    }
    const tex = new THREE.DataTexture(data, side, side);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = true;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }, [photo]);
  useEffect(() => () => map.dispose(), [map]);
  return (
    <sprite position={[0, 0.75, 0]} scale={[0.63, 0.63, 1]}>
      <spriteMaterial map={map} transparent alphaTest={0.15} />
    </sprite>
  );
}
function Token({
  seat,
  index,
  motion,
}: {
  seat: Props["pieces"][number];
  index: number;
  motion: boolean;
}) {
  const mesh = useRef<THREE.Group>(null);
  const [xx, zz] = pos(seat.pos);
  const offset = ((index % 3) - 1) * 0.27,
    depth = index > 2 ? 0.2 : -0.1;
  const initial = useRef([xx + offset, 0.12, zz + depth] as [
    number,
    number,
    number,
  ]);
  useFrame((_, dt) => {
    if (!mesh.current) return;
    const target = new THREE.Vector3(xx + offset, 0.12, zz + depth);
    mesh.current.position.lerp(target, motion ? Math.min(1, dt * 19) : 1);
  });
  const color = tokenColors[seat.token];
  return (
    <group ref={mesh} position={initial.current}>
      {seat.photo && <PhotoHead photo={seat.photo} />}
      <mesh castShadow position={[0, 0.065, 0]}>
        <cylinderGeometry args={[0.225, 0.25, 0.13, 24]} />
        <meshStandardMaterial
          color="#cfaf71"
          metalness={0.55}
          roughness={0.32}
        />
      </mesh>
      <mesh castShadow position={[0, 0.29, 0]}>
        {seat.token === 0 ? (
          <coneGeometry args={[0.29, 0.49, 4]} />
        ) : seat.token === 1 ? (
          <boxGeometry args={[0.48, 0.29, 0.26]} />
        ) : seat.token === 2 ? (
          <torusGeometry args={[0.19, 0.075, 8, 20]} />
        ) : seat.token === 3 ? (
          <boxGeometry args={[0.4, 0.32, 0.2]} />
        ) : seat.token === 4 ? (
          <cylinderGeometry args={[0.14, 0.21, 0.43, 6]} />
        ) : (
          <octahedronGeometry args={[0.29]} />
        )}
        <meshStandardMaterial color={color} metalness={0.35} roughness={0.32} />
      </mesh>
      {seat.token === 0 && (
        <mesh position={[0, 0.45, 0]}>
          <coneGeometry args={[0.115, 0.19, 4]} />
          <meshStandardMaterial color="#f0e9ce" />
        </mesh>
      )}
      {seat.token === 1 && (
        <group position={[0, 0.43, 0]}>
          <mesh>
            <boxGeometry args={[0.32, 0.1, 0.23]} />
            <meshStandardMaterial color="#283e3e" />
          </mesh>
          {[-0.18, 0.18].map((x) => (
            <mesh
              key={x}
              position={[x, -0.26, 0.14]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[0.075, 0.075, 0.045, 12]} />
              <meshStandardMaterial color="#36423e" />
            </mesh>
          ))}
        </group>
      )}
      {seat.token === 3 && (
        <mesh position={[0, 0.48, 0]}>
          <torusGeometry args={[0.095, 0.024, 8, 16]} />
          <meshStandardMaterial color="#d2b582" />
        </mesh>
      )}
    </group>
  );
}
function Deck({ chance }: { chance: boolean }) {
  const art = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 192;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = chance ? "#963e34" : "#243e45";
    ctx.fillRect(0, 0, 192, 256);
    ctx.strokeStyle = "#c2a16a";
    ctx.lineWidth = 2;
    for (const inset of [8, 13])
      ctx.strokeRect(inset, inset, 192 - 2 * inset, 256 - 2 * inset);
    ctx.fillStyle = "#e3c88f";
    ctx.textAlign = "center";
    ctx.font = "bold 82px Georgia";
    ctx.fillText(chance ? "?" : "✦", 96, 149);
    ctx.font = "bold 14px Arial";
    ctx.fillText(chance ? "CHANCE" : "EREIGNIS", 96, 195);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, [chance]);
  useEffect(() => () => art.dispose(), [art]);
  return (
    <group
      position={chance ? [-2.8, 0.14, -2.65] : [2.9, 0.14, 2.4]}
      rotation={[0, chance ? -0.28 : 0.3, 0]}
    >
      <RoundedBox args={[0.98, 0.2, 1.35]} radius={0.035} castShadow>
        <meshStandardMaterial color="#d7c8a9" />
      </RoundedBox>
      <mesh position={[0, 0.105, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.96, 1.33]} />
        <meshStandardMaterial map={art} />
      </mesh>
    </group>
  );
}
function Scene(props: Props) {
  const ownerKey = props.owners?.join(",");
  const [logos, setLogos] = useState<Map<number, HTMLImageElement>>();
  useEffect(() => {
    let active = true;
    void loadFieldImages().then((images) => { if (active) setLogos(images); });
    return () => { active = false; };
  }, []);
  const art = useMemo(
    () =>
      boardArt(
        props.prices?.split(",").map(Number) ?? [],
        ownerKey?.split(",").map(Number) ?? [],
        logos,
        props.rents?.split(",").map(Number) ?? [],
      ),
    [props.prices, ownerKey, logos, props.rents],
  );
  const { camera, size } = useThree();
  const controls = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const cameraKey = props.cameraMode.split(":")[0];
  const activePos =
    cameraKey === "focus" ? (props.pieces[props.active ?? 0]?.pos ?? 0) : 0;
  useEffect(() => {
    const scale = Math.max(1, 1.38 / (size.width / size.height));
    const [xx, zz] = pos(activePos);
    const focus = cameraKey === "focus";
    camera.position.set(
      ...((cameraKey === "top"
        ? [0, 20 * scale, 0.01]
        : focus
          ? [xx * 0.5 + 4, 13, zz * 0.5 + 10]
          : [4.4 * scale, 16 * scale, 12.4 * scale]) as [
        number,
        number,
        number,
      ]),
    );
    controls.current?.target.set(
      focus ? xx * 0.55 : 0,
      0,
      focus ? zz * 0.55 : cameraKey === "top" ? 0 : 1.55,
    );
    controls.current?.update();
  }, [camera, size, props.cameraMode, cameraKey, activePos]);
  useEffect(() => () => art.dispose(), [art]);
  return (
    <>
      <ambientLight intensity={1.05} />
      <directionalLight
        position={[-5, 13, 4]}
        intensity={2.2}
        castShadow={props.quality}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
      />
      <hemisphereLight args={["#fff3d4", "#46675c", 1.2]} />
      <RoundedBox
        args={[12.73, 0.54, 12.73]}
        radius={0.09}
        position={[0, -0.26, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#363c35" roughness={0.65} />
      </RoundedBox>
      <mesh position={[0, -0.085, 0]}>
        <boxGeometry args={[12.77, 0.06, 12.77]} />
        <meshStandardMaterial color="#be9a58" metalness={0.45} />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.025, 0]}
        receiveShadow
        onClick={(event) => {
          event.stopPropagation();
          const closest = board.reduce(
            (best, tile) => {
              const [xx, zz] = pos(tile.id);
              const dist = Math.hypot(event.point.x - xx, event.point.z - zz);
              return dist < best.dist ? { id: tile.id, dist } : best;
            },
            { id: 0, dist: Infinity },
          );
          if (closest.dist < 1.2) props.pick(closest.id);
        }}
      >
        <planeGeometry args={[12.5, 12.5]} />
        <meshBasicMaterial map={art} toneMapped={false} />
      </mesh>
      <Deck chance />
      <Deck chance={false} />
      {props.pieces.map((seat, index) => (
        <Token
          key={seat.token}
          seat={seat}
          index={index}
          motion={props.motion}
        />
      ))}
      {props.dice.map((value, index) => (
        <Die
          key={index}
          index={index}
          value={value}
          rolledAt={props.rolledAt}
          motion={props.motion}
        />
      ))}
      {props.marks?.map((id) => {
        const [xx, zz] = pos(id);
        return (
          <mesh key={`bus-${id}`} position={[xx, 0.07, zz]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.92, 0.92]} />
            <meshBasicMaterial color="#ffd65a" transparent opacity={0.5} depthWrite={false} />
          </mesh>
        );
      })}
      {props.owners?.map((owner, id) => {
        const level = props.levels?.[id] ?? 0;
        if (owner < 0 || !level) return null;
        const [xx, zz] = pos(id);
        const side = Math.floor(id / 10);
        return (
          <group
            key={id}
            position={[
              xx + [0, 1, 0, -1][side] * 0.68,
              0.038,
              zz + [-1, 0, 1, 0][side] * 0.68,
            ]}
            rotation={[0, (-side * Math.PI) / 2, 0]}
          >
            {level >= 5 ? (
              <>
                <mesh position={[0, 0.1, 0]} castShadow>
                  <boxGeometry args={[0.34, 0.2, 0.15]} />
                  <meshStandardMaterial color="#f3d27a" metalness={0.35} roughness={0.35} />
                </mesh>
                <mesh position={[0, 0.25, 0]} rotation={[0, Math.PI / 4, 0]} scale={[1, 1, 0.6]} castShadow>
                  <coneGeometry args={[0.25, 0.14, 4]} />
                  <meshStandardMaterial color="#9e3f36" />
                </mesh>
                {[-0.09, 0, 0.09].map((offset) => (
                  <mesh key={offset} position={[offset, 0.12, 0.076]}>
                    <planeGeometry args={[0.045, 0.07]} />
                    <meshBasicMaterial color="#33534c" />
                  </mesh>
                ))}
              </>
            ) : (
              Array.from({ length: level }, (_, index) => (
                <group key={index} position={[(index - (level - 1) / 2) * 0.19, 0.03, 0]} rotation={[0, (index % 2 ? 1 : -1) * 0.08, 0]}>
                  {[0, 1, 2].map((note) => (
                    <mesh key={note} castShadow={note === 0} position={[note * 0.006, note * 0.026, 0]}>
                      <boxGeometry args={[0.15, 0.022, 0.085]} />
                      <meshStandardMaterial color={note === 1 ? "#6aa577" : "#558d65"} />
                    </mesh>
                  ))}
                  <mesh position={[0, 0.026, 0]}>
                    <boxGeometry args={[0.03, 0.075, 0.088]} />
                    <meshStandardMaterial color="#ead8a8" />
                  </mesh>
                </group>
              ))
            )}
          </group>
        );
      })}
      {props.quality && (
        <ContactShadows
          position={[0, -0.56, 0]}
          opacity={0.45}
          scale={23}
          blur={2.8}
          far={4}
          frames={1}
        />
      )}
      <OrbitControls
        ref={controls}
        enablePan={false}
        minDistance={9}
        maxDistance={34}
        maxPolarAngle={Math.PI / 2.6}
        enableDamping
      />
    </>
  );
}
export default function Table(props: Props) {
  return (
    <Canvas
      shadows={props.quality}
      dpr={[1, props.quality ? 1.7 : 1]}
      camera={{ fov: 42, position: [4.4, 16, 12.4] }}
      gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
    >
      <Scene {...props} />
    </Canvas>
  );
}
