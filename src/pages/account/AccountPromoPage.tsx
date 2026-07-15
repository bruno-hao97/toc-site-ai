export default function AccountPromoPage() {
  return (
    <div className="account-settings">
      <h1 className="account-content-title">🎁 MÃ KHUYẾN MÃI</h1>
      <section className="panel account-card">
        <p className="muted">Nhập mã khuyến mãi để nhận credit bonus.</p>
        <form className="form account-form" onSubmit={(e) => e.preventDefault()}>
          <label className="field">
            <span className="label">MÃ KHUYẾN MÃI</span>
            <input placeholder="Nhập mã…" />
          </label>
          <button type="submit" className="btn account-teal-btn" disabled>
            Áp dụng (sắp có)
          </button>
        </form>
      </section>
    </div>
  );
}
