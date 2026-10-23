/** 이름 첫 글자 동그라미 */
export function Avatar({ name }: { name: string }) {
  return (
    <span
      className="inline-grid size-6 flex-none place-items-center rounded-full bg-accent-soft-strong text-2xs font-semibold text-accent"
      aria-hidden="true"
    >
      {name.slice(0, 1)}
    </span>
  );
}
