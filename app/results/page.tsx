import { Suspense } from "react";
import { Spinner } from "@/components/ui/spinner";
import { ResultsPageContent } from "./results-content";

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <Spinner className="h-8 w-8" />
        </div>
      }
    >
      <ResultsPageContent />
    </Suspense>
  );
}
