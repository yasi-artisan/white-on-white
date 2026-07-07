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

  /* Continuous scrub position (float). Equals `#currentShape` when idle, but
     interpolates between shapes during a morph so a scrubber thumb can glide
     in lockstep with the contour instead of snapping between stages. */
  #scrub = 0;
  #scrubListeners = new Set<(value: number) => void>();

  /* Live-scrub state: a paused morph tween whose progress tracks the slider. */
  #scrubTween: gsap.core.Tween | null = null;
  #scrubSegFrom = -1;
  #scrubSegTo = -1;

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

  /** Continuous scrub position (0 to n-1, fractional during a morph). */
  get scrub(): number {
    return this.#scrub;
  }

  /**
   * Subscribe to continuous scrub updates — fires every frame while a morph
   * is running, so a scrubber thumb can glide in lockstep with the contour.
   * Returns an unsubscribe function.
   */
  onScrub(fn: (value: number) => void): () => void {
    this.#scrubListeners.add(fn);
    fn(this.#scrub);
    return () => {
      this.#scrubListeners.delete(fn);
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

    this.#killTimelines();
    this.#paused = true;

    // Immediately update logical state → nav highlights the target button
    this.#isTransitioning = true;
    this.#stage.classList.add("is-transitioning");
    this.#setShape(target);

    const tl = gsap.timeline({
      defaults: { overwrite: "auto" },
      onComplete: () => {
        this.#isTransitioning = false;
        this.#stage.classList.remove("is-transitioning");
        this.#notifyListeners(); // re-enables buttons
      },
    });

    tl.set(this.#contour, { visibility: "visible" });
    // Morph overlaps the hide by 0.2s; active shape already updated above
    this.#transition(tl, from, target, { morphOffset: "-=0.2" });
  }

  /**
   * Scrub the contour to an arbitrary fractional position (0 to n-1) so it
   * tracks the slider in real time. Kills the auto-loop and any in-flight
   * transition, hides the fold lines, and morphs the contour between the two
   * adjacent shapes. Folds stay hidden until commitScrub() draws them — the
   * "when the morph ends, the current state's drawing is done" step.
   */
  scrubTo(value: number): void {
    this.#killTimelines();
    this.#paused = true;

    const last = this.contours.length - 1;
    const v = gsap.utils.clamp(0, last, value);
    const from = Math.floor(v);
    const to = Math.min(from + 1, last);
    const frac = v - from;

    // Folds belong to discrete shapes, so hide them while the contour is
    // between shapes; commitScrub() draws the settled shape's folds.
    this.#innerGroups.forEach((g) => gsap.set(g, { visibility: "hidden" }));
    gsap.set(this.#contour, { visibility: "visible" });

    // Reuse the morph tween within a segment; only rebuild it (killing the old
    // one) when the adjacent pair changes. Killing it every call would leave
    // progress() pointing at a dead tween and the morph wouldn't follow.
    if (this.#scrubSegFrom !== from || this.#scrubSegTo !== to) {
      this.#scrubTween?.kill();
      gsap.set(this.#contour, { morphSVG: { shape: this.contours[from] } });
      this.#scrubTween = gsap.to(this.#contour, {
        morphSVG: { shape: this.contours[to] },
        duration: 1,
        ease: "none",
        paused: true,
        overwrite: "auto",
      });
      this.#scrubSegFrom = from;
      this.#scrubSegTo = to;
    }
    this.#scrubTween?.progress(frac);
  }

  /**
   * Finish a scrub: ease the contour from `fromValue` onto the target stage
   * (running the morph to the end of the transition, with no hard snap), then
   * draw that shape's fold lines once the contour has settled.
   */
  commitScrub(target: number, fromValue: number): void {
    this.#scrubTween?.kill();
    this.#scrubTween = null;
    this.#scrubSegFrom = this.#scrubSegTo = -1;

    this.#isTransitioning = true;
    this.#stage.classList.add("is-transitioning");
    this.#setShape(target);

    this.#innerGroups.forEach((g, i) =>
      gsap.set(g, { visibility: i === target ? "visible" : "hidden" }),
    );

    // Ease the contour onto the target instead of snapping. Duration scales
    // with the remaining distance so the finish always matches the morph's
    // natural pace (a near-stage release settles quickly).
    const remaining = Math.abs(target - fromValue);
    const settle = gsap.utils.clamp(
      0.15,
      this.cfg.morphDuration,
      remaining * this.cfg.morphDuration,
    );

    const tl = gsap.timeline({
      defaults: { overwrite: "auto" },
      onComplete: () => {
        this.#isTransitioning = false;
        this.#scrub = target;
        this.#stage.classList.remove("is-transitioning");
        this.#notifyListeners();
        // Resume the auto-loop forward from here after the usual beat (paused
        // if the pointer is hovering the contour).
        this.#resumeFrom(target);
      },
    });

    tl.to(this.#contour, {
      morphSVG: { shape: this.contours[target] },
      duration: settle,
      ease: this.cfg.morphEase,
    });

    // Glide the scrub position alongside so the pill eases onto the target too.
    const scrubProxy = { p: fromValue };
    tl.to(
      scrubProxy,
      {
        p: target,
        duration: settle,
        ease: this.cfg.morphEase,
        onUpdate: () => {
          this.#scrub = scrubProxy.p;
          this.#notifyScrub();
        },
      },
      0,
    );

    // With the contour settled, draw the target's fold lines.
    this.#staggerDraw(tl, this.#innerPolys[target]);
  }

  // -- lifecycle called by Origami.astro's inline boot script -----------

  /** Start the repeating morph loop, beginning from the first shape. */
  startLoop(): void {
    const mtl = gsap.timeline({ defaults: { overwrite: "auto" } });
    this.#masterTl = mtl;

    // Mark the starting shape's hover image active immediately — #syncHoverImage
    // otherwise only runs on a shape *change*, so the first image would stay
    // opacity:0 until the loop cycles back to shape 0.
    this.#syncHoverImage();

    // Phase 1: reveal the first shape, then pause
    this.#showOnly(mtl, 0);
    this.#revealShape(mtl, 0);
    mtl.to({}, { duration: this.cfg.pauseAfterDraw });

    // Phase 2: repeating ping-pong loop
    this.#loopTl = this.#buildLoopTl(0);
    mtl.add(this.#loopTl);
  }

  /**
   * Build the repeating morph loop starting at `from`. The sequence ping-pongs
   * — up from `from` to the last shape, back down to the first, then up to
   * `from` again — so it returns to its start and repeats, and never makes a
   * long jump back to shape 0. Shared by the initial loop and the post-commit
   * resume so a manual selection continues from the chosen shape.
   */
  #buildLoopTl(from: number): gsap.core.Timeline {
    const loopTl = gsap.timeline({
      repeat: -1,
      repeatDelay: this.cfg.pauseBetweenCycles,
    });
    const n = this.contours.length;

    // Forward leg: up from `from` to the last shape.
    for (let s = from; s < n - 1; s++) this.#appendStep(loopTl, s, s + 1);
    // Return leg: back down to the first shape.
    for (let s = n - 1; s > 0; s--) this.#appendStep(loopTl, s, s - 1);
    // Forward again: up from the first shape to `from`.
    for (let s = 0; s < from; s++) this.#appendStep(loopTl, s, s + 1);

    return loopTl;
  }

  /** Append one morph step (hide → morph → draw → pause) to a timeline. */
  #appendStep(tl: gsap.core.Timeline, a: number, b: number): void {
    // Block hover during the morph+draw segment
    tl.call(() => this.#stage.classList.add("is-transitioning"));
    // Advance the active shape the moment the contour starts morphing toward
    // `b`, so the heading/scrubber reflect the next section at the START of
    // the transition rather than after the morph has already landed.
    this.#transition(tl, a, b, { onMorphStart: () => this.#setShape(b) });
    // Re-enable hover once drawing is complete
    tl.call(() => this.#stage.classList.remove("is-transitioning"));
    tl.to({}, { duration: this.cfg.pauseAfterDraw });
  }

  /**
   * Resume the auto-loop forward from `target` after the post-draw wait. Called
   * once a manual selection's folds finish drawing, so the showcase keeps going
   * from the chosen shape instead of freezing or resetting to 0. Starts paused
   * if the pointer is currently hovering the contour.
   */
  #resumeFrom(target: number): void {
    this.#paused = false;
    this.#killTimelines();

    const mtl = gsap.timeline({ defaults: { overwrite: "auto" } });
    this.#masterTl = mtl;
    // The target's folds are already drawn; hold for the usual beat, then
    // resume the ping-pong loop forward from here.
    mtl.to({}, { duration: this.cfg.pauseAfterDraw });
    this.#loopTl = this.#buildLoopTl(target);
    mtl.add(this.#loopTl);

    if (this.#stage.classList.contains("is-hovering")) mtl.pause();
  }

  /** Draw a single shape then wait (no loop). */
  startPaused(target: number): void {
    const tl = gsap.timeline({ defaults: { overwrite: "auto" } });
    this.#masterTl = tl;

    this.#showOnly(tl, target);
    this.#revealShape(tl, target);

    // Fire at the very end since the entire draw is one reveal
    tl.call(() => this.#setShape(target));
  }

  /**
   * Tear everything down: kill the GSAP timelines (the loop runs with
   * `repeat: -1`, so without this it keeps ticking against detached DOM after a
   * ClientRouter view-transition navigation) and drop the hover listeners. The
   * page calls this on `astro:before-swap` when it navigates away.
   */
  destroy(): void {
    this.#killTimelines();
    this.#scrubTween?.kill();
    this.#scrubTween = null;
    this.#scrubSegFrom = this.#scrubSegTo = -1;
    this.#contour.removeEventListener("pointerenter", this.#onPointerEnter);
    this.#contour.removeEventListener("pointerleave", this.#onPointerLeave);
    this.#listeners.clear();
    this.#scrubListeners.clear();
  }

  // -- private helpers ---------------------------------------------------

  // Hover handlers are stored as fields so destroy() can remove them.
  #onPointerEnter = (): void => {
    this.#stage.classList.add("is-hovering");
    this.#masterTl?.pause();
  };

  #onPointerLeave = (): void => {
    this.#stage.classList.remove("is-hovering");
    // Only resume if the loop wasn't killed by a manual goTo()
    if (!this.#paused) {
      this.#masterTl?.play();
    }
  };

  /**
   * Hover inside the contour fill area pauses the animation and shows
   * the companion image.  On leave, resume (unless manually paused via
   * `goTo`).
   */
  #bindPathHover(): void {
    this.#contour.addEventListener("pointerenter", this.#onPointerEnter);
    this.#contour.addEventListener("pointerleave", this.#onPointerLeave);
  }

  #notifyListeners(): void {
    for (const fn of this.#listeners) fn(this.#currentShape);
  }

  #notifyScrub(): void {
    for (const fn of this.#scrubListeners) fn(this.#scrub);
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

  /**
   * Show only `shape`'s contour + inner group, hiding every other inner
   * group. Used to set up an initial reveal.
   */
  #showOnly(tl: gsap.core.Timeline, shape: number): void {
    tl.set(this.#contour, { visibility: "visible" });
    this.#innerGroups.forEach((g, i) => {
      tl.set(g, { visibility: i === shape ? "visible" : "hidden" });
    });
  }

  /** Draw `shape`'s contour from scratch, then stagger-draw its inner folds. */
  #revealShape(tl: gsap.core.Timeline, shape: number): void {
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
      this.#innerPolys[shape],
      `-=${this.cfg.drawDuration * 0.5}`,
    );
  }

  /**
   * One shape → shape step: hide `from`'s folds, morph the contour to `to`,
   * then reveal `to`'s folds. This single sequence powers both the auto-loop
   * and `goTo()`. `morphOffset` overlaps the morph with the preceding hide
   * (used by `goTo`); `onMorphStart` fires the instant the contour begins
   * morphing (used by the loop to advance the active shape at the start of
   * each transition, so the heading crossfades in sync with the morph).
   */
  #transition(
    tl: gsap.core.Timeline,
    from: number,
    to: number,
    opts: { morphOffset?: gsap.Position; onMorphStart?: () => void } = {},
  ): void {
    this.#staggerHide(tl, this.#innerPolys[from], this.#innerGroups[from]);

    // Resolve the morph's start to an absolute time so the scrub tween below
    // can ride *alongside* the contour morph. Passing the raw offset to both
    // would append the scrub tween after the morph when the offset is
    // undefined (the loop case) and push the fold-draw out of sync.
    const at = tl.duration();
    const morphAt =
      typeof opts.morphOffset === "string" && opts.morphOffset.startsWith("-=")
        ? at - Number(opts.morphOffset.slice(2))
        : (opts.morphOffset ?? at);

    tl.to(
      this.#contour,
      {
        morphSVG: { shape: this.contours[to] },
        duration: this.cfg.morphDuration,
        ease: this.cfg.morphEase,
        // Advance the active shape as the contour *begins* morphing so nav
        // (heading, hover image, scrubber baseline) tracks the transition
        // from its first frame instead of lagging until the morph lands.
        onStart: () => opts.onMorphStart?.(),
      },
      morphAt,
    );
    // Glide the continuous scrub position alongside the contour morph so a
    // scrubber thumb tracks the animation instead of snapping between stages.
    // Seed the proxy with this step's `from` shape — `#scrub` can't be used
    // here because #transition runs while the timeline is being built, before
    // any step has played, so #scrub is still its initial value.
    const scrubProxy = { p: from };
    tl.to(
      scrubProxy,
      {
        p: to,
        duration: this.cfg.morphDuration,
        ease: this.cfg.morphEase,
        onUpdate: () => {
          this.#scrub = scrubProxy.p;
          this.#notifyScrub();
        },
      },
      morphAt,
    );
    tl.set(this.#innerGroups[to], { visibility: "visible" });
    this.#staggerDraw(tl, this.#innerPolys[to]);
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
