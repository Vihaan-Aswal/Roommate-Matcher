import { screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import { renderWithProviders } from "../renderWithProviders";
import { useRunRoomsQuery } from "../../hooks/useRunRoomsQuery";

const { getRunRoomsMock } = vi.hoisted(() => ({
  getRunRoomsMock: vi.fn(),
}));

vi.mock("../../lib/apiClient", () => ({
  getRunRooms: getRunRoomsMock,
}));

function Probe({
  runId,
  segmentKey,
}: {
  runId: string;
  segmentKey: string | null;
}) {
  const query = useRunRoomsQuery(runId, segmentKey);

  if (!segmentKey) {
    return <p>segment-missing</p>;
  }

  if (query.isLoading) {
    return <p>loading</p>;
  }

  if (query.isError) {
    return <p>error</p>;
  }

  if (query.data) {
    return <p>success:{query.data.rooms.length}</p>;
  }

  return <p>idle</p>;
}

describe("useRunRoomsQuery", () => {
  beforeEach(() => {
    getRunRoomsMock.mockReset();
  });

  it("does not fetch when segment is missing", () => {
    renderWithProviders(<Probe runId="run-1" segmentKey={null} />);

    expect(screen.getByText("segment-missing")).toBeInTheDocument();
    expect(getRunRoomsMock).not.toHaveBeenCalled();
  });

  it("surfaces loading and error state", async () => {
    getRunRoomsMock.mockRejectedValueOnce(new Error("rooms failed"));

    renderWithProviders(<Probe runId="run-1" segmentKey="SEG_A" />);

    expect(screen.getByText("loading")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("error")).toBeInTheDocument();
    });
  });
});
