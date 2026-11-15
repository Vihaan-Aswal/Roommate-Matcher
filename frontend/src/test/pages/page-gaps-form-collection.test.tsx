import { fireEvent, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import { AdminFormCollection } from "../../pages/AdminFormCollection";
import { renderWithProviders } from "../renderWithProviders";

const {
  useAdminFormStatusQueryMock,
  useAdminNonSubmittersQueryMock,
  useWorkspaceFormLinkQueryMock,
  useRegenerateFormLinkMutationMock,
} = vi.hoisted(() => ({
  useAdminFormStatusQueryMock: vi.fn(),
  useAdminNonSubmittersQueryMock: vi.fn(),
  useWorkspaceFormLinkQueryMock: vi.fn(),
  useRegenerateFormLinkMutationMock: vi.fn(),
}));

vi.mock("../../hooks/useAdminFormCollection", () => ({
  useAdminFormStatusQuery: useAdminFormStatusQueryMock,
  useAdminNonSubmittersQuery: useAdminNonSubmittersQueryMock,
  useWorkspaceFormLinkQuery: useWorkspaceFormLinkQueryMock,
  useRegenerateFormLinkMutation: useRegenerateFormLinkMutationMock,
}));

const refetchLinkMock = vi.fn();
const refetchStatusMock = vi.fn();
const regenerateMock = vi.fn();
const writeTextMock = vi.fn();

const FORM_STATUS = {
  total_students: 30,
  valid_responses: 21,
  invalid_responses: 2,
  percentage_valid: 70,
  by_segment: [
    {
      segment_key: "M_1st_year_AC_2",
      total: 10,
      valid: 8,
      percentage: 80,
    },
  ],
};

function formStatusQuery(overrides: Record<string, unknown> = {}) {
  return {
    isLoading: false,
    isError: false,
    data: FORM_STATUS,
    error: null,
    refetch: refetchStatusMock,
    ...overrides,
  };
}

function nonSubmittersQuery(overrides: Record<string, unknown> = {}) {
  return {
    isLoading: false,
    isError: false,
    isSuccess: true,
    data: {
      non_submitters: [
        {
          admission_number: "ADM500",
          full_name: "No Submit",
          segment_key: "M_1st_year_AC_2",
        },
        {
          admission_number: "ADM501",
          full_name: "Still Thinking",
          segment_key: "M_1st_year_AC_2",
        },
      ],
      total_count: 2,
    },
    error: null,
    ...overrides,
  };
}

function formLinkQuery(overrides: Record<string, unknown> = {}) {
  return {
    isLoading: false,
    isError: false,
    data: { token: "abc-def", expires_at: "2026-06-01T00:00:00Z" },
    error: null,
    refetch: refetchLinkMock,
    ...overrides,
  };
}

describe("AdminFormCollection link and collection states", () => {
  beforeEach(() => {
    refetchLinkMock.mockReset();
    refetchStatusMock.mockReset();
    regenerateMock.mockReset();
    writeTextMock.mockReset();

    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { writeText: writeTextMock },
    });

    useAdminFormStatusQueryMock.mockReturnValue(formStatusQuery());
    useAdminNonSubmittersQueryMock.mockReturnValue(nonSubmittersQuery());
    useWorkspaceFormLinkQueryMock.mockReturnValue(formLinkQuery());
    useRegenerateFormLinkMutationMock.mockReturnValue({
      mutate: regenerateMock,
      isPending: false,
    });
  });

  it("shows a loading note for the link", () => {
    useWorkspaceFormLinkQueryMock.mockReturnValue(
      formLinkQuery({ isLoading: true, data: undefined }),
    );

    renderWithProviders(<AdminFormCollection />);

    expect(screen.getByText("Reading the link")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /regenerate link/i })).toBeDisabled();
  });

  it("reports an unavailable link and retries", () => {
    useWorkspaceFormLinkQueryMock.mockReturnValue(
      formLinkQuery({ isError: true, data: undefined, error: new Error("token service down") }),
    );

    renderWithProviders(<AdminFormCollection />);

    expect(screen.getByText("The link is unavailable")).toBeInTheDocument();
    expect(screen.getByText("token service down")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(refetchLinkMock).toHaveBeenCalledTimes(1);
  });

  it("composes the public link from the token and copies it", () => {
    renderWithProviders(<AdminFormCollection />);

    expect(screen.getByText(/\/f\/abc-def$/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /copy link/i }));

    expect(writeTextMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/f\/abc-def$/),
    );
    expect(screen.getByRole("button", { name: /copied/i })).toBeInTheDocument();
  });

  it("prefers the server-issued form url when the API returns one", () => {
    useWorkspaceFormLinkQueryMock.mockReturnValue(
      formLinkQuery({
        data: { form_url: "https://forms.example/f/full-url", token: "abc-def" },
      }),
    );

    renderWithProviders(<AdminFormCollection />);

    expect(screen.getByText("https://forms.example/f/full-url")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open form/i })).toHaveAttribute(
      "href",
      "https://forms.example/f/full-url",
    );
  });

  it("asks for confirmation before regenerating, then closes on success", () => {
    regenerateMock.mockImplementation((_vars, options) => {
      options?.onSuccess?.();
    });

    renderWithProviders(<AdminFormCollection />);

    fireEvent.click(screen.getByRole("button", { name: /regenerate link/i }));
    expect(
      screen.getByText(/Regenerating invalidates the link students already have/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /yes, regenerate the link/i }));

    expect(regenerateMock).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByText(/Regenerating invalidates the link students already have/i),
    ).not.toBeInTheDocument();
  });

  it("can abandon a regeneration", () => {
    renderWithProviders(<AdminFormCollection />);

    fireEvent.click(screen.getByRole("button", { name: /regenerate link/i }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(regenerateMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /regenerate link/i })).toBeInTheDocument();
  });

  it("disables the confirmation while regeneration is running", () => {
    useRegenerateFormLinkMutationMock.mockReturnValue({
      mutate: regenerateMock,
      isPending: true,
    });

    renderWithProviders(<AdminFormCollection />);

    fireEvent.click(screen.getByRole("button", { name: /regenerate link/i }));

    expect(screen.getByRole("button", { name: /regenerating/i })).toBeDisabled();
  });

  it("states that every student has answered when the chase list is empty", () => {
    useAdminNonSubmittersQueryMock.mockReturnValue(
      nonSubmittersQuery({
        data: { non_submitters: [], total_count: 0 },
      }),
    );

    renderWithProviders(<AdminFormCollection />);

    expect(screen.getByText("Every student has answered")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /export csv/i })).toBeDisabled();
  });

  it("exports the non-submitter list as CSV", async () => {
    const createObjectURL = vi.fn(() => "blob:chase-list");
    const revokeObjectURL = vi.fn();
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    const csvParts: string[] = [];
    class RecordingBlob extends Blob {
      constructor(parts: BlobPart[], options?: BlobPropertyBag) {
        super(parts, options);
        csvParts.push(String(parts[0]));
      }
    }
    vi.stubGlobal("Blob", RecordingBlob);

    renderWithProviders(<AdminFormCollection />);

    expect(screen.getByText("2 outstanding")).toBeInTheDocument();
    expect(screen.getByText("No Submit")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /export csv/i }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(csvParts[0]).toContain("admission_number,full_name,segment_key");
    expect(csvParts[0]).toContain("ADM500");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:chase-list");
    expect(clickSpy).toHaveBeenCalled();

    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it("reports an unavailable chase list", () => {
    useAdminNonSubmittersQueryMock.mockReturnValue(
      nonSubmittersQuery({
        isError: true,
        isSuccess: false,
        data: undefined,
        error: new Error("chase list failed"),
      }),
    );

    renderWithProviders(<AdminFormCollection />);

    expect(screen.getByText("The chase list is unavailable")).toBeInTheDocument();
    expect(screen.getByText("chase list failed")).toBeInTheDocument();
  });

  it("reports unavailable collection counts", () => {
    useAdminFormStatusQueryMock.mockReturnValue(
      formStatusQuery({ isError: true, data: undefined, error: new Error("status failed") }),
    );

    renderWithProviders(<AdminFormCollection />);

    expect(screen.getByText("Collection counts are unavailable")).toBeInTheDocument();
    expect(screen.getByText("status failed")).toBeInTheDocument();
  });

  it("shows a counting note while the collection status loads", () => {
    useAdminFormStatusQueryMock.mockReturnValue(
      formStatusQuery({ isLoading: true, data: undefined }),
    );

    renderWithProviders(<AdminFormCollection />);

    expect(screen.getByText("Counting responses")).toBeInTheDocument();
  });

  it("formats whole and fractional completion percentages", () => {
    const { unmount } = renderWithProviders(<AdminFormCollection />);

    expect(screen.getByText("70%")).toBeInTheDocument();
    expect(screen.getByText("9", { selector: ".desk-figure-value" })).toBeInTheDocument();

    unmount();

    useAdminFormStatusQueryMock.mockReturnValue(
      formStatusQuery({ data: { ...FORM_STATUS, percentage_valid: 70.5 } }),
    );

    renderWithProviders(<AdminFormCollection />);

    expect(screen.getByText("70.5%")).toBeInTheDocument();
  });

  it("treats an unparseable link expiry as text without breaking the page", async () => {
    useWorkspaceFormLinkQueryMock.mockReturnValue(
      formLinkQuery({ data: { token: "abc-def", expires_at: "sometime-soon" } }),
    );

    renderWithProviders(<AdminFormCollection />);

    expect(screen.getByText(/\/f\/abc-def$/)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText("Completion by Segment")).toBeInTheDocument(),
    );
  });
});
