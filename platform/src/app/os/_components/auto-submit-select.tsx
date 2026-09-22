"use client";

import type { ReactNode } from "react";

// A <select> that submits its own <form> the moment its value changes — the
// one bit of real interactivity on an otherwise server-rendered page. Kept
// as its own tiny client component because a plain onChange handler can't
// sit directly on an element inside a Server Component.
export function AutoSubmitSelect({
  name,
  defaultValue,
  className,
  children,
}: {
  name: string;
  defaultValue: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className={className}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
    >
      {children}
    </select>
  );
}
