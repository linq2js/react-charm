import {
  compose,
  withActions,
  getState,
  setState,
  withStates
} from "react-charm";
import React from "react";
import { render, fireEvent, cleanup } from "@testing-library/react";
import "test-utils";

afterEach(cleanup);

test("should pass mapped action to target component and component props can be retrieved from action context", () => {
  setState({
    counter: 1
  });

  const Comp = withActions({
    increase({ state, props }) {
      state.counter += props.step;
    }
  })(({ increase }) => {
    return <button onClick={increase} data-testid="button" />;
  });
  const { getByTestId } = render(<Comp step={4} />);

  fireEvent.click(getByTestId("button"));

  expect(getState().counter).toBe(5);
});

test("withActions and withStates work together properly", () => {
  setState({
    counter: 1
  });

  const Comp = compose(
    withStates({
      counter: true
    }),
    withActions({
      increase({ state, props: { counter, step } }) {
        state.counter = counter + step;
      }
    })
  )(({ counter, increase }) => {
    return (
      <button onClick={increase} data-testid="button">
        {counter}
      </button>
    );
  });
  const { getByTestId } = render(<Comp step={4} />);
  const button = getByTestId("button");

  fireEvent.click(button);
  expect(button.innerHTML).toBe("5");
  expect(getState().counter).toBe(5);
});
