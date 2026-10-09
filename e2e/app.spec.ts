import { type Browser, expect, type Page, test } from "@playwright/test";

// Recorre la aplicación como lo harían un máster y sus jugadores. Los pasos dependen unos
// de otros (crear campaña → unirse → chatear…), así que se ejecutan en serie.
test.describe.configure({ mode: "serial" });

const PASSWORD = "longrest";
const suffix = Date.now().toString(36).slice(-5);
const gmUser = `master${suffix}`;
const campaignName = `Prueba ${suffix}`;
const campaignSlug = `prueba-${suffix}`;

async function newUser(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("dialog", (d) => d.accept());
  return page;
}

async function login(page: Page, user: string, password = PASSWORD) {
  await page.goto("/login");
  await page.fill("#identifier", user);
  await page.fill("#password", password);
  await Promise.all([page.waitForURL("/"), page.getByRole("button", { name: "Entrar" }).click()]);
}

/**
 * Página denegada o inexistente. Las rutas con loading.tsx envían la respuesta en streaming
 * antes de comprobar el acceso: el código es 200, pero el cuerpo es la página 404 con
 * noindex y sin rastro del contenido (comportamiento documentado de Next.js).
 */
async function expectNotFound(res: { status(): number; text(): Promise<string> } | null) {
  expect(res).not.toBeNull();
  if (res!.status() === 404) return;
  const html = await res!.text();
  expect(html).toContain('name="robots" content="noindex"');
  expect(html).toContain("Pifia crítica");
}

let gm: Page;
let bruno: Page;

test("cabeceras de seguridad y CSP con nonce", async ({ request }) => {
  const res = await request.get("/");
  const headers = res.headers();
  expect(headers["content-security-policy"]).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-powered-by"]).toBeUndefined();
});

test("un visitante anónimo solo ve lo público", async ({ request }) => {
  expect((await request.get("/c/la-cripta-del-rey-olvidado")).status()).toBe(200);
  expect((await request.get("/c/nacidos-de-la-bruma")).status()).toBe(404); // campaña privada
  const dmOnly = await request.get("/c/la-cripta-del-rey-olvidado/p/secretos-del-valle"); // solo máster
  await expectNotFound(dmOnly);
  expect(await dmOnly.text()).not.toContain("Encuentros aleatorios");
  await expectNotFound(await request.get("/c/la-cripta-del-rey-olvidado/p/trasfondo-de-lyra")); // de otro jugador
  // Página pública: se ve, pero sin el bloque de máster
  const world = await (await request.get("/c/la-cripta-del-rey-olvidado/p/mundo")).text();
  expect(world).toContain("El valle de Brumahonda");
  expect(world).not.toContain("El rey no está muerto");
  const chat = await request.get("/api/campaigns/00000000-0000-0000-0000-000000000000/chat?channel=group");
  expect(chat.status()).toBe(401);
});

test("registro con validación", async ({ browser }) => {
  gm = await newUser(browser);
  await gm.goto("/registro");
  await gm.fill("#displayName", "Máster de Pruebas");
  await gm.fill("#username", gmUser);
  await gm.fill("#email", `${gmUser}@example.com`);
  await gm.fill("#password", "aaaaaaaaaa");
  await gm.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(gm.getByText("La contraseña es demasiado repetitiva")).toBeVisible();

  await gm.fill("#password", PASSWORD);
  await Promise.all([gm.waitForURL("/"), gm.getByRole("button", { name: "Crear cuenta" }).click()]);
  await expect(gm.getByRole("link", { name: "Máster de Pruebas" })).toHaveAttribute("href", "/perfil");
});

test("crear campaña con tema personalizado (rueda de color)", async () => {
  await gm.goto("/campanas/nueva");
  await gm.fill("#name", campaignName);
  await gm.fill("#gameSystem", "D&D 5e");
  await gm.getByRole("button", { name: /Personalizado/ }).click();
  const wheel = gm.getByRole("slider", { name: /Rueda de color/ });
  const box = (await wheel.boundingBox())!;
  await gm.mouse.click(box.x + box.width * 0.85, box.y + box.height * 0.5); // tono ~90°: verde lima
  await expect(gm.getByLabel("Color en hexadecimal")).not.toHaveValue("#e0a64b");
  await Promise.all([gm.waitForURL(`/c/${campaignSlug}`), gm.getByRole("button", { name: "Crear campaña" }).click()]);
  await expect(gm.locator("[data-theme=custom]").first()).toHaveAttribute("style", /--accent:\s*#[0-9a-f]{6}/);
});

test("editar una página con contenido secreto", async () => {
  await gm.goto(`/c/${campaignSlug}/p/historia/editar`);
  await gm.locator("textarea").first().fill("Los héroes llegan al [[Mundo]].\n\n:::dm\nSECRETO-DEL-MASTER\n:::\n\nFin.");
  await expect(gm.getByText("Cambios sin guardar")).toBeVisible();
  await gm.getByRole("button", { name: "Guardar" }).click();
  await expect(gm.getByText("Todo guardado")).toBeVisible();
  await gm.goto(`/c/${campaignSlug}/p/historia`);
  await expect(gm.getByText("SECRETO-DEL-MASTER")).toBeVisible();
});

test("solicitar entrada y aprobarla", async ({ browser }) => {
  bruno = await newUser(browser);
  await login(bruno, "bruno");
  await expectNotFound(await bruno.goto(`/c/${campaignSlug}/p/historia`));
  await bruno.goto(`/c/${campaignSlug}`);
  await bruno.getByRole("button", { name: "Solicitar unirme" }).click();
  await expect(bruno.getByText("Solicitud pendiente").first()).toBeVisible();

  await gm.goto(`/c/${campaignSlug}/ajustes`);
  await gm.getByRole("button", { name: "Aceptar" }).click();
  await expect(gm.getByText("No hay solicitudes pendientes")).toBeVisible();
});

test("el jugador no recibe el contenido de máster", async () => {
  const res = await bruno.goto(`/c/${campaignSlug}/p/historia`);
  expect(res!.status()).toBe(200);
  const html = await bruno.content();
  expect(html).toContain("Fin.");
  expect(html).not.toContain("SECRETO-DEL-MASTER");
  await expectNotFound(await bruno.goto(`/c/${campaignSlug}/p/historia/editar`));
  await expectNotFound(await bruno.goto(`/c/${campaignSlug}/p/notas-del-master`));
});

test("chat de grupo y chat privado", async ({ browser }) => {
  // Grupo
  await gm.goto(`/c/${campaignSlug}`);
  await gm.getByRole("button", { name: /Chat/ }).click();
  await gm.getByRole("textbox", { name: "Mensaje para toda la mesa" }).fill("Sesión el viernes");
  await gm.keyboard.press("Enter");
  await expect(gm.getByText("Sesión el viernes")).toBeVisible();

  // Privado del jugador al máster
  await bruno.goto(`/c/${campaignSlug}`);
  await bruno.getByRole("button", { name: /Chat/ }).click();
  await expect(bruno.getByText("Sesión el viernes")).toBeVisible();
  await bruno.getByRole("navigation", { name: "Conversaciones" }).getByRole("button", { name: /Máster de Pruebas/ }).click();
  await bruno.getByRole("textbox", { name: /Mensaje privado/ }).fill("Mi personaje es un espía");
  await bruno.keyboard.press("Enter");
  await expect(bruno.getByText("Mi personaje es un espía")).toBeVisible();

  // El máster ve el aviso de no leído en la conversación privada y la abre
  const contact = gm.getByRole("navigation", { name: "Conversaciones" }).getByRole("button", { name: /Bruno/ });
  await expect(contact.getByLabel(/sin leer/)).toBeVisible({ timeout: 10_000 });
  await contact.click();
  await expect(gm.getByText("Mi personaje es un espía")).toBeVisible();

  // Alguien de fuera no puede leer el chat ni pidiéndolo directamente a la API
  const outsider = await newUser(browser);
  await login(outsider, "lyra");
  const campaignId = await campaignIdOf(gm);
  expect((await outsider.request.get(`/api/campaigns/${campaignId}/chat?channel=group`)).status()).toBe(403);
});

/** Id de la campaña actual leyendo el formulario oculto de ajustes (solo para tests). */
async function campaignIdOf(page: Page): Promise<string> {
  await page.goto(`/c/${campaignSlug}/ajustes`);
  return page.locator('input[name="campaignId"]').first().inputValue();
}

test("salir de la campaña quita el acceso", async () => {
  await bruno.goto(`/c/${campaignSlug}`);
  await bruno.getByRole("button", { name: "Salir de la campaña" }).click();
  await expect(bruno.getByText("Has salido de la campaña")).toBeVisible();
  await expectNotFound(await bruno.goto(`/c/${campaignSlug}/p/historia`));
});

test("perfil: editar, ver público y cambiar contraseña", async () => {
  await gm.goto("/perfil");
  await gm.fill("#bio", "Me gustan las campañas de intriga.");
  await gm.fill("#game-input", "Pathfinder");
  await gm.keyboard.press("Enter");
  await gm.getByRole("button", { name: "Guardar perfil" }).click();
  await expect(gm.getByText("Perfil actualizado")).toBeVisible();

  await gm.goto(`/u/${gmUser}`);
  await expect(gm.getByText("Me gustan las campañas de intriga.")).toBeVisible();
  await expect(gm.getByText("🎲 Pathfinder")).toBeVisible();
  await expect(gm.getByRole("link", { name: campaignName })).toBeVisible();

  await gm.goto("/perfil");
  await gm.fill("#currentPassword", PASSWORD);
  await gm.fill("#newPassword", "nueva-clave-42");
  await gm.fill("#confirmPassword", "nueva-clave-42");
  await gm.getByRole("button", { name: "Cambiar contraseña" }).click();
  await expect(gm.getByText(/Contraseña cambiada/)).toBeVisible();
});

test("borrar la cuenta exige ceder antes las campañas", async ({ browser }) => {
  await gm.goto("/perfil");
  await gm.fill("#confirm", gmUser);
  await gm.fill("#password", "nueva-clave-42");
  await gm.getByRole("button", { name: "Borrar mi cuenta" }).click();
  await expect(gm.getByText(/cede o borra tus campañas/)).toBeVisible();

  // Un usuario sin campañas propias sí puede borrarse
  const temp = await newUser(browser);
  const username = `temporal${suffix}`;
  await temp.goto("/registro");
  await temp.fill("#displayName", "Temporal");
  await temp.fill("#username", username);
  await temp.fill("#email", `${username}@example.com`);
  await temp.fill("#password", PASSWORD);
  await Promise.all([temp.waitForURL("/"), temp.getByRole("button", { name: "Crear cuenta" }).click()]);
  await temp.goto("/perfil");
  await temp.fill("#confirm", username);
  await temp.fill("#password", PASSWORD);
  await Promise.all([temp.waitForURL(/cuenta=borrada/), temp.getByRole("button", { name: "Borrar mi cuenta" }).click()]);
  expect((await temp.goto(`/u/${username}`))!.status()).toBe(404);
});

test("límite de intentos de login", async ({ browser }) => {
  const attacker = await newUser(browser);
  for (let i = 0; i < 9; i++) {
    await attacker.goto("/login");
    await attacker.fill("#identifier", "tomas");
    await attacker.fill("#password", `incorrecta-${i}`);
    await attacker.getByRole("button", { name: "Entrar" }).click();
    await expect(attacker.locator("form [role=alert]")).toBeVisible();
  }
  await expect(attacker.locator("form [role=alert]")).toHaveText(/Demasiados intentos/);
});

test("árbol de navegación: ruta abierta y búsqueda", async ({ browser }) => {
  const lyra = await newUser(browser);
  await login(lyra, "lyra");
  await lyra.goto("/c/la-cripta-del-rey-olvidado/p/aldea-de-roble");
  const nav = lyra.locator("aside nav");
  await expect(nav.getByRole("button", { name: "Contraer Lugares" })).toBeVisible();
  await expect(nav.getByRole("link", { name: /^Aldea de Roble/ })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: /Secretos del valle/ })).toHaveCount(0); // solo máster
  await nav.getByRole("searchbox").fill("posad");
  await expect(nav.getByRole("link", { name: /Brann el posadero/ })).toBeVisible();
});
