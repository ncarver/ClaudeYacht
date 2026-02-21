import { render, screen, userEvent, waitFor } from "@/test/render";
import { ResultsSearch } from "./results-search";

describe("ResultsSearch", () => {
  it("renders input with placeholder", () => {
    render(<ResultsSearch value="" onChange={() => {}} />);
    expect(screen.getByPlaceholderText("Search listings...")).toBeInTheDocument();
  });

  it("displays the current value", () => {
    render(<ResultsSearch value="catalina" onChange={() => {}} />);
    expect(screen.getByDisplayValue("catalina")).toBeInTheDocument();
  });

  it("calls onChange after typing", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ResultsSearch value="" onChange={onChange} />);

    const input = screen.getByPlaceholderText("Search listings...");
    await user.type(input, "cat");

    // Wait for debounce to fire
    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
    }, { timeout: 1000 });
  });

  it("syncs when external value changes", () => {
    const { rerender } = render(<ResultsSearch value="old" onChange={() => {}} />);
    expect(screen.getByDisplayValue("old")).toBeInTheDocument();

    rerender(<ResultsSearch value="new" onChange={() => {}} />);
    expect(screen.getByDisplayValue("new")).toBeInTheDocument();
  });
});
