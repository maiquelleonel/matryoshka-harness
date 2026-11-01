// Universal Modal Zoom for all Mermaid Diagrams in MkDocs Material
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
        overlay.style.display = "none";
        document.getElementById("mermaid-modal-viewport").innerHTML = "";
        activeSvg = null;
        currentZoom = 1.0;
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
        if (e.target === overlay || e.target.id === "mermaid-modal-viewport") {
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

      const viewport = document.getElementById("mermaid-modal-viewport");
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
    clone.style.minWidth = "750px";
    clone.style.maxWidth = "none";
    clone.style.width = "auto";
    clone.style.height = "auto";

    viewport.appendChild(clone);
    activeSvg = clone;
    currentZoom = 1.4;
    activeSvg.style.transform = `scale(${currentZoom})`;
    document.getElementById("mm-zoom-reset").textContent = `${Math.round(currentZoom * 100)}%`;

    overlay.style.display = "flex";
    // Force reflow for opacity transition
    void overlay.offsetWidth;
    overlay.classList.add("active");
  }

  // Intercept clicks globally on any element inside or related to mermaid
  function attachGlobalListener() {
    ensureModal();

    document.addEventListener("click", function (e) {
      // Find closest mermaid container or svg
      let el = e.target;
      while (el && el !== document.body) {
        if (
          el.tagName &&
          (el.tagName.toLowerCase() === "svg" ||
            el.classList?.contains("mermaid") ||
            el.parentElement?.classList?.contains("mermaid"))
        ) {
          const svg = el.tagName.toLowerCase() === "svg" ? el : el.querySelector("svg");
          if (svg) {
            e.preventDefault();
            e.stopPropagation();
            openModalWithSvg(svg);
            return;
          }
        }
        el = el.parentElement;
      }
    }, true); // Use capture phase to ensure no framework stops propagation!
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attachGlobalListener);
  } else {
    attachGlobalListener();
  }
})();
