import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import type { View } from "../game/view";
import { casinoSlots } from "./casinoLayout";
function Framing() {
  const { camera, size } = useThree();
  useEffect(() => {
    const zoomOut = Math.max(1, 1.2 * size.height / size.width);
    camera.position.set(0, 7.3 * zoomOut, 2.8 * zoomOut);
    camera.lookAt(0, 0, 0);
  }, [camera, size.width, size.height]);
  return null;
}
function Card({
  value,
  xx,
  zz,
  motion = true,
  delay = 0,
}: {
  value: number | null;
  xx: number;
  zz: number;
  motion?: boolean;
  delay?: number;
}) {
  const mesh = useRef<THREE.Group>(null),
    progress = useRef(0);
  useFrame((_, dt) => {
    if (!mesh.current) return;
    progress.current += dt;
    const fraction = motion
      ? Math.min(1, Math.max(0, (progress.current - delay) / 0.55))
      : 1;
    const back = (1 - fraction) ** 2;
    mesh.current.position.set(
      xx,
      0.14 + 0.3 * back + Math.sin(fraction * Math.PI) * 0.3,
      zz,
    );
    mesh.current.rotation.z = value !== null ? back * Math.PI : 0;
    mesh.current.visible = fraction > 0;
  });
  const art = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 220;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = value === null ? "#923e32" : "#efe9d6";
    ctx.fillRect(0, 0, 160, 220);
    ctx.strokeStyle = "#b79863";
    ctx.lineWidth = 4;
    ctx.strokeRect(7, 7, 146, 206);
    ctx.fillStyle =
      value !== null && [1, 2].includes(Math.floor(value / 13))
        ? "#ab4137"
        : "#283a33";
    ctx.textAlign = "center";
    ctx.font = "bold 74px 'Barlow Condensed', sans-serif";
    ctx.fillText(
      value === null
        ? "SM"
        : ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "B", "D", "K"][
            value % 13
          ],
      80,
      88,
    );
    ctx.fillText(
      value === null ? "✦" : ["♠", "♥", "♦", "♣"][Math.floor(value / 13)],
      80,
      158,
    );
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, [value]);
  useEffect(() => () => art.dispose(), [art]);
  return (
    <group ref={mesh} position={[xx, 0.14, zz]}>
      <RoundedBox args={[0.68, 0.04, 0.96]} radius={0.018}>
        <meshStandardMaterial color="#ece2cd" />
      </RoundedBox>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
        <planeGeometry args={[0.66, 0.94]} />
        <meshBasicMaterial map={art} toneMapped={false} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.025, 0]}>
        <planeGeometry args={[0.66, 0.94]} />
        <meshStandardMaterial color="#9f473b" />
      </mesh>
    </group>
  );
}
export default function CasinoTable({
  v,
  motion,
  seat,
}: {
  v: View;
  motion: boolean;
  seat?: string;
}) {
  const table = v.casino!;
  const hand = table.hands.find(other => other.id === (seat ?? table.actor)) ?? table.hands[0];
  const slots = casinoSlots(hand?.cards.length ?? 0);
  const cloth = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(1024, 512);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ccba88";
    ctx.font = "bold .045px Georgia";
    ctx.fillText("BLACKJACK", 0.5, 0.43);
    ctx.strokeStyle = "#c9b57b";
    ctx.lineWidth = 0.004;
    ctx.beginPath();
    ctx.moveTo(0.18, 0.48);
    ctx.lineTo(0.82, 0.48);
    ctx.stroke();
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, []);
  useEffect(() => () => cloth.dispose(), [cloth]);
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 6.8, 5.3], fov: 48 }}
      onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
      gl={{ preserveDrawingBuffer: true }}
    >
      <Framing />
      <ambientLight intensity={2} />
      <directionalLight position={[-3, 7, 4]} intensity={3} />
      <mesh scale={[1.45, 1, 0.85]}>
        <cylinderGeometry args={[3, 3, 0.22, 80]} />
        <meshStandardMaterial color="#225c46" />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} scale={[1.45, 0.85, 1]}>
        <torusGeometry args={[3, 0.14, 12, 80]} />
        <meshStandardMaterial color="#98764c" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.113, 0]}>
        <planeGeometry args={[7.4, 4.2]} />
        <meshBasicMaterial transparent map={cloth} depthWrite={false} />
      </mesh>
      {[-1.85, -1.5, -1.15].map((xx, index) => (
        <group key={xx} position={[xx, 0.15, -1.1]}>
          {Array.from({ length: 5 + index * 2 }, (_, level) => (
            <mesh key={level} position={[0, level * 0.045, 0]}>
              <cylinderGeometry args={[0.16, 0.16, 0.045, 24]} />
              <meshStandardMaterial
                color={
                  level % 2
                    ? "#e1d4ba"
                    : ["#a64036", "#29383a", "#56877c"][index]
                }
              />
            </mesh>
          ))}
        </group>
      ))}
      <RoundedBox
        args={[0.9, 0.45, 1.1]}
        position={[2.5, 0.3, -1]}
        radius={0.05}
      >
        <meshStandardMaterial color="#283f42" />
      </RoundedBox>
      {table.dealer.length > 0 && (
        <>
          <Card value={table.dealer[0]} xx={-0.4} zz={-1} motion={motion} />
          <Card value={null} xx={0.4} zz={-1} motion={motion} delay={0.15} />
        </>
      )}
      {hand?.cards.map((value, index) => (
        <group key={`${hand.id}:${index}`} position={[slots[index].xx, 0.14 * (1 - slots[index].scale), slots[index].zz]} scale={slots[index].scale}>
          <Card value={value} motion={motion} delay={index === 1 ? 0.12 : 0} xx={0} zz={0} />
        </group>
      ))}
    </Canvas>
  );
}
