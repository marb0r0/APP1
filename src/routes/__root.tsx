import { createRootRoute, HeadContent, Link, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import appCss from "../styles.css?url";

const APP_NAME = "Pitchline - Football Intelligence";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      {
        name: "description",
        content: "Live scores, match projections, xG models, value picks, and stats across European (Champions, Europa, Conference) and South American (Brasileirão, Argentino, Libertadores, Sul-Americana) football leagues.",
      },
      { property: "og:title", content: APP_NAME },
      {
        property: "og:description",
        content: "Live scores, match projections, xG models, value picks, and stats across European (Champions, Europa, Conference) and South American (Brasileirão, Argentino, Libertadores, Sul-Americana) football leagues.",
      },
      { name: "theme-color", content: "#0c1210" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Barlow:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap",
      },
    ],
  }),
  component: () => (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>
          <Outlet />
          <Link
            to="/agents"
            className="fixed bottom-4 right-4 z-50 rounded-full border border-primary/40 bg-surface px-4 py-3 text-xs font-bold text-primary shadow-lg transition-colors hover:bg-primary hover:text-primary-ink"
          >
            Agentes &amp; Mercados
          </Link>
          <Link
            to="/todos"
            className="fixed bottom-4 left-4 z-50 rounded-full border border-line bg-surface px-4 py-3 text-xs font-bold text-fg shadow-lg transition-colors hover:border-primary hover:text-primary"
          >
            Lista de tarefas
          </Link>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
