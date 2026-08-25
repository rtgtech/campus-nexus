"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { API_BASE_URL, authFetch } from "@/lib/auth-client";
import { type CampusEvent, type CampusEventType } from "@/lib/app-data";
import { isValidExternalHttpUrl } from "@/lib/external-link";
import { cn } from "@/lib/utils";
import { parseApiResponse } from "@/lib/api-response-contract";

type AdminEventsPanelProps = {
  initialEvents: CampusEvent[];
};

const eventTypes: CampusEventType[] = ["Competition", "Workshop", "Alumni Talk"];
const emptyForm = {
  title: "",
  link: "",
  type: "Competition" as CampusEventType,
  date: "",
  place: "",
};

function sortEvents(events: CampusEvent[]) {
  return [...events].sort((left, right) => left.date.localeCompare(right.date) || left.title.localeCompare(right.title));
}

export function AdminEventsPanel({ initialEvents }: AdminEventsPanelProps) {
  const router = useRouter();
  const [events, setEvents] = useState(() => sortEvents(initialEvents));
  const [form, setForm] = useState(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    setEvents(sortEvents(initialEvents));
  }, [initialEvents]);

  function beginAdd() {
    setForm(emptyForm);
    setEditingId(null);
    setFormError("");
    setMessage("");
    setFormOpen(true);
  }

  function beginEdit(event: CampusEvent) {
    setForm({
      title: event.title,
      link: event.link,
      type: event.type,
      date: event.date,
      place: event.place,
    });
    setEditingId(event.id);
    setFormError("");
    setMessage("");
    setFormOpen(true);
  }

  function closeForm() {
    setForm(emptyForm);
    setEditingId(null);
    setFormError("");
    setFormOpen(false);
  }

  async function saveEvent(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    const payload = {
      title: form.title.trim(),
      link: form.link.trim(),
      type: form.type,
      date: form.date,
      place: form.place.trim(),
    };
    if (!payload.title || !payload.link || !payload.date || !payload.place) {
      setFormError("Title, link, type, date, and place are required.");
      return;
    }
    if (!isValidExternalHttpUrl(payload.link)) {
      setFormError("Link must be a complete external http(s) URL.");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      const response = await authFetch(
        editingId ? `${API_BASE_URL}/api/events/${encodeURIComponent(editingId)}` : `${API_BASE_URL}/api/events`,
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Event could not be saved");
      }
      const saved = parseApiResponse<CampusEvent>(
        editingId ? `/api/events/${editingId}` : "/api/events",
        data,
      );
      setEvents((current) => sortEvents(editingId
        ? current.map((item) => (item.id === editingId ? saved : item))
        : [...current, saved]));
      setMessage(editingId ? "Event updated." : "Event added.");
      closeForm();
      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Event could not be saved");
    } finally {
      setSaving(false);
    }
  }

  async function deleteEvent(event: CampusEvent) {
    setDeletingId(event.id);
    setMessage("");
    try {
      const response = await authFetch(`${API_BASE_URL}/api/events/${encodeURIComponent(event.id)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(typeof data.error === "string" ? data.error : "Event could not be deleted");
      }
      setEvents((current) => current.filter((item) => item.id !== event.id));
      if (editingId === event.id) {
        closeForm();
      }
      setMessage("Event deleted.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Event could not be deleted");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section aria-labelledby="events-heading" className="mt-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="events-heading" className="text-xl font-semibold">Events</h2>
          <p className="mt-1 text-sm text-on-surface-variant">Manage the events shown under Campus Radar.</p>
        </div>
        <Button className="rounded-[3px] px-4" type="button" onClick={beginAdd}>Add event</Button>
      </div>

      {formOpen ? (
        <form className="mt-5 border border-outline-variant/70 bg-white p-4" onSubmit={saveEvent}>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label htmlFor="event-title">Title</Label>
              <Input
                required
                id="event-title"
                className="mt-1.5 h-10 rounded-[3px] border-outline-variant bg-white"
                maxLength={160}
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="event-type">Type</Label>
              <NativeSelect
                id="event-type"
                className="mt-1.5 [&_select]:h-10 [&_select]:rounded-[3px] [&_select]:border-outline-variant [&_select]:bg-white"
                value={form.type}
                onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as CampusEventType }))}
              >
                {eventTypes.map((type) => <NativeSelectOption key={type} value={type}>{type}</NativeSelectOption>)}
              </NativeSelect>
            </div>
            <div>
              <Label htmlFor="event-date">Date</Label>
              <Input
                required
                id="event-date"
                className="mt-1.5 h-10 rounded-[3px] border-outline-variant bg-white"
                type="date"
                value={form.date}
                onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="event-place">Place</Label>
              <Input
                required
                id="event-place"
                className="mt-1.5 h-10 rounded-[3px] border-outline-variant bg-white"
                maxLength={200}
                value={form.place}
                onChange={(event) => setForm((current) => ({ ...current, place: event.target.value }))}
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="event-link">External link</Label>
              <Input
                required
                id="event-link"
                className="mt-1.5 h-10 rounded-[3px] border-outline-variant bg-white"
                maxLength={2048}
                placeholder="https://events.example.edu/apply"
                type="url"
                value={form.link}
                onChange={(event) => setForm((current) => ({ ...current, link: event.target.value }))}
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button className="h-10 rounded-[3px] px-4" disabled={saving} type="submit">
              {saving ? "Saving" : editingId ? "Update event" : "Add event"}
            </Button>
            <Button className="h-10 rounded-[3px]" disabled={saving} type="button" variant="outline" onClick={closeForm}>Cancel</Button>
          </div>
          {formError ? <p className="mt-3 text-sm text-destructive" role="alert">{formError}</p> : null}
        </form>
      ) : null}

      {message ? (
        <p aria-live="polite" className="mt-4 border-l-2 border-on-surface bg-[#f3f3ef] px-3 py-2 text-sm text-on-surface-variant">
          {message}
        </p>
      ) : null}

      <div className="mt-5 overflow-hidden border border-outline-variant/70 bg-white">
        {events.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-on-surface-variant">No events yet.</p>
        ) : (
          <div className="divide-y divide-outline-variant/60">
            {events.map((event) => (
              <article key={event.id} className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_auto] lg:items-center">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold">{event.title}</h3>
                  <a className="mt-1 block truncate text-xs text-on-surface-variant underline-offset-4 hover:underline" href={event.link}>
                    {event.link}
                  </a>
                </div>
                <div className="text-xs text-on-surface-variant">
                  <p className="font-medium text-on-surface">{event.type}</p>
                  <time dateTime={event.date}>{event.date}</time>
                </div>
                <p className="text-xs text-on-surface-variant">{event.place}</p>
                <div className="flex items-center gap-2 lg:justify-end">
                  <Button className="rounded-[3px]" size="sm" type="button" variant="outline" onClick={() => beginEdit(event)}>Edit</Button>
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={<Button className="rounded-[3px]" disabled={deletingId === event.id} size="sm" variant="destructive" />}
                    >
                      {deletingId === event.id ? "Deleting" : "Delete"}
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete {event.title}?</AlertDialogTitle>
                        <AlertDialogDescription>This removes the event from Campus Radar.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction variant="destructive" onClick={() => void deleteEvent(event)}>Delete event</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
