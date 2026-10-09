"use client";

import { type ReactNode, useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/lib/actions/shared";

export function SubmitButton({
  children,
  pendingText,
  className = "btn btn-primary",
}: {
  children: ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? (pendingText ?? "Guardando…") : children}
    </button>
  );
}

export function Feedback({ state }: { state: FormState }) {
  if (!state?.error && !state?.ok) return null;
  return (
    <p
      role={state.error ? "alert" : "status"}
      className={`text-sm ${state.error ? "text-red-300" : "text-emerald-300"}`}
    >
      {state.error ?? state.ok}
    </p>
  );
}

/**
 * Formulario conectado a una server action con estado. Permite usar acciones desde
 * componentes de servidor sin escribir un componente cliente para cada formulario.
 */
export function ActionForm({
  action,
  children,
  className,
  confirmMessage,
  showFeedback = true,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  children: ReactNode;
  className?: string;
  confirmMessage?: string;
  showFeedback?: boolean;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirmMessage && !window.confirm(confirmMessage)) e.preventDefault();
      }}
    >
      {children}
      {showFeedback ? <Feedback state={state} /> : state?.error && <Feedback state={state} />}
    </form>
  );
}
