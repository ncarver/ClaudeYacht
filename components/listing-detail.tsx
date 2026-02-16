"use client";

import { useState, useEffect } from "react";
import { ThumbsUp, ThumbsDown, Star, ExternalLink, Microscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { Listing, BoatProperties } from "@/lib/types";
import {
  parseProperties,
  defaultBoatProperties,
  boatPropertyLabels,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface ListingDetailProps {
  listing: Listing;
  onUpdate: (
    id: number,
    data: Partial<Pick<Listing, "notes" | "thumbs" | "favorite" | "properties">>
  ) => void;
  onResearch: (listing: Listing) => void;
}

export function ListingDetail({ listing, onUpdate, onResearch }: ListingDetailProps) {
  const [notes, setNotes] = useState(listing.notes);
  const [localProps, setLocalProps] = useState(() =>
    parseProperties(listing.properties)
  );

  useEffect(() => {
    setNotes(listing.notes);
  }, [listing.notes]);

  useEffect(() => {
    setLocalProps(parseProperties(listing.properties));
  }, [listing.properties]);

  useEffect(() => {
    if (notes === listing.notes) return;
    const timer = setTimeout(() => {
      onUpdate(listing.id, { notes });
    }, 500);
    return () => clearTimeout(timer);
  }, [notes, listing.id, listing.notes, onUpdate]);

  function handlePropertyChange(key: keyof BoatProperties, checked: boolean) {
    const updated = { ...localProps, [key]: checked };
    setLocalProps(updated);
    onUpdate(listing.id, { properties: JSON.stringify(updated) });
  }

  return (
    <div className="flex gap-6 p-4" onClick={(e) => e.stopPropagation()}>
      {listing.imgUrl && (
        <img
          src={listing.imgUrl}
          alt={listing.listingName ?? "Boat"}
          className="h-32 w-48 rounded-lg object-cover shrink-0"
        />
      )}

      <div className="flex-1 space-y-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              onUpdate(listing.id, {
                thumbs: listing.thumbs === "up" ? null : "up",
              })
            }
            className={cn(
              listing.thumbs === "up" && "text-green-400 bg-green-400/10"
            )}
          >
            <ThumbsUp className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              onUpdate(listing.id, {
                thumbs: listing.thumbs === "down" ? null : "down",
              })
            }
            className={cn(
              listing.thumbs === "down" && "text-red-400 bg-red-400/10"
            )}
          >
            <ThumbsDown className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              onUpdate(listing.id, { favorite: !listing.favorite })
            }
            className={cn(
              listing.favorite && "text-yellow-400 bg-yellow-400/10"
            )}
          >
            <Star
              className={cn("h-4 w-4", listing.favorite && "fill-current")}
            />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onResearch(listing)}
            className={cn(
              listing.hasResearch && "text-purple-400 bg-purple-400/10"
            )}
          >
            <Microscope className="h-4 w-4" />
          </Button>

          {listing.linkUrl && (
            <a
              href={listing.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto flex items-center gap-1 text-xs text-primary hover:underline"
            >
              View on YachtWorld
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        {(listing.sellerName || listing.sellerLocation) && (
          <div className="text-xs text-muted-foreground">
            {listing.sellerName && (
              <span className="font-medium">{listing.sellerName}</span>
            )}
            {listing.sellerName && listing.sellerLocation && " \u00b7 "}
            {listing.sellerLocation}
          </div>
        )}

        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
          {(Object.keys(defaultBoatProperties) as (keyof BoatProperties)[]).map(
            (key) => (
              <label
                key={key}
                className="flex items-center gap-2 text-xs cursor-pointer"
              >
                <Checkbox
                  checked={localProps[key]}
                  onCheckedChange={(checked) =>
                    handlePropertyChange(key, !!checked)
                  }
                />
                <span>{boatPropertyLabels[key]}</span>
              </label>
            )
          )}
        </div>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes about this listing..."
          className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-20 resize-y"
        />
      </div>
    </div>
  );
}
