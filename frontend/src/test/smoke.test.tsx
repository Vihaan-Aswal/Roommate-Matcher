import { render, screen } from "@testing-library/react";

import App from "../App";

describe("App shell", () => {
  it("renders the admin shell", () => {
    render(<App />);

    expect(screen.getByText("Roommate Matcher")).toBeInTheDocument();
  });
});
