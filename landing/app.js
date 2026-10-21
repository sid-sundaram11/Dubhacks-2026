/**
 * Orbit — AI Constellation Creator
 * Space-Themed Interactive Landing Experience
 * Grounded in astronomical J2000 coordinates, real HYG catalog data, and planar projection math.
 */

(function () {
  "use strict";

  // Data from celestial-data.js
  const celestialData = window.CELESTIAL_DATA || {
    stars: [],
    traditionalConstellations: [],
    demoSubjects: []
  };

  const stars = celestialData.stars || [];
  const traditionalConstellations = celestialData.traditionalConstellations || [];
  const demoSubjects = celestialData.demoSubjects || [];

  // Star map for fast O(1) lookup by ID
  const starMap = new Map();
  stars.forEach((s) => starMap.set(s.id, s));

  // Find Giraffe subject data
  const giraffeSubject = demoSubjects.find((s) => s.subject === "giraffe") || {
    id: "constellation-giraffe",
    name: "Camelopardalis Astra (The Giraffe)",
    centerRa: 3.8,
    centerDec: 63.5,
    segments: []
  };

  /* =========================================================================
     1. HERO AMBIENT BACKGROUND CANVAS
     ========================================================================= */
  const heroCanvas = document.getElementById("celestial-hero-canvas");
  if (heroCanvas) {
    const ctx = heroCanvas.getContext("2d");
    let heroWidth = (heroCanvas.width = window.innerWidth);
    let heroHeight = (heroCanvas.height = window.innerHeight);

    window.addEventListener("resize", () => {
      heroWidth = heroCanvas.width = window.innerWidth;
      heroHeight = heroCanvas.height = window.innerHeight;
    });

    const ambientStarCount = 200;
    const ambientStars = Array.from({ length: ambientStarCount }, () => ({
      x: Math.random() * heroWidth,
      y: Math.random() * heroHeight,
      radius: Math.random() * 1.4 + 0.35,
      alpha: Math.random() * 0.7 + 0.2,
      twinkleSpeed: (Math.random() * 0.02 + 0.005) * (Math.random() < 0.5 ? 1 : -1),
      hue: Math.random() < 0.25 ? "#9ecbd0" : Math.random() < 0.4 ? "#e5be7a" : "#f4f1ea"
    }));

    function renderAmbientHero() {
      ctx.clearRect(0, 0, heroWidth, heroHeight);
      for (const s of ambientStars) {
        s.alpha += s.twinkleSpeed;
        if (s.alpha > 0.85 || s.alpha < 0.15) {
          s.twinkleSpeed = -s.twinkleSpeed;
        }

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fillStyle = s.hue;
        ctx.globalAlpha = Math.max(0.05, Math.min(1, s.alpha));
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;
      requestAnimationFrame(renderAmbientHero);
    }
    renderAmbientHero();
  }

  /* =========================================================================
     2. HEADER SMART-HIDE & MOUNTAIN PARALLAX ON SCROLL
     ========================================================================= */
  const siteHeader = document.getElementById("site-header");
  const mountainLayer = document.getElementById("hero-mountain-layer");

  window.addEventListener(
    "scroll",
    () => {
      const scrollY = window.scrollY;

      // 1. Remove/hide top nav bar when scrolling down
      if (siteHeader) {
        if (scrollY > 35) {
          siteHeader.classList.add("header-hidden");
        } else {
          siteHeader.classList.remove("header-hidden");
        }
      }

      // 2. Sketched mountain scrolls up as you scroll up and disappears
      if (mountainLayer) {
        const factor = Math.min(1, scrollY / 320);
        mountainLayer.style.transform = `translate3d(0, -${scrollY * 0.4}px, 0)`;
        mountainLayer.style.opacity = `${Math.max(0, 1 - factor)}`;
      }
    },
    { passive: true }
  );

  /* =========================================================================
     3. INTERACTIVE GIRAFFE DEMO PLAYER & 4 STAGES OF SKELETONIZATION
     ========================================================================= */
  const demoSteps = [
    {
      stepIndex: 0,
      badge: "STAGE 01 / 05",
      title: "Raw Input Photograph",
      desc: "The complete original photograph of the giraffe in the wild before any processing occurs.",
      imgSrc: "assets/demo/giraffe.jpg",
      isSky: false
    },
    {
      stepIndex: 1,
      badge: "STAGE 02 / 05",
      title: "SAM3 AI Cutout",
      desc: "The vision model identifies the giraffe and cleanly extracts its silhouette from the savanna background.",
      imgSrc: "assets/stages/giraffe_mask.png",
      isSky: false
    },
    {
      stepIndex: 2,
      badge: "STAGE 03 / 05",
      title: "96 × 96 Feature Grid",
      desc: "The shape is normalized onto a 96 × 96 grid, sharpening edges and preserving key landmarks like the neck and ears.",
      imgSrc: "assets/stages/giraffe_grid.png",
      isSky: false
    },
    {
      stepIndex: 3,
      badge: "STAGE 04 / 05",
      title: "Topological Skeleton",
      desc: "Mathematical thinning reduces the silhouette to a 1-pixel stick figure preserving the giraffe's posture and limbs.",
      imgSrc: "assets/stages/giraffe_skeleton.png",
      isSky: false
    },
    {
      stepIndex: 4,
      badge: "STAGE 05 / 05",
      title: "Camelopardalis Astra",
      desc: "The skeleton joints snap to real catalog stars in Camelopardalis. Drag the sky to explore the constellation.",
      imgSrc: null,
      isSky: true
    }
  ];

  let currentStep = 0;
  let isDemoPlaying = false;
  let stepTimer = null;
  let progressRaf = null;
  let progressStartTime = 0;
  const STEP_DURATION = 3200; // ms per step

  const demoPlayBtn = document.getElementById("demo-play-btn");
  const demoPlayIcon = document.getElementById("demo-play-icon");
  const demoPlayLabel = document.getElementById("demo-play-label");
  const stepPills = document.querySelectorAll(".demo-step-pill");
  const demoImageStage = document.getElementById("demo-image-stage");
  const demoSkyStage = document.getElementById("demo-sky-stage");
  const demoMainImg = document.getElementById("demo-main-img");
  const captionBadge = document.getElementById("demo-caption-badge");
  const captionTitle = document.getElementById("demo-caption-title");
  const captionDesc = document.getElementById("demo-caption-desc");
  const progressFill = document.getElementById("demo-progress-fill");
  const skyGhostOverlay = document.getElementById("sky-cutout-ghost");
  const btnToggleSkyOverlay = document.getElementById("btn-toggle-sky-overlay");

  function goToStep(index) {
    currentStep = ((index % demoSteps.length) + demoSteps.length) % demoSteps.length;
    const data = demoSteps[currentStep];

    // Update pill states
    stepPills.forEach((p, idx) => {
      p.classList.toggle("active", idx === currentStep);
    });

    // Update captions
    if (captionBadge) captionBadge.textContent = data.badge;
    if (captionTitle) captionTitle.textContent = data.title;
    if (captionDesc) captionDesc.textContent = data.desc;

    // Viewport view switching
    if (data.isSky) {
      if (demoImageStage) {
        demoImageStage.classList.remove("active");
        demoImageStage.style.display = "none";
      }
      if (demoSkyStage) {
        demoSkyStage.style.display = "flex";
        demoSkyStage.classList.add("active");
        resizeSkyCanvas();
        // Aim sky toward Camelopardalis with perfect alignment
        flySkyTo(3.8, 63.5, 37.0);
      }
    } else {
      if (demoSkyStage) {
        demoSkyStage.classList.remove("active");
        demoSkyStage.style.display = "none";
      }
      if (demoImageStage) {
        demoImageStage.style.display = "flex";
        demoImageStage.classList.add("active");
        if (demoMainImg && data.imgSrc) {
          demoMainImg.src = data.imgSrc;
        }
      }
    }

    if (isDemoPlaying) {
      restartStepProgress();
    } else {
      if (progressFill) progressFill.style.width = "0%";
    }
  }

  function restartStepProgress() {
    if (progressRaf) cancelAnimationFrame(progressRaf);
    clearTimeout(stepTimer);

    progressStartTime = performance.now();

    function updateProgress(now) {
      if (!isDemoPlaying) return;
      const elapsed = now - progressStartTime;
      const fraction = Math.min(1, elapsed / STEP_DURATION);
      if (progressFill) {
        progressFill.style.width = `${fraction * 100}%`;
      }

      if (fraction < 1) {
        progressRaf = requestAnimationFrame(updateProgress);
      } else {
        goToStep(currentStep + 1);
      }
    }

    progressRaf = requestAnimationFrame(updateProgress);
  }

  function togglePlayDemo() {
    isDemoPlaying = !isDemoPlaying;
    if (demoPlayBtn) demoPlayBtn.classList.toggle("playing", isDemoPlaying);

    if (isDemoPlaying) {
      if (demoPlayIcon) demoPlayIcon.textContent = "⏸";
      if (demoPlayLabel) demoPlayLabel.textContent = "Pause Demo";
      restartStepProgress();
    } else {
      if (demoPlayIcon) demoPlayIcon.textContent = "▶";
      if (demoPlayLabel) demoPlayLabel.textContent = "Play Demo";
      if (progressRaf) cancelAnimationFrame(progressRaf);
      if (progressFill) progressFill.style.width = "0%";
    }
  }

  demoPlayBtn?.addEventListener("click", togglePlayDemo);

  stepPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      const stepIdx = parseInt(pill.getAttribute("data-step") || "0", 10);
      goToStep(stepIdx);
      if (isDemoPlaying) {
        togglePlayDemo();
      }
    });
  });

  // Photo Cutout Ghost Overlay Toggle in Sky Stage
  let isSkyOverlayVisible = false;
  btnToggleSkyOverlay?.addEventListener("click", () => {
    isSkyOverlayVisible = !isSkyOverlayVisible;
    if (skyGhostOverlay) skyGhostOverlay.classList.toggle("visible", isSkyOverlayVisible);
    if (btnToggleSkyOverlay) btnToggleSkyOverlay.classList.toggle("active", isSkyOverlayVisible);
  });

  /* =========================================================================
     4. CELESTIAL PROJECTION & LIVE SKY CANVAS ENGINE (STAGE 5)
     ========================================================================= */
  const skyCanvas = document.getElementById("interactive-sky-canvas");
  let skyCtx = skyCanvas ? skyCanvas.getContext("2d") : null;

  // Sky camera state (aligned to Camelopardalis)
  const skyState = {
    ra: 3.8,
    dec: 63.5,
    fov: 37.0, // degrees
    targetRa: 3.8,
    targetDec: 63.5,
    targetFov: 37.0,
    isAnimating: false,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragStartRa: 0,
    dragStartDec: 0
  };

  const DEG_TO_RAD = Math.PI / 180;

  function raDecToVector3(raHours, decDeg) {
    const alpha = raHours * 15 * DEG_TO_RAD;
    const delta = decDeg * DEG_TO_RAD;
    return {
      x: Math.cos(delta) * Math.cos(alpha),
      y: Math.sin(delta),
      z: Math.cos(delta) * Math.sin(alpha)
    };
  }

  const starVectors = new Map();
  stars.forEach((star) => {
    starVectors.set(star.id, raDecToVector3(star.ra, star.dec));
  });

  function resizeSkyCanvas() {
    if (!skyCanvas) return;
    const rect = skyCanvas.parentElement.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    skyCanvas.width = rect.width * dpr;
    skyCanvas.height = rect.height * dpr;
  }

  window.addEventListener("resize", resizeSkyCanvas);

  function flySkyTo(ra, dec, fov) {
    skyState.targetRa = ra;
    skyState.targetDec = dec;
    skyState.targetFov = fov || 37.0;
    skyState.isAnimating = true;
  }

  function projectCelestial(v, aimVector, rightVector, upVector, width, height, fovRad) {
    const dot = v.x * aimVector.x + v.y * aimVector.y + v.z * aimVector.z;
    if (dot <= 0.05) return null; // Star is behind camera

    const scale = Math.tan(fovRad / 2);
    const aspect = width / height;

    const xCam = v.x * rightVector.x + v.y * rightVector.y + v.z * rightVector.z;
    const yCam = v.x * upVector.x + v.y * upVector.y + v.z * upVector.z;

    const xNdc = xCam / (dot * scale * aspect);
    const yNdc = yCam / (dot * scale);

    const screenX = (xNdc * 0.5 + 0.5) * width;
    const screenY = (-yNdc * 0.5 + 0.5) * height;

    const margin = 80;
    const onScreen =
      screenX >= -margin &&
      screenX <= width + margin &&
      screenY >= -margin &&
      screenY <= height + margin;

    return { x: screenX, y: screenY, onScreen, dot };
  }

  function magnitudeToRadius(mag) {
    if (mag === null || mag === undefined) return 1.0;
    const r = (5.5 - mag) * 0.9 + 1.2;
    return Math.max(0.8, Math.min(6.5, r));
  }

  function renderLiveSky() {
    if (!skyCtx || !skyCanvas || !demoSkyStage || !demoSkyStage.classList.contains("active")) {
      requestAnimationFrame(renderLiveSky);
      return;
    }

    // Camera smoothing
    if (skyState.isAnimating) {
      let diffRa = skyState.targetRa - skyState.ra;
      if (diffRa > 12) diffRa -= 24;
      if (diffRa < -12) diffRa += 24;

      skyState.ra += diffRa * 0.12;
      skyState.dec += (skyState.targetDec - skyState.dec) * 0.12;
      skyState.fov += (skyState.targetFov - skyState.fov) * 0.12;

      if (skyState.ra < 0) skyState.ra += 24;
      if (skyState.ra >= 24) skyState.ra -= 24;

      if (
        Math.abs(diffRa) < 0.001 &&
        Math.abs(skyState.targetDec - skyState.dec) < 0.001 &&
        Math.abs(skyState.targetFov - skyState.fov) < 0.01
      ) {
        skyState.ra = skyState.targetRa;
        skyState.dec = skyState.targetDec;
        skyState.fov = skyState.targetFov;
        skyState.isAnimating = false;
      }
    }

    const width = skyCanvas.width;
    const height = skyCanvas.height;
    const pr = Math.min(window.devicePixelRatio || 1, 2);

    skyCtx.clearRect(0, 0, width, height);

    // Deep space gradient
    const skyGrad = skyCtx.createRadialGradient(
      width / 2,
      height / 2,
      10,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.7
    );
    skyGrad.addColorStop(0, "#050a12");
    skyGrad.addColorStop(1, "#010204");
    skyCtx.fillStyle = skyGrad;
    skyCtx.fillRect(0, 0, width, height);

    // Camera coordinate frame (True Right Vector: worldUp x aimV)
    const aimV = raDecToVector3(skyState.ra, skyState.dec);
    const worldUp = { x: 0, y: 1, z: 0 };

    let rightV = {
      x: worldUp.y * aimV.z - worldUp.z * aimV.y,
      y: worldUp.z * aimV.x - worldUp.x * aimV.z,
      z: worldUp.x * aimV.y - worldUp.y * aimV.x
    };
    const rLen = Math.hypot(rightV.x, rightV.y, rightV.z);
    if (rLen > 0.0001) {
      rightV.x /= rLen;
      rightV.y /= rLen;
      rightV.z /= rLen;
    } else {
      rightV = { x: 1, y: 0, z: 0 };
    }

    const upV = {
      x: aimV.y * rightV.z - aimV.z * rightV.y,
      y: aimV.z * rightV.x - aimV.x * rightV.z,
      z: aimV.x * rightV.y - aimV.y * rightV.x
    };

    const fovRad = skyState.fov * DEG_TO_RAD;

    function project(v) {
      return projectCelestial(v, aimV, rightV, upV, width, height, fovRad);
    }

    // 1. Background Traditional Constellations
    skyCtx.lineWidth = 1.0 * pr;
    skyCtx.strokeStyle = "rgba(43, 62, 85, 0.35)";
    traditionalConstellations.forEach((c) => {
      c.segments.forEach(([fromId, toId]) => {
        const vA = starVectors.get(fromId);
        const vB = starVectors.get(toId);
        if (!vA || !vB) return;
        const pA = project(vA);
        const pB = project(vB);
        if (pA && pB && (pA.onScreen || pB.onScreen)) {
          skyCtx.beginPath();
          skyCtx.moveTo(pA.x, pA.y);
          skyCtx.lineTo(pB.x, pB.y);
          skyCtx.stroke();
        }
      });
    });

    // 2. Giraffe Constellation Asterism Lines (Glowing Cyan)
    const giraffeSegments = giraffeSubject.segments || [];
    if (giraffeSegments.length > 0) {
      // Glow blur halo
      skyCtx.lineWidth = 4.5 * pr;
      skyCtx.strokeStyle = "rgba(158, 203, 208, 0.22)";
      giraffeSegments.forEach((seg) => {
        const vA = starVectors.get(seg.from);
        const vB = starVectors.get(seg.to);
        if (!vA || !vB) return;
        const pA = project(vA);
        const pB = project(vB);
        if (pA && pB && (pA.onScreen || pB.onScreen)) {
          skyCtx.beginPath();
          skyCtx.moveTo(pA.x, pA.y);
          skyCtx.lineTo(pB.x, pB.y);
          skyCtx.stroke();
        }
      });

      // Crisp core line
      skyCtx.lineWidth = 1.8 * pr;
      skyCtx.strokeStyle = "rgba(158, 203, 208, 0.95)";
      giraffeSegments.forEach((seg) => {
        const vA = starVectors.get(seg.from);
        const vB = starVectors.get(seg.to);
        if (!vA || !vB) return;
        const pA = project(vA);
        const pB = project(vB);
        if (pA && pB && (pA.onScreen || pB.onScreen)) {
          skyCtx.beginPath();
          skyCtx.moveTo(pA.x, pA.y);
          skyCtx.lineTo(pB.x, pB.y);
          skyCtx.stroke();
        }
      });
    }

    // 3. Render Stars
    const constellationStarIds = new Set();
    giraffeSegments.forEach((s) => {
      constellationStarIds.add(s.from);
      constellationStarIds.add(s.to);
    });

    stars.forEach((star) => {
      const v = starVectors.get(star.id);
      if (!v) return;
      const p = project(v);
      if (!p || !p.onScreen) return;

      const isGiraffeStar = constellationStarIds.has(star.id);
      const baseR = magnitudeToRadius(star.mag) * pr;
      const r = isGiraffeStar ? baseR * 1.35 + 1.2 * pr : baseR;

      let color = star.ci !== null && star.ci !== undefined && star.ci < 0.3 ? "#d4eaff" : "#f4f1ea";
      if (isGiraffeStar) color = "#ffffff";

      // Core stellar dot
      skyCtx.beginPath();
      skyCtx.arc(p.x, p.y, r, 0, Math.PI * 2);
      skyCtx.fillStyle = color;
      skyCtx.fill();

      // Constellation highlight reticles
      if (isGiraffeStar) {
        skyCtx.beginPath();
        skyCtx.arc(p.x, p.y, r * 2.2, 0, Math.PI * 2);
        skyCtx.fillStyle = "rgba(158, 203, 208, 0.28)";
        skyCtx.fill();

        skyCtx.beginPath();
        skyCtx.arc(p.x, p.y, r + 4 * pr, 0, Math.PI * 2);
        skyCtx.strokeStyle = "rgba(229, 190, 122, 0.7)";
        skyCtx.lineWidth = 1.0 * pr;
        skyCtx.stroke();
      } else if (star.mag <= 2.2) {
        skyCtx.beginPath();
        skyCtx.arc(p.x, p.y, r * 2.0, 0, Math.PI * 2);
        skyCtx.fillStyle = "rgba(244, 241, 234, 0.12)";
        skyCtx.fill();
      }

      // Draw star name if named and prominent
      if (star.name && (isGiraffeStar || star.mag <= 2.8)) {
        skyCtx.font = `450 ${10 * pr}px "Geist", sans-serif`;
        skyCtx.fillStyle = isGiraffeStar ? "#9ecbd0" : "rgba(142, 156, 168, 0.75)";
        skyCtx.fillText(star.name, p.x + r + 5 * pr, p.y + 3 * pr);
      }
    });

    requestAnimationFrame(renderLiveSky);
  }

  // Interactive mouse/touch drag navigation on sky
  if (skyCanvas) {
    skyCanvas.addEventListener("mousedown", (e) => {
      skyState.isDragging = true;
      skyState.dragStartX = e.clientX;
      skyState.dragStartY = e.clientY;
      skyState.dragStartRa = skyState.ra;
      skyState.dragStartDec = skyState.dec;
      skyState.isAnimating = false;
    });

    window.addEventListener("mousemove", (e) => {
      if (!skyState.isDragging) return;
      const dx = e.clientX - skyState.dragStartX;
      const dy = e.clientY - skyState.dragStartY;

      const fovRatio = skyState.fov / 500;
      let newRa = skyState.dragStartRa + dx * fovRatio * (24 / 360);
      let newDec = skyState.dragStartDec + dy * fovRatio;

      if (newRa < 0) newRa += 24;
      if (newRa >= 24) newRa -= 24;
      newDec = Math.max(-89, Math.min(89, newDec));

      skyState.ra = newRa;
      skyState.dec = newDec;
      skyState.targetRa = newRa;
      skyState.targetDec = newDec;
    });

    window.addEventListener("mouseup", () => {
      skyState.isDragging = false;
    });

    // Touch support for mobile
    skyCanvas.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length === 1) {
          skyState.isDragging = true;
          skyState.dragStartX = e.touches[0].clientX;
          skyState.dragStartY = e.touches[0].clientY;
          skyState.dragStartRa = skyState.ra;
          skyState.dragStartDec = skyState.dec;
          skyState.isAnimating = false;
        }
      },
      { passive: true }
    );

    window.addEventListener(
      "touchmove",
      (e) => {
        if (!skyState.isDragging || e.touches.length !== 1) return;
        const dx = e.touches[0].clientX - skyState.dragStartX;
        const dy = e.touches[0].clientY - skyState.dragStartY;

        const fovRatio = skyState.fov / 500;
        let newRa = skyState.dragStartRa + dx * fovRatio * (24 / 360);
        let newDec = skyState.dragStartDec + dy * fovRatio;

        if (newRa < 0) newRa += 24;
        if (newRa >= 24) newRa -= 24;
        newDec = Math.max(-89, Math.min(89, newDec));

        skyState.ra = newRa;
        skyState.dec = newDec;
        skyState.targetRa = newRa;
        skyState.targetDec = newDec;
      },
      { passive: true }
    );

    window.addEventListener("touchend", () => {
      skyState.isDragging = false;
    });

    // Wheel zoom
    skyCanvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const delta = Math.sign(e.deltaY) * 3;
        skyState.targetFov = Math.max(20, Math.min(65, skyState.fov + delta));
        skyState.isAnimating = true;
      },
      { passive: false }
    );
  }

  // Start live rendering loop
  renderLiveSky();

  // Initialize strictly on Stage 0 (Raw Image)
  goToStep(0);
})();
