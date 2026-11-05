import { useEffect, lazy, Suspense } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import {
  Header,
  Footer,
  Loading,
  MobileBottomNav,
} from "./components/mds/Layout";
import Home from "./pages/Home";
const Catalog = lazy(() => import("./pages/Catalog"));
const Request = lazy(() => import("./pages/Request"));
const Payments = lazy(() => import("./pages/Payments"));
const Tracking = lazy(() => import("./pages/Tracking"));
const Artisan = lazy(() => import("./pages/Artisan"));
const Professional = lazy(() => import("./pages/Professional"));
const Profile = lazy(() => import("./pages/Profile"));
import { Privacy, LegalNotice } from "./pages/Legal";
import NotFound from "./pages/NotFound";
const titles: Record<string, string> = {
  "/": "Vos travaux, simplement",
  "/prestations": "Trouver une prestation",
  "/demande": "Déposer une demande",
  "/suivi": "Suivre ma demande",
  "/paiements": "Mes paiements",
  "/professionnels": "Espace professionnel",
  "/artisan": "Espace artisan",
  "/profil": "Mon profil",
  "/confidentialite": "Confidentialité",
  "/mentions-legales": "Mentions légales",
};
function Routes() {
  const [location, setLocation] = useLocation();
  const { user, loading } = useAuth();
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
      "/paiements",
      "/demande",
      "/professionnels",
      "/profil",
    ].includes(location)
      ? "noindex, nofollow"
      : "index, follow";
  }, [location]);
  useEffect(() => {
    if (loading) return;
    if (user?.role === "admin") {
      const allowed = [
        "/artisan",
        "/profil",
        "/confidentialite",
        "/mentions-legales",
        "/404",
      ];
      if (!allowed.includes(location)) {
        setLocation("/artisan", { replace: true });
      }
    }
  }, [location, user, loading, setLocation]);
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
          <Route path="/paiements" component={Payments} />
          <Route path="/suivi" component={Tracking} />
          <Route path="/professionnels" component={Professional} />
          <Route path="/artisan" component={Artisan} />
          <Route path="/profil" component={Profile} />
          <Route path="/confidentialite" component={Privacy} />
          <Route path="/mentions-legales" component={LegalNotice} />
          <Route path="/404" component={NotFound} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
      <MobileBottomNav />
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
