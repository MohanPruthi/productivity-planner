import React, { useState } from 'react';

// Shows /illustrations/<name>.png when it exists; otherwise renders the fallback
// (the original icon), so missing artwork never leaves a broken image.
const Illustration = ({ name, size = 140, children = null }) => {
  const [failed, setFailed] = useState(false);

  if (failed) return children;

  return (
    <img
      src={`/illustrations/${name}.png`}
      alt=""
      width={size}
      height={size}
      style={{ objectFit: 'contain', userSelect: 'none' }}
      draggable="false"
      onError={() => setFailed(true)}
    />
  );
};

export default Illustration;
