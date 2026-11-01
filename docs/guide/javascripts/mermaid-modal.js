// Universal Modal Zoom and Pan Inspector for Mermaid in MkDocs Material
(function () {
  // 1. Intercept closed shadow roots created by Material for MkDocs to allow inspection
  const origAttachShadow = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function (options) {
    const root = origAttachShadow.call(this, { mode: "open" });
    this.__mermaidShadow = root;
    return root;
  };

  let scale = 1.0;
  let panX = 0;
  let panY = 0;
  let naturalWidth = 800;
  let naturalHeight = 600;
  let canvas = null;
  let viewport = null;
  let isPanning = false;
  let startX = 0, startY = 0;
  let initialPanX = 0, initialPanY = 0;

  function applyTransform() {
    if (!canvas) return;
    canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    const resetBtn = document.getElementById("mm-zoom-reset");
    if (resetBtn) {
      resetBtn.textContent = `${Math.round(scale * 100)}%`;
    }
  }

  function fitToScreen() {
    if (!viewport || !canvas) return;
    const vW = viewport.clientWidth || window.innerWidth;
    const vH = viewport.clientHeight || (window.innerHeight - 60);

    const padding = 60;
    const scaleX = (vW - padding * 2) / naturalWidth;
    const scaleY = (vH - padding * 2) / naturalHeight;
    // Fit completely inside viewport, max initial scale 1.0
    scale = Math.max(0.1, Math.min(1.0, scaleX, scaleY));

    panX = (vW - naturalWidth * scale) / 2;
    panY = (vH - naturalHeight * scale) / 2;
    applyTransform();
  }

  function ensureModal() {
    let overlay = document.getElementById("mermaid-modal-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "mermaid-modal-overlay";
      overlay.innerHTML = `
        <div class="mermaid-modal-bar">
          <div class="mermaid-modal-title">🔍 Mermaid Architecture Inspector (Scroll wheel to zoom, drag to pan)</div>
          <div class="mermaid-modal-controls">
            <button type="button" class="mermaid-btn" id="mm-zoom-out" title="Zoom Out">−</button>
            <button type="button" class="mermaid-btn" id="mm-zoom-reset" title="Fit to Screen">100%</button>
            <button type="button" class="mermaid-btn" id="mm-zoom-in" title="Zoom In">+</button>
            <button type="button" class="mermaid-btn btn-close" id="mm-close" title="Close (Esc)">✕ Close</button>
          </div>
        </div>
        <div class="mermaid-modal-viewport" id="mermaid-modal-viewport">
          <div class="mermaid-modal-canvas" id="mermaid-modal-canvas"></div>
        </div>
      `;
      document.body.appendChild(overlay);

      viewport = document.getElementById("mermaid-modal-viewport");
      canvas = document.getElementById("mermaid-modal-canvas");

      const close = () => {
        overlay.classList.remove("active");
        overlay.style.display = "none";
        canvas.innerHTML = "";
        scale = 1.0;
        panX = 0;
        panY = 0;
        isPanning = false;
        viewport.classList.remove("grabbing");
      };

      document.getElementById("mm-close").addEventListener("click", (e) => {
        e.stopPropagation();
        close();
      });

      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          close();
        }
      });

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && overlay.classList.contains("active")) {
          close();
        }
      });

      // Zoom In (centered on screen)
      document.getElementById("mm-zoom-in").addEventListener("click", (e) => {
        e.stopPropagation();
        const vW = viewport.clientWidth;
        const vH = viewport.clientHeight;
        const centerX = vW / 2;
        const centerY = vH / 2;
        const newScale = Math.min(5.0, scale * 1.25);
        panX = centerX - (centerX - panX) * (newScale / scale);
        panY = centerY - (centerY - panY) * (newScale / scale);
        scale = newScale;
        applyTransform();
      });

      // Zoom Out (centered on screen)
      document.getElementById("mm-zoom-out").addEventListener("click", (e) => {
        e.stopPropagation();
        const vW = viewport.clientWidth;
        const vH = viewport.clientHeight;
        const centerX = vW / 2;
        const centerY = vH / 2;
        const newScale = Math.max(0.1, scale * 0.8);
        panX = centerX - (centerX - panX) * (newScale / scale);
        panY = centerY - (centerY - panY) * (newScale / scale);
        scale = newScale;
        applyTransform();
      });

      // Reset / Fit to Screen
      document.getElementById("mm-zoom-reset").addEventListener("click", (e) => {
        e.stopPropagation();
        fitToScreen();
      });

      // Mouse wheel zoom centered on cursor (Figma-style)
      viewport.addEventListener(
        "wheel",
        (e) => {
          e.preventDefault();
          const rect = viewport.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;

          const factor = e.deltaY < 0 ? 1.15 : 0.87;
          const newScale = Math.max(0.08, Math.min(6.0, scale * factor));

          panX = mouseX - (mouseX - panX) * (newScale / scale);
          panY = mouseY - (mouseY - panY) * (newScale / scale);
          scale = newScale;

          applyTransform();
        },
        { passive: false }
      );

      // Drag to pan (infinite canvas)
      viewport.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        isPanning = true;
        startX = e.clientX;
        startY = e.clientY;
        initialPanX = panX;
        initialPanY = panY;
        viewport.classList.add("grabbing");
      });

      window.addEventListener("mousemove", (e) => {
        if (!isPanning) return;
        panX = initialPanX + (e.clientX - startX);
        panY = initialPanY + (e.clientY - startY);
        applyTransform();
      });

      window.addEventListener("mouseup", () => {
        if (isPanning) {
          isPanning = false;
          viewport.classList.remove("grabbing");
        }
      });
    }
    return overlay;
  }

  function openModalWithSvg(svg) {
    if (!svg) return;
    const overlay = ensureModal();
    canvas = document.getElementById("mermaid-modal-canvas");
    viewport = document.getElementById("mermaid-modal-viewport");
    canvas.innerHTML = "";

    const clone = svg.cloneNode(true);
    clone.removeAttribute("width");
    clone.removeAttribute("height");

    // Extract natural dimensions from viewBox or bounding box
    let w = 800;
    let h = 600;
    if (svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width > 0) {
      w = svg.viewBox.baseVal.width;
      h = svg.viewBox.baseVal.height;
    } else {
      const bbox = svg.getBoundingClientRect();
      w = bbox.width || 800;
      h = bbox.height || 600;
    }

    naturalWidth = w;
    naturalHeight = h;

    clone.style.width = `${w}px`;
    clone.style.height = `${h}px`;
    clone.style.maxWidth = "none";
    clone.style.maxHeight = "none";
    clone.style.display = "block";

    canvas.appendChild(clone);

    overlay.style.display = "flex";
    void overlay.offsetWidth;
    overlay.classList.add("active");

    // Auto-fit to viewport so tall or wide diagrams are never cut off
    fitToScreen();
  }

  function getSvgFromEvent(event) {
    let mermaidContainer = null;
    let foundSvg = null;

    if (event.composedPath) {
      const path = event.composedPath();
      for (const el of path) {
        if (!el || !el.tagName) continue;
        const tag = el.tagName.toLowerCase();
        if (tag === "svg" && !foundSvg) {
          foundSvg = el;
        }
        if (el.classList && el.classList.contains("mermaid")) {
          mermaidContainer = el;
          break;
        }
      }
    }

    if (!mermaidContainer) {
      const target = event.target;
      if (!target || !target.closest) return null;
      mermaidContainer = target.closest(".mermaid");
      if (!mermaidContainer) return null;
    }

    const shadow = mermaidContainer.__mermaidShadow || mermaidContainer.shadowRoot;
    if (shadow) {
      const shadowSvg = shadow.querySelector("svg");
      if (shadowSvg) return shadowSvg;
    }

    if (foundSvg && (mermaidContainer === foundSvg || mermaidContainer.contains(foundSvg))) {
      return foundSvg;
    }

    if (mermaidContainer.tagName && mermaidContainer.tagName.toLowerCase() === "svg") {
      return mermaidContainer;
    }

    return mermaidContainer.querySelector("svg");
  }

  function attachGlobalListener() {
    ensureModal();

    document.addEventListener(
      "click",
      function (e) {
        if (e.target.closest && e.target.closest("#mermaid-modal-overlay")) {
          return;
        }

        const svg = getSvgFromEvent(e);
        if (svg) {
          e.preventDefault();
          e.stopPropagation();
          openModalWithSvg(svg);
        }
      },
      true
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attachGlobalListener);
  } else {
    attachGlobalListener();
  }
})();
