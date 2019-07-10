import { initState, withStates } from "react-charm";
import React from "react";
import { render, cleanup } from "@testing-library/react";
import "test-utils";

afterEach(cleanup);

test("should retrieve multiple state values", () => {
  initState({
    s1: 1,
    s2: 2,
    s3: 3
  });

  const values = [];
  const Comp = withStates({
    s1: true,
    s2: true,
    s3: state => state.s3,
    s4: (state, props) => state.s2 * props.step
  })(({ s1, s2, s3, s4 }) => {
    values.push(s1, s2, s3, s4);
    return null;
  });
  render(<Comp step={4} />);

  expect(values).toEqual([1, 2, 3, 8]);
});
