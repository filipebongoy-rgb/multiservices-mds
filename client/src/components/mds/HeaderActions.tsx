import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Bell, Phone } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { dateTime } from "@shared/mds";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

/** Appel direct de MDS, uniquement si un numéro public est configuré. */
export function HeaderCallButton() {
  const mounted = useMounted();
  return mounted ? <LiveCallButton /> : null;
}

function LiveCallButton() {
  const settings = trpc.mds.settings.public.useQuery(undefined, {
    staleTime: 600000,
  });
  const phone = (settings.data?.contactPhone || "").replace(/[^\d+]/g, "");
  if (!phone) return null;
  return (
    <a
      href={`tel:${phone}`}
      className="simple-phone-action"
      aria-label="Appeler MDS"
    >
      <Phone size={21} aria-hidden="true" />
    </a>
  );
}

/** Cloche : notifications réellement envoyées au compte connecté. */
export function NotificationBell() {
  const mounted = useMounted();
  return mounted ? <LiveNotificationBell /> : null;
}

function LiveNotificationBell() {
  const { user } = useAuth();
  const list = trpc.mds.notifications.list.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 30000,
  });
  const read = trpc.mds.notifications.read.useMutation({
    onSuccess: () => void list.refetch(),
  });
  if (!user) return null;
  const items = (list.data || []).slice(0, 8);
  const unread = (list.data || []).filter(item => !item.readAt).length;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="header-bell"
          aria-label={
            unread
              ? `Notifications : ${unread} non lue${unread > 1 ? "s" : ""}`
              : "Notifications"
          }
        >
          <Bell size={22} aria-hidden="true" />
          {unread > 0 && (
            <span className="header-bell-count" aria-hidden="true">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="header-bell-menu">
        {items.length ? (
          items.map(item => (
            <DropdownMenuItem key={item.id} asChild>
              <Link
                href="/suivi"
                className={item.readAt ? "" : "is-unread"}
                onClick={() => !item.readAt && read.mutate({ id: item.id })}
              >
                <strong>{item.title}</strong>
                <span>{item.message}</span>
                <small>{dateTime(item.createdAt)}</small>
              </Link>
            </DropdownMenuItem>
          ))
        ) : (
          <p className="header-bell-empty">
            Aucune notification pour le moment.
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
