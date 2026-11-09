import { useState } from "react";
import { UserPlus, UserRoundX } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ActionButton, ErrorNotice, Field, QueryState } from "./private-common";

export function ArtisanTeam() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [requestId, setRequestId] = useState("");
  const [teamMemberId, setTeamMemberId] = useState("");
  const list = trpc.mds.team.list.useQuery();
  const utils = trpc.useUtils();
  const invite = trpc.mds.team.invite.useMutation({ onSuccess: () => { setEmail(""); setDisplayName(""); void list.refetch(); } });
  const revoke = trpc.mds.team.revoke.useMutation({ onSuccess: () => void list.refetch() });
  const assign = trpc.mds.team.assign.useMutation();
  if (list.isLoading) return <QueryState loading />;
  if (list.error) return <QueryState error={list.error} retry={list.refetch} />;
  return (
    <section className="stack private-team">
      <div className="section-heading"><div><span className="eyebrow">Équipe terrain</span><h2>Les artisans voient leur planning</h2><p className="muted">Ajoutez un collaborateur. Il ne verra que les interventions que vous lui affectez.</p></div></div>
      <div className="panel stack">
        <h3><UserPlus size={18} aria-hidden="true" /> Ajouter un artisan</h3>
        <div className="form-grid two-columns">
          <Field label="Nom affiché"><input value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder="Prénom Nom" /></Field>
          <Field label="Adresse e-mail"><input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="artisan@exemple.fr" /></Field>
        </div>
        <ActionButton className="primary" disabled={invite.isPending || !email || !displayName} onClick={() => invite.mutate({ email, displayName, role: "technician" })}>{invite.isPending ? "Ajout…" : "Ajouter à l’équipe"}</ActionButton>
        <ErrorNotice error={invite.error} />
      </div>
      <div className="panel stack">
        <h3>Affecter une intervention</h3>
        <p className="muted">L’affectation ne donne pas accès aux paiements, contrats ou réglages MDS.</p>
        <div className="form-grid two-columns">
          <Field label="ID du dossier"><input inputMode="numeric" value={requestId} onChange={event => setRequestId(event.target.value)} placeholder="Ex. 42" /></Field>
          <Field label="Collaborateur"><select value={teamMemberId} onChange={event => setTeamMemberId(event.target.value)}><option value="">Choisir</option>{list.data?.filter(member => member.status === "active").map(member => <option key={member.id} value={member.id}>{member.displayName}</option>)}</select></Field>
        </div>
        <ActionButton disabled={assign.isPending || !requestId || !teamMemberId} onClick={async () => { await assign.mutateAsync({ requestId: Number(requestId), teamMemberId: Number(teamMemberId) }); setRequestId(""); setTeamMemberId(""); await utils.mds.requests.list.invalidate(); }}>Affecter au planning</ActionButton>
        <ErrorNotice error={assign.error} />
      </div>
      <div className="stack compact-list">{list.data?.map(member => <div className="private-list-row" key={member.id}><div><strong>{member.displayName}</strong><span className="muted small-text">{member.email}</span></div><div className="inline-actions"><span className={`status-badge status-${member.status}`}>{member.status === "active" ? "Actif" : member.status === "pending" ? "En attente" : "Révoqué"}</span><ActionButton aria-label={`Révoquer ${member.displayName}`} title="Révoquer l’accès" onClick={() => revoke.mutate({ id: member.id })}><UserRoundX size={16} aria-hidden="true" /></ActionButton></div></div>)}</div>
    </section>
  );
}
