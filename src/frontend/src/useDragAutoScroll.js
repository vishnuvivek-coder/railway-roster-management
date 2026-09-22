import { useEffect, useRef } from 'react';

/**
 * useDragAutoScroll: Silky-smooth edge auto-scrolling engine for HTML5 & Pointer Drag and Drop.
 * Automatically scrolls the window and any scrollable container when dragging items near
 * screen or container boundaries, enabling effortless drag-and-drop across the entire daily sheet.
 */
export function useDragAutoScroll({
  edgeThreshold = 130,
  maxSpeed = 32,
  minSpeed = 5,
  active = true
} = {}) {
  const isDraggingRef = useRef(false);
  const mousePosRef = useRef({ x: 0, y: 0, target: null });
  const animFrameIdRef = useRef(null);

  // Helper: Find all scrollable ancestor elements up to document
  const getScrollableParents = (element) => {
    const parents = [];
    if (!element) return parents;
    let parent = element;
    while (parent && parent !== document.body && parent !== document.documentElement) {
      try {
        const style = window.getComputedStyle(parent);
        const overflowY = style.overflowY;
        const overflowX = style.overflowX;
        const isScrollableY = (overflowY === 'auto' || overflowY === 'scroll') && (parent.scrollHeight - parent.clientHeight > 2);
        const isScrollableX = (overflowX === 'auto' || overflowX === 'scroll') && (parent.scrollWidth - parent.clientWidth > 2);
        if (isScrollableY || isScrollableX) {
          parents.push(parent);
        }
      } catch (err) {
        // ignore detached or inaccessible elements
      }
      parent = parent.parentElement;
    }
    return parents;
  };

  useEffect(() => {
    if (!active) return;

    const stopScrollLoop = () => {
      isDraggingRef.current = false;
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
    };

    const scrollStep = () => {
      if (!isDraggingRef.current) return;

      const { x, y, target } = mousePosRef.current;
      const winW = window.innerWidth || document.documentElement.clientWidth;
      const winH = window.innerHeight || document.documentElement.clientHeight;

      let scrollWindowX = 0;
      let scrollWindowY = 0;

      // 1. Calculate Viewport / Window Edge Proximity & Speed
      // Top Edge (scroll UP)
      if (y < edgeThreshold) {
        const dist = Math.max(0, edgeThreshold - y);
        const ratio = Math.min(2.0, dist / edgeThreshold);
        scrollWindowY = -Math.round(minSpeed + Math.pow(ratio, 1.2) * (maxSpeed - minSpeed));
      } 
      // Bottom Edge (scroll DOWN)
      else if (y > winH - edgeThreshold) {
        const dist = Math.max(0, y - (winH - edgeThreshold));
        const ratio = Math.min(2.0, dist / edgeThreshold);
        scrollWindowY = Math.round(minSpeed + Math.pow(ratio, 1.2) * (maxSpeed - minSpeed));
      }

      // Left Edge (scroll LEFT)
      if (x < edgeThreshold) {
        const dist = Math.max(0, edgeThreshold - x);
        const ratio = Math.min(2.0, dist / edgeThreshold);
        scrollWindowX = -Math.round(minSpeed + Math.pow(ratio, 1.2) * (maxSpeed - minSpeed));
      } 
      // Right Edge (scroll RIGHT)
      else if (x > winW - edgeThreshold) {
        const dist = Math.max(0, x - (winW - edgeThreshold));
        const ratio = Math.min(2.0, dist / edgeThreshold);
        scrollWindowX = Math.round(minSpeed + Math.pow(ratio, 1.2) * (maxSpeed - minSpeed));
      }

      // 2. Perform Window Scroll
      if (scrollWindowY !== 0 || scrollWindowX !== 0) {
        window.scrollBy({
          top: scrollWindowY,
          left: scrollWindowX,
          behavior: 'auto'
        });
      }

      // 3. Scroll all nested scrollable containers under cursor
      const scrollableContainers = getScrollableParents(target);
      for (const container of scrollableContainers) {
        try {
          const rect = container.getBoundingClientRect();
          let scrollContX = 0;
          let scrollContY = 0;

          // Container Top
          if (y < rect.top + edgeThreshold && y > rect.top - 50) {
            const dist = Math.max(0, (rect.top + edgeThreshold) - y);
            const ratio = Math.min(2.0, dist / edgeThreshold);
            if (container.scrollTop > 0) {
              scrollContY = -Math.round(minSpeed + Math.pow(ratio, 1.2) * (maxSpeed - minSpeed));
            }
          }
          // Container Bottom
          else if (y > rect.bottom - edgeThreshold && y < rect.bottom + 50) {
            const dist = Math.max(0, y - (rect.bottom - edgeThreshold));
            const ratio = Math.min(2.0, dist / edgeThreshold);
            if (container.scrollTop + container.clientHeight < container.scrollHeight - 1) {
              scrollContY = Math.round(minSpeed + Math.pow(ratio, 1.2) * (maxSpeed - minSpeed));
            }
          }

          // Container Left
          if (x < rect.left + edgeThreshold && x > rect.left - 50) {
            const dist = Math.max(0, (rect.left + edgeThreshold) - x);
            const ratio = Math.min(2.0, dist / edgeThreshold);
            if (container.scrollLeft > 0) {
              scrollContX = -Math.round(minSpeed + Math.pow(ratio, 1.2) * (maxSpeed - minSpeed));
            }
          }
          // Container Right
          else if (x > rect.right - edgeThreshold && x < rect.right + 50) {
            const dist = Math.max(0, x - (rect.right - edgeThreshold));
            const ratio = Math.min(2.0, dist / edgeThreshold);
            if (container.scrollLeft + container.clientWidth < container.scrollWidth - 1) {
              scrollContX = Math.round(minSpeed + Math.pow(ratio, 1.2) * (maxSpeed - minSpeed));
            }
          }

          if (scrollContY !== 0 || scrollContX !== 0) {
            container.scrollBy({
              top: scrollContY,
              left: scrollContX,
              behavior: 'auto'
            });
          }
        } catch (err) {
          // ignore scroll errors
        }
      }

      // Continue animation loop while dragging
      animFrameIdRef.current = requestAnimationFrame(scrollStep);
    };

    const startScrollLoop = () => {
      if (!isDraggingRef.current) {
        isDraggingRef.current = true;
        animFrameIdRef.current = requestAnimationFrame(scrollStep);
      }
    };

    const updateMousePos = (e) => {
      const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
      if (clientX !== 0 || clientY !== 0 || isDraggingRef.current) {
        mousePosRef.current = {
          x: clientX,
          y: clientY,
          target: e.target || document.elementFromPoint(clientX, clientY)
        };
      }
    };

    const handleDragStart = (e) => {
      updateMousePos(e);
      startScrollLoop();
    };

    const handleDrag = (e) => {
      updateMousePos(e);
    };

    const handleDragOver = (e) => {
      updateMousePos(e);
      if (!isDraggingRef.current) {
        startScrollLoop();
      }
    };

    const handleDragEnd = () => {
      stopScrollLoop();
    };

    const handleDrop = () => {
      stopScrollLoop();
    };

    // Attach listeners globally across the document and window
    window.addEventListener('dragstart', handleDragStart, { passive: true });
    window.addEventListener('drag', handleDrag, { passive: true });
    window.addEventListener('dragover', handleDragOver, { passive: true });
    window.addEventListener('dragend', handleDragEnd, { passive: true });
    window.addEventListener('drop', handleDrop, { passive: true });
    window.addEventListener('mouseup', handleDragEnd, { passive: true });
    window.addEventListener('touchend', handleDragEnd, { passive: true });
    window.addEventListener('touchcancel', handleDragEnd, { passive: true });

    return () => {
      stopScrollLoop();
      window.removeEventListener('dragstart', handleDragStart);
      window.removeEventListener('drag', handleDrag);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragend', handleDragEnd);
      window.removeEventListener('drop', handleDrop);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchend', handleDragEnd);
      window.removeEventListener('touchcancel', handleDragEnd);
    };
  }, [active, edgeThreshold, maxSpeed, minSpeed]);
}

export default useDragAutoScroll;
