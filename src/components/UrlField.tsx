export default function UrlField({
  label,
  value,
  onChange,
  onUpload,
  accept = 'image/*,video/*',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onUpload: (f: File) => Promise<void>;
  accept?: string;
}) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      <div className="url-row">
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://…" />
        <label className="btn ghost sm upload-btn">
          Upload
          <input
            type="file"
            accept={accept}
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onUpload(f);
              e.target.value = '';
            }}
          />
        </label>
      </div>
    </label>
  );
}
