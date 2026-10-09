import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { fetchChannel, isActiveMember, parseChannel, unreadSummary } from "@/lib/chat";

/**
 * Polling del chat de una campaña: `?channel=group|<idUsuario>|none&after=<último id>`.
 * Devuelve los mensajes nuevos del canal pedido y el resumen de no leídos.
 * Un privado solo lo puede pedir uno de sus dos participantes (la consulta filtra por ambos).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!/^[0-9a-f-]{36}$/i.test(id) || !(await isActiveMember(id, user.id))) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  const url = new URL(request.url);
  const channel = parseChannel(url.searchParams.get("channel"));
  if (channel === null) return NextResponse.json({ error: "Canal no válido" }, { status: 400 });
  if (typeof channel === "object" && (channel.with === user.id || !(await isActiveMember(id, channel.with)))) {
    return NextResponse.json({ error: "Ese usuario no está en la campaña" }, { status: 404 });
  }
  const after = Number(url.searchParams.get("after") ?? 0);

  const [messages, unread] = await Promise.all([
    channel === "none" ? [] : fetchChannel(id, user.id, channel, Number.isSafeInteger(after) && after > 0 ? after : 0),
    unreadSummary(id, user.id),
  ]);
  return NextResponse.json({ messages, unread }, { headers: { "Cache-Control": "no-store" } });
}
