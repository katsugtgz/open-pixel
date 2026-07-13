import { Audio } from "@remotion/media";
import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { z } from "zod";

export const promoSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
});

export type PromoProps = z.infer<typeof promoSchema>;

const DURATION = 900;

const beats = [
  {
    from: 0,
    duration: 135,
    image: "gameplay/step-00.png",
    eyebrow: "Open Pixel",
    title: "The village is quiet.",
    body: "A small quest begins before any wallet appears.",
    crop: { scale: 1.34, x: 78, y: 30 },
  },
  {
    from: 135,
    duration: 150,
    image: "gameplay/step-06.png",
    eyebrow: "No wallet gate",
    title: "Walk in first.",
    body: "Move through the village. Find the guide. Start the run.",
    crop: { scale: 1.48, x: -26, y: -18 },
  },
  {
    from: 285,
    duration: 165,
    image: "gameplay/step-10.png",
    eyebrow: "Quest trigger",
    title: "Talk to the guide.",
    body: "Three village nodes are offline. The map waits.",
    crop: { scale: 1.62, x: -120, y: -58 },
  },
  {
    from: 450,
    duration: 165,
    image: "gameplay/step-15.png",
    eyebrow: "Resource village",
    title: "Paths, plots, nodes.",
    body: "Explore the paths. Collect what the village needs.",
    crop: { scale: 1.72, x: 20, y: -46 },
  },
  {
    from: 615,
    duration: 165,
    image: "gameplay/step-16.png",
    eyebrow: "Finish the run",
    title: "Play first. Prove later.",
    body: "Finish the quest, then claim your proof.",
    crop: { scale: 1.56, x: -70, y: -34 },
  },
  {
    from: 780,
    duration: 120,
    image: "gameplay/step-10.png",
    eyebrow: "Open Pixel",
    title: "Village RPG, not DeFi.",
    body: "No gas. No approvals. Just the village and the run.",
    crop: { scale: 1.24, x: 0, y: 0 },
  },
] as const;

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

function ease(
  frame: number,
  input: [number, number],
  output: [number, number],
) {
  return interpolate(frame, input, output, {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
}

function currentBeat(frame: number) {
  return (
    beats.find(
      (beat) => frame >= beat.from && frame < beat.from + beat.duration,
    ) ?? beats[beats.length - 1]
  );
}

function Brand() {
  return (
    <div className="brand">
      <Img src={staticFile("open-pixel-logo-village.jpg")} />
    </div>
  );
}

function GameShot({ beat }: { beat: (typeof beats)[number] }) {
  const frame = useCurrentFrame();
  const local = frame - beat.from;
  const enter = ease(local, [0, 24], [0.72, 1]);
  const exit = interpolate(
    local,
    [beat.duration - 24, beat.duration],
    [1, 0],
    clamp,
  );
  const drift = interpolate(local, [0, beat.duration], [0, 1], clamp);

  return (
    <Sequence from={beat.from} durationInFrames={beat.duration}>
      <AbsoluteFill
        className="shot"
        style={{
          opacity: Math.min(enter, exit),
        }}
      >
        <Img
          src={staticFile(beat.image)}
          className="gameplay-image"
          style={{
            scale: beat.crop.scale + drift * 0.1,
            translate: `${beat.crop.x + drift * -42}px ${beat.crop.y + drift * -18}px`,
          }}
        />
        <div className="scanlines" />
        <div className="vignette" />
      </AbsoluteFill>
    </Sequence>
  );
}

function Copy() {
  const frame = useCurrentFrame();
  const beat = currentBeat(frame);
  const local = frame - beat.from;
  const inOpacity = ease(local, [8, 34], [0, 1]);
  const outOpacity = interpolate(
    local,
    [beat.duration - 30, beat.duration - 8],
    [1, 0],
    clamp,
  );

  return (
    <div
      className="copy"
      style={{
        opacity: Math.min(inOpacity, outOpacity),
        translate: `0 ${interpolate(inOpacity, [0, 1], [30, 0], clamp)}px`,
      }}
    >
      <div className="eyebrow">{beat.eyebrow}</div>
      <h1>{beat.title}</h1>
      <p>{beat.body}</p>
    </div>
  );
}

function ThreatHud() {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, DURATION], [0, 100], clamp);
  const shardCount = Math.min(
    3,
    Math.floor(interpolate(frame, [250, 690], [0, 3], clamp)),
  );

  return (
    <div className="hud-trailer">
      <div className="mission">
        <span>Mission</span>
        <strong>Restore village nodes</strong>
      </div>
      <div className="stats">
        <span>Nodes {shardCount}/3</span>
        <span>Guest mode</span>
        <span>personal_sign only</span>
      </div>
      <div className="bar">
        <div style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function FinalSeal() {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [805, 850], [0, 1], clamp);

  return (
    <div className="seal" style={{ opacity }}>
      <span>No token economy</span>
      <span>No approvals</span>
      <span>No fake game layer</span>
    </div>
  );
}

export const OpenPixelPromo = (_props: PromoProps) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill className="trailer-root">
      <Audio
        src={staticFile("audio/open-pixel-issue-14-voice.mp3")}
        volume={0.92}
      />
      <div className="black-base" />
      {beats.map((beat) => (
        <GameShot key={`${beat.from}-${beat.title}`} beat={beat} />
      ))}
      <div
        className="pulse"
        style={{
          opacity: interpolate(
            frame % 90,
            [0, 8, 90],
            [0.28, 0.06, 0.28],
            clamp,
          ),
        }}
      />
      <Brand />
      <Copy />
      <ThreatHud />
      <FinalSeal />
    </AbsoluteFill>
  );
};
