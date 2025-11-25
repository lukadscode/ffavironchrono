import { DndContext, closestCenter } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import RacePhaseCard from "@/pages/races/RacePhaseCard";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Phase {
  id: string;
  name: string;
  order_index: number;
}

interface Props {
  phases: Phase[];
  onReorder: (phases: Phase[]) => void;
  onDelete: (id: string) => Promise<void>;
  onEdit: (id: string, name: string, order: number) => Promise<void>;
  eventId: string;
  enableCrewDrag?: boolean;
}

export default function PhaseListDnd({
  phases,
  onReorder,
  onDelete,
  onEdit,
  eventId,
  enableCrewDrag = false,
}: Props) {
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = phases.findIndex((p) => p.id === active.id);
    const newIndex = phases.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(phases, oldIndex, newIndex).map((p, i) => ({
      ...p,
      order_index: i + 1,
    }));
    onReorder(reordered);
  };

  return (
        <ScrollArea className="w-full overflow-x-auto">
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
            items={phases.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
            >
            <div className="flex gap-6 px-4 py-4">
                {phases.map((phase) => (
                <RacePhaseCard
                    key={phase.id}
                    phase={phase}
                    onDelete={onDelete}
                    onEdit={onEdit}
                    eventId={eventId}
                    enableCrewDrag={enableCrewDrag}
                />
                ))}
            </div>
            </SortableContext>
        </DndContext>
        </ScrollArea>

  );
}
