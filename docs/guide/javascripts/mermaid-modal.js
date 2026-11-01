// Safe Click-to-Zoom Modal: Intercepts clicks on rendered Mermaid SVG or container
(function () {
  let currentZoom = 1.0;
  let activeSvg = null;

  function ensureModal() {
    let overlay = document.getElementById("mermaid-modal-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "mermaid-modal-overlay";
      overlay.innerHTML = `
        <div class="mermaid-modal-bar">
          <div class="mermaid-modal-title">🔍 Mermaid Architecture Inspector (Scroll wheel to zoom, drag/scroll to pan)</div>
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

      const close = () => {
        overlay.classList.remove("active");
        document.getElementById("mermaid-modal-viewport").innerHTML = "";
        activeSvg = null;
        currentZoom = 1.0;
      };

      const updateScale = () => {
        if (!activeSvg) return;
        activeSvg.style.transform = `scale(${currentZoom})`;
        document.getElementById("mm-zoom-reset").textContent = `${Math.round(currentZoom * 100)}%`;
      };

      document.getElementById("mm-close").addEventListener("click", close);
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay || e.target.id === "mermaid-modal-viewport") close();
      });

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && overlay.classList.contains("active")) close();
      });

      document.getElementById("mm-zoom-in").addEventListener("click", () => {
        currentZoom = Math.min(4.0, currentZoom + 0.25);
        updateScale();
      });

      document.getElementById("mm-zoom-out").addEventListener("click", () => {
        currentZoom = Math.max(0.3, currentZoom - 0.25);
        updateScale();
      });

      document.getElementById("mm-zoom-reset").addEventListener("click", () => {
        currentZoom = 1.0;
        updateScale();
      });

      const viewport = document.getElementById("mermaid-modal-viewport");
      viewport.addEventListener("wheel", (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.15 : -0.15;
        currentZoom = Math.max(0.3, Math.min(4.0, currentZoom + delta));
        updateScale();
      }, { passive: false });
    }
    return overlay;
  }

  function handleMermaidClick(e) {
    // Check if clicked target is an SVG or inside .mermaid or svg.mermaid
    const target = e.target;
    let svg = null;

    if (target.tagName && target.tagName.toLowerCase() === "svg") {
      svg = target;
    } else if (target.ownerSVGElement) {
      svg = target.ownerSVGElement;
    } else {
      const container = target.closest(".mermaid");
      if (container) {
        svg = container.querySelector("svg");
      }
    }

    if (!svg) return;

    const overlay = ensureModal();
    const viewport = document.getElementById("mermaid-modal-viewport");
    viewport.innerHTML = "";

    const clone = svg.cloneNode(true);
    clone.removeAttribute("width");
    clone.removeAttribute("height");
    clone.style.minWidth = "800px";
    clone.style.maxWidth = "none";
    clone.style.width = "auto";
    clone.style.height = "auto";

    viewport.appendChild(clone);
    activeSvg = clone;
    currentZoom = 1.4; // 140% high clarity
    activeSvg.style.transform = `scale(${currentZoom})`;
    document.getElementById("mm-zoom-reset").textContent = `${Math.round(currentZoom * 100)}%`;

    overlay.classList.add("active");
  }

  function attachListeners() {
    ensureModal();
    document.removeEventListener("click", handleMermaidClick);
    document.addEventListener("click", handleMermaidClick);
  }

  // MkDocs instant navigation support via document$ observable
  if (typeof document$ !== "undefined") {
    document$.subscribe(() => {
      attachListeners();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attachListeners);
  } else {
    attachListeners();
  }
})();
