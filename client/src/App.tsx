import { useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Header, Footer, Loading } from "./components/mds/Layout";
import Home from "./pages/Home";
const Catalog = lazy(() => import("./pages/Catalog"));
const Request = lazy(() => import("./pages/Request"));
const Tracking = lazy(() => import("./pages/Tracking"));
const Artisan = lazy(() => import("./pages/Artisan"));
const Professional = lazy(() => import("./pages/Professional"));
import { Privacy, LegalNotice } from "./pages/Legal";
import NotFound from "./pages/NotFound";
const titles: Record<string, string> = {
  "/": "Vos travaux, simplement",
  "/prestations": "Trouver une prestation",
  "/demande": "Déposer une demande",
  "/suivi": "Suivre ma demande",
  "/professionnels": "Espace professionnel",
  "/artisan": "Espace artisan",
  "/confidentialite": "Confidentialité",
  "/mentions-legales": "Mentions légales",
};
function Routes() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title =
      (titles[location] || "Page introuvable") + " — MULTISERVICES MDS";
    let robots = document.querySelector(
      'meta[name="robots"]'
    ) as HTMLMetaElement | null;
    if (!robots) {
      robots = document.createElement("meta");
      robots.name = "robots";
      document.head.appendChild(robots);
    }
    robots.content = [
      "/artisan",
      "/suivi",
      "/demande",
      "/professionnels",
    ].includes(location)
      ? "noindex, nofollow"
      : "index, follow";
  }, [location]);
  return (
    <>
      <Header />
      <Suspense
        fallback={
          <main id="main-content" className="page-shell">
            <Loading />
          </main>
        }
      >
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/prestations" component={Catalog} />
          <Route path="/demande" component={Request} />
          <Route path="/suivi" component={Tracking} />
          <Route path="/professionnels" component={Professional} />
          <Route path="/artisan" component={Artisan} />
          <Route path="/confidentialite" component={Privacy} />
          <Route path="/mentions-legales" component={LegalNotice} />
          <Route path="/404" component={NotFound} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
      <Footer />
    </>
  );
}
export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Routes />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
