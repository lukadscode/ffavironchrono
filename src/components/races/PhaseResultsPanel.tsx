import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPhaseResultsByCategory, getPhaseResults, type PhaseResult } from "@/api/races";
import { Skeleton } from "@/components/ui/skeleton";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import { Button } from "@/components/ui/button";

interface PhaseResultsPanelProps {
  phaseId: string;
  phaseName?: string;
  assignedCrewIds?: string[];
}

export default function PhaseResultsPanel({ phaseId, phaseName, assignedCrewIds = [] }: PhaseResultsPanelProps) {
  const [results, setResults] = useState<Record<string, PhaseResult[]>>({});
  const [allResults, setAllResults] = useState<PhaseResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'category' | 'race'>('category');

  useEffect(() => {
    const fetchResults = async () => {
      try {
        setLoading(true);
        setError(null);
        const [categoryResponse, allResponse] = await Promise.all([
          getPhaseResultsByCategory(phaseId),
          getPhaseResults(phaseId)
        ]);
        setResults(categoryResponse.data);
        setAllResults(allResponse.data);
      } catch (err) {
        setError("Erreur lors du chargement des résultats");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [phaseId]);

  if (loading) {
    return (
      <Card>
        <CardHeader className="bg-blue-50">
          <CardTitle>Résultats de {phaseName || "la phase précédente"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="bg-red-50">
          <CardTitle>Résultats de {phaseName || "la phase précédente"}</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <p className="text-sm text-red-600">{error}</p>
        </CardContent>
      </Card>
    );
  }

  const categories = Object.keys(results).sort();
  const resultsByRace = allResults.reduce((acc, result) => {
    const raceName = result.race.name;
    if (!acc[raceName]) acc[raceName] = [];
    acc[raceName].push(result);
    return acc;
  }, {} as Record<string, PhaseResult[]>);

  const races = Object.keys(resultsByRace).sort((a, b) => {
    const raceA = resultsByRace[a][0]?.race.race_number || 0;
    const raceB = resultsByRace[b][0]?.race.race_number || 0;
    return raceA - raceB;
  });

  if (categories.length === 0 && allResults.length === 0) {
    return (
      <Card>
        <CardHeader className="bg-blue-50">
          <CardTitle>Résultats de {phaseName || "la phase précédente"}</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <p className="text-sm text-gray-600">Aucun résultat disponible</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="bg-blue-50 space-y-3">
        <CardTitle>Résultats de {phaseName || "la phase précédente"}</CardTitle>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={viewMode === 'category' ? 'default' : 'outline'}
            onClick={() => setViewMode('category')}
          >
            Par catégorie
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'race' ? 'default' : 'outline'}
            onClick={() => setViewMode('race')}
          >
            Par course
          </Button>
        </div>
        {assignedCrewIds.length > 0 && (
          <div className="flex items-center gap-3 text-xs text-gray-600">
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-green-50 border border-green-300 rounded"></div>
              <span>Déjà affecté</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-white border border-gray-300 rounded"></div>
              <span>Non affecté</span>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6 max-h-[80vh] overflow-y-auto p-4">
        {viewMode === 'category' ? (
          categories.map((category) => (
            <div key={category} className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-700 border-b pb-1">
                {category}
              </h3>
              <div className="space-y-1">
                {results[category].map((result) => (
                  <DraggableResult
                    key={result.crew_id}
                    result={result}
                    rankType="scratch"
                    isAssigned={assignedCrewIds.includes(result.crew_id)}
                  />
                ))}
              </div>
            </div>
          ))
        ) : (
          races.map((raceName) => (
            <div key={raceName} className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-700 border-b pb-1">
                {raceName}
              </h3>
              <div className="space-y-1">
                {resultsByRace[raceName]
                  .sort((a, b) => (a.rank_in_race || 999) - (b.rank_in_race || 999))
                  .map((result) => (
                    <DraggableResult
                      key={`${result.race.id}-${result.crew_id}`}
                      result={result}
                      rankType="race"
                      isAssigned={assignedCrewIds.includes(result.crew_id)}
                    />
                  ))}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function DraggableResult({ result, rankType, isAssigned }: { result: PhaseResult; rankType: 'scratch' | 'race'; isAssigned?: boolean }) {
  const { setNodeRef, attributes, listeners, transform, isDragging } = useDraggable({
    id: `result-crew-${result.crew_id}`,
    data: { type: "crew", crewId: result.crew_id },
  });

  const style = { transform: CSS.Translate.toString(transform) } as React.CSSProperties;

  const timeDisplay = result.finish_time && result.duration_ms
    ? formatDuration(result.duration_ms)
    : result.finish_time
    ? new Date(result.finish_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "DNS";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={clsx(
        "flex items-center justify-between px-3 py-2 text-xs border rounded cursor-move select-none transition-colors",
        isDragging ? "opacity-60 ring-2 ring-blue-400" : "",
        result.has_timing
          ? isAssigned
            ? "bg-green-50 border-green-300 hover:border-green-400"
            : "bg-white border-gray-300 hover:border-blue-400"
          : "bg-gray-50 border-gray-200 text-gray-500"
      )}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {result.has_timing && (
          <span className={clsx(
            "flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold",
            (rankType === 'scratch' ? result.rank_scratch : result.rank_in_race) === 1 ? "bg-yellow-400 text-yellow-900" :
            (rankType === 'scratch' ? result.rank_scratch : result.rank_in_race) === 2 ? "bg-gray-300 text-gray-800" :
            (rankType === 'scratch' ? result.rank_scratch : result.rank_in_race) === 3 ? "bg-orange-400 text-orange-900" :
            "bg-gray-100 text-gray-700"
          )}>
            {rankType === 'scratch' ? result.rank_scratch : result.rank_in_race}
          </span>
        )}
        <span className="truncate font-medium">{result.crew.club_name}</span>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-gray-600 flex-shrink-0">
        <span className="hidden sm:inline">{result.race.name}</span>
        <span className="font-mono">{timeDisplay}</span>
      </div>
    </div>
  );
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = Math.floor((ms % 1000) / 10);
  return `${minutes}:${seconds.toString().padStart(2, "0")}.${milliseconds.toString().padStart(2, "0")}`;
}
