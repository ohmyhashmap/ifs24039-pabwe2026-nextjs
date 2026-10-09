import { describe, expect, it, vi } from "vitest";
import RootLayout from "@/app/layout";
import DashboardLayout from "@/app/(dashboard)/layout";
import AuthLayout from "@/app/auth/layout";
import { render, screen } from "@testing-library/react";

vi.mock("next/font/google", () => ({
  Inter: () => ({ className: "font-inter" }),
}));

vi.mock("@/components/Providers", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/AuthGuard", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="auth-guard">{children}</div>,
}));

vi.mock("@/components/Navbar", () => ({
  default: () => <nav>Navigation</nav>,
}));

describe("application layouts", () => {
  it("renders the root document with metadata language and providers", () => {
    const root = RootLayout({ children: <p>Root content</p> });
    const body = root.props.children;
    const provider = body.props.children;

    expect(root.type).toBe("html");
    expect(root.props.lang).toBe("id");
    expect(body.type).toBe("body");
    expect(body.props.className).toBe("font-inter");
    expect(provider.props.children.props.children).toBe("Root content");
  });

  it("wraps dashboard content with auth guard and navbar", () => {
    render(<DashboardLayout><p>Dashboard content</p></DashboardLayout>);

    expect(screen.getByTestId("auth-guard")).toContainElement(screen.getByText("Dashboard content"));
    expect(screen.getByRole("navigation")).toHaveTextContent("Navigation");
    expect(screen.getByRole("main")).toContainElement(screen.getByText("Dashboard content"));
  });

  it("renders auth content in a centered main region", () => {
    render(<AuthLayout><p>Sign in here</p></AuthLayout>);

    expect(screen.getByRole("main")).toContainElement(screen.getByText("Sign in here"));
    expect(screen.getByText("Sign in here").parentElement).toHaveClass("max-w-md");
  });
});
