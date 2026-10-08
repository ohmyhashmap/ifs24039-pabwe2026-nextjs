import { fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { store } from "@/store";
import { setUsers, User } from "@/features/users/states/userSlice";

function ReduxHookHarness() {
  const dispatch = useAppDispatch();
  const users = useAppSelector((state) => state.users.users);

  return (
    <>
      <output>{users.length}</output>
      <button onClick={() => dispatch(setUsers([
        { id: 4, name: "Test", email: "test@example.test" } satisfies User,
      ]))}>Add user</button>
    </>
  );
}

describe("typed Redux hooks", () => {
  it("selects state and dispatches typed actions through the store", () => {
    render(<Provider store={store}><ReduxHookHarness /></Provider>);
    expect(screen.getByRole("status")).toHaveTextContent("0");
    fireEvent.click(screen.getByRole("button", { name: "Add user" }));
    expect(screen.getByRole("status")).toHaveTextContent("1");
  });
});
