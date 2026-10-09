"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, register } from "@/lib/actions/auth";
import { Feedback, SubmitButton } from "./forms";

function withNext(path: string, next?: string) {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(login, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next ?? "/"} />
      <div>
        <label className="label" htmlFor="identifier">Usuario o email</label>
        <input id="identifier" name="identifier" defaultValue={state?.values?.identifier} className="input" autoComplete="username" required autoFocus />
      </div>
      <div>
        <label className="label" htmlFor="password">Contraseña</label>
        <input id="password" name="password" type="password" className="input" autoComplete="current-password" required />
      </div>
      <Feedback state={state} />
      <SubmitButton pendingText="Entrando…">Entrar</SubmitButton>
      <p className="text-center text-sm text-ink-3">
        ¿No tienes cuenta?{" "}
        <Link href={withNext("/registro", next)} className="text-accent-2 underline underline-offset-4">
          Regístrate
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const [state, action] = useActionState(register, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next ?? "/"} />
      <div>
        <label className="label" htmlFor="displayName">Nombre visible</label>
        <input id="displayName" name="displayName" defaultValue={state?.values?.displayName} className="input" maxLength={40} required autoFocus />
      </div>
      <div>
        <label className="label" htmlFor="username">Usuario</label>
        <input
          id="username"
          name="username"
          defaultValue={state?.values?.username}
          className="input"
          autoComplete="username"
          pattern="[A-Za-z0-9_\-]{3,24}"
          required
        />
        <p className="hint">3-24 caracteres: letras, números, _ o -</p>
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" defaultValue={state?.values?.email} className="input" autoComplete="email" required />
      </div>
      <div>
        <label className="label" htmlFor="password">Contraseña</label>
        <input
          id="password"
          name="password"
          type="password"
          className="input"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      <Feedback state={state} />
      <SubmitButton pendingText="Creando cuenta…">Crear cuenta</SubmitButton>
      <p className="text-center text-sm text-ink-3">
        ¿Ya tienes cuenta?{" "}
        <Link href={withNext("/login", next)} className="text-accent-2 underline underline-offset-4">
          Entra
        </Link>
      </p>
    </form>
  );
}
