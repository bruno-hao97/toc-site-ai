const models = [
  'VEO - Omni',
  'Happy Horse - 1',
  'Video Upscale 1.0',
  'Kling 3.0 - Motion Control',
  'Kling 3.0 - Edit',
  'Seedance 2.0 - Remix',
  'Seedance 2.0 - Omni',
  'Seedance 2.0',
  'Kling 3.0 - Omni',
  'Grok Video - Heavy',
  'Kling O1 - Edit',
  'Kling 2.6 - Motion Control',
];

export default function MarqueeSection() {
  const items = [...models, ...models];

  return (
    <section className="marquee-section">
      <p className="marquee-label">Kiến trúc hỗ trợ</p>
      <div className="marquee-track">
        {items.map((m, i) => (
          <span key={`${m}-${i}`} className="marquee-pill">
            {m}
          </span>
        ))}
      </div>
    </section>
  );
}
