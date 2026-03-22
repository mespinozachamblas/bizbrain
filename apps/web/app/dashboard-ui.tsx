export function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="statCard">
      <p className="statLabel">{label}</p>
      <p className="statValue">{value}</p>
    </article>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <p className="emptyState">{message}</p>;
}
