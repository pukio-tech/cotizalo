"use client";

import { useId, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  pointerWithin,
  rectIntersection,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { money } from "../../domain/format";
import { STATUSES, type Status } from "../../domain/schema";
import { effectiveStatus, STATUS_DOTS, STATUS_LABELS } from "../../domain/status";
import { updateStatus } from "../../server/actions";
import type { QuotationRow } from "../../server/repository";
import { StatusMenu } from "../status-menu";

// Tablero kanban: una columna por estado guardado. Se mueve arrastrando (mouse, toque prolongado
// o teclado con el asa) o con el menú de estado de cada tarjeta.

// Primero la columna bajo el puntero; con teclado (sin puntero), la que más se cruza con la tarjeta
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : rectIntersection(args);
};

// Con teclado, ← → (o ↑ ↓) saltan a la columna anterior o siguiente
const columnKeyboardCoordinates: KeyboardCoordinateGetter = (event, { context: { over, active, droppableRects, collisionRect } }) => {
  const step = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.code];  if (!step || !collisionRect) return undefined;
  event.preventDefault();
  const current = STATUSES.indexOf((over?.id ?? active?.data.current?.status) as Status);
  const target = STATUSES[Math.min(STATUSES.length - 1, Math.max(0, current + step))];
  const rect = droppableRects.get(target);
  if (!rect) return undefined;
  return { x: rect.left + (rect.width - collisionRect.width) / 2, y: rect.top + 48 };
};

const byRecent = (a: QuotationRow, b: QuotationRow) => b.updatedAt.localeCompare(a.updatedAt);

export function QuotationsBoard({ rows, today }: { rows: QuotationRow[]; today: string }) {
  const dndId = useId();
  const [board, moveOptimistic] = useOptimistic(rows, (state, { id, status }: { id: string; status: Status }) =>
    state.map((r) => (r.id === id ? { ...r, status, updatedAt: new Date().toISOString() } : r))
  );
  const [, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnKeyboardCoordinates })
  );

  const find = (id: unknown) => board.find((r) => r.id === id);
  const nameOf = (id: unknown) => {
    const r = find(id);
    return r ? `${r.code} (${r.client || "sin cliente"})` : "la cotización";
  };
  const columnName = (id: unknown) => STATUS_LABELS[id as Status] ?? "";

  const move = (row: QuotationRow, status: Status) => {
    if (row.status === status) return;
    startTransition(async () => {
      moveOptimistic({ id: row.id, status });
      const r = await updateStatus(row.id, status);
      if (r.ok) toast.success(`${row.code} → ${STATUS_LABELS[status]}`);
      else toast.error(r.error);
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    const row = find(active.id);
    if (row && over) move(row, over.id as Status);
  };

  const active = activeId ? find(activeId) : undefined;

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={({ active }) => setActiveId(String(active.id))}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={onDragEnd}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "Para mover la cotización a otro estado, pulsa Espacio o Enter. Usa las flechas para cambiar de columna y vuelve a pulsar Espacio o Enter para soltarla. Escape cancela.",
        },
        announcements: {
          onDragStart: ({ active }) => `Tomaste ${nameOf(active.id)}.`,
          onDragOver: ({ active, over }) => (over ? `${nameOf(active.id)} está sobre ${columnName(over.id)}.` : undefined),
          onDragEnd: ({ active, over }) => (over ? `Moviste ${nameOf(active.id)} a ${columnName(over.id)}.` : `Soltaste ${nameOf(active.id)}.`),
          onDragCancel: ({ active }) => `Cancelado. ${nameOf(active.id)} no cambió de estado.`,
        },
      }}
    >
      {/* Las columnas se acomodan en filas según el ancho: nunca hay scroll horizontal */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        {STATUSES.map((status) => (
          <BoardColumn key={status} status={status} rows={board.filter((r) => r.status === status).sort(byRecent)} today={today} onMove={move} />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>{active && <CardView row={active} today={today} overlay />}</DragOverlay>
    </DndContext>
  );
}

function BoardColumn({ status, rows, today, onMove }: { status: Status; rows: QuotationRow[]; today: string; onMove: (row: QuotationRow, status: Status) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const headingId = `columna-${status}`;
  const total = rows.reduce((sum, r) => sum + r.firstYear, 0);

  return (
    <section
      ref={setNodeRef}
      aria-labelledby={headingId}
      className={cn("flex min-w-0 flex-col rounded-xl border bg-muted/40 p-2 transition-colors", isOver && "border-brand bg-brand-soft/60")}
    >
      <header className="px-1.5 pt-1 pb-2.5">
        <div className="flex items-center gap-2">
          <span className={cn("size-2 shrink-0 rounded-full", STATUS_DOTS[status])} aria-hidden />
          <h2 id={headingId} className="truncate text-sm font-bold">
            {STATUS_LABELS[status]}
          </h2>
          <span className="ml-auto rounded-full bg-background px-1.5 text-xs font-semibold text-muted-foreground tabular-nums ring-1 ring-border">{rows.length}</span>
        </div>
        <p className="mt-0.5 pl-4 text-xs text-muted-foreground tabular-nums">
          <span className="font-semibold text-foreground">{money(total)}</span> primer año
        </p>
      </header>
      <ul className="flex min-h-20 flex-1 flex-col gap-2">
        {rows.map((row) => (
          <BoardCard key={row.id} row={row} today={today} onMove={onMove} />
        ))}
        {!rows.length && (
          <li className="flex flex-1 items-center justify-center rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
            Arrastra aquí una cotización
          </li>
        )}
      </ul>
    </section>
  );
}

function BoardCard({ row, today, onMove }: { row: QuotationRow; today: string; onMove: (row: QuotationRow, status: Status) => void }) {
  const { setNodeRef, setActivatorNodeRef, listeners, attributes, isDragging } = useDraggable({ id: row.id, data: { status: row.status } });
  // El mouse y el toque arrastran desde toda la tarjeta; el teclado, solo desde el asa (los enlaces y el menú siguen funcionando)
  return (
    <li
      ref={setNodeRef}
      onMouseDown={listeners?.onMouseDown as React.MouseEventHandler | undefined}
      onTouchStart={listeners?.onTouchStart as React.TouchEventHandler | undefined}
      className={cn("touch-manipulation", isDragging && "opacity-40")}
    >
      <CardView
        row={row}
        today={today}
        onMove={(status) => onMove(row, status)}
        handle={
          <button
            ref={setActivatorNodeRef}
            type="button"
            {...attributes}
            onKeyDown={listeners?.onKeyDown as React.KeyboardEventHandler | undefined}
            aria-label={`Mover ${row.code} a otro estado`}
            className="-mr-1 flex size-7 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:cursor-grabbing"
          >
            <GripVertical className="size-4" aria-hidden />
          </button>
        }
      />
    </li>
  );
}

function CardView({ row, today, onMove, handle, overlay }: { row: QuotationRow; today: string; onMove?: (status: Status) => void; handle?: React.ReactNode; overlay?: boolean }) {
  const display = effectiveStatus(row, today);
  return (
    <article className={cn("rounded-lg border bg-card p-3 shadow-xs select-none", overlay ? "rotate-1 cursor-grabbing shadow-lg ring-2 ring-brand" : "cursor-grab hover:border-foreground/20")}>
      <div className="flex items-start gap-1">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[11px] font-bold text-muted-foreground">{row.code}</p>
          <Link href={`/cotizaciones/${row.id}`} className="block truncate text-sm font-semibold hover:underline" title={row.client} draggable={false}>
            {row.client || "Sin cliente"}
          </Link>
          <p className="truncate text-xs text-muted-foreground" title={row.plan}>
            {row.plan || "-"}
          </p>
        </div>
        {handle}
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="text-sm font-bold tabular-nums">{money(row.firstYear)}</span>
        {onMove ? (
          <StatusMenu status={row.status} display={display} onChange={onMove} />
        ) : (
          <span className="text-[11px] font-semibold text-muted-foreground">{STATUS_LABELS[display]}</span>
        )}
      </div>
    </article>
  );
}
