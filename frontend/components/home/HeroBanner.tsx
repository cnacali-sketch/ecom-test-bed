import Image from "next/image";
import Link from "next/link";

/** Full-width campaign banner with editorial photography (Zara-style). */
export function HeroBanner() {
  return (
    <section className="relative h-[70vh] min-h-[420px] w-full overflow-hidden bg-neutral-900">
      <Image
        src="https://placehold.co/1920x1080/2a2a2a/e5e5e5?text=Savvy+Editorial+Campaign"
        alt="Savvy seasonal campaign, editorial photography"
        fill
        priority
        sizes="100vw"
        className="object-cover opacity-90"
      />
      <div className="absolute inset-0 flex flex-col items-start justify-end gap-4 p-8 sm:p-16">
        <h1 className="max-w-xl text-3xl font-semibold text-white sm:text-5xl">
          Further Reductions — 100+ New Lines Added
        </h1>
        <Link
          href="/collections/bags"
          className="rounded-full bg-white px-6 py-3 text-sm font-medium text-neutral-900 hover:bg-neutral-200"
        >
          Shop the Edit
        </Link>
      </div>
    </section>
  );
}
