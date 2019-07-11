export function diff(a, b) {
  if (a === b) {
    return {
      changed: "equal",
      value: a
    };
  }

  const value = {};
  let equal = true;

  Object.keys(a).forEach(key => {
    if (key in b) {
      if (a[key] === b[key]) {
        value[key] = {
          changed: "equal",
          value: a[key]
        };
      } else {
        const typeA = typeof a[key];
        const typeB = typeof b[key];
        if (
          a[key] &&
          b[key] &&
          (typeA === "object" || typeA === "function") &&
          (typeB === "object" || typeB === "function")
        ) {
          const valueDiff = diff(a[key], b[key]);
          if (valueDiff.changed === "equal") {
            value[key] = {
              changed: "equal",
              value: a[key]
            };
          } else {
            equal = false;
            value[key] = valueDiff;
          }
        } else {
          equal = false;
          value[key] = {
            changed: "primitive change",
            removed: a[key],
            added: b[key]
          };
        }
      }
    } else {
      equal = false;
      value[key] = {
        changed: "removed",
        value: a[key]
      };
    }
  });

  Object.keys(b).forEach(key => {
    if (!(key in a)) {
      equal = false;
      value[key] = {
        changed: "added",
        value: b[key]
      };
    }
  });

  if (equal) {
    return {
      changed: "equal",
      value: a
    };
  }
  return {
    changed: "object change",
    value
  };
}

export function getConsoleLogArgs(changes) {
  let text = "";
  const styles = [];
  const render = (obj, level) => {
    const toString = o => {
      try {
        return JSON.stringify(o, null, 2);
      } catch (e) {
        return `Error: ${e.message}`;
      }
    };
    const indent = t => {
      return `%c${t
        .replace(/\r/g, "")
        .split("\n")
        .map(i => {
          let ni = i;
          for (let l = 0; l <= level; l += 1) {
            ni = `  ${ni} `;
          }
          return ni;
        })
        .join("\n")}\n`;
    };
    if (obj.changed === "equal") {
      // text += indent(`${toString(obj.value)}`);
      // styles.push(`color:black;`);
      return;
    }
    Object.keys(obj.value).forEach(key => {
      const cur = obj.value[key];
      switch (cur.changed) {
        case "equal":
          // text += indent(`"${key}": ${toString(cur.value)}`);
          // styles.push(`color:black;`);
          break;

        case "removed":
          text += indent(`"${key}": ${toString(cur.value)}`);
          styles.push(`color:red;`);
          break;

        case "added":
          text += indent(`"${key}": ${toString(cur.value)}`);
          styles.push(`color:green;`);
          break;

        case "primitive change":
          text += indent(`"${key}": ${toString(cur.removed)}`);
          styles.push(`color:red;`);
          text += indent(`"${key}": ${toString(cur.added)}`);
          styles.push(`color:green;`);
          break;

        case "object change":
          text += indent(`"${key}": {`);
          styles.push(`color:black;`);
          render(cur, level + 1);
          text += indent(`}`);
          styles.push(`color:black;`);
          break;

        default:
          break;
      }
    });
  };
  render(changes, 0);
  styles.push(`color: black`);
  return [`${"{\n"}${text}%c}`, ...styles];
}

export function log(a, b) {
  const changes = diff(a, b);
  console.log(...getConsoleLogArgs(changes));
}
