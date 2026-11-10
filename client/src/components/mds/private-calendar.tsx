import { useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { z } from "zod";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { calendarSettingsSchema } from "@shared/operations";
import { dateTime } from "@shared/mds";
import type { calendarRouter } from "../../../../server/mds/calendar";
import { ActionButton, ErrorNotice, Field, QueryState } from "./private-common";
import { dayKey } from "./private-types";

type CalendarData = inferRouterOutputs<typeof calendarRouter>["get"];
type CalendarSettings = z.infer<typeof calendarSettingsSchema>;
type Period = CalendarData["periods"][number];
const weekdays = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
  "Dimanche",
];
function shiftDay(day: string, count: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}
function monday(day: string) {
  return shiftDay(day, -((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7));
}
const dateLabel = (day: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Paris",
  }).format(new Date(`${day}T12:00:00Z`));
const timeLabel = (value: Date) =>
  new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
function localInput(value: Date) {
  const parts = new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const get = (name: Intl.DateTimeFormatPartTypes) =>
    parts.find(p => p.type === name)?.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
/** Never interpret datetime-local in the browser's timezone; reject DST gaps/folds. */
function parisInputISO(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const wall = new Date(`${value}Z`).getTime();
  if (!Number.isFinite(wall)) return null;
  const offsets = new Set<number>();
  for (const delta of [-36, 0, 36]) {
    const sample = new Date(wall + delta * 3_600_000);
    offsets.add(
      new Date(`${localInput(sample)}Z`).getTime() -
        Math.floor(+sample / 60_000) * 60_000
    );
  }
  const matches = [...offsets]
    .map(offset => new Date(wall - offset))
    .filter(date => localInput(date) === value);
  return matches.length === 1 ? matches[0].toISOString() : null;
}
export function ArtisanCalendar({ onOpen }: { onOpen: (id: number) => void }) {
  const query = trpc.mds.calendar.get.useQuery(undefined, {
    retry: false,
    refetchInterval: 30_000,
  });
  const deleteAppt = trpc.mds.calendar.deleteAppointment.useMutation({
    onSuccess: () => void query.refetch(),
  });
  const cleanCompleted =
    trpc.mds.calendar.cleanCompletedAppointments.useMutation({
      onSuccess: () => void query.refetch(),
    });
  const [selectedDate, setSelectedDate] = useState(() => dayKey(new Date()));
  const [view, setView] = useState<"day" | "week">("week");
  const [statusFilter, setStatusFilter] = useState<
    "upcoming" | "all" | "completed"
  >("upcoming");
  const first = view === "week" ? monday(selectedDate) : selectedDate;
  const days = Array.from({ length: view === "week" ? 7 : 1 }, (_, i) =>
    shiftDay(first, i)
  );
  return (
    <div className="stack">
      <div className="section-heading">
        <h2>Planning</h2>
        <p className="muted">Rendez-vous validés · heure de Paris</p>
      </div>
      <QueryState
        loading={query.isLoading}
        error={query.error}
        retry={query.refetch}
      />
      {query.data && !query.error && (
        <div
          className="row"
          style={{ alignItems: "start", flexWrap: "wrap", gap: 20 }}
        >
          <section
            className="panel stack"
            style={{ flex: "3 1 420px", minWidth: 0, maxWidth: "100%" }}
          >
            <div
              className="row"
              style={{
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                <ActionButton
                  aria-label={
                    view === "week" ? "Semaine précédente" : "Jour précédent"
                  }
                  onClick={() =>
                    setSelectedDate(
                      shiftDay(selectedDate, view === "week" ? -7 : -1)
                    )
                  }
                >
                  <ChevronLeft size={18} aria-hidden="true" />
                </ActionButton>
                <ActionButton
                  onClick={() => setSelectedDate(dayKey(new Date()))}
                >
                  Aujourd’hui
                </ActionButton>
                <ActionButton
                  aria-label={
                    view === "week" ? "Semaine suivante" : "Jour suivant"
                  }
                  onClick={() =>
                    setSelectedDate(
                      shiftDay(selectedDate, view === "week" ? 7 : 1)
                    )
                  }
                >
                  <ChevronRight size={18} aria-hidden="true" />
                </ActionButton>
              </div>
              <div className="row" role="group" aria-label="Vue du calendrier">
                <ActionButton
                  aria-pressed={view === "day"}
                  className={view === "day" ? "primary" : "secondary"}
                  onClick={() => setView("day")}
                >
                  Jour
                </ActionButton>
                <ActionButton
                  aria-pressed={view === "week"}
                  className={view === "week" ? "primary" : "secondary"}
                  onClick={() => setView("week")}
                >
                  Semaine
                </ActionButton>
              </div>
            </div>
            <Field label="Aller à une date">
              <input
                type="date"
                value={selectedDate}
                onChange={e =>
                  e.target.value && setSelectedDate(e.target.value)
                }
                style={{ minHeight: 44 }}
              />
            </Field>
            <div
              className="row"
              style={{
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 8,
                alignItems: "center",
              }}
            >
              <div
                className="row"
                role="group"
                aria-label="Filtrer les rendez-vous"
                style={{ flexWrap: "wrap", gap: 6 }}
              >
                <ActionButton
                  aria-pressed={statusFilter === "upcoming"}
                  className={
                    statusFilter === "upcoming" ? "primary" : "secondary"
                  }
                  onClick={() => setStatusFilter("upcoming")}
                >
                  À venir
                </ActionButton>
                <ActionButton
                  aria-pressed={statusFilter === "all"}
                  className={statusFilter === "all" ? "primary" : "secondary"}
                  onClick={() => setStatusFilter("all")}
                >
                  Tous
                </ActionButton>
                <ActionButton
                  aria-pressed={statusFilter === "completed"}
                  className={
                    statusFilter === "completed" ? "primary" : "secondary"
                  }
                  onClick={() => setStatusFilter("completed")}
                >
                  Terminés
                </ActionButton>
              </div>
              {query.data.appointments.some(a => a.status === "completed") && (
                <ActionButton
                  className="destructive"
                  disabled={cleanCompleted.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Supprimer tous les rendez-vous terminés du planning ? L'historique des interventions reste conservé."
                      )
                    )
                      cleanCompleted.mutate();
                  }}
                >
                  Nettoyer les rendez-vous terminés
                </ActionButton>
              )}
            </div>
            <div aria-live="polite" className="mds-calendar-grid">
              {days.map(day => {
                const appointments = query.data.appointments
                  .filter(a => dayKey(a.startAt) === day)
                  .filter(a => statusFilter === "upcoming" ? a.status !== "completed" : statusFilter === "completed" ? a.status === "completed" : true);
                return (
                  <section key={day} className="mds-calendar-day">
                    <header className="mds-calendar-day-header">
                      <span>{dateLabel(day).split(" ")[0]}</span>
                      <strong>{dateLabel(day).replace(/^[^ ]+ /, "")}</strong>
                    </header>
                    <div className="mds-calendar-day-body">
                      {!appointments.length && <span className="mds-calendar-empty">Libre</span>}
                      {appointments.map(a => (
                        <div key={a.id} className="mds-calendar-event-wrap">
                          <button
                            type="button"
                            className={`mds-calendar-event ${a.status === "completed" ? "is-completed" : ""}`}
                            onClick={() => onOpen(a.requestId)}
                            title={`${a.name} — ouvrir le dossier`}
                          >
                            <strong>{timeLabel(a.startAt)}</strong>
                            <span>{a.name}</span>
                            <small>{a.status === "in_progress" ? "En cours" : a.status === "completed" ? "Terminée" : "Confirmé"}</small>
                            <em>{a.address}</em>
                          </button>
                          <button
                            type="button"
                            className="mds-calendar-delete"
                            aria-label="Supprimer ce rendez-vous du planning"
                            disabled={deleteAppt.isPending}
                            onClick={() => {
                              if (window.confirm("Supprimer ce rendez-vous du planning ?")) deleteAppt.mutate({ id: a.id });
                            }}
                          >
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </section>
          <aside
            className="panel stack"
            aria-label="Outils du planning"
            style={{ flex: "1 1 290px", minWidth: 0, maxWidth: "100%" }}
          >
            <h3 className="row">
              <Settings2 size={18} aria-hidden="true" /> Disponibilités
            </h3>
            <p className="badge">
              {query.data.settings.enabled
                ? "Créneaux publics activés"
                : "Créneaux publics désactivés"}
            </p>
            <CalendarConfiguration
              initial={query.data.settings}
              onSaved={() => void query.refetch()}
            />
            <PeriodEditor
              periods={query.data.periods}
              onSaved={() => void query.refetch()}
            />
          </aside>
        </div>
      )}
    </div>
  );
}
function CalendarConfiguration({
  initial,
  onSaved,
}: {
  initial: CalendarSettings;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<CalendarSettings>(initial);
  const [saved, setSaved] = useState(false);
  const [localError, setLocalError] = useState<Error | null>(null);
  const save = trpc.mds.calendar.saveSettings.useMutation({
    onSuccess: () => {
      setSaved(true);
      setLocalError(null);
      onSaved();
    },
  });
  const change = (next: CalendarSettings) => {
    setDraft(next);
    setSaved(false);
    setLocalError(null);
  };
  return (
    <details>
      <summary style={{ minHeight: 44, cursor: "pointer", padding: "10px 0" }}>
        Horaires et zones
      </summary>
      <form
        className="stack"
        onSubmit={e => {
          e.preventDefault();
          const parsed = calendarSettingsSchema.safeParse(draft);
          if (!parsed.success) {
            setLocalError(
              new Error(
                parsed.error.issues[0]?.message ||
                  "Vérifiez les horaires et les zones avant d’enregistrer."
              )
            );
            return;
          }
          save.mutate(draft);
        }}
      >
        <Field label="Proposer des créneaux publics">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={e => change({ ...draft, enabled: e.target.checked })}
            style={{ width: 44, height: 44 }}
          />
        </Field>
        <p className="muted small-text">
          Après l’enregistrement, ces horaires, zones et périodes ponctuelles
          servent directement au calcul des créneaux proposés au client.
        </p>
        <fieldset
          className="stack"
          style={{ border: 0, padding: 0, minWidth: 0 }}
        >
          <legend>Horaires · Europe/Paris</legend>
          {draft.weeklyWindows.length === 0 && (
            <p className="muted">Aucun horaire configuré.</p>
          )}
          {draft.weeklyWindows.map((w, index) => (
            <div
              key={index}
              className="stack"
              style={{ borderBottom: "1px solid #e7e5e2", paddingBottom: 12 }}
            >
              <Field label={`Jour de la plage ${index + 1}`}>
                <select
                  value={w.weekday}
                  onChange={e =>
                    change({
                      ...draft,
                      weeklyWindows: draft.weeklyWindows.map((row, i) =>
                        i === index
                          ? { ...row, weekday: Number(e.target.value) }
                          : row
                      ),
                    })
                  }
                >
                  {weekdays.map((label, i) => (
                    <option key={label} value={i + 1}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="row" style={{ flexWrap: "wrap" }}>
                {(["start", "end"] as const).map(key => (
                  <Field key={key} label={key === "start" ? "Début" : "Fin"}>
                    <input
                      required
                      type="time"
                      value={w[key]}
                      onChange={e =>
                        change({
                          ...draft,
                          weeklyWindows: draft.weeklyWindows.map((row, i) =>
                            i === index
                              ? { ...row, [key]: e.target.value }
                              : row
                          ),
                        })
                      }
                      style={{ minHeight: 44 }}
                    />
                  </Field>
                ))}
              </div>
              <ActionButton
                onClick={() =>
                  change({
                    ...draft,
                    weeklyWindows: draft.weeklyWindows.filter(
                      (_, i) => i !== index
                    ),
                  })
                }
              >
                Retirer cette plage
              </ActionButton>
            </div>
          ))}
          <ActionButton
            disabled={draft.weeklyWindows.length >= 35}
            onClick={() =>
              change({
                ...draft,
                weeklyWindows: [
                  ...draft.weeklyWindows,
                  { weekday: 1, start: "", end: "" },
                ],
              })
            }
          >
            <Plus size={16} aria-hidden="true" /> Ajouter une plage
          </ActionButton>
        </fieldset>
        <fieldset
          className="stack"
          style={{ border: 0, padding: 0, minWidth: 0 }}
        >
          <legend>Zones et trajet avant intervention</legend>
          {draft.travelZones.length === 0 && (
            <p className="muted">Aucune zone configurée.</p>
          )}
          {draft.travelZones.map((zone, index) => (
            <div className="stack" key={index}>
              <Field label={`Préfixe postal ${index + 1}`}>
                <input
                  required
                  inputMode="numeric"
                  pattern="[0-9]{1,5}"
                  maxLength={5}
                  value={zone.prefix}
                  onChange={e =>
                    change({
                      ...draft,
                      travelZones: draft.travelZones.map((row, i) =>
                        i === index ? { ...row, prefix: e.target.value } : row
                      ),
                    })
                  }
                />
              </Field>
              <Field label="Temps de trajet (minutes)">
                <input
                  required
                  type="number"
                  min={0}
                  max={360}
                  value={zone.travelMinutes}
                  onChange={e =>
                    change({
                      ...draft,
                      travelZones: draft.travelZones.map((row, i) =>
                        i === index
                          ? { ...row, travelMinutes: Number(e.target.value) }
                          : row
                      ),
                    })
                  }
                />
              </Field>
              <ActionButton
                onClick={() =>
                  change({
                    ...draft,
                    travelZones: draft.travelZones.filter(
                      (_, i) => i !== index
                    ),
                  })
                }
              >
                Retirer cette zone
              </ActionButton>
            </div>
          ))}
          <ActionButton
            disabled={draft.travelZones.length >= 100}
            onClick={() =>
              change({
                ...draft,
                travelZones: [
                  ...draft.travelZones,
                  { prefix: "", travelMinutes: 0 },
                ],
              })
            }
          >
            <Plus size={16} aria-hidden="true" /> Ajouter une zone
          </ActionButton>
        </fieldset>
        <Field label="Marge après intervention (minutes)">
          <input
            type="number"
            required
            min={0}
            max={180}
            value={draft.bufferMinutes}
            onChange={e =>
              change({ ...draft, bufferMinutes: Number(e.target.value) })
            }
          />
        </Field>
        <Field label="Horizon de réservation (jours)">
          <input
            type="number"
            required
            min={1}
            max={365}
            value={draft.horizonDays}
            onChange={e =>
              change({ ...draft, horizonDays: Number(e.target.value) })
            }
          />
        </Field>
        <p className="muted">
          Les rendez-vous déjà confirmés restent inchangés.
        </p>
        <ErrorNotice error={localError || save.error} />
        {saved && (
          <p role="status">
            Planning enregistré et créneaux clients synchronisés.
          </p>
        )}
        <ActionButton
          type="submit"
          className="primary"
          disabled={save.isPending}
        >
          {save.isPending
            ? "Enregistrement…"
            : "Enregistrer et synchroniser le planning"}
        </ActionButton>
      </form>
    </details>
  );
}
function PeriodEditor({
  periods,
  onSaved,
}: {
  periods: Period[];
  onSaved: () => void;
}) {
  const [id, setId] = useState<number | undefined>();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [kind, setKind] = useState<"available" | "blocked">("blocked");
  const [note, setNote] = useState("");
  const [error, setError] = useState<Error | null>(null);
  const [notice, setNotice] = useState("");
  const reset = () => {
    setId(undefined);
    setStart("");
    setEnd("");
    setNote("");
    setError(null);
  };
  const save = trpc.mds.calendar.savePeriod.useMutation({
    onSuccess: () => {
      reset();
      setNotice("Période enregistrée.");
      onSaved();
    },
  });
  const remove = trpc.mds.calendar.removePeriod.useMutation({
    onSuccess: (_, input) => {
      if (id === input.id) reset();
      setNotice("Période supprimée.");
      onSaved();
    },
  });
  return (
    <details>
      <summary style={{ minHeight: 44, cursor: "pointer", padding: "10px 0" }}>
        Congés et disponibilités ponctuelles
      </summary>
      <div className="stack">
        <form
          className="stack"
          onSubmit={e => {
            e.preventDefault();
            setNotice("");
            const startAt = parisInputISO(start),
              endAt = parisInputISO(end);
            if (!startAt || !endAt) {
              setError(
                new Error(
                  "Choisissez une heure de Paris valide, hors heure ambiguë du changement d’heure."
                )
              );
              return;
            }
            if (new Date(endAt) <= new Date(startAt)) {
              setError(new Error("La fin doit suivre le début."));
              return;
            }
            setError(null);
            save.mutate({ id, startAt, endAt, kind, note });
          }}
        >
          <Field label="Type de période">
            <select
              value={kind}
              onChange={e =>
                setKind(
                  e.target.value === "available" ? "available" : "blocked"
                )
              }
            >
              <option value="blocked">Indisponible / congés</option>
              <option value="available">Disponible exceptionnellement</option>
            </select>
          </Field>
          <Field label="Début (heure de Paris)">
            <input
              required
              type="datetime-local"
              value={start}
              onChange={e => setStart(e.target.value)}
            />
          </Field>
          <Field label="Fin (heure de Paris)">
            <input
              required
              type="datetime-local"
              value={end}
              onChange={e => setEnd(e.target.value)}
            />
          </Field>
          <Field label="Note privée (facultative)">
            <input
              maxLength={1000}
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </Field>
          <ErrorNotice error={error || save.error || remove.error} />
          <ActionButton
            type="submit"
            className="primary"
            disabled={save.isPending}
          >
            {save.isPending
              ? "Enregistrement…"
              : id
                ? "Modifier la période"
                : "Enregistrer la période"}
          </ActionButton>
          {id && (
            <ActionButton onClick={reset}>Annuler la modification</ActionButton>
          )}
        </form>
        {notice && <p role="status">{notice}</p>}
        {!periods.length && <p className="muted">Aucune période ponctuelle.</p>}
        {[...periods]
          .sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt))
          .map(p => (
            <div className="data-row stack" key={p.id}>
              <strong>
                {p.kind === "blocked" ? "Indisponible" : "Disponible"}
              </strong>
              <p>
                {dateTime(p.startAt)} – {dateTime(p.endAt)}
              </p>
              {p.note && <small>{p.note}</small>}
              <div className="row" style={{ flexWrap: "wrap" }}>
                <ActionButton
                  onClick={() => {
                    setId(p.id);
                    setStart(localInput(p.startAt));
                    setEnd(localInput(p.endAt));
                    setKind(p.kind);
                    setNote(p.note ?? "");
                    setNotice("");
                    setError(null);
                  }}
                >
                  Modifier
                </ActionButton>
                <ActionButton
                  disabled={remove.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Supprimer cette période ? Les rendez-vous confirmés resteront inchangés."
                      )
                    )
                      remove.mutate({ id: p.id });
                  }}
                >
                  Supprimer
                </ActionButton>
              </div>
            </div>
          ))}
      </div>
    </details>
  );
}
