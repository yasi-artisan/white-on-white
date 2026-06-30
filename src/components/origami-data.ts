// ---------------------------------------------------------------------------
// Origami animation config
// ---------------------------------------------------------------------------
export interface OrigamiAnimConfig {
  /** Stroke width for contour outlines, px */
  contourWidth: number;
  /** Stroke width for inner fold lines, px */
  innerWidth: number;
  /** Duration to draw each segment (contour or single polygon), seconds */
  drawDuration: number;
  /** Stagger delay between drawing consecutive inner polygons, seconds */
  drawStagger: number;
  /** Duration of the contour morph between shapes, seconds */
  morphDuration: number;
  /** Pause after inner lines are fully drawn, before morph starts, seconds */
  pauseAfterDraw: number;
  /** Pause between full cycles (after B→A transition completes), seconds */
  pauseBetweenCycles: number;
  /** GSAP ease for draw animations */
  drawEase: string;
  /** GSAP ease for morph animations */
  morphEase: string;
}

export const defaultConfig: OrigamiAnimConfig = {
  contourWidth: 3,
  innerWidth: 2,
  drawDuration: 1.6,
  drawStagger: 0.18,
  morphDuration: 2.2,
  pauseAfterDraw: 1.8,
  pauseBetweenCycles: 1.0,
  drawEase: "power2.inOut",
  morphEase: "power2.inOut",
};

// ---------------------------------------------------------------------------
// Shape data
// ---------------------------------------------------------------------------
export interface OrigamiItem {
  contour: string;
  polygons: string[];
}

const ostrich: OrigamiItem = {
  contour:
    "M423 372L312 704L321.5 716.5L590.5 796L870 822L1129.5 647L1107.5 155H1097L841.5 425.5L774.5 386L445.5 348.5L442.5 340H436L423 364V372Z",
  polygons: [
    "M630 673L621 659.5L424.5 370M630 673L775 384.5L853.5 642M630 673L590 796.5M630 673L657 670M755.25 656L853.5 642C939.697 620.197 993.115 606.686 1070.5 587.112M1108.5 577.5L842 426.5M1070.5 587.112C1082.52 584.072 1095.11 580.886 1108.5 577.5L1084 329M1108.5 577.5L865.5 400L1084 329M1084 329L1097 155.5M621 659.5L318 712M657 670L871 823M657 670L755.25 656M1070.5 587.112L1129.5 647L755.25 656",
  ],
};

const carmolek: OrigamiItem = {
  contour:
    "M588.5 937L389 842.5V830L499.5 646.5L644.5 542.5L423 329.5V318.5L669 103.5V98L685.5 86.5L906.5 312.5L1038 622.5L1033.5 636L765.5 748.5L588.5 937Z",
  polygons: [
    "M843.5 510L765.5 748L390 844M765.5 748L691.5 611",
    "M908.5 314.5L689.5 326M689.5 326L670 98M689.5 326L675.5 459M908.5 319.5L915 490M915 490L1036.5 623.5M915 490L694.5 547.5",
    "M390 830L704 599.5L658.5 387L426 331L422.5 320L689.5 316M658.5 387L645 541.5L704 599.5M704 599.5L498.5 648",
  ],
};

/** All shapes in animation order. */
export const shapes: OrigamiItem[] = [ostrich, carmolek];

/** Convenience named exports for direct access. */
export { ostrich, carmolek };
