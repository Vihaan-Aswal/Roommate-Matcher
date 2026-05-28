import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import App from "../App";

import { AuthProvider } from "../providers/AuthProvider";

describe("App shell", () => {
  it("renders the admin shell", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>,
    );

    expect(screen.getByText("Roommate Matcher")).toBeInTheDocument();
  });
});
