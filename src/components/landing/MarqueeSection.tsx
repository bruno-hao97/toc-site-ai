const models = [
  'VEO - Omni',
  'Kling 3.0 - Motion Control',
  'Seedance 2.0 - Omni',
  'Kling O1 - Edit',
  'Grok Video - Heavy',
  'Kling 2.6 - Motion Control',
  'Nano Babana Pro',
  'Google Veo',
  'Flux Pro',
  'ElevenLabs v3',
];

export default function MarqueeSection() {
  return (
    <section className="model-rail" aria-label="Model đang hỗ trợ">
      <div className="container">
        <p className="model-rail-label">Kiến trúc hỗ trợ</p>
        <div className="model-rail-track">
          {models.map((name) => (
            <span key={name} className="model-rail-item">
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
