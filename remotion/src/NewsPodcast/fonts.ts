import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/SpaceGrotesk";
import { continueRender, delayRender, staticFile } from "remotion";

const { fontFamily: interFamily } = loadInter("normal", {
  weights: ["400", "600", "700", "800", "900"],
  subsets: ["latin"],
});

const { fontFamily: groteskFamily } = loadMono("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

export const SansFont = interFamily;
export const DisplayFont = groteskFamily;

// Bold condensed face for the broadcast captions (from the content-automation kit).
export const BoldFont = "TheBoldFont";

let boldLoaded = false;
export const loadBoldFont = async (): Promise<void> => {
  if (boldLoaded) return;
  const handle = delayRender("Loading caption font");
  boldLoaded = true;
  try {
    const font = new FontFace(
      BoldFont,
      `url('${staticFile("theboldfont.ttf")}') format('truetype')`,
    );
    await font.load();
    document.fonts.add(font);
  } catch (e) {
    // Fall back to the bundled sans face if the file is missing.
    console.warn("Could not load TheBoldFont:", e);
  }
  continueRender(handle);
};
