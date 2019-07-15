import { dispatch, getState } from "react-charm";
import fetch from "node-fetch";

test("should call onSuccess action", async () => {
  const onSuccess = jest.fn();
  const onFailure = jest.fn();
  const action = ({ effect }, url) =>
    effect.async(fetch(url), onSuccess, onFailure);

  await dispatch(action, "https://api.myjson.com/bins/vrtvf");

  expect(onSuccess.mock.calls.length).toBe(1);
  expect(onFailure.mock.calls.length).toBe(0);
});

test("should call onFailure action", async () => {
  const onSuccess = jest.fn();
  const onFailure = jest.fn();
  const action = ({ effect }, url) =>
    effect.async(fetch(url), onSuccess, onFailure);

  await dispatch(action, "https://");

  expect(onSuccess.mock.calls.length).toBe(0);
  expect(onFailure.mock.calls.length).toBe(1);
});

test("should update state prop", async () => {
  const action = ({ effect }, url) =>
    effect.async(fetch(url).then(res => res.json()), "data");

  const promise = dispatch(action, "https://api.myjson.com/bins/vrtvf");

  expect(getState().data.status).toBe("loading");

  await promise;

  expect(getState().data.status).toBe("success");
  expect(getState().data.payload).toEqual([
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
