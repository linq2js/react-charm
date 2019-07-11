import { log } from "diff-log";
import { setState, dispatch, on, getState, subscribe } from "react-charm";

test("All 'on' overloads should work properly", () => {
  setState({
    counter1: 0,
    counter2: 0,
    counter3: 0,
    counter4: 0,
    counter5: 0
  });

  const increase = ({ state }) => state.counter1++;
  const decrease = ({ state }) => state.counter1--;

  on(increase, ({ state }) => (state.counter2 = state.counter1));

  on([
    [increase, ({ state }) => (state.counter3 = state.counter1)],
    [decrease, ({ state }) => (state.counter4 = state.counter1)]
  ]);

  on([increase, decrease], ({ state }) => {
    state.counter5 = state.counter1;
  });

  subscribe((currentState, modifier, prevState) => {
    log(prevState, currentState);
  });

  dispatch(increase);

  expect(getState()).toEqual({
    // counter1 is increased
    counter1: 1,
    // counter2 copies value from counter1 on increase
    counter2: 1,
    // counter3 copies value form counter1 on increase
    counter3: 1,
    // counter4 is not affected
    counter4: 0,
    // counter5 always copies value from counter1
    counter5: 1
  });

  dispatch(decrease);

  expect(getState()).toEqual({
    // counter1 is decreased
    counter1: 0,
    // counter2 is not affected
    counter2: 1,
    // counter3 is not affected
    counter3: 1,
    // counter4 copies value from counter1
    counter4: 0,
    // counter5 always copies value from counter1
    counter5: 0
  });
});
