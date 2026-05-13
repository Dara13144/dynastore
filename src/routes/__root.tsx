import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import "@/integrations/supabase/attach-fetch-auth";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "google-site-verification", content: "8diCLufyhJnU_wOWfBHl8DvoEb3t8UxkPQ74uikgv74" },
      { title: "Dynastore Gaming" },
      { name: "description", content: "Dyna Store — ហាងហ្គេម PC និង Console នៅកម្ពុជា ជាមួយការទូទាត់តាម Bakong KHQR និងការទាញយកហ្គេមភ្លាមៗ។" },
      { name: "author", content: "Dyna Store" },
      { property: "og:site_name", content: "Dyna Store" },
      { property: "og:title", content: "Dyna Store — ទិញហ្គេមដោយ KHQR" },
      { property: "og:description", content: "Dyna Store — ហាងហ្គេម PC និង Console នៅកម្ពុជា ជាមួយការទូទាត់តាម Bakong KHQR និងការទាញយកហ្គេមភ្លាមៗ។" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Dyna Store — ទិញហ្គេមដោយ KHQR" },
      { name: "twitter:description", content: "Dyna Store — ហាងហ្គេម PC និង Console នៅកម្ពុជា ជាមួយការទូទាត់តាម Bakong KHQR និងការទាញយកហ្គេមភ្លាមៗ។" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/81765852-df1e-4307-8b6c-f764f338545e/id-preview-972c5967--c299877f-7af3-4cab-a4b4-973400b82e93.lovable.app-1778606757957.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/81765852-df1e-4307-8b6c-f764f338545e/id-preview-972c5967--c299877f-7af3-4cab-a4b4-973400b82e93.lovable.app-1778606757957.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Dyna Store",
          url: "https://dynastore.lovable.app",
          logo: "https://dynastore.lovable.app/favicon.ico",
          description: "Dyna Store — ហាងហ្គេម PC និង Console នៅកម្ពុជា ជាមួយការទូទាត់តាម Bakong KHQR និងការទាញយកហ្គេមភ្លាមៗ។",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Dyna Store",
          url: "https://dynastore.lovable.app",
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
