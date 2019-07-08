import React from "react";
import { useStates, setState, dispatch } from "react-charm";

setState({ counter: 0 });

// create named action
const increase = ({ state }) => state.counter++;

export default () => {
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
