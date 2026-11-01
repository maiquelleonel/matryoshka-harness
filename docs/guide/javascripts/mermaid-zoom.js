// Universal Modal Zoom for all Mermaid diagrams in MkDocs Material
(function () {
  let zoomLevel = 1.0;
  let activeModalSvg = null;

  function initMermaidZoom() {
    const mermaidContainers = document.querySelectorAll(".mermaid");
    if (!mermaidContainers.length) return;

    // Create Modal DOM elements once
    let modalOverlay = document.getElementById("mermaid-zoom-modal");
    if (!modalOverlay) {
      modalOverlay = document.createElement("div");
      modalOverlay.id = "mermaid-zoom-modal";
      modalOverlay.className = "mermaid-modal-overlay";
      modalOverlay.innerHTML = `
        <div class="mermaid-modal-content">
          <div class="mermaid-modal-header">
            <div class="mermaid-modal-title">
              <span>🔍 Architecture Diagram Inspector</span>
            </div>
            <div class="mermaid-modal-actions">
              <button class="mermaid-modal-btn" id="mermaid-zoom-out" title="Zoom Out">−</button>
              <button class="mermaid-modal-btn" id="mermaid-zoom-reset" title="Reset Zoom">100%</button>
              <button class="mermaid-modal-btn" id="mermaid-zoom-in" title="Zoom In">+</button>
              <button class="mermaid-modal-btn close" id="mermaid-modal-close" title="Close (Esc)">✕ Close</button>
            </div>
          </div>
          <div class="mermaid-modal-body" id="mermaid-modal-body"></div>
        </div>
      `;
      document.body.appendChild(modalOverlay);

      // Event handlers for controls
      const closeBtn = document.getElementById("mermaid-modal-close");
      const zoomInBtn = document.getElementById("mermaid-zoom-in");
      const zoomOutBtn = document.getElementById("mermaid-zoom-out");
      const resetBtn = document.getElementById("mermaid-zoom-reset");
      const modalBody = document.getElementById("mermaid-modal-body");

      function closeModal() {
        modalOverlay.classList.remove("active");
        modalBody.innerHTML = "";
        zoomLevel = 1.0;
        activeModalSvg = null;
      }

      function updateZoom() {
        if (!activeModalSvg) return;
        activeModalSvg.style.transform = `scale(${zoomLevel})`;
        resetBtn.textContent = `${Math.round(zoomLevel * 100)}%`;
      }

      closeBtn.addEventListener("click", closeModal);
      modalOverlay.addEventListener("click", (e) => {
        if (e.target === modalOverlay) closeModal();
      });

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modalOverlay.classList.contains("active")) {
          closeModal();
        }
      });

      zoomInBtn.addEventListener("click", () => {
        zoomLevel = Math.min(3.5, zoomLevel + 0.25);
        updateZoom();
      });

      zoomOutBtn.addEventListener("click", () => {
        zoomLevel = Math.max(0.4, zoomLevel - 0.25);
        updateZoom();
      });

      resetBtn.addEventListener("click", () => {
        zoomLevel = 1.0;
        updateZoom();
      });

      modalBody.addEventListener("wheel", (e) => {
        e.preventDefault();
        if (e.deltaY < 0) {
          zoomLevel = Math.min(3.5, zoomLevel + 0.15);
        } else {
          zoomLevel = Math.max(0.4, zoomLevel - 0.15);
        }
        updateZoom();
      }, { passive: false });
    }

    // Wrap each rendered mermaid block with zoom-in trigger
    mermaidContainers.forEach((container) => {
      if (container.dataset.zoomInitialized) return;
      container.dataset.zoomInitialized = "true";

      const wrapper = document.createElement("div");
      wrapper.className = "mermaid-wrapper";
      wrapper.title = "Click to inspect & zoom in fullscreen modal";

      const zoomBadge = document.createElement("button");
      zoomBadge.className = "mermaid-zoom-btn";
      zoomBadge.innerHTML = "🔍 Zoom";
      zoomBadge.title = "Expand diagram";

      container.parentNode.insertBefore(wrapper, container);
      wrapper.appendChild(container);
      wrapper.appendChild(zoomBadge);

      function openModal() {
        const svg = container.querySelector("svg");
        if (!svg) return;

        const modalOverlay = document.getElementById("mermaid-zoom-modal");
        const modalBody = document.getElementById("mermaid-modal-body");
        modalBody.innerHTML = "";

        const clonedSvg = svg.cloneNode(true);
        // Ensure natural dimensions
        clonedSvg.removeAttribute("width");
        clonedSvg.removeAttribute("height");
        clonedSvg.style.minWidth = "600px";
        clonedSvg.style.maxWidth = "none";

        modalBody.appendChild(clonedSvg);
        activeModalSvg = clonedSvg;
        zoomLevel = 1.35; // Default initial zoom for high clarity
        activeModalSvg.style.transform = `scale(${zoomLevel})`;

        const resetBtn = document.getElementById("mermaid-zoom-reset");
        if (resetBtn) resetBtn.textContent = `${Math.round(zoomLevel * 100)}%`;

        modalOverlay.classList.add("active");
      }

      wrapper.addEventListener("click", openModal);
    });
  }

  // Subscribe to instant navigation and DOM readiness
  if (typeof document$ !== "undefined") {
    document$.subscribe(() => {
      setTimeout(initMermaidZoom, 300);
    });
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      setTimeout(initMermaidZoom, 300);
    });
  }
})();
