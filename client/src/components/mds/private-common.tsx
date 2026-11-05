import {
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Download,
  FileText,
  Loader2,
  LogIn,
  RefreshCw,
  Upload,
  X,
} from "lucide-react";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { dateTime, statusLabels } from "@shared/mds";
import type { PrivateDocument, RequestRecord } from "./private-types";

export function ActionButton({
  className = "secondary",
  style,
  children,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={`btn ${className}`}
      style={{ minHeight: 44, ...style }}
      {...props}
    >
      {children}
    </button>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small className="muted">{hint}</small>}
    </label>
  );
}
export function ErrorNotice({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p className="error-message" role="alert">
      {error instanceof Error
        ? error.message
        : "Une erreur est survenue. Réessayez."}
    </p>
  );
}
export function LoginButton() {
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="stack">
      <ActionButton
        className="primary"
        onClick={() => {
          try {
            startLogin();
          } catch {
            setError(
              "La connexion n’est pas configurée pour le moment. Contactez MDS ou réessayez plus tard."
            );
          }
        }}
      >
        <LogIn size={18} aria-hidden="true" /> Se connecter avec Manus
      </ActionButton>
      <ErrorNotice error={error ? new Error(error) : null} />
    </div>
  );
}
export function QueryState({
  loading,
  error,
  retry,
  empty,
  emptyText = "Aucun élément pour le moment.",
}: {
  loading?: boolean;
  error?: unknown;
  retry?: () => unknown;
  empty?: boolean;
  emptyText?: string;
}) {
  if (loading)
    return (
      <div className="notice row" role="status">
        <Loader2 size={18} aria-hidden="true" /> Chargement…
      </div>
    );
  if (error)
    return (
      <div className="notice">
        <ErrorNotice error={error} />
        {retry && (
          <ActionButton onClick={() => void retry()}>
            <RefreshCw size={16} aria-hidden="true" /> Réessayer
          </ActionButton>
        )}
      </div>
    );
  if (empty) return <div className="empty">{emptyText}</div>;
  return null;
}
export function StatusBadge({ status }: { status: RequestRecord["status"] }) {
  return <span className="badge">{statusLabels[status] ?? status}</span>;
}
export function PrivateModal({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const previousFocus = useRef<HTMLElement | null>(
    typeof document !== "undefined"
      ? (document.activeElement as HTMLElement)
      : null
  );
  return (
    <Dialog.Root
      open
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          className="modal-backdrop"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(20,24,25,.55)",
            zIndex: 90,
          }}
        />
        <Dialog.Content
          className="modal panel stack private-modal"
          style={{
            position: "fixed",
            zIndex: 91,
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-50%)",
            width: "min(600px, calc(100vw - 32px))",
            maxHeight: "calc(100dvh - 32px)",
            overflowY: "auto",
            background: "white",
          }}
          onCloseAutoFocus={event => {
            event.preventDefault();
            previousFocus.current?.focus();
          }}
        >
          <div
            className="row"
            style={{ justifyContent: "space-between", alignItems: "start" }}
          >
            <Dialog.Title style={{ fontSize: 22, fontWeight: 700 }}>
              {title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <ActionButton aria-label="Fermer la fenêtre">
                <X size={18} aria-hidden="true" />
              </ActionButton>
            </Dialog.Close>
          </div>
          <Dialog.Description className="muted">
            {description ??
              "Les modifications sont enregistrées dans votre espace privé."}
          </Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function DocumentList({
  documents,
  reference,
  emptyText = "Aucun document déposé.",
}: {
  documents: PrivateDocument[];
  reference?: string;
  emptyText?: string;
}) {
  const utils = trpc.useUtils();
  const [downloading, setDownloading] = useState<number | null>(null);
  const [error, setError] = useState<unknown>(null);
  async function download(id: number) {
    setDownloading(id);
    setError(null);
    try {
      const file = await utils.client.mds.documents.download.mutate({
        id,
        ...(reference ? { reference } : {}),
      });
      const bytes = Uint8Array.from(atob(file.base64), c => c.charCodeAt(0));
      const url = URL.createObjectURL(
        new Blob([bytes], { type: file.mimeType })
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (cause) {
      setError(cause);
    } finally {
      setDownloading(null);
    }
  }
  return (
    <div className="stack">
      <ErrorNotice error={error} />
      {documents.length === 0 ? (
        <div className="empty">{emptyText}</div>
      ) : (
        <ul className="data-list" style={{ listStyle: "none", padding: 0 }}>
          {documents.map(doc => (
            <li
              key={doc.id}
              className="data-row row"
              style={{ flexWrap: "wrap", justifyContent: "space-between" }}
            >
              <div className="row">
                <FileText size={20} aria-hidden="true" />
                <div>
                  <strong style={{ overflowWrap: "anywhere" }}>
                    {doc.name}
                  </strong>
                  <p className="muted">{dateTime(doc.createdAt)}</p>
                </div>
              </div>
              <ActionButton
                disabled={downloading !== null}
                onClick={() => void download(doc.id)}
                aria-label={`Télécharger ${doc.name}`}
              >
                <Download size={17} aria-hidden="true" />
                {downloading === doc.id ? "Téléchargement…" : "Télécharger"}
              </ActionButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function UploadDocument({
  reference,
  organizationId,
  kind,
  onUploaded,
}: {
  reference?: string;
  organizationId?: number;
  kind: "quote" | "invoice" | "contract" | "other";
  onUploaded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [reading, setReading] = useState(false);
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = trpc.mds.documents.upload.useMutation();
  async function submit() {
    if (!file) return;
    setError(null);
    setSuccess(false);
    setReading(true);
    try {
      const documentName = name.trim() || file.name;
      if (documentName.length > 200 || /[\x00-\x1f/\\]/.test(documentName))
        throw new Error(
          "Le nom doit contenir au maximum 200 caractères, sans barre oblique ni caractère de contrôle."
        );
      if (file.size > 5 * 1024 * 1024)
        throw new Error("Le PDF doit faire au maximum 5 Mo.");
      if (
        !file.name.toLowerCase().endsWith(".pdf") ||
        (file.type && file.type !== "application/pdf")
      )
        throw new Error("Sélectionnez un véritable document PDF.");
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () =>
          reject(new Error("Impossible de lire le fichier."));
        reader.readAsDataURL(file);
      });
      await upload.mutateAsync({
        reference,
        organizationId,
        name: documentName,
        mimeType: "application/pdf",
        base64,
        kind,
      });
      setFile(null);
      setName("");
      if (inputRef.current) inputRef.current.value = "";
      setSuccess(true);
      onUploaded();
    } catch (cause) {
      setError(cause);
    } finally {
      setReading(false);
    }
  }
  return (
    <form
      className="stack"
      onSubmit={event => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="form-grid">
        <Field
          label="Document PDF"
          hint="PDF réel, 5 Mo maximum. Transfert privé avec contrôle serveur."
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            required
            onChange={e => {
              const next = e.target.files?.[0] ?? null;
              setFile(next);
              setName(next?.name ?? "");
              setSuccess(false);
            }}
          />
        </Field>
        <Field label="Nom du document">
          <input
            value={name}
            maxLength={200}
            onChange={e => setName(e.target.value)}
            required
          />
        </Field>
      </div>
      <ErrorNotice error={error} />
      {success && (
        <p className="success-message" role="status">
          Document déposé.
        </p>
      )}
      <ActionButton
        type="submit"
        className="primary"
        disabled={!file || reading || upload.isPending}
      >
        <Upload size={18} aria-hidden="true" />
        {reading || upload.isPending ? "Dépôt en cours…" : "Déposer le PDF"}
      </ActionButton>
    </form>
  );
}
