import {
  useEffect,
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
  return (
    <div>
      <ActionButton
        className="primary"
        onClick={() => {
          window.location.href = "/connexion";
        }}
      >
        <LogIn size={18} aria-hidden="true" /> Ouvrir la page de connexion
      </ActionButton>
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
  token,
  organizationId,
  kind,
  photoStage = "other",
  multiple = false,
  onUploaded,
}: {
  reference?: string;
  token?: string;
  organizationId?: number;
  kind: "photo" | "quote" | "invoice" | "contract" | "other";
  photoStage?: "before" | "after" | "other";
  multiple?: boolean;
  onUploaded: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [reading, setReading] = useState(false);
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = trpc.mds.documents.upload.useMutation();
  useEffect(() => {
    const urls =
      kind === "photo" ? files.map(file => URL.createObjectURL(file)) : [];
    setPreviews(urls);
    return () => urls.forEach(url => URL.revokeObjectURL(url));
  }, [files, kind]);
  async function submit() {
    if (!files.length) return;
    setError(null);
    setSuccess(false);
    setReading(true);
    try {
      if (multiple && files.length > 10)
        throw new Error("Ajoutez au maximum 10 photos à la fois.");
      for (const file of files) {
        const documentName =
          multiple || kind === "photo" ? file.name : name.trim() || file.name;
        if (documentName.length > 200 || /[\x00-\x1f/\\]/.test(documentName))
          throw new Error(
            "Le nom doit contenir au maximum 200 caractères, sans barre oblique ni caractère de contrôle."
          );
        if (file.size > 5 * 1024 * 1024)
          throw new Error("Chaque fichier doit faire au maximum 5 Mo.");
        if (kind === "photo") {
          if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
            throw new Error(
              "Choisissez uniquement des photos JPG, PNG ou WebP."
            );
        } else if (
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
          token,
          organizationId,
          name: documentName,
          mimeType: kind === "photo" ? file.type : "application/pdf",
          base64,
          kind,
          photoStage,
          description: description.trim() || undefined,
        });
      }
      setFiles([]);
      setName("");
      setDescription("");
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
          label={kind === "photo" ? "Photo demandée par MDS" : "Document PDF"}
          hint={
            kind === "photo"
              ? multiple
                ? "JPG, PNG ou WebP, 5 Mo par photo, 10 photos maximum."
                : "JPG, PNG ou WebP, 5 Mo maximum."
              : "PDF, 5 Mo maximum. Transfert privé."
          }
        >
          <input
            ref={inputRef}
            type="file"
            multiple={multiple}
            accept={
              kind === "photo"
                ? "image/jpeg,image/png,image/webp"
                : "application/pdf,.pdf"
            }
            required
            onChange={e => {
              const next = Array.from(e.target.files || []);
              setFiles(next);
              setName(next[0]?.name ?? "");
              setSuccess(false);
            }}
          />
        </Field>
        {kind !== "photo" && (
          <Field label="Nom du document">
            <input
              value={name}
              maxLength={200}
              onChange={e => setName(e.target.value)}
              required
            />
          </Field>
        )}
        {kind === "photo" && (
          <Field label="Description (facultative)">
            <input
              value={description}
              maxLength={500}
              onChange={event => setDescription(event.target.value)}
              placeholder="Exemple : état du mur sous la fuite"
            />
          </Field>
        )}
      </div>
      {kind === "photo" && previews.length > 0 && (
        <div className="photo-preview-grid" aria-label="Aperçu des photos">
          {previews.map((url, index) => (
            <figure key={url}>
              <img src={url} alt={`Aperçu de la photo ${index + 1}`} />
              <figcaption>{files[index]?.name}</figcaption>
            </figure>
          ))}
        </div>
      )}
      <ErrorNotice error={error} />
      {success && (
        <p className="success-message" role="status">
          Document déposé.
        </p>
      )}
      <ActionButton
        type="submit"
        className="primary"
        disabled={!files.length || reading || upload.isPending}
      >
        <Upload size={18} aria-hidden="true" />
        {reading || upload.isPending
          ? "Dépôt en cours…"
          : kind === "photo"
            ? multiple
              ? `Ajouter ${files.length || "les"} photos`
              : "Ajouter la photo"
            : "Déposer le PDF"}
      </ActionButton>
    </form>
  );
}
