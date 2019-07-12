import { getState } from "react-charm";
import React from "react";
import { render, fireEvent, cleanup, wait, act } from "@testing-library/react";
import "test-utils";

afterEach(cleanup);

test("should load data properly", async () => {
  const Comp = await import("./index");
  const { getByText, getByTestId } = render(<Comp.default />);
  const button = getByText(/Load Data Success/i);
  act(() => {
    fireEvent.click(button);
  });
  await wait(() => getByTestId("result"));
  expect(getState().data).toEqual([
    {
      text: "Todo 1",
      done: false
    },
    {
      text: "Todo 2",
      done: true
    },
    {
      text: "Todo 3",
      done: false
    }
  ]);
});

test("should receive error message", async () => {
  const Comp = await import("./index");
  const { getByText, getByTestId } = render(<Comp.default />);
  const button = getByText(/Load Data Failure/i);
  act(() => {
    fireEvent.click(button);
  });
  await wait(() => getByTestId("error"));
  expect(getState().error).toBe("Internal Server Error");
});
