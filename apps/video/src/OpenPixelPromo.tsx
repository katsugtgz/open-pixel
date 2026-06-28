import { Audio } from "@remotion/media";
import { z } from "zod";
import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import "./style.css";

export const promoSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
});

export type PromoProps = z.infer<typeof promoSchema>;

const FPS = 30;

const chapters = [
  "Guest first",
  "Farm village",
  "Gather resources",
  "Off-chain points",
  "Optional proof",
];

const scenes = [
  {
    from: 0,
    duration: 150,
    kind: "intro",
    kicker: "Zero Cup prototype",
    title: "Open Pixel",
    body: "A cozy resource-village RPG with optional Web3 proof.",
  },
  {
    from: 135,
    duration: 195,
    kind: "game",
    kicker: "Playable first",
    title: "Start as a guest",
    body: "Open the browser game, move around with WASD, and explore the farm village.",
  },
  {
    from: 315,
    duration: 180,
    kind: "gameZoom",
    kicker: "Core loop",
    title: "Gather village resources",
    body: "Cozy loop: plant, harvest, chop, mine, fulfill orders. No wallet required to play.",
  },
  {
    from: 480,
    duration: 180,
    kind: "web",
    kicker: "Claim flow",
    title: "Points stay off-chain",
    body: "The web shell handles the badge, leaderboard, and proof receipt without turning the game into DeFi.",
  },
  {
    from: 645,
    duration: 165,
    kind: "proof",
    kicker: "Safety stance",
    title: "Readable proof only",
    body: "personal_sign only. No gas, no token, no approvals, no swaps, no permit.",
  },
  {
    from: 795,
    duration: 105,
    kind: "outro",
    kicker: "Demo-ready loop",
    title: "Farm. Fulfill. Prove.",
    body: "Open Pixel keeps Web3 optional and the game playable first.",
  },
] as const;

type Scene = Omit<(typeof scenes)[number], "title" | "body"> & {
  title: string;
  body: string;
};

function clamp(
  frame: number,
  input: [number, number],
  output: [number, number],
) {
  return interpolate(frame, input, output, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
}

function SceneShell({ children }: { children: React.ReactNode }) {
  return (
    <AbsoluteFill className="scene-shell">
      <div className="bg-grid" />
      <div className="bg-glow bg-glow-lime" />
      <div className="bg-glow bg-glow-pink" />
      {children}
    </AbsoluteFill>
  );
}

function BrandBug() {
  return (
    <div className="brand-bug">
      <Img src={staticFile("open-pixel-logo.svg")} />
      <span>Open Pixel</span>
    </div>
  );
}

function ProgressBar({ frame }: { frame: number }) {
  const width = interpolate(frame, [0, 900], [0, 100], {
    extrapolateRight: "clamp",
  });

  return (
    <div className="progress-rail">
      {chapters.map((chapter) => (
        <span key={chapter}>{chapter}</span>
      ))}
      <div className="progress-fill" style={{ width: `${width}%` }} />
    </div>
  );
}

function FrameCard({
  src,
  variant = "wide",
  zoom = 1,
}: {
  src: string;
  variant?: "wide" | "tilt";
  zoom?: number;
}) {
  const frame = useCurrentFrame();
  const drift = clamp(frame, [0, 160], [0, 1]);
  const scale = zoom + drift * 0.055;
  const x = variant === "tilt" ? interpolate(drift, [0, 1], [32, -18]) : 0;

  return (
    <div className={`frame-card ${variant}`}>
      <Img
        src={staticFile(src)}
        style={{ transform: `translateX(${x}px) scale(${scale})` }}
      />
    </div>
  );
}

function CopyBlock({ scene }: { scene: Scene }) {
  const frame = useCurrentFrame();
  const enter = clamp(frame, [0, 24], [0, 1]);

  return (
    <div
      className="copy-block"
      style={{
        opacity: enter,
        transform: `translateY(${interpolate(enter, [0, 1], [34, 0])}px)`,
      }}
    >
      <p className="kicker">{scene.kicker}</p>
      <h2>{scene.title}</h2>
      <p>{scene.body}</p>
    </div>
  );
}

function PixelMotif() {
  const frame = useCurrentFrame();
  const bob = Math.sin((frame / FPS) * Math.PI * 2) * 8;
  return (
    <div className="pixel-motif" style={{ transform: `translateY(${bob}px)` }}>
      <div className="motif-sun" />
      <div className="motif-tile motif-a" />
      <div className="motif-tile motif-b" />
      <div className="motif-shard motif-c" />
      <div className="motif-shard motif-d" />
    </div>
  );
}

function Intro({ scene }: { scene: Scene }) {
  const frame = useCurrentFrame();
  const enter = clamp(frame, [0, 34], [0, 1]);
  return (
    <SceneShell>
      <BrandBug />
      <div className="intro-lockup" style={{ opacity: enter }}>
        <Img src={staticFile("open-pixel-logo.svg")} />
        <CopyBlock scene={scene} />
      </div>
      <PixelMotif />
      <ProgressBar frame={scene.from + frame} />
    </SceneShell>
  );
}

function GameScene({ scene, zoom = 1 }: { scene: Scene; zoom?: number }) {
  const frame = useCurrentFrame();
  return (
    <SceneShell>
      <BrandBug />
      <FrameCard src="captures/game.png" variant="tilt" zoom={zoom} />
      <CopyBlock scene={scene} />
      <div className="badge-strip">
        <span>WASD movement</span>
        <span>Farm village</span>
        <span>Crops, trees, ore</span>
      </div>
      <ProgressBar frame={scene.from + frame} />
    </SceneShell>
  );
}

function WebScene({ scene, src }: { scene: Scene; src: string }) {
  const frame = useCurrentFrame();
  return (
    <SceneShell>
      <BrandBug />
      <FrameCard src={src} zoom={1.03} />
      <CopyBlock scene={scene} />
      <div className="receipt-stack">
        <span>No token</span>
        <span>No gas</span>
        <span>No approvals</span>
      </div>
      <ProgressBar frame={scene.from + frame} />
    </SceneShell>
  );
}

function Outro({ scene }: { scene: Scene }) {
  const frame = useCurrentFrame();
  return (
    <SceneShell>
      <BrandBug />
      <div className="outro-panel">
        <CopyBlock scene={scene} />
        <div className="outro-grid">
          <span>guest-first</span>
          <span>off-chain points</span>
          <span>personal_sign only</span>
        </div>
      </div>
      <PixelMotif />
      <ProgressBar frame={scene.from + frame} />
    </SceneShell>
  );
}

function TransitionWipe({
  at,
  direction,
}: {
  at: number;
  direction: "left" | "right";
}) {
  const frame = useCurrentFrame();
  const p = clamp(frame, [at, at + 20], [0, 1]);
  const x =
    direction === "left"
      ? interpolate(p, [0, 1], [-110, 110])
      : interpolate(p, [0, 1], [110, -110]);

  return (
    <div
      className="wipe"
      style={{ transform: `translateX(${x}%) skewX(-12deg)` }}
    >
      <div />
    </div>
  );
}

export function OpenPixelPromo({ title, subtitle }: PromoProps) {
  const promoScenes = scenes.map((scene, index) =>
    index === 0 ? { ...scene, title, body: subtitle } : scene,
  );

  return (
    <AbsoluteFill className="promo-v2">
      <Audio src={staticFile("generated/voiceover.mp3")} volume={0.9} />
      <Sequence
        from={promoScenes[0].from}
        durationInFrames={promoScenes[0].duration}
        premountFor={30}
      >
        <Intro scene={promoScenes[0]} />
      </Sequence>
      <Sequence
        from={promoScenes[1].from}
        durationInFrames={promoScenes[1].duration}
        premountFor={30}
      >
        <GameScene scene={promoScenes[1]} zoom={0.98} />
      </Sequence>
      <Sequence
        from={promoScenes[2].from}
        durationInFrames={promoScenes[2].duration}
        premountFor={30}
      >
        <GameScene scene={promoScenes[2]} zoom={1.22} />
      </Sequence>
      <Sequence
        from={promoScenes[3].from}
        durationInFrames={promoScenes[3].duration}
        premountFor={30}
      >
        <WebScene scene={promoScenes[3]} src="captures/web-home.png" />
      </Sequence>
      <Sequence
        from={promoScenes[4].from}
        durationInFrames={promoScenes[4].duration}
        premountFor={30}
      >
        <WebScene scene={promoScenes[4]} src="captures/web-claim.png" />
      </Sequence>
      <Sequence
        from={promoScenes[5].from}
        durationInFrames={promoScenes[5].duration}
        premountFor={30}
      >
        <Outro scene={promoScenes[5]} />
      </Sequence>
      {[130, 310, 475, 640, 790].map((at, index) => (
        <TransitionWipe
          key={at}
          at={at}
          direction={index % 2 === 0 ? "left" : "right"}
        />
      ))}
    </AbsoluteFill>
  );
}
