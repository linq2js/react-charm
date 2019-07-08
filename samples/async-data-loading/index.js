import React from "react";
import { useStates, dispatch } from "react-charm";
import fetch from "node-fetch";

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

export default () => {
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
      {typeof loading === "boolean" ? (
        loading ? (
          <div data-testid="loading">Loading...</div>
        ) : error ? (
          <div data-testid="error" style={{ color: "red" }}>
            {error}
          </div>
        ) : (
          <div data-testid="result">
            <pre>{JSON.stringify(data, null, 2)}</pre>
          </div>
        )
      ) : (
        ""
      )}
    </>
  );
};
