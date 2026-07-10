import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

export function RecommendationsList({ recommendations, loading }) {
  if (loading) {
    return <Skeleton className="h-20 w-full" />;
  }

  const items = recommendations?.length ? recommendations : ["No insights available yet."];

  return (
    <Alert>
      <AlertTitle>Recommended actions</AlertTitle>
      <AlertDescription>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
