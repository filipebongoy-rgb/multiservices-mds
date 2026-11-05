import { money } from "@shared/mds";
import type { PricingSnapshot } from "@shared/pricing";

export function PriceDetails({
  snapshot,
  compact = false,
  frozen = false,
}: {
  snapshot: PricingSnapshot;
  compact?: boolean;
  frozen?: boolean;
}) {
  return (
    <section
      className={
        compact ? "pricing-details compact" : "pricing-details notice stack"
      }
      aria-label="Conditions tarifaires"
    >
      <div
        className="row"
        style={{ justifyContent: "space-between", flexWrap: "wrap" }}
      >
        <strong>
          {snapshot.pricingMode === "quote" ||
          (snapshot.requiresQuote && snapshot.postcode)
            ? "Devis personnalisé"
            : "Prix affiché"}
        </strong>
        {snapshot.totalCents !== null && (
          <strong className="pricing-total">
            {money(snapshot.totalCents)}
          </strong>
        )}
      </div>
      {snapshot.totalCents !== null ? (
        <dl className="pricing-breakdown">
          <div>
            <dt>Prestation</dt>
            <dd>{money(snapshot.baseCents)}</dd>
          </div>
          <div>
            <dt>Déplacement</dt>
            <dd>
              {snapshot.travelMode === "included"
                ? "Inclus"
                : money(snapshot.travelCents)}
            </dd>
          </div>
          <div>
            <dt>Total annoncé</dt>
            <dd>{money(snapshot.totalCents)}</dd>
          </div>
        </dl>
      ) : (
        <div className="small-text">
          {snapshot.pricingMode === "fixed" && snapshot.baseCents !== null && (
            <p>
              Prestation : {money(snapshot.baseCents)}. Ce n’est pas un total
              ferme sans déplacement défini.
            </p>
          )}
          <p>{snapshot.reason}</p>
          {snapshot.pricingMode === "quote" && snapshot.pricingRule && (
            <p>{snapshot.pricingRule}</p>
          )}
        </div>
      )}
      {(snapshot.included || snapshot.excluded) && (
        <div className="pricing-scope">
          {snapshot.included && (
            <div>
              <strong>Ce qui est inclus</strong>
              <p>{snapshot.included}</p>
            </div>
          )}
          {snapshot.excluded && (
            <div>
              <strong>Ce qui n’est pas inclus</strong>
              <p>{snapshot.excluded}</p>
            </div>
          )}
        </div>
      )}
      {snapshot.pricingMode === "fixed" &&
        snapshot.travelMode === "postcode" &&
        !snapshot.postcode && (
          <details>
            <summary>Voir les frais de déplacement configurés</summary>
            <ul>
              {snapshot.travelRules?.map(rule => (
                <li key={rule.prefix}>
                  Codes postaux commençant par {rule.prefix} :{" "}
                  {money(rule.feeCents)}
                </li>
              ))}
            </ul>
            <p className="small-text">
              Le préfixe le plus précis s’applique. Sans correspondance, MDS
              établira un devis.
            </p>
          </details>
        )}
      <p className="small-text muted">
        {snapshot.serviceId
          ? `Durée indicative : ${snapshot.durationMinutes} min`
          : "Durée à définir après analyse"}
        {snapshot.zone ? ` · ${snapshot.zone}` : ""}.
      </p>
      {snapshot.conditions && (
        <p className="small-text">{snapshot.conditions}</p>
      )}
      {frozen && (
        <p className="small-text muted">
          Conditions conservées au dépôt. Un changement du catalogue ne modifie
          pas ce dossier.
        </p>
      )}
    </section>
  );
}
