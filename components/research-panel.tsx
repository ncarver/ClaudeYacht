"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  ExternalLink,
  Loader2,
  AlertCircle,
  BookOpen,
  Anchor,
  MessageSquare,
  FileText,
  RefreshCw,
  Microscope,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  Listing,
  ResearchResult,
  ResearchStatus,
  SailboatDataSpecs,
  SailboatCandidate,
  ReviewCandidate,
  ReviewResult,
  ForumCandidate,
  ForumResult,
} from "@/lib/types";
import {
  parseSailboatData,
  parseReviews,
  parseForums,
  sailboatDataLabels,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface ResearchPanelProps {
  listing: Listing;
  onClose: () => void;
  onResearchComplete?: () => void;
}

const stepLabels: Record<string, string> = {
  sailboatdata: "Searching sailboatdata.com...",
  reviews: "Searching for professional reviews...",
  forums: "Looking for owners forums...",
  yachtworld: "Reading listing details...",
};

export function ResearchPanel({ listing, onClose, onResearchComplete }: ResearchPanelProps) {
  const [research, setResearch] = useState<ResearchResult | null>(null);
  const [status, setStatus] = useState<ResearchStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchResearch = useCallback(async () => {
    try {
      const res = await fetch(`/api/research/${listing.id}`);
      if (res.ok) {
        const data: ResearchResult = await res.json();
        setResearch(data);
        return data;
      }
    } catch (err) {
      console.error("Failed to fetch research:", err);
    }
    return null;
  }, [listing.id]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    intervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/research/${listing.id}/status`);
        if (res.ok) {
          const s: ResearchStatus = await res.json();
          setStatus(s);
          if (s.status === "waiting_for_input") {
            stopPolling(); // Stop polling while waiting for user selection
          } else if (s.status === "complete" || s.status === "failed") {
            stopPolling();
            await fetchResearch();
            if (s.status === "complete") onResearchComplete?.();
          }
        }
      } catch {
        // ignore polling errors
      }
    }, 2000);
  }, [listing.id, stopPolling, fetchResearch]);

  useEffect(() => {
    fetchResearch().then((data) => {
      setLoading(false);
      if (data?.listing?.status === "running") {
        startPolling();
      }
    });
    return stopPolling;
  }, [listing.id, fetchResearch, startPolling, stopPolling]);

  async function handleStartResearch() {
    setStatus({
      listingId: listing.id,
      status: "running",
      step: "sailboatdata",
      errorMessage: null,
    });

    try {
      const res = await fetch(`/api/research/${listing.id}`, {
        method: "POST",
      });
      if (res.ok) {
        startPolling();
      } else {
        const data = await res.json();
        setStatus({
          listingId: listing.id,
          status: "failed",
          step: null,
          errorMessage: data.error ?? "Failed to start research",
        });
      }
    } catch {
      setStatus({
        listingId: listing.id,
        status: "failed",
        step: null,
        errorMessage: "Network error",
      });
    }
  }

  async function handleSelectSailboat(slug: string | null) {
    try {
      await fetch(`/api/research/${listing.id}/select-sailboat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      // Clear waiting status and resume polling — pipeline continues server-side
      setStatus((prev) =>
        prev ? { ...prev, status: "running", step: "sailboatdata", candidates: undefined } : prev
      );
      startPolling();
    } catch {
      console.error("Failed to submit sailboat selection");
    }
  }

  async function handleSelectReviews(urls: string[]) {
    try {
      await fetch(`/api/research/${listing.id}/select-reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });
      setStatus((prev) =>
        prev ? { ...prev, status: "running", step: "reviews", reviewCandidates: undefined } : prev
      );
      startPolling();
    } catch {
      console.error("Failed to submit review selection");
    }
  }

  async function handleSelectForums(urls: string[]) {
    try {
      await fetch(`/api/research/${listing.id}/select-forums`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });
      setStatus((prev) =>
        prev ? { ...prev, status: "running", step: "forums", forumCandidates: undefined } : prev
      );
      startPolling();
    } catch {
      console.error("Failed to submit forum selection");
    }
  }

  const isWaitingForInput = status?.status === "waiting_for_input";
  const isRunning =
    (status?.status === "running" ||
      (research?.listing?.status === "running" && !status)) &&
    !isWaitingForInput;
  const isComplete =
    status?.status === "complete" || research?.listing?.status === "complete";
  const hasFailed =
    status?.status === "failed" || research?.listing?.status === "failed";
  const currentStep = status?.step ?? null;

  const specs = research?.model?.sailboatData
    ? parseSailboatData(research.model.sailboatData)
    : null;
  const reviews = research?.model?.reviews
    ? parseReviews(research.model.reviews)
    : [];
  const forums = research?.model?.forums
    ? parseForums(research.model.forums)
    : [];

  const boatName = [listing.buildYear, listing.manufacturer, listing.boatClass]
    .filter(Boolean)
    .join(" ");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-2">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">{boatName || "Research"}</h2>
        {listing.listingName && listing.listingName !== boatName && (
          <p className="text-sm text-muted-foreground">{listing.listingName}</p>
        )}
      </div>

      {/* Action bar */}
      <div>
        {isRunning ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{currentStep ? stepLabels[currentStep] : "Researching..."}</span>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={handleStartResearch}
            className="gap-2"
          >
            {isComplete ? (
              <>
                <RefreshCw className="h-4 w-4" />
                Re-run Research
              </>
            ) : (
              <>
                <Microscope className="h-4 w-4" />
                Start Research
              </>
            )}
          </Button>
        )}
      </div>

      {/* Error */}
      {hasFailed && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/5 p-3">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-destructive">Research failed</p>
            <p className="text-muted-foreground">
              {status?.errorMessage ??
                research?.listing?.errorMessage ??
                "Unknown error"}
            </p>
          </div>
        </div>
      )}

      {/* Sailboatdata model selection */}
      {isWaitingForInput && status?.candidates && status.candidates.length > 0 && (
        <Section
          icon={<Anchor className="h-4 w-4" />}
          title="Select Boat Model"
        >
          <p className="text-xs text-muted-foreground">
            Select the matching model from sailboatdata.com:
          </p>
          <div className="space-y-1 mt-2">
            {status.candidates.map((c) => (
              <button
                key={c.slug}
                onClick={() => handleSelectSailboat(c.slug)}
                className={cn(
                  "w-full text-left rounded-lg border p-2 text-xs hover:bg-muted transition-colors",
                  c.recommended && "border-primary"
                )}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium">{c.modelName}</span>
                  {c.recommended && (
                    <span className="text-[10px] text-primary font-medium">Suggested</span>
                  )}
                </div>
                <div className="flex gap-3 text-muted-foreground mt-0.5">
                  {c.loa && <span>{c.loa}</span>}
                  {c.firstBuilt && <span>First built {c.firstBuilt}</span>}
                </div>
              </button>
            ))}
            <button
              onClick={() => handleSelectSailboat(null)}
              className="w-full text-left rounded-lg border border-dashed p-2 text-xs text-muted-foreground hover:bg-muted transition-colors"
            >
              None of these match
            </button>
          </div>
        </Section>
      )}

      {/* Review selection */}
      {isWaitingForInput && status?.step === "reviews" && status?.reviewCandidates && status.reviewCandidates.length > 0 && (
        <ReviewSelection
          candidates={status.reviewCandidates}
          onSubmit={handleSelectReviews}
        />
      )}

      {/* Forum selection */}
      {isWaitingForInput && status?.step === "forums" && status?.forumCandidates && status.forumCandidates.length > 0 && (
        <ForumSelection
          candidates={status.forumCandidates}
          onSubmit={handleSelectForums}
        />
      )}

      {/* Listing Description */}
      {isComplete && (
        <Section
          icon={<FileText className="h-4 w-4" />}
          title="Listing Description"
        >
          {research?.listing?.listingSummary ? (
            <div className="space-y-2">
              <p className="text-sm leading-relaxed">
                {research.listing.listingSummary}
              </p>
              {listing.linkUrl && (
                <a
                  href={listing.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-400 hover:underline"
                >
                  View on YachtWorld
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          ) : (
            <EmptyMessage>No description available</EmptyMessage>
          )}
        </Section>
      )}

      {/* Boat Specs */}
      {isComplete && (
        <Section
          icon={<Anchor className="h-4 w-4" />}
          title="Boat Specifications"
          subtitle={
            research?.model?.manufacturer && research?.model?.boatClass
              ? `${research.model.manufacturer} ${research.model.boatClass}${research.model.yearMin ? ` (${research.model.yearMin}–${research.model.yearMax})` : ""}`
              : undefined
          }
          subtitleHref={specs?.sailboatDataUrl ?? undefined}
        >
          {specs ? (
            <SpecsGrid specs={specs} />
          ) : (
            <EmptyMessage>No specifications found on sailboatdata.com</EmptyMessage>
          )}
        </Section>
      )}

      {/* Reviews */}
      {isComplete && (
        <Section
          icon={<BookOpen className="h-4 w-4" />}
          title="Professional Reviews"
        >
          {reviews.length > 0 ? (
            <div className="space-y-3">
              {reviews.map((review, i) => (
                <ReviewCard key={i} review={review} />
              ))}
            </div>
          ) : (
            <EmptyMessage>No reviews found</EmptyMessage>
          )}
        </Section>
      )}

      {/* Forums */}
      {isComplete && (
        <Section
          icon={<MessageSquare className="h-4 w-4" />}
          title="Owners Forums"
        >
          {forums.length > 0 ? (
            <div className="space-y-3">
              {forums.map((forum, i) => (
                <ForumCard key={i} forum={forum} />
              ))}
            </div>
          ) : (
            <EmptyMessage>No forums found</EmptyMessage>
          )}
        </Section>
      )}
    </div>
  );
}

// ---- Sub-components ----

function Section({
  icon,
  title,
  subtitle,
  subtitleHref,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  subtitleHref?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {subtitle && (
        subtitleHref ? (
          <a
            href={subtitleHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            {subtitle}
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )
      )}
      {children}
    </div>
  );
}

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-muted-foreground italic">{children}</p>
  );
}

function SpecsGrid({ specs }: { specs: SailboatDataSpecs }) {
  const entries = (
    Object.keys(sailboatDataLabels) as (keyof SailboatDataSpecs)[]
  ).filter((key) => key !== "sailboatDataUrl" && specs[key] !== null && specs[key] !== undefined);

  if (entries.length === 0) {
    return <EmptyMessage>No specifications available</EmptyMessage>;
  }

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
      {entries.map((key) => (
        <div key={key} className="flex justify-between text-xs py-0.5">
          <span className="text-muted-foreground">
            {sailboatDataLabels[key]}
          </span>
          <span className="font-medium tabular-nums">{specs[key]}</span>
        </div>
      ))}
    </div>
  );
}

function ReviewCard({ review }: { review: ReviewResult }) {
  return (
    <div className="rounded-lg border border-border p-3 space-y-1">
      <div className="flex items-start justify-between gap-2">
        <a
          href={review.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-primary hover:underline leading-tight"
        >
          {review.title}
        </a>
        <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
      </div>
      <p className="text-xs text-muted-foreground">{review.source}</p>
      {review.excerpt && (
        <p className="text-xs leading-relaxed">{review.excerpt}</p>
      )}
    </div>
  );
}

function ForumCard({ forum }: { forum: ForumResult }) {
  return (
    <div className="rounded-lg border border-border p-3 space-y-1">
      <div className="flex items-start justify-between gap-2">
        <a
          href={forum.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-primary hover:underline leading-tight"
        >
          {forum.title}
        </a>
        <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
      </div>
      <p className="text-xs text-muted-foreground">{forum.source}</p>
      {forum.excerpt && (
        <p className="text-xs leading-relaxed">{forum.excerpt}</p>
      )}
    </div>
  );
}

function ForumSelection({
  candidates,
  onSubmit,
}: {
  candidates: ForumCandidate[];
  onSubmit: (urls: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(url: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) {
        next.delete(url);
      } else {
        next.add(url);
      }
      return next;
    });
  }

  return (
    <Section
      icon={<MessageSquare className="h-4 w-4" />}
      title="Select Forums"
    >
      <p className="text-xs text-muted-foreground">
        Select the relevant forums to save:
      </p>
      <div className="space-y-1 mt-2">
        {candidates.map((c) => (
          <button
            key={c.url}
            onClick={() => toggle(c.url)}
            className={cn(
              "w-full text-left rounded-lg border p-2 text-xs hover:bg-muted transition-colors",
              selected.has(c.url) && "border-primary bg-primary/5"
            )}
          >
            <div className="flex items-start gap-2">
              <div
                className={cn(
                  "mt-0.5 h-3.5 w-3.5 shrink-0 rounded border flex items-center justify-center",
                  selected.has(c.url)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/40"
                )}
              >
                {selected.has(c.url) && (
                  <svg className="h-2.5 w-2.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 6l3 3 5-5" />
                  </svg>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <span className="font-medium leading-tight line-clamp-2">{c.title}</span>
                <div className="text-muted-foreground mt-0.5">{c.source}</div>
                {c.snippet && (
                  <p className="text-muted-foreground mt-1 line-clamp-2">{c.snippet}</p>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
      <div className="flex gap-2 mt-3">
        <Button
          variant="default"
          size="sm"
          disabled={selected.size === 0}
          onClick={() => onSubmit(Array.from(selected))}
          className="gap-1"
        >
          Save {selected.size > 0 ? `(${selected.size})` : ""}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSubmit([])}
        >
          Skip
        </Button>
      </div>
    </Section>
  );
}

function ReviewSelection({
  candidates,
  onSubmit,
}: {
  candidates: ReviewCandidate[];
  onSubmit: (urls: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(url: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) {
        next.delete(url);
      } else {
        next.add(url);
      }
      return next;
    });
  }

  return (
    <Section
      icon={<BookOpen className="h-4 w-4" />}
      title="Select Reviews"
    >
      <p className="text-xs text-muted-foreground">
        Select the relevant reviews to save:
      </p>
      <div className="space-y-1 mt-2">
        {candidates.map((c) => (
          <button
            key={c.url}
            onClick={() => toggle(c.url)}
            className={cn(
              "w-full text-left rounded-lg border p-2 text-xs hover:bg-muted transition-colors",
              selected.has(c.url) && "border-primary bg-primary/5"
            )}
          >
            <div className="flex items-start gap-2">
              <div
                className={cn(
                  "mt-0.5 h-3.5 w-3.5 shrink-0 rounded border flex items-center justify-center",
                  selected.has(c.url)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/40"
                )}
              >
                {selected.has(c.url) && (
                  <svg className="h-2.5 w-2.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 6l3 3 5-5" />
                  </svg>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <span className="font-medium leading-tight line-clamp-2">{c.title}</span>
                <div className="text-muted-foreground mt-0.5">{c.source}</div>
                {c.snippet && (
                  <p className="text-muted-foreground mt-1 line-clamp-2">{c.snippet}</p>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
      <div className="flex gap-2 mt-3">
        <Button
          variant="default"
          size="sm"
          disabled={selected.size === 0}
          onClick={() => onSubmit(Array.from(selected))}
          className="gap-1"
        >
          Save {selected.size > 0 ? `(${selected.size})` : ""}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSubmit([])}
        >
          Skip
        </Button>
      </div>
    </Section>
  );
}
