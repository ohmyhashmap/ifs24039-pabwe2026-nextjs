import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import Modal from "@/components/ui/Modal";
import Toast from "@/components/ui/Toast";
import { useFormInput } from "@/hooks/useFormInput";

function FormInputHarness() {
  const { values, handleChange, reset, setValues } = useFormInput({ name: "", bio: "" });
  return (
    <>
      <input name="name" value={values.name} onChange={handleChange} aria-label="name" />
      <textarea name="bio" value={values.bio} onChange={handleChange} aria-label="bio" />
      <button onClick={() => setValues({ name: "updated", bio: "set" })}>Set values</button>
      <button onClick={reset}>Reset</button>
      <output>{values.name}:{values.bio}</output>
    </>
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe("UI primitives and form input hook", () => {
  it("renders the requested number of loading placeholders", () => {
    const { container } = render(<LoadingSkeleton count={2} />);
    expect(screen.getByText("Memuat konten...")).toBeInTheDocument();
    expect(container.querySelectorAll("[aria-hidden='true']")).toHaveLength(2);
  });

  it("only renders the modal when open and closes it by button or Escape", () => {
    const onClose = vi.fn();
    const { rerender } = render(<Modal isOpen={false} onClose={onClose} title="Dialog">Body</Modal>);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    rerender(<Modal isOpen onClose={onClose} title="Dialog">Body</Modal>);
    expect(screen.getByRole("dialog")).toHaveTextContent("Body");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Tutup dialog" }));
    expect(onClose).toHaveBeenCalledTimes(2);

    rerender(<Modal isOpen={false} onClose={onClose} title="Dialog">Body</Modal>);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows toast variants and closes the toast after three seconds", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const { rerender } = render(<Toast message={null} onClose={onClose} />);
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();

    rerender(<Toast message="Saved" onClose={onClose} />);
    expect(screen.getByText("Saved")).toHaveClass("bg-green-600");
    act(() => vi.advanceTimersByTime(3000));
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(<Toast message="Failed" type="error" onClose={onClose} />);
    expect(screen.getByText("Failed")).toHaveClass("bg-red-600");
  });

  it("updates named fields, supports direct updates, and resets to initial values", () => {
    render(<FormInputHarness />);
    fireEvent.change(screen.getByRole("textbox", { name: "name" }), { target: { value: "Ari" } });
    fireEvent.change(screen.getByRole("textbox", { name: "bio" }), { target: { value: "Writer" } });
    expect(screen.getByRole("status")).toHaveTextContent("Ari:Writer");

    fireEvent.click(screen.getByRole("button", { name: "Set values" }));
    expect(screen.getByRole("status")).toHaveTextContent("updated:set");
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByRole("status")).toHaveTextContent(":");
  });
});
