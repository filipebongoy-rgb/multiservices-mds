import { useEffect, lazy, Suspense } from "react";
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
const Portfolio = lazy(() => import("./pages/Portfolio"));
const Network = lazy(() => import("./pages/Network"));
const LocalService = lazy(() => import("./pages/LocalService").then(m => ({ default: m.LocalServicePage })));
const Profile = lazy(() => import("./pages/Profile"));
const Auth = lazy(() => import("./pages/Auth"));
import { Privacy, LegalNotice } from "./pages/Legal";
import NotFound from "./pages/NotFound";
const titles: Record<string, string> = {
  "/": "Vos travaux, simplement",
  "/prestations": "Trouver une prestation",
  "/demande": "Déposer une demande",
  "/suivi": "Suivre ma demande",
  "/paiements": "Mes paiements",
  "/professionnels": "Espace professionnel",
  "/portfolio": "Réalisations MDS",
  "/reseau": "Réseau MDS",
  "/plombier-rennes": "Plombier à Rennes",
  "/electricien-rennes": "Électricien à Rennes",
  "/chauffagiste-rennes": "Chauffagiste à Rennes",
  "/peintre-rennes": "Peintre à Rennes",
  "/petits-travaux-rennes": "Petits travaux à Rennes",
  "/artisan": "Espace artisan",
  "/artisan/assistant": "Assistant artisan",
  "/artisan/demandes": "Demandes artisan",
  "/artisan/planning": "Planning artisan",
  "/artisan/interventions": "Interventions artisan",
  "/artisan/settlements": "Règlements artisan",
  "/artisan/activity": "Activité artisan",
  "/artisan/team": "Équipe artisan",
  "/profil": "Mon profil",
  "/connexion": "Connexion",
  "/confidentialite": "Confidentialité",
  "/mentions-legales": "Mentions légales",
};
function Routes() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    const resolvedTitle =
      titles[location] ||
      (location.match(/^\/artisan\/(requests|demandes)\/\d+/)
        ? "Dossier artisan"
        : location.match(/^\/artisan\/interventions\/\d+/)
          ? "Fiche intervention"
          : "Page introuvable");
    document.title =
      resolvedTitle + " — MULTISERVICES MDS";
    let robots = document.querySelector(
      'meta[name="robots"]'
    ) as HTMLMetaElement | null;
    if (!robots) {
      robots = document.createElement("meta");
      robots.name = "robots";
      document.head.appendChild(robots);
    }
      robots.content =
        location.startsWith("/artisan") ||
        [
          "/suivi",
          "/paiements",
          "/demande",
          "/professionnels",
          "/profil",
          "/connexion",
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
          <Route path="/paiements" component={Payments} />
          <Route path="/suivi" component={Tracking} />
          <Route path="/professionnels" component={Professional} />
          <Route path="/portfolio" component={Portfolio} />
          <Route path="/reseau" component={Network} />
          <Route path="/plombier-rennes" component={() => <LocalService slug="plombier-rennes" />} />
          <Route path="/electricien-rennes" component={() => <LocalService slug="electricien-rennes" />} />
          <Route path="/chauffagiste-rennes" component={() => <LocalService slug="chauffagiste-rennes" />} />
          <Route path="/peintre-rennes" component={() => <LocalService slug="peintre-rennes" />} />
          <Route path="/petits-travaux-rennes" component={() => <LocalService slug="petits-travaux-rennes" />} />
          <Route path="/artisan/:section/:id" component={Artisan} />
          <Route path="/artisan/:section" component={Artisan} />
          <Route path="/artisan" component={Artisan} />
          <Route path="/profil" component={Profile} />
          <Route path="/connexion" component={Auth} />
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
