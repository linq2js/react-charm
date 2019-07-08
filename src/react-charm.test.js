import { getState, setState, subscribe, dispatch } from "react-charm";

test("Should update state properly", () => {
  setState({ counter: 0 });
  const increase = ({ state }) => {
    state.counter++;
  };

  dispatch(increase);
  dispatch(increase);

  expect(getState().counter).toBe(2);
});

test("Should call another action properly", () => {
  setState({ counter: 0 });
  const decrease = ({ state }, step = 1) => (state.counter -= step);
  const update = ({ state, action }) => {
    state.counter += 10;
    action(decrease);
    action(decrease, 2);
  };

  dispatch(update);

  expect(getState().counter).toBe(7);
});

test("Should call effect properly", () => {
  const callback = jest.fn();
  const fetch = () => callback();
  const startFetching = ({ effect }) => {
    effect(fetch);
  };

  dispatch(startFetching); // call once
  dispatch(startFetching); // call twice

  expect(callback.mock.calls.length).toBe(2);
});

test("Should call another effect properly", () =>
  new Promise(resolve => {
    setState({});
    // create an effect to emulate pending
    const delayIn = async (context, interval) =>
      new Promise(resolve => setTimeout(resolve, interval));
    const fetch = async ({ effect, action }, onSuccess) => {
      await effect(delayIn, 200);
      action(onSuccess, "article-list");
    };
    // create an action to handle fetched data
    const onFetchSuccess = ({ state }, payload) => (state.payload = payload);
    const startFetchingAction = ({ effect }) => {
      effect(fetch, onFetchSuccess);
    };

    dispatch(startFetchingAction);

    subscribe(state => {
      expect(state.payload).toBe("article-list");
      resolve();
    });
  }));
