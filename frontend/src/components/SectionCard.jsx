function SectionCard({ title, action, children }) {
  return (
    <section className="section-card">
      <div className="section-header">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default SectionCard;

