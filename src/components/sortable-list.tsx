"use client";

import { useId, useState } from "react";
import { closestCenter, DndContext, KeyboardSensor, MeasuringStrategy, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

let seq = 0;
const newId = () => `s${++seq}`;

/**
 * Ids estables para listas sin id propio (servicios, textos). Se mantienen alineados con la
 * lista: si cambia su largo desde fuera (agregar, quitar, restablecer) se ajustan.
 */
export function useStableIds(length: number) {
  const [ids, setIds] = useState(() => Array.from({ length }, newId));
  if (ids.length !== length) {
    const next = ids.length > length ? ids.slice(0, length) : [...ids, ...Array.from({ length: length - ids.length }, newId)];
    setIds(next);
    return { ids: next, setIds };
  }
  return { ids, setIds };
}

const instructions = {
  draggable:
    "Para reordenar, presiona Espacio o Enter para tomar el elemento, usa las flechas arriba y abajo para moverlo y vuelve a presionar Espacio o Enter para soltarlo. Escape cancela.",
};

/**
 * Lista vertical reordenable con mouse, toque y teclado (dnd-kit), con anuncios en español.
 * `renderItem` recibe el asa de arrastre ya preparada para colocarla donde convenga.
 */
export function SortableList<T>({
  items,
  ids,
  label,
  itemLabel,
  onReorder,
  onDragStart,
  renderItem,
  className,
}: {
  items: T[];
  ids: string[];
  label: string;
  itemLabel: (item: T, index: number) => string;
  onReorder: (from: number, to: number) => void;
  /** P. ej. para cerrar una tarjeta expandida antes de moverla. */
  onDragStart?: () => void;
  renderItem: (item: T, index: number, handle: React.ReactNode) => React.ReactNode;
  className?: string;
}) {
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const nameOf = (id: unknown) => {
    const i = ids.indexOf(String(id));
    return i >= 0 ? `«${itemLabel(items[i], i)}»` : "el elemento";
  };
  const position = (id: unknown) => `posición ${ids.indexOf(String(id)) + 1} de ${ids.length}`;

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    onReorder(ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
  };

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragStart={() => onDragStart?.()}
      onDragEnd={onDragEnd}
      // Las alturas pueden cambiar al empezar (tarjeta que se cierra): se vuelven a medir
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      accessibility={{
        screenReaderInstructions: instructions,
        announcements: {
          onDragStart: ({ active }) => `Tomaste ${nameOf(active.id)}, ${position(active.id)}.`,
          onDragOver: ({ active, over }) => (over ? `${nameOf(active.id)} está en la ${position(over.id)}.` : undefined),
          onDragEnd: ({ active, over }) => (over ? `Soltaste ${nameOf(active.id)} en la ${position(over.id)}.` : `Soltaste ${nameOf(active.id)}.`),
          onDragCancel: ({ active }) => `Cancelado. ${nameOf(active.id)} volvió a su lugar.`,
        },
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul aria-label={label} className={cn("space-y-2", className)}>
          {items.map((item, i) => (
            <SortableRow key={ids[i]} id={ids[i]} handleLabel={`Mover ${itemLabel(item, i)}`}>
              {(handle) => renderItem(item, i, handle)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ id, handleLabel, children }: { id: string; handleLabel: string; children: (handle: React.ReactNode) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      aria-label={handleLabel}
      className="flex size-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="size-4" />
    </button>
  );
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("relative", isDragging && "z-10 shadow-float")}
    >
      {children(handle)}
    </li>
  );
}

export { arrayMove };
