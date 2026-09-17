import { SITE } from "@/lib/site";

/**
 * PLACEHOLDER LOGO — a neutral geometric mark, not a designed identity.
 *
 * To use your real one: drop the file in `public/` (e.g. `public/logo.svg`)
 * and replace the <svg> below with:
 *   <Image src="/logo.svg" alt={SITE.name} width={32} height={32} priority />
 * importing Image from "next/image".
 */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span
      className={`btn-gradient grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white ${className}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4">
        <path
          d="M12 3 20 12 12 21 4 12z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinejoin="round"
        />
        <path
          d="M12 8.5 15.5 12 12 15.5 8.5 12z"
          fill="currentColor"
          opacity="0.9"
        />
      </svg>
    </span>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <Logo />
      {/* White: Wordmark is only ever used in the navy navbar today. Move it
          somewhere light and this needs a color prop instead. */}
      <span className="text-[17px] font-semibold tracking-tight text-white">
        {SITE.name}
      </span>
    </span>
  );
}
