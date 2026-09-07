"use client";

import { useFormStatus } from "react-dom";

// The parent-facing form kit.
//
// Written for a phone held in one hand while a kid asks for a snack: big touch
// targets, one question per block, and choices you tap rather than dropdowns
// you hunt through. Everything here is deliberately plain — the warmth in this
// flow comes from the words, not from decoration.

export function StepHeader({
  eyebrow,
  title,
  sub,
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="mb-6">
      {eyebrow && (
        <p className="mb-1.5 font-sport text-[11px] font-bold uppercase tracking-[0.14em] text-orange">
          {eyebrow}
        </p>
      )}
      <h1 className="font-display text-[28px] leading-[1.06] font-black tracking-tight text-near-black">
        {title}
      </h1>
      {sub && <p className="mt-2 font-body text-[15px] leading-relaxed text-gray-dark">{sub}</p>}
    </div>
  );
}

export function Question({
  label,
  hint,
  optional,
  children,
  error,
}: {
  label: string;
  hint?: string;
  optional?: boolean;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="mb-6">
      <div className="mb-2">
        <label className="font-heading text-[15px] font-bold text-near-black">
          {label}
          {optional && (
            <span className="ml-2 font-body text-[13px] font-normal text-gray-dark">Optional</span>
          )}
        </label>
        {hint && <p className="mt-1 font-body text-[13.5px] leading-snug text-gray-dark">{hint}</p>}
      </div>
      {children}
      {error && (
        <p role="alert" className="mt-1.5 font-body text-[13px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

const inputBase =
  "w-full rounded-lg border border-gray-mid bg-white px-3.5 py-3 font-body text-[16px] text-near-black placeholder:text-gray-dark/60 focus:border-orange focus:outline-none focus:ring-2 focus:ring-orange/25";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputBase} ${props.className ?? ""}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} rows={props.rows ?? 3} className={`${inputBase} ${props.className ?? ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputBase} ${props.className ?? ""}`} />;
}

/**
 * A tappable choice. Used for single-select (radio) and multi-select
 * (checkbox) alike — same target size, same look, so the difference the parent
 * notices is how many stay lit, which is what actually matters to them.
 */
export function ChoiceChip({
  name,
  value,
  label,
  type = "checkbox",
  defaultChecked,
}: {
  name: string;
  value: string;
  label: string;
  type?: "checkbox" | "radio";
  defaultChecked?: boolean;
}) {
  return (
    <label className="cursor-pointer">
      <input
        type={type}
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />
      <span className="flex min-h-[46px] items-center rounded-full border border-gray-mid bg-white px-4 font-body text-[15px] text-near-black transition-colors peer-checked:border-orange peer-checked:bg-orange peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-orange/40">
        {label}
      </span>
    </label>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

/**
 * The bigger sibling of ChoiceChip, for choices that need a sentence of
 * explanation next to them — media consent especially, where the difference
 * between the options is the whole decision.
 */
export function ChoiceCard({
  name,
  value,
  headline,
  detail,
  type = "radio",
  defaultChecked,
}: {
  name: string;
  value: string;
  headline: string;
  detail?: string;
  type?: "radio" | "checkbox";
  defaultChecked?: boolean;
}) {
  return (
    <label className="cursor-pointer">
      <input
        type={type}
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />
      <span className="flex flex-col rounded-xl border border-gray-mid bg-white p-4 transition-colors peer-checked:border-orange peer-checked:bg-orange/5 peer-focus-visible:ring-2 peer-focus-visible:ring-orange/40">
        <span className="font-heading text-[15px] font-bold text-near-black">{headline}</span>
        {detail && (
          <span className="mt-1 font-body text-[13.5px] leading-snug text-gray-dark">{detail}</span>
        )}
      </span>
    </label>
  );
}

export function CardStack({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-2.5">{children}</div>;
}

export function SubmitButton({
  children = "Continue",
  pendingLabel = "Saving…",
}: {
  children?: React.ReactNode;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-[52px] w-full rounded-lg bg-orange px-5 font-sport text-[15px] font-bold uppercase tracking-wide text-white transition-colors hover:bg-orange-hover disabled:opacity-60"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

export function SecondaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="min-h-[48px] w-full rounded-lg border border-gray-mid bg-white px-5 font-sport text-[14px] font-bold uppercase tracking-wide text-gray-dark transition-colors hover:border-gray-dark hover:text-near-black"
    >
      {children}
    </button>
  );
}

/** Yes/No pair. Neither is preselected where the answer matters legally. */
export function YesNo({
  name,
  defaultValue,
  yesLabel = "Yes",
  noLabel = "No",
  onChangeValue,
}: {
  name: string;
  defaultValue?: "yes" | "no" | null;
  yesLabel?: string;
  noLabel?: string;
  onChangeValue?: (value: "yes" | "no") => void;
}) {
  return (
    <div className="flex gap-2.5">
      {(["no", "yes"] as const).map((v) => (
        <label key={v} className="flex-1 cursor-pointer">
          <input
            type="radio"
            name={name}
            value={v}
            defaultChecked={defaultValue === v}
            onChange={() => onChangeValue?.(v)}
            className="peer sr-only"
          />
          <span className="flex min-h-[50px] items-center justify-center rounded-lg border border-gray-mid bg-white font-heading text-[15px] font-bold text-near-black transition-colors peer-checked:border-orange peer-checked:bg-orange peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-orange/40">
            {v === "yes" ? yesLabel : noLabel}
          </span>
        </label>
      ))}
    </div>
  );
}
