import { getState, setState, watch } from "react-charm";

test("watcher should work properly", () => {
  watch(
    state => state.counter,
    ({ state }) => {
      state.counter++;
    }
  );

  setState({
    counter: 1
  });

  expect(getState()).toEqual({
    counter: 2
  });
});
