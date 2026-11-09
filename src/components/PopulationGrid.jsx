import { useEffect, useMemo, useRef } from 'react';

export default function PopulationGrid({ rows, sample, inspected, onInspect }) {
  const canvas = useRef(null);
  const selected = useMemo(() => new Set(sample.indices), [sample.indices]);
  const rowCount = Math.ceil(rows.length / 100);

  useEffect(() => {
    const element = canvas.current;
    function draw() {
      const { width, height } = element.getBoundingClientRect();
      if (!width || !height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      element.width = Math.round(width * dpr);
      element.height = Math.round(height * dpr);
      const ctx = element.getContext('2d');
      ctx.scale(dpr, dpr);
      const cw = width / 100, ch = height / rowCount;
      for (let i = 0; i < rows.length; i += 1) {
        const x = (i % 100) * cw, y = Math.floor(i / 100) * ch;
        const isSelected = selected.has(i);
        ctx.fillStyle = isSelected ? '#2563EB' : Math.floor((i % 100) / 20) % 2 ? '#CDDDE7' : '#DAE6ED';
        ctx.fillRect(x + 0.55, y + 0.55, Math.max(1, cw - 1.1), Math.max(1, ch - 1.1));
        if (isSelected) {
          ctx.strokeStyle = '#FB7185';
          ctx.lineWidth = 1.2;
          ctx.strokeRect(x + 0.35, y + 0.35, Math.max(1, cw - 0.7), Math.max(1, ch - 0.7));
        }
      }
    }
    const observer = new ResizeObserver(draw);
    observer.observe(element);
    draw();
    return () => observer.disconnect();
  }, [rows, rowCount, selected]);

  function inspectAt(event) {
    const rect = canvas.current.getBoundingClientRect();
    const x = Math.min(99, Math.max(0, Math.floor((event.clientX - rect.left) / rect.width * 100)));
    const y = Math.min(rowCount - 1, Math.max(0, Math.floor((event.clientY - rect.top) / rect.height * rowCount)));
    const index = y * 100 + x;
    if (index < rows.length) onInspect(index);
  }

  return (
    <figure className="population-figure">
      <div className="day-axis" aria-hidden="true">{['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => <span key={day}>{day}</span>)}</div>
      <div className="grid-body">
        <div className="week-axis" aria-hidden="true"><span>Week 1</span><span>25</span><span>50</span><span>75</span><span>100</span></div>
        <div className="canvas-frame">
          <canvas
            ref={canvas}
            role="img"
            aria-label="Full population grid: 10,000 appointments in original chronological order. One cell per appointment; 100 selected appointments have blue fill and coral outlines."
            aria-describedby="grid-description"
            onPointerMove={event => { if (event.pointerType === 'mouse') inspectAt(event); }}
            onPointerDown={inspectAt}
          />
          <div className="inspection-marker" aria-hidden="true" style={{ left: (inspected % 100) + '%', top: Math.floor(inspected / 100) / rowCount * 100 + '%', width: '1%', height: 100 / rowCount + '%' }} />
        </div>
      </div>
      <figcaption id="grid-description">Read left to right, then down. Each horizontal row is one week: five days × 20 appointment slots. Use the row inspector for keyboard access to every appointment.</figcaption>
    </figure>
  );
}
