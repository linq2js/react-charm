import React, { useState } from "react";
import { getState, setState, withDispatch } from "react-charm";
import { cleanup, render, fireEvent } from "@testing-library/react";

afterEach(cleanup);

test("should dispatch action when component mounted", async () => {
  setState({
    counter1: 1,
    counter2: 1
  });
  const increase1 = ({ state }) => (state.counter1 += 1);
  const increase2 = ({ state }) => (state.counter2 += 2);
  const Comp = withDispatch([increase1, increase2])(() => "");

  await render(<Comp />);

  expect(getState()).toEqual({
    counter1: 2,
    counter2: 3
  });
});

test("should dispatch multiple times", async () => {
  const increase = jest.fn();

  const Comp = withDispatch({
    many: increase
  })(() => "");

  const ParentComp = () => {
    const [, setValue] = useState();

    function handleClick() {
      setValue({});
    }

    return (
      <>
        <button data-testid="rerender" onClick={handleClick} />
        <Comp />
      </>
    );
  };

  const { getByTestId } = await render(<ParentComp />);
  const button = getByTestId("rerender");

  fireEvent.click(button);
  fireEvent.click(button);

  expect(increase.mock.calls.length).toBe(3);
});

test("should dispatch only input arguments changed", async () => {
  const increase = jest.fn();

  const Comp = withDispatch({
    many: [
      [
        increase,
        // extract isTrue from props and dispatch only if isTrue prop changed
        props => [props.isTrue]
      ]
    ]
  })(() => "");

  const ParentComp = () => {
    const [value, setValue] = useState(0);

    function handleClick() {
      setValue(value + 1);
    }

    return (
      <>
        <button data-testid="rerender" onClick={handleClick} />
        <Comp isTrue value={value} />
      </>
    );
  };

  const { getByTestId } = await render(<ParentComp />);
  const button = getByTestId("rerender");

  fireEvent.click(button);
  fireEvent.click(button);
  fireEvent.click(button);
  fireEvent.click(button);

  expect(increase.mock.calls.length).toBe(1);
});
