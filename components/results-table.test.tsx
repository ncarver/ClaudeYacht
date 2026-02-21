import { render, screen, userEvent } from "@/test/render";
import { ResultsTable } from "./results-table";
import { createListing, resetFixtureIds } from "@/test/fixtures";

beforeEach(() => {
  resetFixtureIds();
});

const defaultProps = {
  sorting: [],
  onSortingChange: vi.fn(),
  onUpdateListing: vi.fn(),
  onResearch: vi.fn(),
};

describe("ResultsTable", () => {
  it("renders listing rows", () => {
    const data = [
      createListing({ listingName: "Catalina 42", priceUSD: 85000 }),
      createListing({ listingName: "Beneteau 40", priceUSD: 70000 }),
    ];

    render(<ResultsTable data={data} {...defaultProps} />);

    expect(screen.getByText("Catalina 42")).toBeInTheDocument();
    expect(screen.getByText("Beneteau 40")).toBeInTheDocument();
  });

  it("displays formatted price", () => {
    const data = [createListing({ priceUSD: 85000 })];
    render(<ResultsTable data={data} {...defaultProps} />);

    expect(screen.getByText("$85,000")).toBeInTheDocument();
  });

  it("displays formatted length", () => {
    const data = [createListing({ lengthInMeters: 12.8 })];
    render(<ResultsTable data={data} {...defaultProps} />);

    expect(screen.getByText("42.0 ft")).toBeInTheDocument();
  });

  it("shows column headers", () => {
    render(<ResultsTable data={[]} {...defaultProps} />);

    expect(screen.getByText("Listing")).toBeInTheDocument();
    expect(screen.getByText("Manufacturer")).toBeInTheDocument();
    expect(screen.getByText("Year")).toBeInTheDocument();
    expect(screen.getByText("Price")).toBeInTheDocument();
  });

  it("shows empty state message when no data", () => {
    render(<ResultsTable data={[]} {...defaultProps} />);
    expect(screen.getByText("No listings match your filters.")).toBeInTheDocument();
  });

  it("expands row on click", async () => {
    const user = userEvent.setup();
    const listing = createListing({
      listingName: "Catalina 42",
      sellerName: "Bay Marine",
    });

    render(<ResultsTable data={[listing]} {...defaultProps} />);

    // Click the row to expand it
    const row = screen.getByText("Catalina 42").closest("tr");
    if (row) await user.click(row);

    // ListingDetail should now be visible with seller info
    expect(screen.getByText("Bay Marine")).toBeInTheDocument();
  });

  it("shows indicator icons for favorite listing", () => {
    const data = [createListing({ favorite: true })];
    render(<ResultsTable data={data} {...defaultProps} />);

    // The star indicator should be present (yellow color)
    const indicators = document.querySelectorAll('[class*="text-yellow"]');
    expect(indicators.length).toBeGreaterThan(0);
  });

  it("shows indicator icons for thumbs up listing", () => {
    const data = [createListing({ thumbs: "up" })];
    render(<ResultsTable data={data} {...defaultProps} />);

    const indicators = document.querySelectorAll('[class*="text-green"]');
    expect(indicators.length).toBeGreaterThan(0);
  });

  it("shows indicator icons for thumbs down listing", () => {
    const data = [createListing({ thumbs: "down" })];
    render(<ResultsTable data={data} {...defaultProps} />);

    const indicators = document.querySelectorAll('[class*="text-red"]');
    expect(indicators.length).toBeGreaterThan(0);
  });
});
