import { useState } from "react";
import {
  AlertTriangle,
  Bot,
  CalendarClock,
  Check,
  CircleDollarSign,
  ClipboardList,
  Copy,
  FileText,
  Mail,
  MessageSquare,
  Phone,
  RefreshCw,
  Send,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { dateTime } from "@shared/mds";
import { ActionButton, ErrorNotice, QueryState } from "./private-common";

type Task = {
  id: string;
  kind: "request" | "appointment" | "quote" | "invoice" | "payment" | "message" | "incident";
  priority: "urgent" | "today" | "follow_up";
  title: string;
  detail: string;
  requestId: number | null;
  reference: string | null;
  clientName: string | null;
  dueAt: string | Date | null;
  actionLabel: string;
};
type ActionType =
  | "follow_up"
  | "quote_review"
  | "invoice_review"
  | "appointment_confirmation"
  | "call_script";
type Channel = "email" | "sms" | "call";

const actionForTask = (task: Task): ActionType => {
  if (task.kind === "quote") return "quote_review";
  if (task.kind === "invoice" || task.kind === "payment") return "invoice_review";
  if (task.kind === "appointment") return "appointment_confirmation";
  if (task.kind === "message") return "follow_up";
  return "follow_up";
};

function taskIcon(task: Task) {
  if (task.priority === "urgent") return <AlertTriangle size={19} aria-hidden="true" />;
  if (task.kind === "appointment") return <CalendarClock size={19} aria-hidden="true" />;
  if (task.kind === "quote" || task.kind === "invoice") return <FileText size={19} aria-hidden="true" />;
  if (task.kind === "payment") return <CircleDollarSign size={19} aria-hidden="true" />;
  return <ClipboardList size={19} aria-hidden="true" />;
}

export function ArtisanAssistant({ onOpenRequest }: { onOpenRequest: (id: number) => void }) {
  const query = trpc.mds.assistant.overview.useQuery(undefined, {
    retry: false,
    refetchInterval: 30_000,
  });
  const draftMutation = trpc.mds.assistant.draft.useMutation();
  const approveMutation = trpc.mds.assistant.approve.useMutation();
  const autoConfirmMutation = trpc.mds.assistant.autoConfirm.useMutation();
  const cancelMutation = trpc.mds.assistant.cancel.useMutation();
  const utils = trpc.useUtils();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [draft, setDraft] = useState<{
    id: number;
    subject: string;
    body: string;
    recipient: string;
    channel: Channel;
    note: string;
    status: string;
  } | null>(null);
  const [copyDone, setCopyDone] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const prepareDraft = async (task: Task, channel: Channel) => {
    if (!task.requestId) {
      setNotice("Ouvrez le dossier pour traiter cette action.");
      return;
    }
    setSelectedTask(task);
    setNotice(null);
    try {
      const result = await draftMutation.mutateAsync({
        requestId: task.requestId,
        actionType: actionForTask(task),
        channel,
      });
      setDraft(result);
      await utils.mds.assistant.overview.invalidate();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Le brouillon n’a pas pu être préparé.");
    }
  };

  const copyDraft = async () => {
    if (!draft) return;
    await navigator.clipboard?.writeText(`${draft.subject}\n\n${draft.body}`);
    setCopyDone(true);
    window.setTimeout(() => setCopyDone(false), 1800);
  };

  if (query.isLoading) return <QueryState loading />;
  if (query.error) return <QueryState error={query.error} retry={query.refetch} />;
  if (!query.data) return null;
  const data = query.data;

  return (
    <section className="assistant-dashboard stack" aria-labelledby="assistant-title">
      <header className="assistant-hero assistant-hero-compact">
        <div className="assistant-hero-icon" aria-hidden="true"><Bot size={25} /></div>
        <div>
          <span className="eyebrow">Contrôle rapide</span>
          <h2 id="assistant-title">À faire maintenant</h2>
        </div>
        <ActionButton aria-label="Actualiser l’assistante" onClick={() => void query.refetch()} disabled={query.isFetching}>
          <RefreshCw size={17} aria-hidden="true" />
          {query.isFetching ? "Actualisation…" : "Actualiser"}
        </ActionButton>
      </header>

      <div className="assistant-metrics" aria-label="Résumé de l’activité">
        <div className="assistant-metric urgent"><strong>{data.counts.urgent}</strong><span>À traiter en priorité</span></div>
        <div className="assistant-metric"><strong>{data.counts.today}</strong><span>Aujourd’hui</span></div>
        <div className="assistant-metric"><strong>{data.counts.followUp}</strong><span>À relancer</span></div>
        <div className="assistant-metric"><strong>{data.counts.unpaidInvoices}</strong><span>Factures à vérifier</span></div>
      </div>

      <ErrorNotice error={draftMutation.error || approveMutation.error || cancelMutation.error || autoConfirmMutation.error} />
      {notice && <p className="notice" role="status">{notice}</p>}

      <div className="assistant-layout">
          <div className="panel stack assistant-quick-panel">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
            <div>
              <span className="eyebrow">À faire maintenant</span>
              <h3 style={{ margin: "4px 0 0" }}>Une seule liste, dans le bon ordre</h3>
            </div>
            <span className="badge">{data.tasks.length}</span>
          </div>
          {data.tasks.length === 0 ? (
            <div className="empty">Aucune tâche urgente. Vous pouvez vous concentrer sur les interventions.</div>
          ) : (
            <div className="assistant-task-list">
              {data.tasks.map(task => (
                    <article className={`assistant-task assistant-task-${task.priority}`} key={task.id} onClick={() => task.requestId && onOpenRequest(task.requestId)} role={task.requestId ? "button" : undefined} tabIndex={task.requestId ? 0 : undefined} onKeyDown={event => { if (task.requestId && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onOpenRequest(task.requestId); } }}>
                  <div className="assistant-task-icon">{taskIcon(task)}</div>
                  <div className="assistant-task-copy">
                    <strong>{task.title}</strong>
                    <span>{task.detail}</span>
                    {task.dueAt && <small>{task.priority === "today" ? `Aujourd’hui · ${dateTime(task.dueAt)}` : dateTime(task.dueAt)}</small>}
                  </div>
                  <div className="assistant-task-actions" onClick={event => event.stopPropagation()}>
                    {task.requestId && task.autoConfirmable && (
                      <ActionButton className="primary" disabled={autoConfirmMutation.isPending} onClick={async () => { if (!window.confirm("Confirmer ce rendez-vous et l’ajouter au planning ?")) return; try { const result = await autoConfirmMutation.mutateAsync({ requestId: task.requestId! }); setNotice(result.note); await utils.mds.assistant.overview.invalidate(); } catch { /* ErrorNotice displays the mutation error. */ } }}><CalendarClock size={15} aria-hidden="true" /> {autoConfirmMutation.isPending ? "Confirmation…" : "Confirmer le rendez-vous"}</ActionButton>
                    )}
                    {task.requestId && !task.autoConfirmable && (task.priority === "follow_up" || task.kind === "payment" || task.kind === "message") && (
                      <ActionButton className="secondary" onClick={() => void prepareDraft(task, "email")} disabled={draftMutation.isPending}><Mail size={15} aria-hidden="true" /> {draftMutation.isPending ? "Préparation…" : "Préparer la relance"}</ActionButton>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {draft && <div className="panel assistant-draft-panel">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "start" }}>
            <div><span className="eyebrow">Brouillon contrôlé</span><h3 style={{ margin: "4px 0 0" }}>L’assistante prépare, vous validez</h3></div>
            <Send size={20} aria-hidden="true" />
          </div>
          {!draft ? (
            <div className="assistant-draft-empty"><MessageSquare size={24} aria-hidden="true" /><p>Choisissez E-mail, SMS ou Appel sur une tâche de relance. Aucun message ne partira sans validation.</p></div>
          ) : (
            <div className="stack">
              <div className="assistant-recipient"><span>Destinataire</span><strong>{draft.recipient}</strong><small>{draft.channel === "call" ? (data.voice.configured ? "Appel automatique prêt à lancer" : "Appel automatique en attente de configuration") : "Message non envoyé"}</small></div>
              <label className="field"><span>Objet</span><input value={draft.subject} onChange={event => setDraft({ ...draft, subject: event.target.value })} /></label>
              <label className="field"><span>Message</span><textarea rows={8} value={draft.body} onChange={event => setDraft({ ...draft, body: event.target.value })} /></label>
              <p className="muted small-text">{draft.note}</p>
              <div className="row" style={{ flexWrap: "wrap" }}>
                <ActionButton onClick={() => void copyDraft()}><Copy size={16} aria-hidden="true" /> {copyDone ? "Copié" : "Copier"}</ActionButton>
                {draft.channel === "call" ? (
                  <ActionButton className="primary" disabled={approveMutation.isPending} onClick={async () => { if (!data.voice.configured) { setNotice("L’appel est préparé mais reste désactivé tant que le fournisseur Voice n’est pas configuré."); return; } if (!window.confirm(`Lancer l’appel vers ${draft.recipient} ?`)) return; try { const result = await approveMutation.mutateAsync({ actionId: draft.id }); setNotice(result.note); setDraft({ ...draft, status: result.status }); await utils.mds.assistant.overview.invalidate(); } catch { /* ErrorNotice displays the mutation error. */ } }}><Phone size={16} aria-hidden="true" /> {approveMutation.isPending ? "Appel…" : "Lancer l’appel"}</ActionButton>
                ) : (
                  <ActionButton className="primary" disabled={approveMutation.isPending} onClick={async () => { if (!window.confirm(`Envoyer ce ${draft.channel === "email" ? "e-mail" : "SMS"} à ${draft.recipient} ?`)) return; try { const result = await approveMutation.mutateAsync({ actionId: draft.id }); setNotice(result.note); setDraft({ ...draft, status: result.status }); await utils.mds.assistant.overview.invalidate(); } catch { /* ErrorNotice displays the mutation error. */ } }}><Send size={16} aria-hidden="true" /> {approveMutation.isPending ? "Envoi…" : "Valider et envoyer"}</ActionButton>
                )}
                <ActionButton disabled={cancelMutation.isPending} onClick={async () => { try { await cancelMutation.mutateAsync({ actionId: draft.id }); setDraft(null); await utils.mds.assistant.overview.invalidate(); } catch { /* ErrorNotice displays the mutation error. */ } }}><X size={16} aria-hidden="true" /> Annuler</ActionButton>
              </div>
              {draft.status !== "proposed" && <p className="assistant-status"><Check size={16} aria-hidden="true" /> Statut : {draft.status}</p>}
            </div>
          )}
        </div>}
      </div>

      {data.recentActions.length > 0 && <details className="panel assistant-history-details">
        <summary>Voir l’historique des brouillons ({data.recentActions.length})</summary>
        <div className="row" style={{ justifyContent: "space-between" }}><div><span className="eyebrow">Historique assistant</span><h3 style={{ margin: "4px 0 0" }}>Dernières propositions</h3></div><span className="muted small-text">Modèle : {data.assistantModel}</span></div>
        <div className="assistant-history">{data.recentActions.map(action => <div className="assistant-history-row" key={action.id}><div><strong>{action.subject}</strong><span>{action.channel.toUpperCase()} · {action.status}</span></div><small>{dateTime(action.createdAt)}</small></div>)}</div>
      </details>}
    </section>
  );
}
