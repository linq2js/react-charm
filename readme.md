# react-charm

## Counter App

```jsx harmony
import React from "react";
import { render } from "react-dom";
import { useStates, setState, dispatch } from "react-charm";

setState({ counter: 0 });

// create named action
const increase = ({ state }) => state.counter++;

const App = () => {
  // useCharm retrieves state selector list
  // then return array of [stateValue1, stateValue2, ...]
  const [counter] = useStates(state => state.counter);

  function handleClick() {
    dispatch(increase);
  }

  return (
    <>
      <h1>{counter}</h1>
      <button onClick={handleClick}>Increase</button>
    </>
  );
};

render(<App />, document.getElementById("root"));
```

## Ajax Data Loading

```jsx harmony
import React from "react";
import { render } from "react-dom";
import { useStates, dispatch } from "react-charm";

const fetchEffect = ({ action }, url, onSuccess, onFailure) => {
  fetch(url)
    .then(res => res.json())
    .then(payload => {
      payload.message
        ? action(onFailure, payload.message)
        : action(onSuccess, payload);
    });
};

const loadDataSuccessAction = ({ state }, payload) => {
  state.loading = false;
  state.data = payload;
};

const loadDataFailureAction = ({ state }, error) => {
  state.loading = false;
  state.error = error;
};

const loadDataAction = ({ state, effect }, url) => {
  state.loading = true;
  delete state.error;
  delete state.data;
  effect(fetchEffect, url, loadDataSuccessAction, loadDataFailureAction);
};

const validUrl = "https://api.myjson.com/bins/vrtvf";
const invalidUrl = "https://api.myjson.com/bins/invalid";

const App = () => {
  const [data, error, loading] = useStates("data", "error", "loading");

  function handleClickSuccess() {
    dispatch(loadDataAction, validUrl);
  }

  function handleClickFailure() {
    dispatch(loadDataAction, invalidUrl);
  }

  return (
    <>
      {!loading && (
        <>
          <button onClick={handleClickSuccess}>Load Data Success</button>{" "}
          <button onClick={handleClickFailure}>Load Data Failure</button>
        </>
      )}
      <pre>
        {typeof loading === "boolean" ? (
          loading ? (
            "Loading..."
          ) : error ? (
            <span style={{ color: "red" }}>{error}</span>
          ) : (
            JSON.stringify(data, null, 2)
          )
        ) : (
          ""
        )}
      </pre>
    </>
  );
};

render(<App />, document.getElementById("root"));
```
