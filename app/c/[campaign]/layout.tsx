import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CampaignNav, type NavNode } from "@/components/campaign/CampaignNav";
import { ChatPanel } from "@/components/campaign/ChatPanel";
import { SiteHeader } from "@/components/SiteHeader";
import { buildTree, getCampaignContext, getMembers, getVisiblePages, type TreeNode } from "@/lib/campaigns";
import { unreadSummary } from "@/lib/chat";
import type { ChatContact } from "@/lib/chat-types";
import { canChat, isGameMaster, ROLE_LABELS } from "@/lib/permissions";
import { themeProps } from "@/lib/themes";

type Params = { params: Promise<{ campaign: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const ctx = await getCampaignContext((await params).campaign);
  return ctx ? { title: { default: ctx.campaign.name, template: `%s · ${ctx.campaign.name}` }, description: ctx.campaign.tagline } : {};
}

// Solo lo que la navegación necesita (no se envía al navegador quién tiene acceso a qué).
function toNav(nodes: TreeNode[]): NavNode[] {
  return nodes.map(({ id, slug, title, icon, visibility, spoilers, children }) => ({
    id,
    slug,
    title,
    icon,
    visibility,
    spoilers,
    children: toNav(children),
  }));
}

export default async function CampaignLayout({ children, params }: Params & { children: React.ReactNode }) {
  const ctx = await getCampaignContext((await params).campaign);
  if (!ctx) notFound();
  const { campaign, viewer, user } = ctx;

  const gm = isGameMaster(viewer);
  const chat = user && canChat(viewer);
  const [pages, members, unread] = await Promise.all([
    getVisiblePages(ctx),
    gm || chat ? getMembers(campaign.id) : Promise.resolve([]),
    chat ? unreadSummary(campaign.id, user.id) : Promise.resolve(null),
  ]);
  // Contactos para los privados: el resto de miembros activos, el equipo de máster primero.
  const contacts: ChatContact[] = members
    .filter((m) => m.status === "active" && m.userId !== user?.id)
    .map((m) => ({ id: m.userId, username: m.username, displayName: m.displayName, avatarUrl: m.avatarUrl, role: m.role }));
  const roleLabel =
    viewer.status === "pending" ? "Solicitud pendiente" : viewer.role ? ROLE_LABELS[viewer.role] : null;

  const nav = (
    <CampaignNav
      campaignSlug={campaign.slug}
      campaignName={campaign.name}
      roleLabel={roleLabel}
      tree={toNav(buildTree(pages))}
      isGameMaster={gm}
      pendingRequests={members.filter((m) => m.status === "pending").length}
    />
  );

  return (
    <div {...themeProps(campaign.theme, campaign.customTheme)} className="themed-bg min-h-dvh">
      <SiteHeader />
      <div className="mx-auto flex max-w-7xl gap-8 px-4 py-6">
        <aside className="hidden w-72 shrink-0 lg:block">
          <div className="panel sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto p-3">{nav}</div>
        </aside>
        <div className="min-w-0 flex-1">
          <details className="panel mb-4 p-3 lg:hidden">
            <summary className="cursor-pointer text-sm font-semibold text-ink-2">☰ Pestañas de {campaign.name}</summary>
            <div className="mt-3">{nav}</div>
          </details>
          {children}
        </div>
      </div>
      {chat && unread && (
        <ChatPanel
          campaignId={campaign.id}
          campaignName={campaign.name}
          currentUserId={user.id}
          contacts={contacts}
          initialUnread={unread}
        />
      )}
    </div>
  );
}
