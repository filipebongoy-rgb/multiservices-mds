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
  Mic,
  MicOff,
  MessageSquare,
  Phone,
  Send,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { dateTime } from "@shared/mds";
import { ActionButton, ErrorNotice, QueryState } from "./private-common";
import { useLocation } from "wouter";

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

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
  autoConfirmable?: boolean;
  autoQuoteable?: boolean;
  autoValidateable?: boolean;
  assignedTo?: string | null;
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
  const prepareQuoteMutation = trpc.mds.assistant.prepareQuote.useMutation();
  const autoValidateMutation = trpc.mds.assistant.autoValidate.useMutation();
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
  const [command, setCommand] = useState("");
  const [voiceReply, setVoiceReply] = useState("Dites : « ouvre les demandes » ou « prépare une relance ».");
  const [listening, setListening] = useState(false);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [, setLocation] = useLocation();

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

  const speak = (text: string) => {
    setVoiceReply(text);
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "fr-FR";
      window.speechSynthesis.speak(utterance);
    }
  };

  const executeCommand = async (rawCommand: string) => {
    const text = rawCommand.trim().toLocaleLowerCase("fr-FR");
    if (!text) {
      speak("Je n’ai pas entendu de demande. Dites par exemple : ouvre le planning.");
      return;
    }
    if (text.includes("demande")) {
      setLocation("/artisan/requests");
      speak("J’ouvre les demandes.");
      return;
    }
    if (text.includes("planning") || text.includes("rendez-vous") || text.includes("rendez vous")) {
      setLocation("/artisan/planning");
      speak("J’ouvre le planning.");
      return;
    }
    if (text.includes("intervention") || text.includes("mission")) {
      setLocation("/artisan/interventions");
      speak("J’ouvre les interventions.");
      return;
    }
    if (text.includes("actualise") || text.includes("actualise") || text.includes("rafraîchi") || text.includes("rafraichi")) {
      await query.refetch();
      speak("C’est actualisé.");
      return;
    }
    if (text.includes("relance") || text.includes("message")) {
      const task = data.tasks.find(item => item.requestId && (item.priority === "follow_up" || item.kind === "payment" || item.kind === "message"));
      if (task) {
        await prepareDraft(task, "email");
        speak(`J’ai préparé une relance pour ${task.clientName || "le client"}. Vérifiez le message avant l’envoi.`);
      } else {
        speak("Je ne trouve pas de client à relancer.");
      }
      return;
    }
    if (text.includes("confirme") || text.includes("confirmer")) {
      const task = data.tasks.find(item => item.requestId && item.autoConfirmable);
      if (task) {
        speak("J’ai trouvé le rendez-vous. Utilisez le bouton Confirmer le rendez-vous pour valider.");
      } else {
        speak("Je ne trouve pas de rendez-vous prêt à confirmer.");
      }
      return;
    }
    speak("Je peux ouvrir les demandes, le planning ou les interventions, actualiser, ou préparer une relance.");
  };

  const listen = () => {
    const SpeechRecognition = (window as Window & { SpeechRecognition?: BrowserSpeechRecognitionConstructor; webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor }).SpeechRecognition
      ?? (window as Window & { webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor }).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      speak("La commande vocale n’est pas disponible ici. Écrivez votre demande dans la case.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "fr-FR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = event => {
      const transcript = event.results[0]?.[0]?.transcript || "";
      setCommand(transcript);
      void executeCommand(transcript);
    };
    recognition.onerror = () => {
      setListening(false);
      speak("Je n’ai pas compris. Essayez avec des mots simples.");
    };
    recognition.onend = () => setListening(false);
    setListening(true);
    recognition.start();
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
          <h2 id="assistant-title">Missions et actions</h2>
          <p className="assistant-hero-help">La mission la plus importante est affichée juste en dessous.</p>
        </div>
      </header>

      <div className="assistant-metrics" aria-label="Résumé de l’activité">
        <div className="assistant-metric urgent"><strong>{data.counts.urgent}</strong><span>À traiter en priorité</span></div>
        <div className="assistant-metric"><strong>{data.counts.today}</strong><span>Aujourd’hui</span></div>
        <div className="assistant-metric"><strong>{data.counts.followUp}</strong><span>À relancer</span></div>
        <div className="assistant-metric"><strong>{data.counts.unpaidInvoices}</strong><span>Factures à vérifier</span></div>
      </div>

      <ErrorNotice error={draftMutation.error || approveMutation.error || cancelMutation.error || autoConfirmMutation.error || prepareQuoteMutation.error || autoValidateMutation.error} />
      {notice && <p className="notice" role="status">{notice}</p>}

      <section className="panel assistant-voice-panel" aria-labelledby="assistant-voice-title">
        <div className="assistant-voice-copy">
          <span className="eyebrow">Commande simple</span>
          <h3 id="assistant-voice-title">Parler à l’assistante</h3>
          <p>Dites une phrase courte. Exemple : « ouvre les demandes ».</p>
        </div>
        <div className="assistant-voice-actions">
          <ActionButton className="primary" onClick={listen} disabled={listening}>
            {listening ? <MicOff size={18} aria-hidden="true" /> : <Mic size={18} aria-hidden="true" />}
            {listening ? "J’écoute…" : "Parler à l’assistante"}
          </ActionButton>
          <div className="assistant-command-row">
            <input aria-label="Demande à l’assistante" value={command} onChange={event => setCommand(event.target.value)} placeholder="Écrire une demande" />
            <ActionButton onClick={() => void executeCommand(command)}>Faire</ActionButton>
          </div>
        </div>
        <p className="assistant-voice-reply" role="status" aria-live="polite">{voiceReply}</p>
        <div className="assistant-quick-links" aria-label="Actions rapides">
          <ActionButton onClick={() => setLocation("/artisan/requests")}>Demandes</ActionButton>
          <ActionButton onClick={() => setLocation("/artisan/planning")}>Planning</ActionButton>
          <ActionButton onClick={() => setLocation("/artisan/interventions")}>Interventions</ActionButton>
          <ActionButton onClick={() => void query.refetch()}>Actualiser</ActionButton>
        </div>
      </section>

      <div className="assistant-layout">
          <div className="panel stack assistant-quick-panel">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
            <div>
              <span className="eyebrow">Prochaine action</span>
              <h3 style={{ margin: "4px 0 0" }}>À faire maintenant</h3>
            </div>
            <span className="badge">{data.tasks.length}</span>
          </div>
          {data.tasks.length === 0 ? (
            <div className="empty">Aucune tâche urgente. Vous pouvez vous concentrer sur les interventions.</div>
          ) : (
            <div className="assistant-task-list">
              {(showAllTasks ? data.tasks : data.tasks.slice(0, 3)).map(task => (
                    <article className={`assistant-task assistant-task-${task.priority}`} key={task.id} onClick={() => task.requestId && onOpenRequest(task.requestId)} role={task.requestId ? "button" : undefined} tabIndex={task.requestId ? 0 : undefined} onKeyDown={event => { if (task.requestId && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onOpenRequest(task.requestId); } }}>
                  <div className="assistant-task-icon">{taskIcon(task)}</div>
                  <div className="assistant-task-copy">
                    <strong>{task.title}</strong>
                    <span>{task.detail}</span>
                    {task.dueAt && <small>{task.priority === "today" ? `Aujourd’hui · ${dateTime(task.dueAt)}` : dateTime(task.dueAt)}</small>}
                  </div>
                  <div className="assistant-task-actions" onClick={event => event.stopPropagation()}>
                    {task.requestId && !task.autoConfirmable && !task.autoValidateable && !task.autoQuoteable && (
                      <ActionButton className="primary" onClick={() => onOpenRequest(task.requestId!)}>
                        Ouvrir la mission
                      </ActionButton>
                    )}
                    {task.requestId && task.autoConfirmable && (
                      <ActionButton className="primary" disabled={autoConfirmMutation.isPending} onClick={async () => { if (!window.confirm("Confirmer ce rendez-vous et l’ajouter au planning ?")) return; try { const result = await autoConfirmMutation.mutateAsync({ requestId: task.requestId! }); setNotice(result.note); await utils.mds.assistant.overview.invalidate(); } catch { /* ErrorNotice displays the mutation error. */ } }}><CalendarClock size={15} aria-hidden="true" /> {autoConfirmMutation.isPending ? "Confirmation…" : "Confirmer le rendez-vous"}</ActionButton>
                    )}
                    {task.requestId && task.autoValidateable && (
                      <ActionButton className="primary" disabled={autoValidateMutation.isPending} onClick={async () => {
                        try {
                          const result = await autoValidateMutation.mutateAsync({ requestId: task.requestId! });
                          setNotice(result.note);
                          await utils.mds.assistant.overview.invalidate();
                        } catch { /* ErrorNotice displays the mutation error. */ }
                      }}>
                        <Check size={15} aria-hidden="true" /> {autoValidateMutation.isPending ? "Validation…" : "Valider le dossier"}
                      </ActionButton>
                    )}
                    {task.requestId && task.autoQuoteable && !task.autoConfirmable && (
                      <ActionButton className="secondary" disabled={prepareQuoteMutation.isPending} onClick={async () => {
                        try {
                          const result = await prepareQuoteMutation.mutateAsync({ requestId: task.requestId! });
                          setNotice(result.note);
                          await utils.mds.assistant.overview.invalidate();
                        } catch { /* ErrorNotice displays the mutation error. */ }
                      }}>
                        <FileText size={15} aria-hidden="true" /> {prepareQuoteMutation.isPending ? "Remplissage…" : "Remplir le devis"}
                      </ActionButton>
                    )}
                    {task.requestId && !task.autoConfirmable && (task.priority === "follow_up" || task.kind === "payment" || task.kind === "message") && (
                      <ActionButton className="secondary" onClick={() => void prepareDraft(task, "email")} disabled={draftMutation.isPending}><Mail size={15} aria-hidden="true" /> {draftMutation.isPending ? "Préparation…" : "Préparer la relance"}</ActionButton>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
          {data.tasks.length > 3 && (
            <ActionButton className="secondary" onClick={() => setShowAllTasks(value => !value)}>
              {showAllTasks ? "Voir moins" : `Voir les ${data.tasks.length - 3} autres missions`}
            </ActionButton>
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
