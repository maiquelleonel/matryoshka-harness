// Universal Modal Zoom and Pan Inspector for Mermaid in MkDocs Material
(function () {
  // 1. Intercept closed shadow roots created by Material for MkDocs to allow inspection
  const origAttachShadow = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function (options) {
    const root = origAttachShadow.call(this, { mode: "open" });
    this.__mermaidShadow = root;
    return root;
  };

  let currentZoom = 1.0;
  let activeSvg = null;
  let isPanning = false;
  let startX = 0, startY = 0;
  let scrollLeftStart = 0, scrollTopStart = 0;

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
            <button type="button" class="mermaid-btn" id="mm-zoom-reset" title="Reset">100%</button>
            <button type="button" class="mermaid-btn" id="mm-zoom-in" title="Zoom In">+</button>
            <button type="button" class="mermaid-btn btn-close" id="mm-close" title="Close (Esc)">✕ Close</button>
          </div>
        </div>
        <div class="mermaid-modal-viewport" id="mermaid-modal-viewport"></div>
      `;
      document.body.appendChild(overlay);

      const viewport = document.getElementById("mermaid-modal-viewport");

      const close = () => {
        overlay.classList.remove("active");
        overlay.style.display = "none";
        viewport.innerHTML = "";
        activeSvg = null;
        currentZoom = 1.0;
        isPanning = false;
        viewport.classList.remove("grabbing");
      };

      const updateScale = () => {
        if (!activeSvg) return;
        activeSvg.style.transform = `scale(${currentZoom})`;
        document.getElementById("mm-zoom-reset").textContent = `${Math.round(currentZoom * 100)}%`;
      };

      document.getElementById("mm-close").addEventListener("click", (e) => {
        e.stopPropagation();
        close();
      });

      overlay.addEventListener("click", (e) => {
        if (e.target === overlay || e.target === viewport) {
          close();
        }
      });

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && overlay.classList.contains("active")) {
          close();
        }
      });

      document.getElementById("mm-zoom-in").addEventListener("click", (e) => {
        e.stopPropagation();
        currentZoom = Math.min(4.0, currentZoom + 0.25);
        updateScale();
      });

      document.getElementById("mm-zoom-out").addEventListener("click", (e) => {
        e.stopPropagation();
        currentZoom = Math.max(0.3, currentZoom - 0.25);
        updateScale();
      });

      document.getElementById("mm-zoom-reset").addEventListener("click", (e) => {
        e.stopPropagation();
        currentZoom = 1.0;
        updateScale();
      });

      // Mouse wheel zoom
      viewport.addEventListener(
        "wheel",
        (e) => {
          e.preventDefault();
          const delta = e.deltaY < 0 ? 0.15 : -0.15;
          currentZoom = Math.max(0.3, Math.min(4.0, currentZoom + delta));
          updateScale();
        },
        { passive: false }
      );

      // Drag to pan
      viewport.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        isPanning = true;
        startX = e.clientX;
        startY = e.clientY;
        scrollLeftStart = viewport.scrollLeft;
        scrollTopStart = viewport.scrollTop;
        viewport.classList.add("grabbing");
      });

      window.addEventListener("mousemove", (e) => {
        if (!isPanning) return;
        e.preventDefault();
        viewport.scrollLeft = scrollLeftStart - (e.clientX - startX);
        viewport.scrollTop = scrollTopStart - (e.clientY - startY);
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
    const viewport = document.getElementById("mermaid-modal-viewport");
    viewport.innerHTML = "";

    const clone = svg.cloneNode(true);
    clone.removeAttribute("width");
    clone.removeAttribute("height");
        clone.style.maxWidth = "none";
    clone.style.width = "auto";
    clone.style.height = "auto";
    clone.style.display = "block";

    viewport.appendChild(clone);
    activeSvg = clone;
    currentZoom = 1.0;
    activeSvg.style.transform = `scale(${currentZoom})`;
    document.getElementById("mm-zoom-reset").textContent = `${Math.round(currentZoom * 100)}%`;

    overlay.style.display = "flex";
    void overlay.offsetWidth;
    overlay.classList.add("active");
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

    // If not inside a .mermaid block in composedPath, check target.closest
    if (!mermaidContainer) {
      const target = event.target;
      if (!target || !target.closest) return null;
      mermaidContainer = target.closest(".mermaid");
      if (!mermaidContainer) return null;
    }

    // STRICT ISOLATION: The click MUST have occurred inside a .mermaid block
    // Ignore header logos, hamburger nav icons, search buttons, copy buttons, etc.
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
