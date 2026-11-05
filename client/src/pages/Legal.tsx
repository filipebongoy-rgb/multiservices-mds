import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { ApiError, Loading } from "@/components/mds/Layout";
export function Privacy() {
  return (
    <main id="main-content" className="page-shell standard-page legal-copy">
      <div className="eyebrow">VOS INFORMATIONS</div>
      <h1 className="page-title">Confidentialité</h1>
      <p className="lead">
        Les informations demandées servent à analyser votre besoin, vous
        contacter et organiser une intervention après accord des deux parties.
      </p>
      <h2>Les informations conservées</h2>
      <p>
        Le dossier contient votre nom, vos coordonnées, l’adresse
        d’intervention, votre description, les éventuelles photos, les
        propositions, les confirmations et leur historique. Les comptes
        professionnels contiennent les organisations, leurs sites et les
        collaborateurs autorisés.
      </p>
      <h2>L’accès à vos dossiers</h2>
      <p>
        L’artisan administrateur MDS peut consulter les demandes qui lui sont
        adressées. Une organisation et ses collaborateurs autorisés accèdent
        uniquement aux dossiers de cette organisation. Un particulier peut
        accéder à sa demande au moyen de son lien privé de suivi ou de son
        compte autorisé.
      </p>
      <p>
        Le lien privé est une clé d’accès. Conservez-le et ne le partagez pas
        publiquement. Les pièces jointes sont chiffrées avant stockage et
        restituées après contrôle des droits. Les données textuelles du dossier
        sont conservées dans une base gérée, avec accès contrôlé côté serveur.
      </p>
      <h2>La dictée et les brouillons</h2>
      <p>
        La dictée, lorsqu’elle est compatible avec votre navigateur, utilise son
        service de reconnaissance vocale, qui peut être fourni par l’éditeur du
        navigateur. MDS ne conserve pas l’audio. Vous pouvez toujours utiliser
        la saisie écrite.
      </p>
      <p>
        Votre brouillon est conservé dans la session de votre navigateur afin de
        ne pas perdre les informations saisies. Il est supprimé après l’envoi
        réussi. Une photo sélectionnée n’est pas conservée dans le brouillon
        après le rechargement de la page.
      </p>
      <h2>Les évaluations et notifications</h2>
      <p>
        Une évaluation exige une identité authentifiée et une intervention
        réellement terminée. Les évaluations restent privées et ne sont pas
        publiées automatiquement. Les notifications sont enregistrées dans
        l’application. Si MDS configure et active les canaux externes, le nom de
        canal, les coordonnées nécessaires et un message court incluant le lien
        privé de suivi sont transmis au fournisseur choisi pour l’envoi. Les
        adaptateurs préparés sont Resend et Twilio ; un canal non configuré
        reste désactivé. Le registre distingue message accepté par le
        fournisseur, livré, échoué ou à vérifier.
      </p>
      <h2>Les paiements</h2>
      <p>
        Lorsque vous ouvrez le paiement Stripe, les références de votre dossier
        et de facture, le montant ainsi que votre nom et votre adresse e-mail
        sont transmis au prestataire pour préparer le paiement et le rapprocher
        de votre facture. Les informations de carte sont saisies chez Stripe ;
        MDS ne conserve ni numéro de carte, ni code de sécurité.
      </p>
      <p>
        Le registre MDS conserve les références, dates, modes et statuts de
        paiement, acompte, solde et remboursement, ainsi que le montant
        contractuel réservé et le montant reçu effectivement confirmé. Une
        divergence avec le montant reçu nécessite un rapprochement avec les
        données Stripe. Les essais de paiement sont signalés et ne règlent pas
        une facture réelle.
      </p>
      <h2>Cookies et services du site</h2>
      <p>
        La connexion utilise une session technique nécessaire à l’accès aux
        espaces privés. Les polices de l’interface peuvent être chargées depuis
        Google Fonts. La Preview et l’hébergement peuvent utiliser des services
        techniques et des mesures d’audience gérés par Manus ; leurs réglages
        doivent être revus avant mise en service publique.
      </p>
      <h2>Vos droits et la mise en service</h2>
      <p>
        MDS devra renseigner ses coordonnées de contact, la durée de
        conservation, le responsable du traitement et les informations
        réglementaires avant une ouverture commerciale. Ces informations ne sont
        pas inventées dans cette version. Les demandes d’accès, de rectification
        ou de suppression doivent être adressées à MDS une fois ses coordonnées
        configurées. La suppression physique des pièces stockées et une
        politique automatique de conservation restent à mettre en place.
      </p>
      <div className="notice">
        Ces informations décrivent la version développée. Elles ne remplacent
        pas une politique juridique finalisée adaptée à l’entreprise.
      </div>
      <Link className="text-link" href="/">
        Retour à l’accueil
      </Link>
    </main>
  );
}
export function LegalNotice() {
  const q = trpc.mds.settings.public.useQuery();
  const s = q.data;
  return (
    <main id="main-content" className="page-shell standard-page legal-copy">
      <div className="eyebrow">INFORMATIONS DE L’ENTREPRISE</div>
      <h1 className="page-title">Mentions légales</h1>
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ApiError message={q.error.message} retry={() => q.refetch()} />
      ) : (
        <>
          <h2>Éditeur du service</h2>
          <p>
            {s?.legalName ||
              "MULTISERVICES MDS — identité légale à renseigner par l’administrateur."}
          </p>
          <p>
            {s?.businessAddress || "Adresse professionnelle non renseignée."}
          </p>
          <p>
            {s?.contactEmail || "Adresse e-mail de contact non renseignée."}
            <br />
            {s?.contactPhone || "Téléphone professionnel non renseigné."}
          </p>
          <h2>Informations réglementaires</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>
            {s?.legalNotice ||
              "Les informations d’immatriculation, le responsable de publication, la médiation de la consommation, les assurances et les conditions applicables restent à renseigner par MDS avant une ouverture commerciale."}
          </p>
          <h2>Zone et prestations</h2>
          <p>
            {s?.zone || "La zone d’intervention reste à définir par MDS."} Les
            familles de métiers servent à organiser les demandes. Seules les
            prestations explicitement activées par MDS sont proposées dans le
            catalogue public.
          </p>
          <h2>Demandes et confirmation</h2>
          <p>
            Une demande ne constitue jamais une réservation définitive. MDS doit
            accepter ou proposer des conditions ; le client doit ensuite les
            valider. Pour les travaux nécessitant un devis, son acceptation est
            une étape distincte.
          </p>
          <div className="notice">
            Cette application est une fondation technique. Les informations
            légales manquantes doivent être complétées avant mise en service
            commerciale.
          </div>
        </>
      )}
      <Link className="text-link" href="/confidentialite">
        Consulter les informations de confidentialité
      </Link>
    </main>
  );
}
