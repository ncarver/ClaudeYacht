import { render, screen, userEvent } from "@/test/render";
import { ListingDetail } from "./listing-detail";
import { createListing } from "@/test/fixtures";

describe("ListingDetail", () => {
  const defaultProps = {
    listing: createListing({
      sellerName: "Bay Marine",
      sellerLocation: "San Francisco, CA",
      linkUrl: "https://www.yachtworld.com/boat/test",
      imgUrl: "https://images.example.com/boat.jpg",
    }),
    onUpdate: vi.fn(),
    onResearch: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders seller information", () => {
    render(<ListingDetail {...defaultProps} />);
    expect(screen.getByText("Bay Marine")).toBeInTheDocument();
    // Seller location is in same parent as seller name and separator
    expect(screen.getByText(/San Francisco, CA/)).toBeInTheDocument();
  });

  it("renders View on YachtWorld link", () => {
    render(<ListingDetail {...defaultProps} />);
    const link = screen.getByText("View on YachtWorld");
    expect(link).toBeInTheDocument();
    expect(link.closest("a")).toHaveAttribute("href", "https://www.yachtworld.com/boat/test");
  });

  it("calls onUpdate with thumbs up on click", async () => {
    const user = userEvent.setup();
    render(<ListingDetail {...defaultProps} />);

    // Find the thumbs up button (it has the ThumbsUp icon)
    const buttons = screen.getAllByRole("button");
    const thumbsUpBtn = buttons.find((b) => b.querySelector('[class*="lucide-thumbs-up"]') || b.textContent === "");
    // Click the first action button (thumbs up is first)
    await user.click(buttons[0]);

    expect(defaultProps.onUpdate).toHaveBeenCalledWith(
      defaultProps.listing.id,
      expect.objectContaining({ thumbs: "up" })
    );
  });

  it("calls onUpdate when favorite is toggled", async () => {
    const user = userEvent.setup();
    render(<ListingDetail {...defaultProps} />);

    // The star/favorite button
    const buttons = screen.getAllByRole("button");
    // Favorite is the 3rd action button (after thumbs up, thumbs down)
    await user.click(buttons[2]);

    expect(defaultProps.onUpdate).toHaveBeenCalledWith(
      defaultProps.listing.id,
      expect.objectContaining({ favorite: true })
    );
  });

  it("calls onResearch when research button is clicked", async () => {
    const user = userEvent.setup();
    render(<ListingDetail {...defaultProps} />);

    const buttons = screen.getAllByRole("button");
    // Research is the 4th action button
    await user.click(buttons[3]);

    expect(defaultProps.onResearch).toHaveBeenCalledWith(defaultProps.listing);
  });

  it("renders property checkboxes", () => {
    render(<ListingDetail {...defaultProps} />);
    expect(screen.getByText("Double-ender")).toBeInTheDocument();
    expect(screen.getByText("Tiller steering")).toBeInTheDocument();
    expect(screen.getByText("Furling main")).toBeInTheDocument();
  });

  it("renders notes textarea", () => {
    const listing = createListing({ notes: "Great condition" });
    render(<ListingDetail {...defaultProps} listing={listing} />);
    expect(screen.getByDisplayValue("Great condition")).toBeInTheDocument();
  });
});
