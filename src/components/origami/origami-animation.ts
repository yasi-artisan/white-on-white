// ---------------------------------------------------------------------------
// OrigamiAnimation — class that owns the full GSAP timeline and internal
// state for the origami wireframe component.
//
// External code hooks in via:
//   anim.currentShape          — read-only current shape index
//   anim.goTo(index)           — morph to a shape (pauses the loop)
//   anim.onChange(fn)          — subscribe → returns unsubscribe function
// ---------------------------------------------------------------------------
import gsap from "gsap";
import { MorphSVGPlugin } from "gsap/MorphSVGPlugin";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import type { OrigamiAnimConfig } from "./origami-data";

gsap.registerPlugin(MorphSVGPlugin, DrawSVGPlugin);

export type ChangeListener = (index: number) => void;

export class OrigamiAnimation {
  /* ---- public-ish (read from outside) ---- */
  readonly contours: string[];
  readonly cfg: OrigamiAnimConfig;

  /* ---- private DOM refs ---- */
  #root: HTMLElement;
  #stage: HTMLElement;
  #contour: SVGPathElement;
  #innerGroups: SVGGElement[];
  #innerPolys: SVGPathElement[][];
  #hoverImgEls: HTMLImageElement[];

  /* ---- internal state ---- */
  #currentShape = 0;
  #isTransitioning = false;
  #loopTl: gsap.core.Timeline | null = null;
  #masterTl: gsap.core.Timeline | null = null;
  #paused = false;
  #listeners = new Set<ChangeListener>();

  constructor(root: HTMLElement, contours: string[], cfg: OrigamiAnimConfig) {
    this.#root = root;
    this.contours = contours;
    this.cfg = cfg;

    this.#stage = root.querySelector(".origami-stage") as HTMLElement;
    const svg = this.#stage.querySelector(".origami-svg") as SVGElement;
    this.#contour = svg.querySelector(".origami-contour") as SVGPathElement;

    this.#innerGroups = contours.map(
      (_, i) => svg.querySelector(`.origami-inner--${i}`)!,
    );
    this.#innerPolys = this.#innerGroups.map((g) =>
      gsap.utils.toArray<SVGPathElement>(g.querySelectorAll(".origami-poly")),
    );
    this.#hoverImgEls = Array.from(
      this.#stage.querySelectorAll<HTMLImageElement>(".origami-hover-img"),
    );

    // Hover only activates when the cursor is over a drawn path stroke
    this.#bindPathHover();
  }

  // -- public API --------------------------------------------------------

  /** The currently-visible shape index (0-based). */
  get currentShape(): number {
    return this.#currentShape;
  }

  /** Whether a morph transition is currently in progress. */
  get isTransitioning(): boolean {
    return this.#isTransitioning;
  }

  /** Subscribe to shape changes. Returns an unsubscribe function. */
  onChange(fn: ChangeListener): () => void {
    this.#listeners.add(fn);
    // Fire immediately with current state so the subscriber can initialise
    fn(this.#currentShape);
    return () => {
      this.#listeners.delete(fn);
    };
  }

  /**
   * Morph to a specific shape.  Kills the auto-loop (if running) so the
   * animation stays on the target shape until the next `goTo()` call.
   *
   * The active shape updates *immediately* so nav highlights the clicked
   * button without waiting for the morph to finish.  Buttons stay disabled
   * via `isTransitioning` until the full transition (hide → morph → draw)
   * completes.
   */
  goTo(target: number): void {
    if (
      target === this.#currentShape &&
      this.#innerGroups[target].style.visibility !== "hidden"
    ) {
      return;
    }

    // Capture the *current* shape before we change it
    const from = this.#currentShape;
    const fromGroup = this.#innerGroups[from];
    const fromPolys = this.#innerPolys[from];

    this.#killTimelines();
    this.#paused = true;

    // Immediately update logical state → nav highlights the target button
    this.#isTransitioning = true;
    this.#stage.classList.add("is-transitioning");
    this.#setShape(target);

    const toGroup = this.#innerGroups[target];
    const toPolys = this.#innerPolys[target];

    const tl = gsap.timeline({
      defaults: { overwrite: "auto" },
      onComplete: () => {
        this.#isTransitioning = false;
        this.#stage.classList.remove("is-transitioning");
        this.#notifyListeners(); // re-enables buttons
      },
    });

    tl.set(this.#contour, { visibility: "visible" });
    this.#staggerHide(tl, fromPolys, fromGroup);

    tl.to(
      this.#contour,
      {
        morphSVG: { shape: this.contours[target] },
        duration: this.cfg.morphDuration,
        ease: this.cfg.morphEase,
      },
      "-=0.2",
    );

    tl.set(toGroup, { visibility: "visible" });
    this.#staggerDraw(tl, toPolys);
  }

  // -- lifecycle called by Origami.astro's inline boot script -----------

  /** Start the repeating morph loop (shapes 0 → 1 → … → 0). */
  startLoop(): void {
    const mtl = gsap.timeline({ defaults: { overwrite: "auto" } });
    this.#masterTl = mtl;

    // Phase 0: initial visibility
    mtl.set(this.#contour, { visibility: "visible" });
    this.#innerGroups.forEach((g, i) => {
      mtl.set(g, { visibility: i === 0 ? "visible" : "hidden" });
    });

    // Phase 1: initial reveal of first shape
    mtl.fromTo(
      this.#contour,
      { drawSVG: "0 0" },
      {
        drawSVG: "0% 100%",
        duration: this.cfg.drawDuration * 1.1,
        ease: this.cfg.drawEase,
      },
    );
    this.#staggerDraw(
      mtl,
      this.#innerPolys[0],
      `-=${this.cfg.drawDuration * 0.5}`,
    );
    mtl.to({}, { duration: this.cfg.pauseAfterDraw });

    // Phase 2 → N: repeating loop
    this.#loopTl = gsap.timeline({
      repeat: -1,
      repeatDelay: this.cfg.pauseBetweenCycles,
    });

    const n = this.contours.length;
    for (let i = 0; i < n; i++) {
      const from = i;
      const to = (i + 1) % n;

      // Block hover during the morph+draw segment
      this.#loopTl.call(() => this.#stage.classList.add("is-transitioning"));

      this.#staggerHide(
        this.#loopTl,
        this.#innerPolys[from],
        this.#innerGroups[from],
      );
      this.#loopTl.to(this.#contour, {
        morphSVG: { shape: this.contours[to] },
        duration: this.cfg.morphDuration,
        ease: this.cfg.morphEase,
      });

      // Fire shape change right after morph, before inner polys draw
      this.#loopTl.call(() => this.#setShape(to));

      this.#loopTl.set(this.#innerGroups[to], { visibility: "visible" });
      this.#staggerDraw(this.#loopTl, this.#innerPolys[to]);

      // Re-enable hover once drawing is complete
      this.#loopTl.call(() => this.#stage.classList.remove("is-transitioning"));

      this.#loopTl.to({}, { duration: this.cfg.pauseAfterDraw });
    }

    mtl.add(this.#loopTl);
  }

  /** Draw a single shape then wait (no loop). */
  startPaused(target: number): void {
    const tl = gsap.timeline({ defaults: { overwrite: "auto" } });
    this.#masterTl = tl;

    tl.set(this.#contour, { visibility: "visible" });
    this.#innerGroups.forEach((g, i) => {
      tl.set(g, { visibility: i === target ? "visible" : "hidden" });
    });

    tl.fromTo(
      this.#contour,
      { drawSVG: "0 0" },
      {
        drawSVG: "0% 100%",
        duration: this.cfg.drawDuration * 1.1,
        ease: this.cfg.drawEase,
      },
    );
    this.#staggerDraw(
      tl,
      this.#innerPolys[target],
      `-=${this.cfg.drawDuration * 0.5}`,
    );

    // Fire at the very end since the entire draw is one reveal
    tl.call(() => this.#setShape(target));
  }

  // -- private helpers ---------------------------------------------------

  /**
   * Hover inside the contour fill area pauses the animation and shows
   * the companion image.  On leave, resume (unless manually paused via
   * `goTo`).
   */
  #bindPathHover(): void {
    this.#contour.addEventListener("pointerenter", () => {
      this.#stage.classList.add("is-hovering");
      this.#masterTl?.pause();
    });
    this.#contour.addEventListener("pointerleave", () => {
      this.#stage.classList.remove("is-hovering");
      // Only resume if the loop wasn't killed by a manual goTo()
      if (!this.#paused) {
        this.#masterTl?.play();
      }
    });
  }

  #notifyListeners(): void {
    for (const fn of this.#listeners) fn(this.#currentShape);
  }

  #setShape(index: number): void {
    this.#currentShape = index;
    this.#syncHoverImage();
    this.#notifyListeners();
  }

  #syncHoverImage(): void {
    for (const img of this.#hoverImgEls) {
      const idx = Number(img.dataset.shape);
      img.classList.toggle("is-active", idx === this.#currentShape);
    }
  }

  #killTimelines(): void {
    this.#loopTl?.kill();
    this.#loopTl = null;
    this.#masterTl?.kill();
    this.#masterTl = null;
  }

  #staggerDraw(
    tl: gsap.core.Timeline,
    paths: SVGPathElement[],
    position?: gsap.Position,
  ): void {
    tl.fromTo(
      paths,
      { drawSVG: "0 0" },
      {
        drawSVG: "0% 100%",
        duration: this.cfg.drawDuration,
        stagger: this.cfg.drawStagger,
        ease: this.cfg.drawEase,
      },
      position,
    );
  }

  #staggerHide(
    tl: gsap.core.Timeline,
    paths: SVGPathElement[],
    group: SVGGElement,
    position?: gsap.Position,
  ): void {
    tl.to(
      paths,
      {
        drawSVG: "0 0",
        duration: this.cfg.drawDuration * 0.35,
        stagger: { each: this.cfg.drawStagger * 0.4, from: "end" },
        ease: "power2.in",
      },
      position,
    );
    tl.set(group, { visibility: "hidden" });
  }
}
