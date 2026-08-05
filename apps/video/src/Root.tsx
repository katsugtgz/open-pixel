import { Composition } from "remotion";
import { OpenPixelPromo, promoSchema } from "./OpenPixelPromo";

export const RemotionRoot = () => {
  return (
    <Composition
      id="OpenPixelPromo"
      component={OpenPixelPromo}
      durationInFrames={900}
      fps={30}
      width={1920}
      height={1080}
      schema={promoSchema}
      defaultProps={{
        title: "Open Pixel",
        subtitle: "AI-native pixel quest RPG. Guest-first. No token economy.",
      }}
    />
  );
};
