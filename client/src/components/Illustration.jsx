import React, { useState } from 'react';

// Shows /illustrations/<name>.png if one has been added, else the bundled <name>.svg,
// else the fallback (the original icon), so missing artwork never leaves a broken image.
const SOURCES = ['png', 'svg'];

const Illustration = ({ name, size = 140, children = null }) => {
  const [attempt, setAttempt] = useState(0);

  if (attempt >= SOURCES.length) return children;

  return (
    <img
      src={`/illustrations/${name}.${SOURCES[attempt]}`}
      alt=""
      width={size}
      height={size}
      style={{ objectFit: 'contain', userSelect: 'none' }}
      draggable="false"
      onError={() => setAttempt(a => a + 1)}
    />
  );
};

export default Illustration;
