import { getState } from "react-charm";
import React from "react";
import { render, fireEvent, cleanup } from "@testing-library/react";

afterEach(cleanup);

test("counter value should increased after button clicking", async () => {
  const Comp = await import("./index");
  const { getByText } = render(<Comp.default />);
  const button = getByText(/Increase/i);
  fireEvent.click(button);
  fireEvent.click(button);
  expect(getState().counter).toBe(2);
});
