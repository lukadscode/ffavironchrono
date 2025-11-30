import { CrewStatus, CREW_STATUS_LABELS } from "@/constants/crewStatus";
import { cn } from "@/lib/utils";

interface CrewStatusBadgeProps {
  status: string;
  className?: string;
}

export const CrewStatusBadge: React.FC<CrewStatusBadgeProps> = ({ status, className }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case CrewStatus.REGISTERED:
        return "bg-green-100 text-green-800 border-green-200";
      case CrewStatus.DNS:
      case CrewStatus.SCRATCH:
      case CrewStatus.WITHDRAWN:
        return "bg-gray-100 text-gray-800 border-gray-200";
      case CrewStatus.DNF:
        return "bg-orange-100 text-orange-800 border-orange-200";
      case CrewStatus.DISQUALIFIED:
        return "bg-red-100 text-red-800 border-red-200";
      case CrewStatus.CHANGED:
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const label = CREW_STATUS_LABELS[status as CrewStatus] || status;

  return (
    <span
      className={cn(
        "px-2 py-1 rounded-full text-xs font-medium border",
        getStatusColor(status),
        className
      )}
    >
      {label}
    </span>
  );
};

