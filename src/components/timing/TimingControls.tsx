import { Button } from "@/components/ui/button";

export function TimingControls({ onRecord }: { onRecord: () => void }) {
  return (
    <div className="flex gap-4 my-4">
      <Button onClick={onRecord}>🚩 STOP TIMING</Button>
    </div>
  );
}
