const times = 1000000;

function plainObjectTest() {
  let id = 1;
  const set = {};
  const start = new Date().getTime();
  for (let i = 0; i < times; i++) {
    const f = () => {};
    if (!f.__id) {
      f.__id = ++id;
    }
    set[f.__id] = f;
    delete set[f.__id];
  }

  return new Date().getTime() - start;
}

function setTest() {
  const set = new Set();
  const start = new Date().getTime();
  for (let i = 0; i < times; i++) {
    const f = () => {};
    set.add(f);
    set.delete(f);
  }

  return new Date().getTime() - start;
}

test("compare performance of plain object and WeakSet", () => {
  console.log("object", plainObjectTest());
  console.log("set", setTest());
});
