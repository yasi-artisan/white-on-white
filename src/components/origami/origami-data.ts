// ---------------------------------------------------------------------------
// Origami animation config
// ---------------------------------------------------------------------------
import osterichImg from "@/assets/origami/osterich.png";
import carmolekImg from "@/assets/origami/carmolek.png";
import squirrelImg from "@/assets/origami/squirrel.png";
import pigeonImg from "@/assets/origami/pigeon.png";
import rabbitImg from "@/assets/origami/rabbit.png";

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

/** Duration of the hover image crossfade, seconds (0 = disable hover). */
export const HOVER_FADE_DURATION = 0.6;

// ---------------------------------------------------------------------------
// Shape data
// ---------------------------------------------------------------------------
export interface OrigamiItem {
  /** Human-readable label shown in navigation links. */
  label: string;
  /** Closed outline path (used for morphing between shapes). */
  contour: string;
  /** Inner fold-line paths. */
  polygons: string[];
  /** Optional companion image shown on hover when this shape is active.
   *  Can be a URL (relative or absolute) or an inline data-URI. */
  hoverImage?: string;
}

const ostrich: OrigamiItem = {
  label: "Ostrich",
  hoverImage: osterichImg.src,
  contour:
    "M423 372L312 704L321.5 716.5L590.5 796L870 822L1129.5 647L1107.5 155H1097L841.5 425.5L774.5 386L445.5 348.5L442.5 340H436L423 364V372Z",
  polygons: [
    "M630 673L621 659.5L424.5 370M630 673L775 384.5L853.5 642M630 673L590 796.5M630 673L657 670M755.25 656L853.5 642C939.697 620.197 993.115 606.686 1070.5 587.112M1108.5 577.5L842 426.5M1070.5 587.112C1082.52 584.072 1095.11 580.886 1108.5 577.5L1084 329M1108.5 577.5L865.5 400L1084 329M1084 329L1097 155.5M621 659.5L318 712M657 670L871 823M657 670L755.25 656M1070.5 587.112L1129.5 647L755.25 656",
  ],
};

const carmolek: OrigamiItem = {
  label: "Carmolek",
  hoverImage: carmolekImg.src,
  contour:
    "M588.5 937L389 842.5V830L499.5 646.5L644.5 542.5L423 329.5V318.5L669 103.5V98L685.5 86.5L906.5 312.5L1038 622.5L1033.5 636L765.5 748.5L588.5 937Z",
  polygons: [
    "M843.5 510L765.5 748L390 844M765.5 748L691.5 611",
    "M908.5 314.5L689.5 326M689.5 326L670 98M689.5 326L675.5 459M908.5 319.5L915 490M915 490L1036.5 623.5M915 490L694.5 547.5",
    "M390 830L704 599.5L658.5 387L426 331L422.5 320L689.5 316M658.5 387L645 541.5L704 599.5M704 599.5L498.5 648",
  ],
};

const squirrel: OrigamiItem = {
  label: "Squirrel",
  hoverImage: squirrelImg.src,
  contour:
    "M1101 584V262H798L537 268L521 249L505 255L478 232L461 249V262L202 554V569L511 801L537 808L814 852L1101 838L1092 814L1101 584Z",
  polygons: [
    "M1099 262L794 580M794 580L804 262M794 580H1099M539 269L478 262L789 574.968L794 580M794 580L1099 840M794 580L1093 817M794 580L814 852M478 586H506L794 580M794 580L531 808M478 269L502.29 544M506 586L460 262M506 586L502.29 544M789 574.968L502.29 544M478 586L203 574.968M478 586L514 796",
  ],
};

const pigeon: OrigamiItem = {
  label: "Pigeon",
  hoverImage: pigeonImg.src,
  contour:
    "M675.5 979.5L213 552.5L225 542H663V174V154L1082 139L1103 533L1088 549L1095 561L675.5 979.5Z",
  polygons: [
    "M871 342L662 542L453 776M662 542L884 758M662 542L1090 548M884 758L676 979M662 174L871 342L1090 548L884 758M1105 533L662 174L899 314L1082 139",
  ],
};

const rabbit: OrigamiItem = {
  label: "Rabbit",
  hoverImage: rabbitImg.src,
  contour:
    "M1150 117L826 492L452 195L427 213V223L124 566L504 863H530H881L1216 822L1170 117H1150Z",
  polygons: [
    "M123 569L810 585L1219 823M810 585L524 863M810 585L879 863",
    "M471 530L826 493L1216 807L1174 458M826 493L841 604M826 493L749 584M471 530L122 569M471 530L427 223M471 530L479 584M1174 458L1149 118M1174 458L841 474",
  ],
};

/** All shapes in animation order. */
export const shapes: OrigamiItem[] = [
  ostrich,
  carmolek,
  squirrel,
  pigeon,
  rabbit,
];

/** Convenience named exports for direct access. */
export { ostrich, carmolek, squirrel, pigeon, rabbit };
