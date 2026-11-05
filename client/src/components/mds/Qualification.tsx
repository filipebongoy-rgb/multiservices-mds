import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { trades } from "@shared/mds";

export function Qualification({
  description,
  serviceId,
  answers,
  onAnswer,
  onService,
  questions,
}: {
  description: string;
  serviceId: number | null;
  answers: Record<string, string>;
  onAnswer: (question: string, answer: string) => void;
  onService: (id: number) => void;
  questions: string[];
}) {
  const [agreed, setAgreed] = useState(false),
    [answer, setAnswer] = useState("");
  const ai = trpc.mds.qualification.analyze.useMutation();
  const activeQuestion =
    ai.data?.result.question || questions.find(q => !answers[q]);
  const suggested = ai.data?.result;
  return (
    <details className="refinement">
      <summary className="simple-summary">
        Préciser mon problème (facultatif)
      </summary>
      <div className="stack" style={{ marginTop: 12 }}>
        <label className="row small-text">
          <input
            type="checkbox"
            checked={agreed}
            onChange={e => setAgreed(e.target.checked)}
          />
          Utiliser l’aide IA sur ma description et mes réponses, sans mes
          coordonnées.
        </label>
        <button
          type="button"
          className="btn secondary"
          disabled={!agreed || description.trim().length < 10 || ai.isPending}
          onClick={() => {
            setAnswer("");
            ai.mutate({
              description: description.slice(0, 3000),
              serviceId,
              answers,
              consent: true,
            });
          }}
        >
          {ai.isPending
            ? "Lecture de votre description…"
            : "M’aider à préciser"}
        </button>
        {ai.error && (
          <p role="alert">
            L’aide est indisponible. Vous pouvez continuer sans elle.
          </p>
        )}
        {ai.data?.reason && (
          <p className="muted" role="status">
            {ai.data.reason}
          </p>
        )}
        {suggested?.confidence === "probable" && suggested.trade && (
          <p className="small-text">
            Métier probable :{" "}
            {trades.find(t => t.slug === suggested.trade)?.name}. MDS vérifiera.
          </p>
        )}
        {suggested?.serviceId &&
          suggested.serviceId !== serviceId &&
          suggested.confidence === "probable" && (
            <button
              type="button"
              className="btn secondary"
              onClick={() => onService(suggested.serviceId!)}
            >
              Choisir la prestation suggérée
            </button>
          )}
        {activeQuestion && (
          <div className="field">
            <label htmlFor="one-help-question">{activeQuestion}</label>
            <input
              id="one-help-question"
              value={answer}
              maxLength={500}
              onChange={e => setAnswer(e.target.value)}
            />
            <button
              type="button"
              className="btn secondary"
              disabled={!answer.trim()}
              onClick={() => {
                onAnswer(activeQuestion, answer.trim());
                setAnswer("");
                ai.reset();
              }}
            >
              Ajouter cette précision
            </button>
          </div>
        )}
        <p className="muted small-text">
          Aucun diagnostic. Vous pouvez envoyer votre demande sans répondre.
        </p>
      </div>
    </details>
  );
}
