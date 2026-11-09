import { useEffect, useRef, useState } from 'react';

const value = number => number.toFixed(4);
const tick = number => number.toLocaleString('en-US', { maximumFractionDigits: 2 });

export default function SamplingDistribution({ result, bins, scale, color, label }) {
  const container = useRef(null);
  const [width, setWidth] = useState(360);
  const [hovered, setHovered] = useState(null);
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      const actual = container.current.getBoundingClientRect().width;
      if (actual > 0) setWidth(Math.max(220, Math.floor(actual)));
    });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const height = 240;
  const left = 64, right = width - 15, top = 16, bottom = 188;
  const x = number => left + (number - scale.xMin) / (scale.xMax - scale.xMin) * (right - left);
  const y = probability => bottom - probability / scale.yMax * (bottom - top);
  const xTicks = Array.from({ length: 5 }, (_, i) => scale.xMin + (scale.xMax - scale.xMin) * i / 4);
  const yTicks = Array.from({ length: 5 }, (_, i) => scale.yMax * i / 4);
  return <div className="distribution">
    <div ref={container} className="distribution-plot">
      <svg width="100%" height={height} viewBox={'0 0 ' + width + ' ' + height} role="img" aria-label={label + ': distribution of ' + result.runs + ' mean estimates in minutes. Dashed yellow reference: true mean ' + value(result.truth) + '. Solid coral reference: mean estimate ' + value(result.estimateMean) + '. A bin data table follows.'}>
        <rect x={left} y={top} width={right - left} height={bottom - top} fill="#FBFCFF" stroke="#D8E3EF" />
        {yTicks.map((probability, i) => <g key={i}><line x1={left} x2={right} y1={y(probability)} y2={y(probability)} stroke="#E4EBF4" /><text x={left - 7} y={y(probability) + 4} textAnchor="end" fill="#526A84" fontSize="11">{tick(probability * 100)}%</text></g>)}
        {bins.map((bin, i) => <rect key={i} x={x(bin.lower) + 0.7} y={y(bin.probability)} width={Math.max(0.5, x(bin.upper) - x(bin.lower) - 1.4)} height={Math.max(0, bottom - y(bin.probability))} fill={color} fillOpacity={hovered === i ? 1 : 0.78} onPointerEnter={() => setHovered(i)} onPointerLeave={() => setHovered(null)} onClick={() => setHovered(i)}><title>{tick(bin.lower)}–{tick(bin.upper)} min: {bin.count} estimates ({tick(bin.probability * 100)}%)</title></rect>)}
        <line x1={x(result.truth)} x2={x(result.truth)} y1={top} y2={bottom} stroke="#FACC15" strokeWidth="4" strokeDasharray="5 4" />
        <line x1={x(result.truth)} x2={x(result.truth)} y1={top} y2={bottom} stroke="#89700C" strokeWidth="1.4" strokeDasharray="5 4" />
        <line x1={x(result.estimateMean)} x2={x(result.estimateMean)} y1={top} y2={bottom} stroke="#BE3455" strokeWidth="2" />
        {xTicks.map((number, i) => <g key={i}><line x1={x(number)} x2={x(number)} y1={bottom} y2={bottom + 5} stroke="#73869C" /><text x={x(number)} y={bottom + 20} textAnchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'} fill="#526A84" fontSize="11">{tick(number)}</text></g>)}
        <text x={(left + right) / 2} y={height - 9} textAnchor="middle" fill="#3C566F" fontSize="12">Estimated mean wait (minutes)</text>
        <text transform={'translate(13 ' + (top + bottom) / 2 + ') rotate(-90)'} textAnchor="middle" fill="#3C566F" fontSize="11">Estimates per bin (%)</text>
      </svg>
    </div>
    <div className="distribution-hover" aria-live="off">{hovered === null ? 'Hover or tap a bar to inspect its bin.' : tick(bins[hovered].lower) + '–' + tick(bins[hovered].upper) + ' min · ' + bins[hovered].count + ' estimates · ' + tick(bins[hovered].probability * 100) + '%'}</div>
    <div className="distribution-references"><span><i className="true-reference" />True mean <strong>{value(result.truth)} min</strong></span><span><i className="estimate-reference" />Mean estimate <strong>{value(result.estimateMean)} min</strong></span></div>
    <details className="bin-details"><summary>View accessible bin table</summary><div className="table-wrap"><table><caption>Histogram bins for {label}</caption><thead><tr><th scope="col">Wait estimate range (min)</th><th scope="col">Count</th><th scope="col">Percentage</th></tr></thead><tbody>{bins.map((bin, i) => <tr key={i}><th scope="row">{tick(bin.lower)}–{tick(bin.upper)}</th><td>{bin.count}</td><td>{tick(bin.probability * 100)}%</td></tr>)}</tbody></table></div></details>
  </div>;
}
