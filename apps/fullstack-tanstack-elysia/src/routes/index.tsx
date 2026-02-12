import { createFileRoute, Link } from "@tanstack/react-router";
import { Button, Card, CardContent } from "@monorepo-template/web-ui";
import { CheckCircle2, ArrowRight, Layers, Shield, Smartphone } from "lucide-react";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const context = Route.useRouteContext();
  const { isAuthenticated } = context;

  return (
    <div className="min-h-screen bg-linear-to-b from-background to-muted/20">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
              Fullstack TanStack + Elysia
              <span className="block text-primary mt-2">Embedded API</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              A fullstack app with Elysia API embedded inside TanStack Start. Isomorphic Eden treaty
              — direct call on SSR, HTTP on client. Single deployable unit.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            {isAuthenticated ? (
              <Link to="/todos">
                <Button size="lg" className="text-lg">
                  Go to Dashboard <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/auth/signup">
                  <Button size="lg" className="text-lg">
                    Get Started <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link to="/auth/login">
                  <Button size="lg" variant="outline" className="text-lg">
                    Sign In
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Everything You Need to Build Fast
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card>
              <CardContent className="space-y-4 p-6">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Layers className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Embedded Elysia API</h3>
                <p className="text-muted-foreground">
                  Full Elysia API running inside TanStack Start. API routes at /api/v1/* with the
                  same patterns as a standalone server.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4 p-6">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Isomorphic Treaty</h3>
                <p className="text-muted-foreground">
                  Eden treaty that works everywhere. Direct Elysia call during SSR (no HTTP), HTTP
                  request on the client. Zero config.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4 p-6">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Smartphone className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Single Deployment</h3>
                <p className="text-muted-foreground">
                  One Cloudflare Worker serves both the frontend and API. No separate server to
                  manage or deploy.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4 p-6">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Todo CRUD Example</h3>
                <p className="text-muted-foreground">
                  A complete Todo feature using the embedded Elysia API with type-safe Eden treaty
                  calls.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4 p-6">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Layers className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Shared Packages</h3>
                <p className="text-muted-foreground">
                  Reuses domain, application, and infrastructure packages from the monorepo for
                  consistent architecture.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4 p-6">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Type Safety</h3>
                <p className="text-muted-foreground">
                  End-to-end type safety from Elysia routes to Eden treaty to React hooks. Shared
                  types across the stack.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="container mx-auto px-4 py-16">
        <Card className="max-w-3xl mx-auto">
          <CardContent className="text-center space-y-6 p-12">
            <h2 className="text-3xl font-bold">
              {isAuthenticated ? "Your Dashboard Awaits" : "Ready to Build?"}
            </h2>
            <p className="text-lg text-muted-foreground">
              {isAuthenticated
                ? "Head to the dashboard to manage your todos."
                : "Sign up and explore the Todo CRUD example to see the embedded Elysia API in action."}
            </p>
            <Link to={isAuthenticated ? "/todos" : "/auth/signup"}>
              <Button size="lg" className="text-lg">
                {isAuthenticated ? "Go to Dashboard" : "Create Free Account"}{" "}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 border-t">
        <div className="text-center text-sm text-muted-foreground">
          <p>Fullstack TanStack + Elysia — Embedded API with Isomorphic Treaty</p>
        </div>
      </footer>
    </div>
  );
}
